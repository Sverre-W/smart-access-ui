import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormArray, Validators } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import {
  NotificationsService,
  NotificationTemplateDto,
  TemplateTranslation,
} from '../../../core/services/notifications-service';
import { PermissionsService } from '../../../core/services/permissions-service';

function extractApiError(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const e = (err as { error: unknown }).error;
    if (e && typeof e === 'object') {
      if ('detail' in e && typeof (e as { detail: unknown }).detail === 'string')
        return (e as { detail: string }).detail;
      if ('title' in e && typeof (e as { title: unknown }).title === 'string')
        return (e as { title: string }).title;
      if ('errors' in e) {
        const errs = (e as { errors: Record<string, string[]> }).errors;
        return Object.values(errs).flat().join(' ');
      }
    }
  }
  return 'An unexpected error occurred. Please try again.';
}

@Component({
  selector: 'app-edit-notification',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslateModule, ButtonModule, InputTextModule, TextareaModule],
  templateUrl: './edit-notification.html',
})
export class EditNotification implements OnInit {
  private readonly service = inject(NotificationsService);
  private readonly permissions = inject(PermissionsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly fb = inject(FormBuilder);

  readonly canEdit = computed(() =>
    this.permissions.hasPermission('Notifications Server', 'Edit Templates')
  );

  readonly isNew = signal(false);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  readonly template = signal<NotificationTemplateDto | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(500)],
    subject: ['', Validators.maxLength(300)],
    body: [''],
    translations: this.fb.array<ReturnType<typeof this.buildTranslationGroup>>([]),
  });

  get translations(): FormArray {
    return this.form.controls.translations;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'new') {
      this.isNew.set(true);
      this.loading.set(false);
      if (!this.canEdit()) this.form.disable();
      return;
    }

    try {
      const t = await this.service.getTemplate(id!);
      this.template.set(t);
      this.form.patchValue({
        name: t.name,
        description: t.description ?? '',
        subject: t.subject ?? '',
        body: t.body ?? '',
      });
      (t.translations ?? []).forEach(tr => this.translations.push(this.buildTranslationGroup(tr)));
      if (!this.canEdit()) this.form.disable();
    } catch {
      this.loadError.set('settings.notifications.loadOneError');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Translations ──────────────────────────────────────────────────────────

  private buildTranslationGroup(tr?: Partial<TemplateTranslation>) {
    return this.fb.nonNullable.group({
      language: [tr?.language ?? '', Validators.required],
      subject: [tr?.subject ?? ''],
      body: [tr?.body ?? ''],
    });
  }

  addTranslation(): void {
    this.translations.push(this.buildTranslationGroup());
  }

  removeTranslation(index: number): void {
    this.translations.removeAt(index);
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const { name, description, subject, body, translations } = this.form.getRawValue();
    const payload = {
      name,
      description,
      subject: subject || null,
      body: body || null,
      translations: translations.length ? (translations as TemplateTranslation[]) : null,
    };

    try {
      if (this.isNew()) {
        await this.service.createTemplate(payload);
        await this.router.navigate(['/settings/notifications']);
      } else {
        const updated = await this.service.updateTemplate(this.template()!.id, payload);
        this.template.set(updated);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      }
    } catch (err) {
      this.saveError.set(extractApiError(err));
    } finally {
      this.saving.set(false);
    }
  }

  goBack(): void {
    this.location.back();
  }
}
