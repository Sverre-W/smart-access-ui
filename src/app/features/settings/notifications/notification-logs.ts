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
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import {
  NotificationsService,
  NotificationLogDto,
  NotificationChannel,
  IPagedOf,
} from '../../../core/services/notifications-service';
import { PermissionsService } from '../../../core/services/permissions-service';
import { FormsModule } from '@angular/forms';

// ─── Status severity mapping ──────────────────────────────────────────────────

const STATUS_SEVERITY: Record<string, 'success' | 'info' | 'warn' | 'danger' | 'secondary'> = {
  sent: 'success',
  delivered: 'success',
  pending: 'info',
  queued: 'info',
  failed: 'danger',
  error: 'danger',
  bounced: 'warn',
};

function statusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
  return STATUS_SEVERITY[status?.toLowerCase()] ?? 'secondary';
}

// ─── Filter state ─────────────────────────────────────────────────────────────

interface LogFilters {
  channel: string | null;
  status: string | null;
  from: string | null;
  to: string | null;
}

const EMPTY_FILTERS: LogFilters = { channel: null, status: null, from: null, to: null };

const PAGE_SIZE = 25;

const KNOWN_STATUSES = ['Sent', 'Delivered', 'Pending', 'Queued', 'Failed', 'Bounced'];

@Component({
  selector: 'app-notification-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, ButtonModule, SelectModule, TagModule, DatePipe, FormsModule],
  templateUrl: './notification-logs.html',
})
export class NotificationLogs implements OnInit {
  private readonly service = inject(NotificationsService);
  private readonly permissions = inject(PermissionsService);
  private readonly translate = inject(TranslateService);

  readonly canView = computed(() =>
    this.permissions.hasPermission('Notifications Server', 'View Notifications Log')
  );

  // ── Data ─────────────────────────────────────────────────────────────────────

  readonly logs = signal<NotificationLogDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly totalItems = signal(0);
  readonly totalPages = signal(0);
  readonly currentPage = signal(0);

  readonly channels = signal<NotificationChannel[]>([]);

  // ── Filters ──────────────────────────────────────────────────────────────────

  readonly filters = signal<LogFilters>({ ...EMPTY_FILTERS });

  readonly channelOptions = computed(() => [
    { label: this.translate.instant('settings.notifications.logs.allChannels'), value: null },
    ...this.channels().map(c => ({ label: c.name, value: c.canonicalName })),
  ]);

  readonly statusOptions = KNOWN_STATUSES.map(s => ({ label: s, value: s }));

  readonly hasActiveFilters = computed(() => {
    const f = this.filters();
    return !!(f.channel || f.status || f.from || f.to);
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadChannels(), this.loadPage(0)]);
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  private async loadChannels(): Promise<void> {
    try {
      const ch = await this.service.getChannels();
      this.channels.set(ch);
    } catch {
      // non-critical — filters degrade gracefully
    }
  }

  private async loadPage(page: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const f = this.filters();
    try {
      const result: IPagedOf<NotificationLogDto> = await this.service.getLogs({
        page,
        pageSize: PAGE_SIZE,
        channel: f.channel ?? undefined,
        status: f.status ?? undefined,
        from: f.from ?? undefined,
        to: f.to ?? undefined,
      });
      this.logs.set(result.items);
      this.totalItems.set(result.totalItems ?? 0);
      this.totalPages.set(result.totalPages ?? 0);
      this.currentPage.set(page);
    } catch {
      this.error.set(this.translate.instant('settings.notifications.logs.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Filter actions ────────────────────────────────────────────────────────────

  applyFilters(): void {
    this.loadPage(0);
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_FILTERS });
    this.loadPage(0);
  }

  onFilterChange(): void {
    this.loadPage(0);
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.loadPage(page);
  }

  readonly hasPrev = computed(() => this.currentPage() > 0);
  readonly hasNext = computed(() => this.currentPage() < this.totalPages() - 1);

  readonly pageLabel = computed(() => {
    const total = this.totalPages();
    if (!total) return '';
    return this.translate.instant('settings.notifications.logs.pageOf', {
      current: this.currentPage() + 1,
      total,
    });
  });

  // ── Helpers ───────────────────────────────────────────────────────────────────

  statusSeverity = statusSeverity;

  readonly hasLogs = computed(() => this.logs().length > 0);

  readonly skeletonRows = [1, 2, 3, 4, 5];
}
