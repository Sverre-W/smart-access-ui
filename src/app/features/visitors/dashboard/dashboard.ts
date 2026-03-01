import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { VisitorService, VisitDto, VisitorCheckInStatus, buildFilter } from '../services/visitor-service';
import { VisitStateBadge } from '../../../shared/components/visit-state-badge/visit-state-badge';

interface DayColumn {
  date: Date;
  label: string;
  dayNum: string;
  isToday: boolean;
  visits: VisitDto[];
}

@Component({
  selector: 'app-visitors-dashboard',
  standalone: true,
  imports: [DatePipe, VisitStateBadge],
  templateUrl: './dashboard.html',
})
export class VisitorsDashboard implements OnInit {
  private visitorService = inject(VisitorService);
  private router = inject(Router);

  readonly todayVisits = signal<VisitDto[]>([]);
  readonly weekVisits = signal<VisitDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

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
    const today = new Date();
    const monday = new Date(today);
    monday.setHours(0, 0, 0, 0);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);

    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const isToday = date.toDateString() === today.toDateString();

      const visits = this.weekVisits().filter(v => {
        if (!v.start) return false;
        const visitDate = new Date(v.start);
        return visitDate.toDateString() === date.toDateString();
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

  navigateToCreate(): void {
    this.router.navigate(['/visitors/create']);
  }

  async ngOnInit(): Promise<void> {
    const today = new Date();
    const weekStart = this.getWeekStart(today);
    const weekEnd = this.getWeekEnd(today);

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
              { key: 'Start', op: 'lessThan',           value: this.toUtcDayEnd(weekEnd)     },
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
      this.error.set('Failed to load visitor data.');
    } finally {
      this.loading.set(false);
    }
  }

  visitTime(visit: VisitDto): string {
    if (!visit.start) return '';
    const d = new Date(visit.start);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  visitEndTime(visit: VisitDto): string {
    if (!visit.end) return '';
    const d = new Date(visit.end);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  visitorCount(visit: VisitDto): number {
    return visit.visitorInvitations?.length ?? 0;
  }

  private isOnDate(isoString: string | null, date: Date): boolean {
    if (!isoString) return false;
    return new Date(isoString).toDateString() === date.toDateString();
  }

  /** Start of a local calendar day as a UTC ISO string, e.g. "2026-03-01T00:00:00Z" */
  private toUtcDayStart(d: Date): string {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  /** Start of the next local calendar day as UTC — used as exclusive upper bound */
  private toUtcDayEnd(d: Date): string {
    const e = new Date(d);
    e.setHours(0, 0, 0, 0);
    e.setDate(e.getDate() + 1);
    return e.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  private getWeekStart(d: Date): Date {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  private getWeekEnd(d: Date): Date {
    const start = this.getWeekStart(d);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }
}
