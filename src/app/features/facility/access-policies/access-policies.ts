import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AccessPolicyService,
  SystemDto,
  RuleSetSummary,
  SystemAgentType,
  EntityLink,
} from '../services/access-policy-service';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import type { PaginatorState } from 'primeng/paginator';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-facility-access-policies',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    RouterLink,
    ReactiveFormsModule,
    TagModule,
    ButtonModule,
    SelectModule,
    InputTextModule,
    PaginatorModule,
  ],
  templateUrl: './access-policies.html',
})
export class FacilityAccessPolicies implements OnInit {
  private service = inject(AccessPolicyService);
  private fb = inject(FormBuilder);

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly systems = signal<SystemDto[]>([]);
  readonly ruleSets = signal<RuleSetSummary[]>([]);
  readonly loading = signal(true);
  readonly ruleSetsLoading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Rule set pagination ───────────────────────────────────────────────────

  readonly ruleSetFirst = signal(0);
  readonly ruleSetPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly ruleSetTotalRecords = signal(0);
  readonly ruleSetPageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── Create system ─────────────────────────────────────────────────────────

  readonly createSystemOpen = signal(false);
  readonly createSystemSaving = signal(false);
  readonly createSystemError = signal<string | null>(null);
  readonly availableAgents = signal<EntityLink[]>([]);
  readonly agentsLoading = signal(false);

  readonly createSystemForm = this.fb.nonNullable.group({
    agent: this.fb.control<EntityLink | null>(null, Validators.required),
  });

  // ── Create rule set ───────────────────────────────────────────────────────

  readonly createRuleSetOpen = signal(false);
  readonly createRuleSetSaving = signal(false);
  readonly createRuleSetError = signal<string | null>(null);

