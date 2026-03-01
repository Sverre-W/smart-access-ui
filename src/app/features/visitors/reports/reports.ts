import { Component, OnInit, signal, computed } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { MeterGroupModule } from 'primeng/metergroup';
import { ProgressBarModule } from 'primeng/progressbar';
import { TooltipModule } from 'primeng/tooltip';

type RangePeriod = '7d' | '30d' | '90d';

interface KpiCard {
  label: string;
  value: string;
  sub: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  trend: number | null; // % change vs previous period, null = no trend data
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

// ─── Mockup data sets keyed by period ─────────────────────────────────────────

const MOCK: Record<RangePeriod, {
  kpis: KpiCard[];
  visitsPerDay: { labels: string[]; counts: number[] };
  checkInRate: number;        // 0–100
  avgDuration: string;        // e.g. "1h 45m"
  visitsByState: { label: string; value: number; color: string }[];
  confirmations: ConfirmationBreakdown[];
  topLocations: TopLocation[];
  peakHours: { hour: string; count: number }[];
}> = {
  '7d': {
    kpis: [
      { label: 'Total visits',      value: '47',   sub: 'last 7 days',  icon: 'pi-calendar',     iconBg: 'bg-blue-50',   iconColor: 'text-blue-500',  trend: +12  },
      { label: 'Unique visitors',   value: '39',   sub: 'last 7 days',  icon: 'pi-users',        iconBg: 'bg-violet-50', iconColor: 'text-violet-500', trend: +8   },
      { label: 'Check-in rate',     value: '83%',  sub: 'of expected',  icon: 'pi-check-circle', iconBg: 'bg-green-50',  iconColor: 'text-green-500',  trend: +3   },
      { label: 'No-shows',          value: '8',    sub: 'did not arrive',icon: 'pi-user-minus',  iconBg: 'bg-red-50',    iconColor: 'text-red-400',    trend: -2   },
    ],
    visitsPerDay: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      counts: [5, 9, 11, 8, 7, 4, 3],
    },
    checkInRate: 83,
    avgDuration: '1h 52m',
    visitsByState: [
      { label: 'Scheduled', value: 12, color: '#a1a1aa' },
      { label: 'Approved',  value: 18, color: '#3b82f6' },
      { label: 'Started',   value: 9,  color: '#22c55e' },
      { label: 'Finished',  value: 6,  color: '#d4d4d8' },
      { label: 'Canceled',  value: 2,  color: '#f87171' },
    ],
    confirmations: [
      { label: 'Accepted',  value: 31, color: '#22c55e' },
      { label: 'Tentative', value: 5,  color: '#f59e0b' },
      { label: 'Declined',  value: 3,  color: '#f87171' },
      { label: 'No reply',  value: 8,  color: '#d4d4d8' },
    ],
    topLocations: [
      { name: 'Main Reception',    count: 18, pct: 38 },
      { name: 'Conference Room A', count: 11, pct: 23 },
      { name: 'Lab 2 – Floor 3',   count: 8,  pct: 17 },
      { name: 'Executive Suite',   count: 6,  pct: 13 },
      { name: 'Parking East',      count: 4,  pct: 9  },
    ],
    peakHours: [
      { hour: '08:00', count: 3 },
      { hour: '09:00', count: 8 },
      { hour: '10:00', count: 11 },
      { hour: '11:00', count: 7 },
      { hour: '12:00', count: 4 },
      { hour: '13:00', count: 5 },
      { hour: '14:00', count: 9 },
      { hour: '15:00', count: 6 },
      { hour: '16:00', count: 3 },
      { hour: '17:00', count: 2 },
    ],
  },
  '30d': {
    kpis: [
      { label: 'Total visits',      value: '184',  sub: 'last 30 days', icon: 'pi-calendar',     iconBg: 'bg-blue-50',   iconColor: 'text-blue-500',  trend: +19  },
      { label: 'Unique visitors',   value: '142',  sub: 'last 30 days', icon: 'pi-users',        iconBg: 'bg-violet-50', iconColor: 'text-violet-500', trend: +14  },
      { label: 'Check-in rate',     value: '79%',  sub: 'of expected',  icon: 'pi-check-circle', iconBg: 'bg-green-50',  iconColor: 'text-green-500',  trend: -2   },
      { label: 'No-shows',          value: '38',   sub: 'did not arrive',icon: 'pi-user-minus',  iconBg: 'bg-red-50',    iconColor: 'text-red-400',    trend: +5   },
    ],
    visitsPerDay: {
      labels: ['W1', 'W2', 'W3', 'W4'],
      counts: [41, 52, 47, 44],
    },
    checkInRate: 79,
    avgDuration: '2h 08m',
    visitsByState: [
      { label: 'Scheduled', value: 34, color: '#a1a1aa' },
      { label: 'Approved',  value: 72, color: '#3b82f6' },
      { label: 'Started',   value: 41, color: '#22c55e' },
      { label: 'Finished',  value: 28, color: '#d4d4d8' },
      { label: 'Canceled',  value: 9,  color: '#f87171' },
    ],
    confirmations: [
      { label: 'Accepted',  value: 118, color: '#22c55e' },
      { label: 'Tentative', value: 14,  color: '#f59e0b' },
      { label: 'Declined',  value: 10,  color: '#f87171' },
      { label: 'No reply',  value: 42,  color: '#d4d4d8' },
    ],
    topLocations: [
      { name: 'Main Reception',    count: 71, pct: 39 },
      { name: 'Conference Room A', count: 43, pct: 23 },
      { name: 'Lab 2 – Floor 3',   count: 31, pct: 17 },
      { name: 'Executive Suite',   count: 22, pct: 12 },
      { name: 'Parking East',      count: 17, pct: 9  },
    ],
    peakHours: [
      { hour: '08:00', count: 11 },
      { hour: '09:00', count: 28 },
      { hour: '10:00', count: 42 },
      { hour: '11:00', count: 29 },
      { hour: '12:00', count: 14 },
      { hour: '13:00', count: 18 },
      { hour: '14:00', count: 36 },
      { hour: '15:00', count: 22 },
      { hour: '16:00', count: 13 },
      { hour: '17:00', count: 8  },
    ],
  },
  '90d': {
    kpis: [
      { label: 'Total visits',      value: '521',  sub: 'last 90 days', icon: 'pi-calendar',     iconBg: 'bg-blue-50',   iconColor: 'text-blue-500',  trend: +31  },
      { label: 'Unique visitors',   value: '374',  sub: 'last 90 days', icon: 'pi-users',        iconBg: 'bg-violet-50', iconColor: 'text-violet-500', trend: +22  },
      { label: 'Check-in rate',     value: '81%',  sub: 'of expected',  icon: 'pi-check-circle', iconBg: 'bg-green-50',  iconColor: 'text-green-500',  trend: +1   },
      { label: 'No-shows',          value: '99',   sub: 'did not arrive',icon: 'pi-user-minus',  iconBg: 'bg-red-50',    iconColor: 'text-red-400',    trend: -4   },
    ],
    visitsPerDay: {
      labels: ['Jan', 'Feb', 'Mar'],
      counts: [168, 187, 166],
    },
    checkInRate: 81,
    avgDuration: '1h 58m',
    visitsByState: [
      { label: 'Scheduled', value: 88,  color: '#a1a1aa' },
      { label: 'Approved',  value: 201, color: '#3b82f6' },
      { label: 'Started',   value: 122, color: '#22c55e' },
      { label: 'Finished',  value: 88,  color: '#d4d4d8' },
      { label: 'Canceled',  value: 22,  color: '#f87171' },
    ],
    confirmations: [
      { label: 'Accepted',  value: 332, color: '#22c55e' },
      { label: 'Tentative', value: 41,  color: '#f59e0b' },
      { label: 'Declined',  value: 28,  color: '#f87171' },
      { label: 'No reply',  value: 120, color: '#d4d4d8' },
    ],
    topLocations: [
      { name: 'Main Reception',    count: 204, pct: 39 },
      { name: 'Conference Room A', count: 120, pct: 23 },
      { name: 'Lab 2 – Floor 3',   count: 88,  pct: 17 },
      { name: 'Executive Suite',   count: 63,  pct: 12 },
      { name: 'Parking East',      count: 46,  pct: 9  },
    ],
    peakHours: [
      { hour: '08:00', count: 31  },
      { hour: '09:00', count: 84  },
      { hour: '10:00', count: 119 },
      { hour: '11:00', count: 82  },
      { hour: '12:00', count: 41  },
      { hour: '13:00', count: 53  },
      { hour: '14:00', count: 101 },
      { hour: '15:00', count: 62  },
      { hour: '16:00', count: 38  },
      { hour: '17:00', count: 22  },
    ],
  },
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
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

  // ── Period selector ────────────────────────────────────────────────────────
  readonly periodOptions: { label: string; value: RangePeriod }[] = [
    { label: 'Last 7 days',  value: '7d'  },
    { label: 'Last 30 days', value: '30d' },
    { label: 'Last 90 days', value: '90d' },
  ];
  selectedPeriod: RangePeriod = '30d';

  readonly loading = signal(true);

  // ── Derived data from mock ─────────────────────────────────────────────────
  readonly data = computed(() => MOCK[this.selectedPeriod]);

  // ── Chart data objects (rebuilt whenever period changes) ───────────────────

  get visitsBarData() {
    const d = this.data();
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
    const d = this.data();
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
    const d = this.data();
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
    const d = this.data();
    const total = d.confirmations.reduce((s, c) => s + c.value, 0);
    return d.confirmations.map(c => ({
      label: c.label,
      value: total > 0 ? Math.round((c.value / total) * 100) : 0,
      color: c.color,
    }));
  }

  ngOnInit(): void {
    // Simulate a brief async load
    setTimeout(() => this.loading.set(false), 400);
  }

  onPeriodChange(): void {
    this.loading.set(true);
    setTimeout(() => this.loading.set(false), 300);
  }

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
}
