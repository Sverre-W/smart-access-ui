import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { PermissionsService } from '../../../core/services/permissions-service';
import { SchemaForm } from '../../../shared/components/schema-form/schema-form';
import {
  OnboardingService,
  OnboardingTemplateDto,
  OnboardingPhaseDto,
  StepConfigurationDto,
  AvailableStepDto,
  PhaseType,
  TriggerType,
  StepTriggerEvent,
  OnboardingStepType,
  RetryStrategy,
  AddPhaseRequest,
  UpdatePhaseRequest,
  AddStepRequest,
} from '../services/onboarding-service';

// ── Phase type options ─────────────────────────────────────────────────────────

const PHASE_TYPE_OPTIONS: { label: string; value: PhaseType }[] = [
  { label: 'Pre-Visit', value: PhaseType.PreVisit },
  { label: 'Arrival', value: PhaseType.Arrival },
  { label: 'On-Site', value: PhaseType.OnSite },
  { label: 'Departure', value: PhaseType.Departure },
  { label: 'Post-Visit', value: PhaseType.PostVisit },
];

// ── Retry strategy options ─────────────────────────────────────────────────────

const RETRY_STRATEGY_OPTIONS: { label: string; value: RetryStrategy }[] = [
  { label: 'None', value: RetryStrategy.None },
  { label: 'Fixed Delay', value: RetryStrategy.FixedDelay },
  { label: 'Exponential Backoff', value: RetryStrategy.ExponentialBackoff },
];

// ── Trigger type options ───────────────────────────────────────────────────────

const TRIGGER_TYPE_OPTIONS: { label: string; value: TriggerType }[] = [
  { label: 'Manual', value: TriggerType.Manual },
  { label: 'Event', value: TriggerType.Event },
  { label: 'Time', value: TriggerType.Time },
  { label: 'Conditional', value: TriggerType.Conditional },
];

// ── Step trigger event labels ──────────────────────────────────────────────────

const TRIGGER_EVENT_LABELS: Record<StepTriggerEvent, string> = {
  [StepTriggerEvent.SessionCreated]: 'Session Created',
  [StepTriggerEvent.VisitorConfirmed]: 'Visitor Confirmed',
  [StepTriggerEvent.CheckInCompleted]: 'Check-In Completed',
  [StepTriggerEvent.CheckOutCompleted]: 'Check-Out Completed',
  [StepTriggerEvent.SessionCancelled]: 'Session Cancelled',
  [StepTriggerEvent.Manual]: 'Manual',
  [StepTriggerEvent.Scheduled]: 'Scheduled',
};

