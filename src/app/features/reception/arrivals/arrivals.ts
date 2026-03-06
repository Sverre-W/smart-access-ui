import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  VisitorService,
  VisitDto,
  VisitorInvitationDto,
  buildFilter,
} from '../../visitors/services/visitor-service';
import { CheckinStatusBadge } from '../../../shared/components/checkin-status-badge/checkin-status-badge';
import { formatLocalTime } from '../../../shared/utils/date-utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLocalDayStart(d: Date): string {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toLocalDayEnd(d: Date): string {
  const e = new Date(d);
  e.setHours(0, 0, 0, 0);
  e.setDate(e.getDate() + 1);
  return e.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

// ─── Types ────────────────────────────────────────────────────────────────────

/** Invitation enriched with its parent visit so the template has full context. */
export interface ArrivalRow extends VisitorInvitationDto {
  visit: VisitDto;
}

// ─── Component ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-arrivals',
  standalone: true,
  imports: [RouterLink, ButtonModule, ToastModule, CheckinStatusBadge, TranslateModule],
  templateUrl: './arrivals.html',
  providers: [MessageService],
})
export class Arrivals implements OnInit {
  private visitorService = inject(VisitorService);
  private translate = inject(TranslateService);
  private messageService = inject(MessageService);

  readonly selectedDate = signal<Date>(this.today());
  readonly invitations = signal<ArrivalRow[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly checkingOutId = signal<string | null>(null);

  readonly isToday = computed(() => isSameDay(this.selectedDate(), this.today()));

  readonly dateLabel = computed(() =>
    this.selectedDate().toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  );

  readonly hasInvitations = computed(() => this.invitations().length > 0);

  async ngOnInit(): Promise<void> {
    await this.load(this.selectedDate());
  }

  async previousDay(): Promise<void> {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() - 1);
    this.selectedDate.set(d);
    await this.load(d);
  }

  async nextDay(): Promise<void> {
    const d = new Date(this.selectedDate());
    d.setDate(d.getDate() + 1);
    this.selectedDate.set(d);
    await this.load(d);
  }

  async goToToday(): Promise<void> {
    const t = this.today();
    this.selectedDate.set(t);
    await this.load(t);
  }

  fullName(inv: VisitorInvitationDto): string {
    const { firstName, lastName } = inv.visitor;
    return [firstName, lastName].filter(Boolean).join(' ');
  }

  initials(inv: VisitorInvitationDto): string {
    const f = inv.visitor.firstName?.[0] ?? '';
    const l = inv.visitor.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  }

  avatarColor(inv: VisitorInvitationDto): string {
    const hue = [...inv.visitor.id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `hsl(${hue} 55% 88%)`;
  }

  avatarTextColor(inv: VisitorInvitationDto): string {
    const hue = [...inv.visitor.id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `hsl(${hue} 45% 35%)`;
  }

  visitTime(inv: ArrivalRow): string {
    return formatLocalTime(inv.visit.start);
  }

  visitEndTime(inv: ArrivalRow): string {
    return formatLocalTime(inv.visit.end);
  }

  canCheckOut(inv: ArrivalRow): boolean {
    return inv.checkInStatus === 'Arrived';
  }

  async checkOut(inv: ArrivalRow): Promise<void> {
    if (!this.canCheckOut(inv) || this.checkingOutId() !== null) return;

    const rowKey = inv.visitor.id + inv.visit.id;
    this.checkingOutId.set(rowKey);

    try {
      await this.visitorService.checkOutVisitor(inv.visitor.id, inv.visit.id);

      // Optimistically update the row status in place — no full reload needed.
      this.invitations.update(rows =>
        rows.map(r =>
          r.visitor.id === inv.visitor.id && r.visit.id === inv.visit.id
            ? { ...r, checkInStatus: 'Left' as const, leftOn: new Date().toISOString() }
            : r
        )
      );

      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('reception.arrivals.checkOut.successSummary'),
        detail: this.translate.instant('reception.arrivals.checkOut.successDetail', {
          name: this.fullName(inv),
        }),
        life: 4000,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('reception.arrivals.checkOut.errorSummary'),
        detail: this.translate.instant('reception.arrivals.checkOut.errorDetail'),
        life: 5000,
      });
    } finally {
      this.checkingOutId.set(null);
    }
  }

  private today(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private async load(date: Date): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await this.visitorService.getAllVisits({
        Filter: buildFilter({
          op: 'and',
          filters: [
            { key: 'Start', op: 'greaterThanOrEqual', value: toLocalDayStart(date) },
            { key: 'Start', op: 'lessThan',           value: toLocalDayEnd(date)   },
          ],
        }),
        Sort: 'Start',
        SortDir: 'Asc',
        PageSize: 500,
      });

      // Flatten each visit's visitor invitations into individual arrival rows,
      // keeping only Visitor-role entries and attaching the parent visit.
      const rows: ArrivalRow[] = result.items.flatMap(visit =>
        (visit.visitorInvitations ?? [])
          .filter(inv => inv.role === 'Visitor')
          .map(inv => ({ ...inv, visit }))
      );

      this.invitations.set(rows);
    } catch {
      this.error.set(this.translate.instant('reception.arrivals.loadError'));
    } finally {
      this.loading.set(false);
    }
  }
}
