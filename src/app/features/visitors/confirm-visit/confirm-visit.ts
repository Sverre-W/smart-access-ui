import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  VisitorService,
  VisitDto,
  VisitorInvitationDto,
  ConfirmVisitorRequest,
} from '../services/visitor-service';

type PageState = 'loading' | 'ready' | 'submitting' | 'success' | 'error' | 'not-found';

@Component({
  selector: 'app-confirm-visit',
  imports: [FormsModule, TranslateModule],
  templateUrl: './confirm-visit.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmVisit implements OnInit {

  // ─── Services ────────────────────────────────────────────────────────────────

  private route = inject(ActivatedRoute);
  private visitorService = inject(VisitorService);
  private cdr = inject(ChangeDetectorRef);
  private translate = inject(TranslateService);

  // ─── Route params ─────────────────────────────────────────────────────────

  visitId = '';
  visitorId = '';

  // ─── State ───────────────────────────────────────────────────────────────────

  readonly pageState = signal<PageState>('loading');
  readonly loadError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);

  readonly visit = signal<VisitDto | null>(null);
  readonly invitation = signal<VisitorInvitationDto | null>(null);

  // ─── Editable form fields ─────────────────────────────────────────────────

  firstName = '';
  lastName = '';
  company = '';
  licensePlate = '';

  // ─── Computed ─────────────────────────────────────────────────────────────

  readonly visitorName = computed(() => {
    const inv = this.invitation();
    if (!inv) return '';
    return [inv.visitor.firstName, inv.visitor.lastName].filter(Boolean).join(' ');
  });

  readonly initials = computed(() => {
    const f = this.firstName?.[0] ?? '';
    const l = this.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  });

  readonly avatarColor = computed(() => {
    const inv = this.invitation();
    if (!inv) return 'hsl(220 55% 88%)';
    const hue = [...inv.visitor.id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `hsl(${hue} 55% 88%)`;
  });

  readonly avatarTextColor = computed(() => {
    const inv = this.invitation();
    if (!inv) return 'hsl(220 45% 35%)';
    const hue = [...inv.visitor.id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `hsl(${hue} 45% 35%)`;
  });

  readonly visitTimeRange = computed(() => {
    const v = this.visit();
    if (!v) return null;
    const start = v.start ? new Date(v.start).toLocaleString(undefined, {
      dateStyle: 'medium', timeStyle: 'short',
    }) : null;
    const end = v.end ? new Date(v.end).toLocaleString(undefined, {
      timeStyle: 'short',
    }) : null;
    if (!start) return null;
    return end ? `${start} – ${end}` : start;
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.visitId   = this.route.snapshot.paramMap.get('visitId')   ?? '';
    this.visitorId = this.route.snapshot.paramMap.get('visitorId') ?? '';

    if (!this.visitId || !this.visitorId) {
      this.pageState.set('not-found');
      return;
    }

    try {
      const visit = await this.visitorService.getVisitInfoForVisitor(this.visitorId, this.visitId);
      this.visit.set(visit);

      const inv = (visit.visitorInvitations ?? []).find(i => i.visitor.id === this.visitorId) ?? null;
      this.invitation.set(inv);

      if (!inv) {
        this.pageState.set('not-found');
        this.cdr.markForCheck();
        return;
      }

      // Pre-fill form with existing visitor data
      this.firstName    = inv.visitor.firstName ?? '';
      this.lastName     = inv.visitor.lastName ?? '';
      this.company      = inv.visitor.company ?? '';
      this.licensePlate = inv.visitor.licensePlate ?? '';

      this.pageState.set('ready');
    } catch {
      this.loadError.set(this.translate.instant('visitors.confirmVisit.loadError'));
      this.pageState.set('error');
    } finally {
      this.cdr.markForCheck();
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  async confirm(): Promise<void> {
    if (this.pageState() !== 'ready') return;

    this.pageState.set('submitting');
    this.submitError.set(null);
    this.cdr.markForCheck();

    const body: ConfirmVisitorRequest = {
      visitId:         this.visitId,
      firstName:       this.firstName.trim() || null,
      lastName:        this.lastName.trim() || null,
      email:           this.invitation()!.visitor.email ?? null,
      company:         this.company.trim() || null,
      licensePlate:    this.licensePlate.trim() || null,
      phone:           null,
      parkingRequired: this.invitation()!.parkingRequired ?? null,
      role:            this.invitation()!.role ?? null,
      confirmation:    'ACCEPTED',
    };

    try {
      await this.visitorService.confirmVisitor(this.visitorId, this.visitId, body);
      this.pageState.set('success');
    } catch {
      this.submitError.set(this.translate.instant('visitors.confirmVisit.confirmError'));
      this.pageState.set('ready');
    } finally {
      this.cdr.markForCheck();
    }
  }

  async decline(): Promise<void> {
    if (this.pageState() !== 'ready') return;

    this.pageState.set('submitting');
    this.submitError.set(null);
    this.cdr.markForCheck();

    const body: ConfirmVisitorRequest = {
      visitId:         this.visitId,
      firstName:       this.invitation()!.visitor.firstName ?? null,
      lastName:        this.invitation()!.visitor.lastName ?? null,
      email:           this.invitation()!.visitor.email ?? null,
      company:         this.invitation()!.visitor.company ?? null,
      licensePlate:    this.invitation()!.visitor.licensePlate ?? null,
      phone:           null,
      parkingRequired: this.invitation()!.parkingRequired ?? null,
      role:            this.invitation()!.role ?? null,
      confirmation:    'DECLINED',
    };

    try {
      await this.visitorService.confirmVisitor(this.visitorId, this.visitId, body);
      this.pageState.set('success');
    } catch {
      this.submitError.set(this.translate.instant('visitors.confirmVisit.declineError'));
      this.pageState.set('ready');
    } finally {
      this.cdr.markForCheck();
    }
  }
}