@Component({
  selector: 'app-onboarding-template-detail',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslateModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TagModule,
    TextareaModule,
    CheckboxModule,
    SchemaForm,
  ],
  templateUrl: './onboarding-template-detail.html',
})
export class OnboardingTemplateDetail implements OnInit {
  private service = inject(OnboardingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  readonly canWrite = computed(() =>
    this.permissions.hasPermission('Onboarding Service', 'Onboarding:ManageTemplates')
  );

  // ── Static options ────────────────────────────────────────────────────────

  readonly phaseTypeOptions = PHASE_TYPE_OPTIONS;
  readonly retryStrategyOptions = RETRY_STRATEGY_OPTIONS;
  readonly triggerTypeOptions = TRIGGER_TYPE_OPTIONS;

  // ── Page state ────────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly template = signal<OnboardingTemplateDto | null>(null);

  // ── Details form ──────────────────────────────────────────────────────────

  readonly detailsSaving = signal(false);
  readonly detailsSaveError = signal<string | null>(null);
  readonly detailsSaveSuccess = signal(false);

  readonly detailsForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  // ── Activate / Deactivate ─────────────────────────────────────────────────

  readonly toggling = signal(false);
  readonly toggleError = signal<string | null>(null);

  // ── Add phase ─────────────────────────────────────────────────────────────

  readonly addPhaseOpen = signal(false);
  readonly addPhaseSaving = signal(false);
  readonly addPhaseError = signal<string | null>(null);

  readonly addPhaseForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    phaseType: [PhaseType.PreVisit, Validators.required],
    executeInParallel: [false],
    continueOnOptionalFailure: [false],
  });

  // ── Delete phase ──────────────────────────────────────────────────────────

  readonly deletingPhaseId = signal<string | null>(null);
  readonly deletePhaseConfirmId = signal<string | null>(null);
  readonly deletePhaseError = signal<string | null>(null);

  // ── Expanded phases (for showing steps inline) ────────────────────────────

  readonly expandedPhaseIds = signal<Set<string>>(new Set());

  // ── Available step types (loaded once) ───────────────────────────────────

  readonly availableSteps = signal<AvailableStepDto[]>([]);
  readonly availableStepsLoading = signal(false);

  // ── Add step ─────────────────────────────────────────────────────────────

  /** phaseId currently showing the add-step panel, or null */
  readonly addStepForPhaseId = signal<string | null>(null);
  readonly addStepSaving = signal(false);
  readonly addStepError = signal<string | null>(null);

  readonly addStepForm = this.fb.nonNullable.group({
    stepType: [OnboardingStepType.Custom as OnboardingStepType, Validators.required],
    displayName: [''],
    isOptional: [false],
    isEnabled: [true],
  });

  // ── Delete step ───────────────────────────────────────────────────────────

  readonly deletingStepId = signal<string | null>(null);
  readonly deleteStepConfirmId = signal<string | null>(null);
  readonly deleteStepError = signal<string | null>(null);

  // ── Edit step ─────────────────────────────────────────────────────────────

  /** stepId currently open in the edit panel, or null */
  readonly editStepId = signal<string | null>(null);
  readonly editStepSaving = signal(false);
  readonly editStepError = signal<string | null>(null);
  readonly editStepSuccess = signal(false);

  readonly editStepForm = this.fb.nonNullable.group({
    displayName: [''],
    isOptional: [false],
    isEnabled: [true],
    triggerType: [TriggerType.Manual as TriggerType],
    triggerEventType: [null as StepTriggerEvent | null],
    maxRetries: [0, [Validators.min(0), Validators.max(20)]],
    retryStrategy: [RetryStrategy.None as RetryStrategy],
    initialDelaySeconds: [0, [Validators.min(0)]],
    maxDelaySeconds: [0, [Validators.min(0)]],
    backoffMultiplier: [1, [Validators.min(1)]],
    timeoutSeconds: [null as number | null],
    notes: [''],
    parameters: [''],
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('templateId');
    if (!id) {
      this.error.set(this.translate.instant('facility.onboardingTemplateDetail.notFound'));
      this.loading.set(false);
      return;
    }
    await Promise.all([this.load(id), this.loadAvailableSteps()]);
  }

  private async load(templateId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const t = await this.service.getTemplate(templateId);
      this.template.set(t);
      this.detailsForm.patchValue({ name: t.name, description: t.description ?? '' });
    } catch {
      this.error.set(this.translate.instant('facility.onboardingTemplateDetail.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAvailableSteps(): Promise<void> {
    this.availableStepsLoading.set(true);
    try {
      const steps = await this.service.getAvailableSteps();
      this.availableSteps.set(steps);
    } catch {
      // Non-fatal — step type picker will be empty
    } finally {
      this.availableStepsLoading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['..'], { relativeTo: this.route });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  activeLabel(isActive: boolean): string {
    return isActive
      ? this.translate.instant('facility.onboardingTemplates.active')
      : this.translate.instant('facility.onboardingTemplates.inactive');
  }

  activeSeverity(isActive: boolean): 'success' | 'secondary' {
    return isActive ? 'success' : 'secondary';
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  stepTypeLabel(stepType: OnboardingStepType): string {
    const found = this.availableSteps().find(s => s.stepType === stepType);
    return found?.displayName ?? stepType;
  }

  stepOptions(): { label: string; value: OnboardingStepType }[] {
    return this.availableSteps().map(s => ({ label: s.displayName, value: s.stepType }));
  }

  isPhaseExpanded(phaseId: string): boolean {
    return this.expandedPhaseIds().has(phaseId);
  }

  togglePhase(phaseId: string): void {
    this.expandedPhaseIds.update(ids => {
      const next = new Set(ids);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  }

  sortedPhases(): OnboardingPhaseDto[] {
    return [...(this.template()?.phases ?? [])].sort((a, b) => a.order - b.order);
  }

  sortedSteps(phase: OnboardingPhaseDto): StepConfigurationDto[] {
    return [...(phase.steps ?? [])].sort((a, b) => a.order - b.order);
  }

  // ── Save details ──────────────────────────────────────────────────────────

  async saveDetails(): Promise<void> {
    this.detailsForm.markAllAsTouched();
    if (this.detailsForm.invalid) return;

    const t = this.template();
    if (!t) return;

    this.detailsSaving.set(true);
    this.detailsSaveError.set(null);
    this.detailsSaveSuccess.set(false);

    const { name, description } = this.detailsForm.getRawValue();
    try {
      await this.service.updateTemplate(t.id, { name, description: description || null });
      this.template.update(prev => (prev ? { ...prev, name, description: description || null } : prev));
      this.detailsSaveSuccess.set(true);
      setTimeout(() => this.detailsSaveSuccess.set(false), 3000);
    } catch (err) {
      this.detailsSaveError.set(this.extractApiError(err));
    } finally {
      this.detailsSaving.set(false);
    }
  }

  // ── Activate / Deactivate ─────────────────────────────────────────────────

  async toggleActive(): Promise<void> {
    const t = this.template();
    if (!t) return;

    this.toggling.set(true);
    this.toggleError.set(null);
    try {
      if (t.isActive) {
        await this.service.deactivateTemplate(t.id);
      } else {
        await this.service.activateTemplate(t.id);
      }
      // Reload to get fresh state (activating deactivates others server-side)
      await this.load(t.id);
    } catch {
      const key = t.isActive
        ? 'facility.onboardingTemplates.deactivateError'
        : 'facility.onboardingTemplates.activateError';
      this.toggleError.set(this.translate.instant(key, { name: t.name }));
    } finally {
      this.toggling.set(false);
    }
  }

  // ── Add phase ─────────────────────────────────────────────────────────────

  openAddPhase(): void {
    this.addPhaseForm.reset({ phaseType: PhaseType.PreVisit, executeInParallel: false, continueOnOptionalFailure: false });
    this.addPhaseError.set(null);
    this.addPhaseOpen.set(true);
  }

  closeAddPhase(): void {
    this.addPhaseOpen.set(false);
  }

  async saveAddPhase(): Promise<void> {
    this.addPhaseForm.markAllAsTouched();
    if (this.addPhaseForm.invalid) return;

    const t = this.template();
    if (!t) return;

    this.addPhaseSaving.set(true);
    this.addPhaseError.set(null);

    const { name, description, phaseType, executeInParallel, continueOnOptionalFailure } =
      this.addPhaseForm.getRawValue();

    const body: AddPhaseRequest = {
      name,
      description: description || null,
      phaseType,
      order: (t.phases?.length ?? 0) + 1,
      executeInParallel,
      continueOnOptionalFailure,
      trigger: { type: TriggerType.Manual, eventType: null, relativeTime: null, allowedRoles: null, conditionExpression: null },
    };

    try {
      await this.service.addPhase(t.id, body);
      this.addPhaseOpen.set(false);
      await this.load(t.id);
    } catch (err) {
      this.addPhaseError.set(this.extractApiError(err));
    } finally {
      this.addPhaseSaving.set(false);
    }
  }

  // ── Delete phase ──────────────────────────────────────────────────────────

  confirmDeletePhase(phaseId: string): void {
    this.deletePhaseError.set(null);
    this.deletePhaseConfirmId.set(phaseId);
  }

  abortDeletePhase(): void {
    this.deletePhaseConfirmId.set(null);
  }

  async executeDeletePhase(phase: OnboardingPhaseDto): Promise<void> {
    const t = this.template();
    if (!t) return;

    this.deletingPhaseId.set(phase.id);
    this.deletePhaseError.set(null);
    try {
      await this.service.deletePhase(t.id, phase.id);
      this.deletePhaseConfirmId.set(null);
      await this.load(t.id);
    } catch {
      this.deletePhaseError.set(
        this.translate.instant('facility.onboardingTemplateDetail.deletePhaseError', { name: phase.name }),
      );
    } finally {
      this.deletingPhaseId.set(null);
    }
  }

  // ── Add step ──────────────────────────────────────────────────────────────

  openAddStep(phaseId: string): void {
    this.addStepForm.reset({ stepType: OnboardingStepType.Custom, isOptional: false, isEnabled: true });
    this.addStepError.set(null);
    this.addStepForPhaseId.set(phaseId);
  }

  closeAddStep(): void {
    this.addStepForPhaseId.set(null);
  }

  async saveAddStep(phase: OnboardingPhaseDto): Promise<void> {
    this.addStepForm.markAllAsTouched();
    if (this.addStepForm.invalid) return;

    const t = this.template();
    if (!t) return;

    this.addStepSaving.set(true);
    this.addStepError.set(null);

    const { stepType, displayName, isOptional, isEnabled } = this.addStepForm.getRawValue();
    const availableStep = this.availableSteps().find(s => s.stepType === stepType);

    const body: AddStepRequest = {
      stepType,
      displayName: displayName || null,
      isOptional,
      isEnabled,
      order: (phase.steps?.length ?? 0) + 1,
      trigger: null,
      maxRetries: 0,
      retryStrategy: RetryStrategy.None,
      initialDelaySeconds: 0,
      maxDelaySeconds: 0,
      backoffMultiplier: 1,
      timeoutSeconds: null,
      notes: null,
      stepVersion: availableStep?.version ?? '1.0',
      parameters: availableStep?.defaultConfiguration ?? null,
    };

    try {
      await this.service.addStep(t.id, phase.id, body);
      this.addStepForPhaseId.set(null);
      await this.load(t.id);
    } catch (err) {
      this.addStepError.set(this.extractApiError(err));
    } finally {
      this.addStepSaving.set(false);
    }
  }

  // ── Delete step ───────────────────────────────────────────────────────────

  confirmDeleteStep(stepId: string): void {
    this.deleteStepError.set(null);
    this.deleteStepConfirmId.set(stepId);
  }

  abortDeleteStep(): void {
    this.deleteStepConfirmId.set(null);
  }

  async executeDeleteStep(phase: OnboardingPhaseDto, step: StepConfigurationDto): Promise<void> {
    const t = this.template();
    if (!t) return;

    this.deletingStepId.set(step.id);
    this.deleteStepError.set(null);
    try {
      await this.service.deleteStep(t.id, phase.id, step.id);
      this.deleteStepConfirmId.set(null);
      await this.load(t.id);
    } catch {
      this.deleteStepError.set(
        this.translate.instant('facility.onboardingTemplateDetail.deleteStepError', {
          name: step.displayName ?? step.stepType,
        }),
      );
    } finally {
      this.deletingStepId.set(null);
    }
  }

  // ── Toggle step enabled ───────────────────────────────────────────────────

  readonly togglingStepId = signal<string | null>(null);

  async toggleStepEnabled(phase: OnboardingPhaseDto, step: StepConfigurationDto): Promise<void> {
    const t = this.template();
    if (!t) return;

    this.togglingStepId.set(step.id);
    try {
      await this.service.updateStep(t.id, phase.id, step.id, {
        trigger: step.trigger,
        order: step.order,
        isOptional: step.isOptional,
        isEnabled: !step.isEnabled,
        maxRetries: step.retryPolicy?.maxAttempts ?? 0,
        retryStrategy: step.retryPolicy?.strategy ?? RetryStrategy.None,
        initialDelaySeconds: step.retryPolicy?.initialDelaySeconds ?? 0,
        maxDelaySeconds: step.retryPolicy?.maxDelaySeconds ?? 0,
        backoffMultiplier: step.retryPolicy?.backoffMultiplier ?? 1,
        timeoutSeconds: step.timeoutSeconds,
        displayName: step.displayName,
        notes: step.notes,
        stepVersion: step.stepVersion,
        parameters: step.parameters,
      });
      await this.load(t.id);
    } catch {
      // Silently fail on toggle — not critical
    } finally {
      this.togglingStepId.set(null);
    }
  }

  // ── Edit step ─────────────────────────────────────────────────────────────

  openEditStep(step: StepConfigurationDto): void {
    this.editStepError.set(null);
    this.editStepSuccess.set(false);
    this.editStepForm.patchValue({
      displayName: step.displayName ?? '',
      isOptional: step.isOptional,
      isEnabled: step.isEnabled,
      triggerType: step.trigger?.type ?? TriggerType.Manual,
      triggerEventType: step.trigger?.eventType ?? null,
      maxRetries: step.retryPolicy?.maxAttempts ?? 0,
      retryStrategy: step.retryPolicy?.strategy ?? RetryStrategy.None,
      initialDelaySeconds: step.retryPolicy?.initialDelaySeconds ?? 0,
      maxDelaySeconds: step.retryPolicy?.maxDelaySeconds ?? 0,
      backoffMultiplier: step.retryPolicy?.backoffMultiplier ?? 1,
      timeoutSeconds: step.timeoutSeconds ?? null,
      notes: step.notes ?? '',
      parameters: step.parameters ?? '',
    });
    this.editStepId.set(step.id);
  }

  closeEditStep(): void {
    this.editStepId.set(null);
  }

  async saveEditStep(phase: OnboardingPhaseDto, step: StepConfigurationDto): Promise<void> {
    const t = this.template();
    if (!t) return;

    this.editStepSaving.set(true);
    this.editStepError.set(null);
    this.editStepSuccess.set(false);

    const {
      displayName,
      isOptional,
      isEnabled,
      triggerType,
      triggerEventType,
      maxRetries,
      retryStrategy,
      initialDelaySeconds,
      maxDelaySeconds,
      backoffMultiplier,
      timeoutSeconds,
      notes,
      parameters,
    } = this.editStepForm.getRawValue();

    const trigger = this.buildTrigger(triggerType, triggerEventType);

    try {
      await this.service.updateStep(t.id, phase.id, step.id, {
        trigger,
        order: step.order,
        displayName: displayName || null,
        isOptional,
        isEnabled,
        maxRetries,
        retryStrategy,
        initialDelaySeconds,
        maxDelaySeconds: maxDelaySeconds ?? 0,
        backoffMultiplier,
        timeoutSeconds: timeoutSeconds ?? null,
        notes: notes || null,
        stepVersion: step.stepVersion,
        parameters: parameters || step.parameters,
      });
      this.editStepSuccess.set(true);
      setTimeout(() => this.editStepSuccess.set(false), 3000);
      await this.load(t.id);
    } catch (err) {
      this.editStepError.set(this.extractApiError(err));
    } finally {
      this.editStepSaving.set(false);
    }
  }

  /** Steps in the same phase that could be listed as dependencies (excluding self). */
  dependencyOptions(phase: OnboardingPhaseDto, currentStepId: string): StepConfigurationDto[] {
    return this.sortedSteps(phase).filter(s => s.id !== currentStepId);
  }

  dependencyLabel(phase: OnboardingPhaseDto, depStepId: string): string {
    const s = phase.steps?.find(x => x.id === depStepId);
    return s ? (s.displayName ?? this.stepTypeLabel(s.stepType)) : depStepId;
  }

  /** Returns the JSON Schema string for the step currently open in the edit panel. */
  schemaForEditStep(stepId: string): string | null {
    const step = this.currentEditStep(stepId);
    const available = this.availableSteps().find(s => step && s.stepType === step.stepType);
    return available?.schema ?? null;
  }

  /** Trigger event options filtered to those supported by the currently edited step. */
  triggerEventOptionsForStep(stepId: string): { label: string; value: StepTriggerEvent }[] {
    const step = this.currentEditStep(stepId);
    const available = this.availableSteps().find(s => step && s.stepType === step.stepType);
    const supported = available?.supportedTriggerEvents ?? Object.values(StepTriggerEvent);
    return supported.map(e => ({ label: TRIGGER_EVENT_LABELS[e] ?? e, value: e }));
  }

  /** Trigger type options filtered to those relevant for the currently edited step. */
  triggerTypeOptionsForStep(stepId: string): { label: string; value: TriggerType }[] {
    const step = this.currentEditStep(stepId);
    const available = this.availableSteps().find(s => step && s.stepType === step.stepType);
    const hasEvents = (available?.supportedTriggerEvents?.length ?? 0) > 0;
    return TRIGGER_TYPE_OPTIONS.filter(o => o.value !== TriggerType.Event || hasEvents);
  }

  readonly TriggerType = TriggerType;

  private currentEditStep(stepId: string): StepConfigurationDto | undefined {
    for (const phase of this.template()?.phases ?? []) {
      const found = phase.steps?.find(s => s.id === stepId);
      if (found) return found;
    }
    return undefined;
  }

  private buildTrigger(
    type: TriggerType,
    eventType: StepTriggerEvent | null,
  ) {
    return {
      type,
      eventType: type === TriggerType.Event ? eventType : null,
      relativeTime: null,
      allowedRoles: null,
      conditionExpression: null,
    };
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
    return this.translate.instant('facility.onboardingTemplateDetail.unexpectedError');
  }
}
