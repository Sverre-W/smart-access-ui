import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { VisitorService, VisitDto, VisitorCheckInStatus, buildFilter } from '../services/visitor-service';
import { PermissionsService } from '../../../core/services/permissions-service';
import { ButtonModule } from 'primeng/button';
import { VisitStateBadge } from '../../../shared/components/visit-state-badge/visit-state-badge';
import { formatLocalTime } from '../../../shared/utils/date-utils';

interface DayColumn {
  date: Date;
  label: string;
  dayNum: string;
  isToday: boolean;
  visits: VisitDto[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

@Component({
  selector: 'app-visitors-dashboard',
  standalone: true,
  imports: [ButtonModule, VisitStateBadge, TranslateModule],
  templateUrl: './dashboard.html',
})
export class VisitorsDashboard implements OnInit {
  private visitorService = inject(VisitorService);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  // ── Today's data (always the real today, unaffected by week nav) ──────────
  readonly todayVisits = signal<VisitDto[]>([]);

  // ── Permissions ───────────────────────────────────────────────────────────
  readonly canCreateVisit = computed(() =>
    this.permissions.hasPermission('Visitors Service', 'Visits:Create')
  );

  // ── Week navigation ───────────────────────────────────────────────────────
  /** Monday of the currently displayed week (normalised to midnight). */
  readonly selectedWeekStart = signal<Date>(this.getWeekStart(new Date()));

  readonly weekVisits = signal<VisitDto[]>([]);
  readonly loading = signal(true);
  readonly weekLoading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Derived ───────────────────────────────────────────────────────────────

  readonly isCurrentWeek = computed(() => {
    const sel = this.selectedWeekStart();
    const cur = this.getWeekStart(new Date());
    return sel.toDateString() === cur.toDateString();
  });

  readonly weekLabel = computed(() => {
    const start = this.selectedWeekStart();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

    if (start.getFullYear() !== end.getFullYear()) {
      return `${fmt(start)} ${start.getFullYear()} – ${fmt(end)} ${end.getFullYear()}`;
    }
    if (start.getMonth() !== end.getMonth()) {
      return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
    }
    return `${start.getDate()} – ${fmt(end)} ${end.getFullYear()}`;
  });

  readonly checkedInToday = computed(() =>
    this.todayVisits().filter(v =>
      v.visitorInvitations?.some(i => i.checkInStatus === ('Arrived' as VisitorCheckInStatus))
    ).length
  );

  readonly expectedToday = computed(() =>
    this.todayVisits().filter(v =>
      v.visitorInvitations?.some(i => i.checkInStatus === ('Expected' as VisitorCheckInStatus))
    ).length
  );

  readonly weekDays = computed<DayColumn[]>(() => {
    const monday = this.selectedWeekStart();
    const today = new Date();

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();

      const visits = this.weekVisits().filter(v => {
        if (!v.start) return false;
        return new Date(v.start).toDateString() === date.toDateString();
      });

      return {
        date,
        label: DAY_LABELS[i],
        dayNum: String(date.getDate()),
        isToday,
        visits,
      };
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const today = new Date();
    const weekStart = this.getWeekStart(today);

    try {
      const [todayResult, weekResult] = await Promise.all([
        this.visitorService.getAllVisits({
          Filter: buildFilter({
            op: 'and',
            filters: [
              { key: 'Start', op: 'greaterThanOrEqual', value: this.toUtcDayStart(today) },
              { key: 'Start', op: 'lessThan',           value: this.toUtcDayEnd(today)   },
            ],
          }),
          Sort: 'Start',
          SortDir: 'Asc',
          PageSize: 500,
        }),
        this.visitorService.getAllVisits({
          Filter: buildFilter({
            op: 'and',
            filters: [
              { key: 'Start', op: 'greaterThanOrEqual', value: this.toUtcDayStart(weekStart) },
              { key: 'Start', op: 'lessThan',           value: this.toUtcDayEnd(this.getWeekEnd(weekStart)) },
            ],
          }),
          Sort: 'Start',
          SortDir: 'Asc',
          PageSize: 500,
        }),
      ]);

      this.todayVisits.set(todayResult.items);
      this.weekVisits.set(weekResult.items);
    } catch {
      this.error.set(this.translate.instant('visitors.dashboard.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Week navigation actions ───────────────────────────────────────────────

  previousWeek(): void {
    const prev = new Date(this.selectedWeekStart());
    prev.setDate(prev.getDate() - 7);
    this.selectedWeekStart.set(prev);
    this.loadWeek(prev);
  }

  nextWeek(): void {
    const next = new Date(this.selectedWeekStart());
    next.setDate(next.getDate() + 7);
    this.selectedWeekStart.set(next);
    this.loadWeek(next);
  }

  goToCurrentWeek(): void {
    const cur = this.getWeekStart(new Date());
    this.selectedWeekStart.set(cur);
    this.loadWeek(cur);
  }

  private async loadWeek(weekStart: Date): Promise<void> {
    const weekEnd = this.getWeekEnd(weekStart);
    this.weekLoading.set(true);
    this.error.set(null);

    try {
      const result = await this.visitorService.getAllVisits({
        Filter: buildFilter({
          op: 'and',
          filters: [
            { key: 'Start', op: 'greaterThanOrEqual', value: this.toUtcDayStart(weekStart) },
            { key: 'Start', op: 'lessThan',           value: this.toUtcDayEnd(weekEnd)     },
          ],
        }),
        Sort: 'Start',
        SortDir: 'Asc',
        PageSize: 500,
      });
      this.weekVisits.set(result.items);
    } catch {
      this.error.set(this.translate.instant('visitors.dashboard.loadError'));
    } finally {
      this.weekLoading.set(false);
    }
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  navigateToCreate(): void {
    this.router.navigate(['/visitors/create']);
  }

  navigateToVisit(visitId: string): void {
    this.router.navigate(['/visitors/edit', visitId]);
  }

  visitTime(visit: VisitDto): string {
    return formatLocalTime(visit.start);
  }

  visitEndTime(visit: VisitDto): string {
    return formatLocalTime(visit.end);
  }

  visitorCount(visit: VisitDto): number {
    return visit.visitorInvitations?.filter(i => i.role === 'Visitor').length ?? 0;
  }

  // ── Private date helpers ──────────────────────────────────────────────────

  private getWeekStart(d: Date): Date {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  private getWeekEnd(weekStart: Date): Date {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }

  private toUtcDayStart(d: Date): string {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private toUtcDayEnd(d: Date): string {
    const e = new Date(d);
    e.setHours(0, 0, 0, 0);
    e.setDate(e.getDate() + 1);
    return e.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
}