  readonly createRuleSetForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    system: this.fb.control<EntityLink | null>(null, Validators.required),
  });

  // ── Delete system ─────────────────────────────────────────────────────────

  readonly deleteSystemConfirmingId = signal<string | null>(null);
  readonly deleteSystemInProgressId = signal<string | null>(null);
  readonly deleteSystemError = signal<string | null>(null);

  // ── Delete rule set ───────────────────────────────────────────────────────

  readonly deleteRuleSetConfirmingId = signal<string | null>(null);
  readonly deleteRuleSetInProgressId = signal<string | null>(null);
  readonly deleteRuleSetError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [systems, ruleSetsPage] = await Promise.all([
        this.service.getSystems(),
        this.service.getRuleSets({ page: 0, pageSize: this.ruleSetPageSize() }),
      ]);
      this.systems.set(systems);
      this.ruleSets.set(ruleSetsPage.items);
      this.ruleSetTotalRecords.set(ruleSetsPage.totalItems ?? ruleSetsPage.items.length);
    } catch {
      this.error.set('Failed to load access policies. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadRuleSets(firstOffset: number): Promise<void> {
    this.ruleSetsLoading.set(true);
    const size = this.ruleSetPageSize();
    const page = Math.floor(firstOffset / size);
    try {
      const result = await this.service.getRuleSets({ page, pageSize: size });
      this.ruleSets.set(result.items);
      this.ruleSetTotalRecords.set(result.totalItems ?? result.items.length);
    } catch {
      this.error.set('Failed to load rule sets. Please try again.');
    } finally {
      this.ruleSetsLoading.set(false);
    }
  }

  async onRuleSetPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    const newRows = event.rows ?? this.ruleSetPageSize();
    if (newRows !== this.ruleSetPageSize()) {
      this.ruleSetPageSize.set(newRows);
      this.ruleSetFirst.set(0);
      await this.loadRuleSets(0);
    } else {
      this.ruleSetFirst.set(newFirst);
      await this.loadRuleSets(newFirst);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  systemTypeLabel(type: SystemAgentType): string {
    return type === SystemAgentType.Lenel ? 'Lenel OnGuard' : 'UniPass';
  }

  systemTypeSeverity(type: SystemAgentType): 'info' | 'secondary' {
    return type === SystemAgentType.Lenel ? 'info' : 'secondary';
  }

  activeLabel(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  activeSeverity(isActive: boolean): 'success' | 'secondary' {
    return isActive ? 'success' : 'secondary';
  }

  ruleCount(ruleSetId: string): number {
    // RuleSetSummary doesn't carry rule count — surfaced as rule sets are loaded
    return 0;
  }

  systemOptions(): EntityLink[] {
    return this.systems().map(s => ({ id: s.id, name: s.name }));
  }

  // ── Create system ─────────────────────────────────────────────────────────

  async openCreateSystem(): Promise<void> {
    this.createSystemForm.reset();
    this.createSystemError.set(null);
    this.createSystemOpen.set(true);
    this.agentsLoading.set(true);
    try {
      const agents = await this.service.getAvailableAgents();
      this.availableAgents.set(agents);
    } catch {
      this.createSystemError.set('Failed to load available agents.');
    } finally {
      this.agentsLoading.set(false);
    }
  }

  closeCreateSystem(): void {
    this.createSystemOpen.set(false);
  }

  async saveCreateSystem(): Promise<void> {
    this.createSystemForm.markAllAsTouched();
    if (this.createSystemForm.invalid) return;
    this.createSystemSaving.set(true);
    this.createSystemError.set(null);
    try {
      const agent = this.createSystemForm.controls.agent.value!;
      const created = await this.service.createSystem({ agent });
      this.systems.update(list => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      this.createSystemOpen.set(false);
    } catch (err) {
      this.createSystemError.set(this.extractApiError(err));
    } finally {
      this.createSystemSaving.set(false);
    }
  }

  // ── Create rule set ───────────────────────────────────────────────────────

  openCreateRuleSet(): void {
    this.createRuleSetForm.reset();
    this.createRuleSetError.set(null);
    this.createRuleSetOpen.set(true);
  }

  closeCreateRuleSet(): void {
    this.createRuleSetOpen.set(false);
  }

  async saveCreateRuleSet(): Promise<void> {
    this.createRuleSetForm.markAllAsTouched();
    if (this.createRuleSetForm.invalid) return;
    this.createRuleSetSaving.set(true);
    this.createRuleSetError.set(null);
    try {
      const { name, system } = this.createRuleSetForm.controls;
      await this.service.createRuleSet({ name: name.value, system: system.value! });
      this.createRuleSetOpen.set(false);
      // Reload first page so the new item is visible
      this.ruleSetFirst.set(0);
      await this.loadRuleSets(0);
    } catch (err) {
      this.createRuleSetError.set(this.extractApiError(err));
    } finally {
      this.createRuleSetSaving.set(false);
    }
  }

  // ── Delete system ─────────────────────────────────────────────────────────

  confirmDeleteSystem(id: string): void {
    this.deleteSystemError.set(null);
    this.deleteSystemConfirmingId.set(id);
  }

  abortDeleteSystem(): void {
    this.deleteSystemConfirmingId.set(null);
  }

  async executeDeleteSystem(system: SystemDto): Promise<void> {
    this.deleteSystemInProgressId.set(system.id);
    this.deleteSystemError.set(null);
    try {
      await this.service.deleteSystem(system.id);
      this.systems.update(list => list.filter(s => s.id !== system.id));
      this.deleteSystemConfirmingId.set(null);
    } catch {
      this.deleteSystemError.set(`Failed to delete "${system.name}". Please try again.`);
    } finally {
      this.deleteSystemInProgressId.set(null);
    }
  }

  // ── Delete rule set ───────────────────────────────────────────────────────

  confirmDeleteRuleSet(id: string): void {
    this.deleteRuleSetError.set(null);
    this.deleteRuleSetConfirmingId.set(id);
  }

  abortDeleteRuleSet(): void {
    this.deleteRuleSetConfirmingId.set(null);
  }

  async executeDeleteRuleSet(ruleSet: RuleSetSummary): Promise<void> {
    this.deleteRuleSetInProgressId.set(ruleSet.id);
    this.deleteRuleSetError.set(null);
    try {
      await this.service.deleteRuleSet(ruleSet.id);
      this.ruleSets.update(list => list.filter(r => r.id !== ruleSet.id));
      this.deleteRuleSetConfirmingId.set(null);
    } catch {
      this.deleteRuleSetError.set(`Failed to delete "${ruleSet.name}". Please try again.`);
    } finally {
      this.deleteRuleSetInProgressId.set(null);
    }
  }

  // ── Error helper ──────────────────────────────────────────────────────────

  private extractApiError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error: unknown }).error;
      if (e && typeof e === 'object') {
        if ('detail' in e && typeof (e as { detail: unknown }).detail === 'string') {
          return (e as { detail: string }).detail;
        }
        if ('title' in e && typeof (e as { title: unknown }).title === 'string') {
          return (e as { title: string }).title;
        }
        if ('errors' in e) {
          const errs = (e as { errors: Record<string, string[]> }).errors;
          return Object.values(errs).flat().join(' ');
        }
      }
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
