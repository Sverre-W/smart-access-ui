import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import {
  NotificationsService,
  NotificationTemplateDto,
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
  selector: 'app-settings-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, ButtonModule, IconField, InputIcon, InputTextModule, DatePipe],
  templateUrl: './notifications.html',
})
export class SettingsNotifications implements OnInit {
  private readonly service = inject(NotificationsService);
  private readonly permissions = inject(PermissionsService);
  private readonly translate = inject(TranslateService);

  readonly canEdit = computed(() =>
    this.permissions.hasPermission('Notifications Server', 'Edit Templates')
  );

  // ── Data ────────────────────────────────────────────────────────────────────

  readonly allTemplates = signal<NotificationTemplateDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Search ──────────────────────────────────────────────────────────────────

  readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filteredTemplates = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.allTemplates();
    return this.allTemplates().filter(
      t =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q)
    );
  });

  readonly hasTemplates = computed(() => this.filteredTemplates().length > 0);

  // ── Delete ──────────────────────────────────────────────────────────────────

  readonly deleteConfirmingId = signal<string | null>(null);
  readonly deleteInProgressId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      // Load all templates — iterate pages if necessary
      const first = await this.service.getTemplates(0, 100);
      this.allTemplates.set(first.items);
    } catch {
      this.error.set(this.translate.instant('settings.notifications.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Search ──────────────────────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const value = (event.target as HTMLInputElement).value;
    this.searchTimer = setTimeout(() => this.searchQuery.set(value), 250);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  confirmDelete(id: string): void {
    this.deleteError.set(null);
    this.deleteConfirmingId.set(id);
  }

  abortDelete(): void {
    this.deleteConfirmingId.set(null);
  }

  async executeDelete(template: NotificationTemplateDto): Promise<void> {
    this.deleteInProgressId.set(template.id);
    this.deleteError.set(null);
    try {
      await this.service.deleteTemplate(template.id);
      this.allTemplates.update(list => list.filter(t => t.id !== template.id));
      this.deleteConfirmingId.set(null);
    } catch (err) {
      this.deleteError.set(extractApiError(err));
    } finally {
      this.deleteInProgressId.set(null);
    }
  }
}
