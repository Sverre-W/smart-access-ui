import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnChanges,
  signal,
  computed,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { SelectModule } from 'primeng/select';
import { MultiSelectModule } from 'primeng/multiselect';
import {
  NotificationsService,
  NotificationBlueprint,
  NotificationChannel,
  NotificationAction,
} from '../../../core/services/notifications-service';

// ── Local types ───────────────────────────────────────────────────────────────

interface BlueprintViewModel {
  blueprint: NotificationBlueprint;
  actions: NotificationAction[];
  expanded: boolean;
  loading: boolean;
  error: string | null;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function buildBlankAction(blueprintName: string): Omit<NotificationAction, 'id'> {
  return {
    description: '',
    notificationBlueprintName: blueprintName,
    notificationChannelName: '',
    notificationChannelFriendlyName: '',
    includedRoles: [],
    excludedRoles: [],
    subject: '',
    body: '',
  };
}

function extractApiError(err: unknown): string {
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

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-notification-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MultiSelectModule,
  ],
  templateUrl: './notification-editor.html',
})
export class NotificationEditor implements OnChanges {
  private service = inject(NotificationsService);
  private fb = inject(FormBuilder);

  /** Filter blueprints to this category (e.g. "Visitor Management"). */
  readonly category = input.required<string>();

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly blueprintVms = signal<BlueprintViewModel[]>([]);
  readonly channels = signal<NotificationChannel[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly hasBlueprints = computed(() => this.blueprintVms().length > 0);

  // ── Action form (shared for add + edit) ──────────────────────────────────

  /** id of the action being edited, or null when adding */
  readonly editingActionId = signal<string | null>(null);
  /** canonical name of blueprint currently showing the add/edit panel */
  readonly activeBlueprintName = signal<string | null>(null);
  readonly formSaving = signal(false);
  readonly formError = signal<string | null>(null);

  /** Role options for the currently active blueprint */
  readonly activeRoleOptions = computed(() => {
    const name = this.activeBlueprintName();
    if (!name) return [];
    const vm = this.blueprintVms().find(v => v.blueprint.canonicalName === name);
    return vm?.blueprint.supportedRoles.map(r => ({ label: r, value: r })) ?? [];
  });

  readonly channelOptions = computed(() =>
    this.channels().map(c => ({ label: c.name, value: c.canonicalName }))
  );

  readonly actionForm = this.fb.nonNullable.group({
    description: ['', [Validators.required, Validators.maxLength(250)]],
    notificationChannelName: ['', Validators.required],
    includedRoles: [[] as string[], Validators.required],
    excludedRoles: [[] as string[]],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    body: ['', Validators.required],
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  readonly deleteConfirmingId = signal<string | null>(null);
  readonly deleteInProgressId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnChanges(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.blueprintVms.set([]);
    this.closeForm();

    try {
      const [blueprints, channels] = await Promise.all([
        this.service.getBlueprints(),
        this.service.getChannels(),
      ]);
      const filtered = blueprints.filter(b => b.category === this.category());
      this.channels.set(channels);
      this.blueprintVms.set(
        filtered.map(b => ({
          blueprint: b,
          actions: [],
          expanded: false,
          loading: false,
          error: null,
        }))
      );
    } catch {
      this.error.set('Failed to load notification blueprints. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Blueprint expand / collapse ───────────────────────────────────────────

  async toggleBlueprint(canonicalName: string): Promise<void> {
    const vm = this.findVm(canonicalName);
    if (!vm) return;

    if (vm.expanded) {
      this.updateVm(canonicalName, { expanded: false });
      if (this.activeBlueprintName() === canonicalName) this.closeForm();
      return;
    }

    this.updateVm(canonicalName, { expanded: true, loading: true, error: null });
    try {
      const actions = await this.service.getBlueprintActions(canonicalName);
      this.updateVm(canonicalName, { actions, loading: false });
    } catch {
      this.updateVm(canonicalName, {
        loading: false,
        error: 'Failed to load actions for this blueprint.',
      });
    }
  }

  // ── Add action ────────────────────────────────────────────────────────────

  openAdd(canonicalName: string): void {
    this.closeForm();
    this.activeBlueprintName.set(canonicalName);
    this.editingActionId.set(null);
    this.actionForm.reset({
      description: '',
      notificationChannelName: '',
      includedRoles: [],
      excludedRoles: [],
      subject: '',
      body: '',
    });
  }

  // ── Edit action ───────────────────────────────────────────────────────────

  openEdit(action: NotificationAction): void {
    this.closeForm();
    this.activeBlueprintName.set(action.notificationBlueprintName);
    this.editingActionId.set(action.id ?? null);
    this.actionForm.reset({
      description: action.description,
      notificationChannelName: action.notificationChannelName,
      includedRoles: [...action.includedRoles],
      excludedRoles: [...action.excludedRoles],
      subject: action.subject,
      body: action.body,
    });
  }

  closeForm(): void {
    this.activeBlueprintName.set(null);
    this.editingActionId.set(null);
    this.formError.set(null);
    this.actionForm.reset();
  }

  isAdding(canonicalName: string): boolean {
    return this.activeBlueprintName() === canonicalName && this.editingActionId() === null;
  }

  isEditing(actionId: string): boolean {
    return this.editingActionId() === actionId;
  }

  async saveAction(): Promise<void> {
    this.actionForm.markAllAsTouched();
    if (this.actionForm.invalid) return;

    const blueprintName = this.activeBlueprintName()!;
    const { description, notificationChannelName, includedRoles, excludedRoles, subject, body } =
      this.actionForm.controls;

    const draft: NotificationAction = {
      ...buildBlankAction(blueprintName),
      description: description.value,
      notificationChannelName: notificationChannelName.value,
      includedRoles: includedRoles.value,
      excludedRoles: excludedRoles.value,
      subject: subject.value,
      body: body.value,
    };

    this.formSaving.set(true);
    this.formError.set(null);

    try {
      const editId = this.editingActionId();
      if (editId) {
        const updated = await this.service.updateAction(editId, { ...draft, id: editId });
        this.updateVm(blueprintName, {
          actions: this.findVm(blueprintName)!.actions.map(a =>
            a.id === editId ? updated : a
          ),
        });
      } else {
        const created = await this.service.createAction(blueprintName, draft);
        this.updateVm(blueprintName, {
          actions: [...(this.findVm(blueprintName)?.actions ?? []), created],
        });
      }
      this.closeForm();
    } catch (err) {
      this.formError.set(extractApiError(err));
    } finally {
      this.formSaving.set(false);
    }
  }

  // ── Delete action ─────────────────────────────────────────────────────────

  confirmDelete(actionId: string): void {
    this.deleteError.set(null);
    this.deleteConfirmingId.set(actionId);
  }

  abortDelete(): void {
    this.deleteConfirmingId.set(null);
  }

  async executeDelete(action: NotificationAction): Promise<void> {
    this.deleteInProgressId.set(action.id ?? null);
    this.deleteError.set(null);
    try {
      await this.service.deleteAction(action.id!);
      this.updateVm(action.notificationBlueprintName, {
        actions: this.findVm(action.notificationBlueprintName)!.actions.filter(
          a => a.id !== action.id
        ),
      });
      this.deleteConfirmingId.set(null);
      if (this.editingActionId() === action.id) this.closeForm();
    } catch {
      this.deleteError.set('Failed to delete the notification action. Please try again.');
    } finally {
      this.deleteInProgressId.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  channelLabel(canonicalName: string): string {
    return this.channels().find(c => c.canonicalName === canonicalName)?.name ?? canonicalName;
  }

  private findVm(canonicalName: string): BlueprintViewModel | undefined {
    return this.blueprintVms().find(v => v.blueprint.canonicalName === canonicalName);
  }

  private updateVm(canonicalName: string, patch: Partial<BlueprintViewModel>): void {
    this.blueprintVms.update(vms =>
      vms.map(v => (v.blueprint.canonicalName === canonicalName ? { ...v, ...patch } : v))
    );
  }
}
