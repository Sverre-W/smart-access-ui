import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormArray, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AccessPolicyService,
  SystemDto,
  UnipassSystemConfigurationDto,
  UnipassBadgeTypeDto,
  UnipassAccessAssignmentDto,
  UnipassMetaDataDto,
  IdentityDto,
  EntityLink,
} from '../services/access-policy-service';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-edit-system',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
  ],
  templateUrl: './edit-system.html',
})
export class EditSystem implements OnInit {
  private service = inject(AccessPolicyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // ── Page state ────────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly system = signal<SystemDto | null>(null);

  // ── Metadata ──────────────────────────────────────────────────────────────

  readonly metadata = signal<UnipassMetaDataDto | null>(null);
  readonly metadataError = signal<string | null>(null);

  // ── Configuration ─────────────────────────────────────────────────────────

  readonly configSaving = signal(false);
  readonly configSaveError = signal<string | null>(null);
  readonly configSaveSuccess = signal(false);

  // Badge types form array
  readonly badgeTypesForm = this.fb.array<FormGroup>([]);

  // Access assignments form array
  readonly accessAssignmentsForm = this.fb.array<FormGroup>([]);

  readonly configForm = this.fb.group({
    badgeTypes: this.badgeTypesForm,
    accessAssignments: this.accessAssignmentsForm,
  });

  // ── Identity mappings ─────────────────────────────────────────────────────

  readonly mappings = signal<IdentityDto[]>([]);
  readonly mappingsLoading = signal(false);
  readonly removeConfirmingId = signal<string | null>(null);
  readonly removeInProgressId = signal<string | null>(null);
  readonly removeError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('systemId')!;
    await this.load(id);
  }

  private async load(systemId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      // Load system + config in parallel; metadata is best-effort
      const [system, config, metaResult, mappings] = await Promise.all([
        this.service.getSystem(systemId),
        this.service.getSystemConfiguration(systemId),
        this.service.getSystemMetadata(systemId).then(m => ({ ok: true as const, value: m })).catch(() => ({ ok: false as const })),
        this.service.getSystemMappings(systemId),
      ]);

      this.system.set(system);
      this.mappings.set(mappings);

      if (metaResult.ok) {
        this.metadata.set(metaResult.value as UnipassMetaDataDto);
      } else {
        this.metadataError.set('Live metadata could not be loaded from the access control system. The system may be offline. You can still view and edit the configuration below.');
      }

      if (config.$type === 'UnipassSystemConfigurationDto') {
        this.buildConfigForm(config);
      }
    } catch {
      this.error.set('Failed to load system. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  // ── Config form helpers ───────────────────────────────────────────────────

  private buildConfigForm(config: UnipassSystemConfigurationDto): void {
    this.badgeTypesForm.clear();
    for (const bt of config.badgeTypes) {
      this.badgeTypesForm.push(this.makeBadgeTypeGroup(bt));
    }

    this.accessAssignmentsForm.clear();
    for (const aa of config.accessAssignments) {
      this.accessAssignmentsForm.push(this.makeAccessAssignmentGroup(aa));
    }
  }

  private makeBadgeTypeGroup(bt?: Partial<UnipassBadgeTypeDto>): FormGroup {
    return this.fb.group({
      id:           [bt?.id           ?? crypto.randomUUID()],
      name:         [bt?.name         ?? '', Validators.required],
      startOfRange: [bt?.startOfRange ?? null, [Validators.required, Validators.min(0)]],
      endOfRange:   [bt?.endOfRange   ?? null, [Validators.required, Validators.min(0)]],
    });
  }

  private makeAccessAssignmentGroup(aa?: Partial<UnipassAccessAssignmentDto>): FormGroup {
    return this.fb.group({
      id:                  [aa?.id                              ?? crypto.randomUUID()],
      name:                [aa?.name                           ?? '', Validators.required],
      canonicalAccessRule: [aa?.canonicalAccessRule            ?? null, Validators.required],
      canonicalSite:       [aa?.canonicalSite                  ?? null, Validators.required],
    });
  }

  get badgeTypeGroups(): FormGroup[] {
    return this.badgeTypesForm.controls as FormGroup[];
  }

  get accessAssignmentGroups(): FormGroup[] {
    return this.accessAssignmentsForm.controls as FormGroup[];
  }

  asGroup(control: import('@angular/forms').AbstractControl): FormGroup {
    return control as FormGroup;
  }

  addBadgeType(): void {
    this.badgeTypesForm.push(this.makeBadgeTypeGroup());
  }

  removeBadgeType(index: number): void {
    this.badgeTypesForm.removeAt(index);
  }

  addAccessAssignment(): void {
    this.accessAssignmentsForm.push(this.makeAccessAssignmentGroup());
  }

  removeAccessAssignment(index: number): void {
    this.accessAssignmentsForm.removeAt(index);
  }

  accessRuleOptions(): EntityLink[] {
    return this.metadata()?.canonicalAccessRules ?? [];
  }

  siteOptions(): EntityLink[] {
    return this.metadata()?.canonicalSites ?? [];
  }

  async saveConfig(): Promise<void> {
    this.configForm.markAllAsTouched();
    if (this.configForm.invalid) return;

    const systemId = this.system()!.id;
    this.configSaving.set(true);
    this.configSaveError.set(null);
    this.configSaveSuccess.set(false);

    const body: UnipassSystemConfigurationDto = {
      $type: 'UnipassSystemConfigurationDto',
      badgeTypes: this.badgeTypesForm.value as UnipassBadgeTypeDto[],
      accessAssignments: this.accessAssignmentsForm.value.map((aa: {
        id: string;
        name: string;
        canonicalAccessRule: EntityLink;
        canonicalSite: EntityLink;
      }) => ({
        id: aa.id,
        name: aa.name,
        canonicalAccessRule: aa.canonicalAccessRule,
        canonicalSite: aa.canonicalSite,
      })) as UnipassAccessAssignmentDto[],
    };

    try {
      await this.service.updateSystemConfiguration(systemId, body);
      this.configSaveSuccess.set(true);
      setTimeout(() => this.configSaveSuccess.set(false), 3000);
    } catch (err) {
      this.configSaveError.set(this.extractApiError(err) ?? 'Failed to save configuration. Please try again.');
    } finally {
      this.configSaving.set(false);
    }
  }

  // ── Identity mappings ─────────────────────────────────────────────────────

  confirmRemoveMapping(id: string): void {
    this.removeError.set(null);
    this.removeConfirmingId.set(id);
  }

  abortRemoveMapping(): void {
    this.removeConfirmingId.set(null);
  }

  async executeRemoveMapping(mapping: IdentityDto): Promise<void> {
    const systemId = this.system()!.id;
    this.removeInProgressId.set(mapping.id);
    this.removeError.set(null);
    try {
      await this.service.deleteSystemMapping(systemId, mapping);
      this.mappings.update(list => list.filter(m => m.id !== mapping.id));
      this.removeConfirmingId.set(null);
    } catch {
      this.removeError.set('Failed to remove mapping. Please try again.');
    } finally {
      this.removeInProgressId.set(null);
    }
  }

  displayName(mapping: IdentityDto): string {
    const full = [mapping.firstName, mapping.lastName].filter(Boolean).join(' ');
    return full || mapping.externalId;
  }

  // ── Error helper ──────────────────────────────────────────────────────────

  private extractApiError(err: unknown): string | null {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error?: { detail?: string; title?: string; errors?: Record<string, string[]> } }).error;
      if (e?.detail) return e.detail;
      if (e?.errors) return Object.values(e.errors).flat().join(' ');
      if (e?.title) return e.title;
    }
    return null;
  }
}
