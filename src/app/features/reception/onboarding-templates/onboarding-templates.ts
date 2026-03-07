import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { PermissionsService } from '../../../core/services/permissions-service';
import {
  OnboardingService,
  OnboardingTemplateDto,
} from '../services/onboarding-service';

@Component({
  selector: 'app-facility-onboarding-templates',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    TranslateModule,
    ButtonModule,
    InputTextModule,
    TagModule,
    TextareaModule,
  ],
  templateUrl: './onboarding-templates.html',
})
export class FacilityOnboardingTemplates implements OnInit {
  private service = inject(OnboardingService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  readonly canWrite = computed(() =>
    this.permissions.hasPermission('Onboarding Service', 'Onboarding:ManageTemplates')
  );

  // ── Data ────────────────────────────────────────────────────────────────────

  readonly templates = signal<OnboardingTemplateDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Create template ─────────────────────────────────────────────────────────

  readonly createOpen = signal(false);
  readonly createSaving = signal(false);
  readonly createError = signal<string | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  // ── Clone ───────────────────────────────────────────────────────────────────

  readonly cloningId = signal<string | null>(null);

  // ── Activate / Deactivate ───────────────────────────────────────────────────

  readonly togglingId = signal<string | null>(null);
  readonly toggleError = signal<string | null>(null);

  // ── Delete ──────────────────────────────────────────────────────────────────

  readonly deleteConfirmingId = signal<string | null>(null);
  readonly deleteInProgressId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const templates = await this.service.getAllTemplates();
      this.templates.set(templates);
    } catch {
      this.error.set(this.translate.instant('facility.onboardingTemplates.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  activeLabel(isActive: boolean): string {
    return isActive
      ? this.translate.instant('facility.onboardingTemplates.active')
      : this.translate.instant('facility.onboardingTemplates.inactive');
  }

  activeSeverity(isActive: boolean): 'success' | 'secondary' {
    return isActive ? 'success' : 'secondary';
  }

  phaseCount(template: OnboardingTemplateDto): number {
    return template.phases?.length ?? 0;
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset();
    this.createError.set(null);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  async saveCreate(): Promise<void> {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;
    this.createSaving.set(true);
    this.createError.set(null);
    try {
      const { name, description } = this.createForm.controls;
      await this.service.createTemplate({
        name: name.value,
        description: description.value || null,
      });
      this.createOpen.set(false);
      await this.load();
    } catch (err) {
      this.createError.set(this.extractApiError(err));
    } finally {
      this.createSaving.set(false);
    }
  }

  // ── Clone ────────────────────────────────────────────────────────────────────

  async clone(template: OnboardingTemplateDto): Promise<void> {
    this.cloningId.set(template.id);
    try {
      await this.service.cloneTemplate(template.id);
      await this.load();
    } catch {
      this.error.set(
        this.translate.instant('facility.onboardingTemplates.cloneError', { name: template.name }),
      );
    } finally {
      this.cloningId.set(null);
    }
  }

  // ── Activate / Deactivate ────────────────────────────────────────────────────

  async toggleActive(template: OnboardingTemplateDto): Promise<void> {
    this.togglingId.set(template.id);
    this.toggleError.set(null);
    try {
      if (template.isActive) {
        await this.service.deactivateTemplate(template.id);
      } else {
        await this.service.activateTemplate(template.id);
      }
      await this.load();
    } catch {
      const key = template.isActive
        ? 'facility.onboardingTemplates.deactivateError'
        : 'facility.onboardingTemplates.activateError';
      this.toggleError.set(this.translate.instant(key, { name: template.name }));
    } finally {
      this.togglingId.set(null);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  confirmDelete(id: string): void {
    this.deleteError.set(null);
    this.deleteConfirmingId.set(id);
  }

  abortDelete(): void {
    this.deleteConfirmingId.set(null);
  }

  async executeDelete(template: OnboardingTemplateDto): Promise<void> {
    this.deleteInProgressId.set(template.id);
    this.deleteError.set(null);
    try {
      await this.service.deleteTemplate(template.id);
      this.templates.update(list => list.filter(t => t.id !== template.id));
      this.deleteConfirmingId.set(null);
    } catch {
      this.deleteError.set(
        this.translate.instant('facility.onboardingTemplates.deleteError', { name: template.name }),
      );
    } finally {
      this.deleteInProgressId.set(null);
    }
  }

  // ── Error helper ─────────────────────────────────────────────────────────────

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
