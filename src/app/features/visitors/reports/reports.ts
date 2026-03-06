import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MeterGroupModule } from 'primeng/metergroup';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';
import { VisitorService, VisitDto, VisitState, VisitorConfirmation, buildFilter } from '../services/visitor-service';

type RangePeriod = '7d' | '30d' | '90d';

interface KpiCard {
  label: string;
  value: string;
  sub: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  trend: null; // trends unavailable — requires comparative period API support
}

interface TopLocation {
  name: string;
  count: number;
  pct: number;
}

interface ConfirmationBreakdown {
  label: string;
  value: number;
  color: string;
}

interface ReportData {
  kpis: KpiCard[];
  visitsPerDay: { labels: string[]; counts: number[] };
  checkInRate: number;
  avgDuration: string;
  visitsByState: { label: string; value: number; color: string }[];
  confirmations: ConfirmationBreakdown[];
  topLocations: TopLocation[];
  peakHours: { hour: string; count: number }[];
}

// ─── State color map ──────────────────────────────────────────────────────────

const STATE_COLORS: Record<VisitState, string> = {
  SCHEDULED: '#a1a1aa',
  APPROVED:  '#3b82f6',
  REJECTED:  '#fb923c',
  LOCKED:    '#a855f7',
  STARTED:   '#22c55e',
  FINISHED:  '#d4d4d8',
  CANCELED:  '#f87171',
};

const CONFIRMATION_COLORS: Record<VisitorConfirmation, string> = {
  ACCEPTED:  '#22c55e',
  TENTATIVE: '#f59e0b',
  DECLINED:  '#f87171',
  UNKNOWN:   '#d4d4d8',
  DELEGATED: '#a1a1aa',
};

// ─── Pure aggregation functions ───────────────────────────────────────────────

function periodDays(period: RangePeriod): number {
  return period === '7d' ? 7 : period === '30d' ? 30 : 90;
}

function periodStart(period: RangePeriod): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - periodDays(period) + 1);
  return d;
}

