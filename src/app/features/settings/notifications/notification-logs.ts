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
import { PaginatorModule } from 'primeng/paginator';
import type { PaginatorState } from 'primeng/paginator';
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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

const KNOWN_STATUSES = ['Sent', 'Delivered', 'Pending', 'Queued', 'Failed', 'Bounced'];

@Component({
  selector: 'app-notification-logs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslateModule,
    ButtonModule,
    SelectModule,
    TagModule,
    DatePipe,
    FormsModule,
    PaginatorModule,
  ],
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

  // ── Pagination state (matches p-paginator's offset-based model) ───────────────

  readonly first = signal(0);
  readonly totalRecords = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

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
    await Promise.all([this.loadChannels(), this.load(0)]);
  }

  // ── Data loading ─────────────────────────────────────────────────────────────

  private async loadChannels(): Promise<void> {
    try {
      const ch = await this.service.getChannels();
      this.channels.set(ch);
    } catch {
      // non-critical — channel filter degrades gracefully
    }
  }

  private async load(firstOffset: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    const f = this.filters();
    const size = this.pageSize();
    const page = Math.floor(firstOffset / size);
    try {
      const result: IPagedOf<NotificationLogDto> = await this.service.getLogs({
        page,
        pageSize: size,
        channel: f.channel ?? undefined,
        status: f.status ?? undefined,
        from: f.from ?? undefined,
        to: f.to ?? undefined,
      });
      this.logs.set(result.items);
      this.totalRecords.set(result.totalItems ?? result.items.length);
    } catch {
      this.error.set(this.translate.instant('settings.notifications.logs.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Pagination ────────────────────────────────────────────────────────────────

  async onPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    const newRows = event.rows ?? this.pageSize();
    if (newRows !== this.pageSize()) {
      this.pageSize.set(newRows);
      this.first.set(0);
      await this.load(0);
    } else {
      this.first.set(newFirst);
      await this.load(newFirst);
    }
  }

  // ── Filter actions ────────────────────────────────────────────────────────────

  setChannel(value: string | null): void {
    this.filters.update(f => ({ ...f, channel: value }));
    this.first.set(0);
    this.load(0);
  }

  setStatus(value: string | null): void {
    this.filters.update(f => ({ ...f, status: value }));
    this.first.set(0);
    this.load(0);
  }

  setFrom(value: string | null): void {
    this.filters.update(f => ({ ...f, from: value }));
    this.first.set(0);
    this.load(0);
  }

  setTo(value: string | null): void {
    this.filters.update(f => ({ ...f, to: value }));
    this.first.set(0);
    this.load(0);
  }

  applyFilters(): void {
    this.first.set(0);
    this.load(0);
  }

  clearFilters(): void {
    this.filters.set({ ...EMPTY_FILTERS });
    this.first.set(0);
    this.load(0);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  statusSeverity = statusSeverity;

  readonly hasLogs = computed(() => this.logs().length > 0);

  readonly skeletonRows = [1, 2, 3, 4, 5];
}