function toUtcDayStart(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toUtcDayEnd(d: Date): string {
  const e = new Date(d);
  e.setHours(0, 0, 0, 0);
  e.setDate(e.getDate() + 1);
  return e.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function countUniqueVisitors(visits: VisitDto[]): number {
  const ids = new Set<string>();
  for (const v of visits) {
    for (const inv of v.visitorInvitations ?? []) {
      if (inv.role === 'Visitor') ids.add(inv.visitor.id);
    }
  }
  return ids.size;
}

function countNoShows(visits: VisitDto[]): number {
  return visits.filter(v =>
    (v.state === 'FINISHED' || v.state === 'CANCELED') &&
    (v.visitorInvitations ?? []).every(i => i.checkInStatus === 'Expected')
  ).length;
}

function computeCheckInRate(visits: VisitDto[]): number {
  const invitations = visits.flatMap(v => v.visitorInvitations ?? []).filter(i => i.role === 'Visitor');
  if (!invitations.length) return 0;
  const arrived = invitations.filter(i => i.checkInStatus === 'Arrived' || i.checkInStatus === 'Left').length;
  return Math.round((arrived / invitations.length) * 100);
}

function computeAvgDuration(visits: VisitDto[]): string {
  const durations = visits
    .filter(v => v.state === 'FINISHED' && v.actualStart && v.actualEnd)
    .map(v => new Date(v.actualEnd!).getTime() - new Date(v.actualStart!).getTime());

  if (!durations.length) return '—';

  const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  const totalMinutes = Math.round(avgMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function computeVisitsByState(visits: VisitDto[]): { label: string; value: number; color: string }[] {
  const counts = new Map<VisitState, number>();
  for (const v of visits) {
    counts.set(v.state, (counts.get(v.state) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([state, value]) => ({
    label: state.charAt(0) + state.slice(1).toLowerCase(),
    value,
    color: STATE_COLORS[state],
  }));
}

function computeConfirmations(visits: VisitDto[]): ConfirmationBreakdown[] {
  const counts = new Map<VisitorConfirmation, number>();
  for (const v of visits) {
    for (const inv of v.visitorInvitations ?? []) {
      const conf: VisitorConfirmation = inv.confirmation ?? 'UNKNOWN';
      counts.set(conf, (counts.get(conf) ?? 0) + 1);
    }
  }
  const labelMap: Record<VisitorConfirmation, string> = {
    ACCEPTED:  'Accepted',
    TENTATIVE: 'Tentative',
    DECLINED:  'Declined',
    UNKNOWN:   'No reply',
    DELEGATED: 'Delegated',
  };
  return Array.from(counts.entries()).map(([conf, value]) => ({
    label: labelMap[conf],
    value,
    color: CONFIRMATION_COLORS[conf],
  }));
}

function computeTopLocations(visits: VisitDto[]): TopLocation[] {
  const counts = new Map<string, number>();
  for (const v of visits) {
    const name = v.location?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

function computePeakHours(visits: VisitDto[]): { hour: string; count: number }[] {
  const counts = new Map<number, number>();
  for (const v of visits) {
    for (const inv of v.visitorInvitations ?? []) {
      if (!inv.arrivedOn) continue;
      const hour = new Date(inv.arrivedOn).getHours();
      counts.set(hour, (counts.get(hour) ?? 0) + 1);
    }
  }
  if (!counts.size) return [];
  return Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, count]) => ({
      hour: `${String(hour).padStart(2, '0')}:00`,
      count,
    }));
}

function computeVisitsPerDay(
  visits: VisitDto[],
  period: RangePeriod,
): { labels: string[]; counts: number[] } {
  const days = periodDays(period);
  const start = periodStart(period);

  if (days <= 7) {
    // Daily buckets — Mon…Sun labels
    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const count = visits.filter(v => v.start && new Date(v.start).toDateString() === d.toDateString()).length;
      return { label: DAY_LABELS[d.getDay()], count };
    }).reduce<{ labels: string[]; counts: number[] }>(
      (acc, { label, count }) => {
        acc.labels.push(label);
        acc.counts.push(count);
        return acc;
      },
      { labels: [], counts: [] },
    );
  }

  if (days <= 31) {
    // Weekly buckets
    const weeks = Math.ceil(days / 7);
    return Array.from({ length: weeks }, (_, i) => {
      const weekStart = new Date(start);
      weekStart.setDate(start.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const count = visits.filter(v => {
        if (!v.start) return false;
        const d = new Date(v.start);
        return d >= weekStart && d < weekEnd;
      }).length;
      return { label: `W${i + 1}`, count };
    }).reduce<{ labels: string[]; counts: number[] }>(
      (acc, { label, count }) => {
        acc.labels.push(label);
        acc.counts.push(count);
        return acc;
      },
      { labels: [], counts: [] },
    );
  }

  // Monthly buckets for 90d
  const monthCounts = new Map<string, number>();
  for (const v of visits) {
    if (!v.start) continue;
    const d = new Date(v.start);
    const key = d.toLocaleString(undefined, { month: 'short' });
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const labels = Array.from(monthCounts.keys());
  const counts = Array.from(monthCounts.values());
  return { labels, counts };
}

function buildReportData(visits: VisitDto[], period: RangePeriod, translate: TranslateService): ReportData {
  const days = periodDays(period);
  const subLabel = translate.instant(`visitors.reports.periodSub.${period}`);

  const totalVisits = visits.length;
  const uniqueVisitors = countUniqueVisitors(visits);
  const checkInRate = computeCheckInRate(visits);
  const noShows = countNoShows(visits);

  return {
    kpis: [
      {
        label: translate.instant('visitors.reports.kpi.totalVisits'),
        value: String(totalVisits),
        sub: subLabel,
        icon: 'pi-calendar',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-500',
        trend: null,
      },
      {
        label: translate.instant('visitors.reports.kpi.uniqueVisitors'),
        value: String(uniqueVisitors),
        sub: subLabel,
        icon: 'pi-users',
        iconBg: 'bg-violet-50',
        iconColor: 'text-violet-500',
        trend: null,
      },
      {
        label: translate.instant('visitors.reports.kpi.checkInRate'),
        value: `${checkInRate}%`,
        sub: translate.instant('visitors.reports.kpi.ofExpected'),
        icon: 'pi-check-circle',
        iconBg: 'bg-green-50',
        iconColor: 'text-green-500',
        trend: null,
      },
      {
        label: translate.instant('visitors.reports.kpi.noShows'),
        value: String(noShows),
        sub: translate.instant('visitors.reports.kpi.didNotArrive'),
        icon: 'pi-user-minus',
        iconBg: 'bg-red-50',
        iconColor: 'text-red-400',
        trend: null,
      },
    ],
    visitsPerDay: computeVisitsPerDay(visits, period),
    checkInRate,
    avgDuration: computeAvgDuration(visits),
    visitsByState: computeVisitsByState(visits),
    confirmations: computeConfirmations(visits),
    topLocations: computeTopLocations(visits),
    peakHours: computePeakHours(visits),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    TranslateModule,
    FormsModule,
    ChartModule,
    SelectButtonModule,
    SkeletonModule,
    TagModule,
    MeterGroupModule,
    ProgressBarModule,
    TooltipModule,
  ],
  templateUrl: './reports.html',
})
export class Reports implements OnInit {
  private visitorService = inject(VisitorService);
  private translate = inject(TranslateService);

  // ── Period selector ────────────────────────────────────────────────────────
  readonly periodOptions: { label: string; value: RangePeriod }[] = [
    { label: 'Last 7 days',  value: '7d'  },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
  ];
  selectedPeriod: RangePeriod = '30d';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly reportData = signal<ReportData | null>(null);

  // ── Chart data objects ─────────────────────────────────────────────────────

  get visitsBarData() {
    const d = this.reportData();
    if (!d) return null;
    return {
      labels: d.visitsPerDay.labels,
      datasets: [{
        label: 'Visits',
        data: d.visitsPerDay.counts,
        backgroundColor: '#238cff',
        borderRadius: 6,
        borderSkipped: false,
      }],
    };
  }

  get visitsBarOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.parsed.y} visits` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 11 } } },
        y: { grid: { color: '#f4f4f5' }, ticks: { color: '#a1a1aa', font: { size: 11 }, stepSize: 5 }, beginAtZero: true },
      },
    };
  }

  get donutData() {
    const d = this.reportData();
    if (!d) return null;
    return {
      labels: d.visitsByState.map(s => s.label),
      datasets: [{
        data: d.visitsByState.map(s => s.value),
        backgroundColor: d.visitsByState.map(s => s.color),
        hoverOffset: 6,
        borderWidth: 2,
        borderColor: '#ffffff',
      }],
    };
  }

  get donutOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#52525b', font: { size: 11 }, padding: 14, boxWidth: 10, boxHeight: 10 },
        },
      },
    };
  }

  get peakHoursBarData() {
    const d = this.reportData();
    if (!d) return null;
    const maxCount = Math.max(...d.peakHours.map(h => h.count));
    return {
      labels: d.peakHours.map(h => h.hour),
      datasets: [{
        label: 'Arrivals',
        data: d.peakHours.map(h => h.count),
        backgroundColor: d.peakHours.map(h =>
          h.count === maxCount ? '#238cff' : '#bfdbfe'
        ),
        borderRadius: 4,
        borderSkipped: false,
      }],
    };
  }

  get peakHoursOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.parsed.y} arrivals` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#a1a1aa', font: { size: 10 } } },
        y: { grid: { color: '#f4f4f5' }, ticks: { color: '#a1a1aa', font: { size: 10 } }, beginAtZero: true },
      },
    };
  }

  get meterGroupValue() {
    const d = this.reportData();
    if (!d) return [];
    const total = d.confirmations.reduce((s, c) => s + c.value, 0);
    return d.confirmations.map(c => ({
      label: c.label,
      value: total > 0 ? Math.round((c.value / total) * 100) : 0,
      color: c.color,
    }));
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadPeriod();
  }

  async onPeriodChange(): Promise<void> {
    await this.loadPeriod();
  }

  // ── Template helpers ───────────────────────────────────────────────────────

  trendLabel(trend: number | null): string {
    if (trend === null) return '';
    return trend >= 0 ? `+${trend}%` : `${trend}%`;
  }

  trendClass(trend: number | null, higherIsBetter = true): string {
    if (trend === null) return 'text-zinc-400';
    const positive = higherIsBetter ? trend > 0 : trend < 0;
    return positive ? 'text-green-500' : 'text-red-400';
  }

  trendIcon(trend: number | null, higherIsBetter = true): string {
    if (trend === null) return '';
    const positive = higherIsBetter ? trend > 0 : trend < 0;
    return positive ? 'pi pi-arrow-up' : 'pi pi-arrow-down';
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async loadPeriod(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const start = periodStart(this.selectedPeriod);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const filter = buildFilter({
      op: 'and',
      filters: [
        { key: 'Start', op: 'greaterThanOrEqual', value: toUtcDayStart(start) },
        { key: 'Start', op: 'lessThan',           value: toUtcDayEnd(tomorrow) },
      ],
    });

    try {
      const result = await this.visitorService.getAllVisits({
        Filter: filter,
        Sort: 'Start',
        SortDir: 'Asc',
        PageSize: 1000,
      });
      this.reportData.set(buildReportData(result.items, this.selectedPeriod, this.translate));
    } catch {
      this.error.set(this.translate.instant('visitors.reports.loadError'));
    } finally {
      this.loading.set(false);
    }
  }
}
