import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  VisitorService,
  VisitDto,
  VisitorInvitationDto,
  OnboardingData,
  AdditionalDataDto,
  VisitorOnboardingDto,
  LocationDto,
  OrganizerDto,
} from '../../../visitors/services/visitor-service';
import { KioskSessionService } from '../services/kiosk-session-service';
import { CheckinStatusBadge } from '../../../../shared/components/checkin-status-badge/checkin-status-badge';
import { VisitStateBadge } from '../../../../shared/components/visit-state-badge/visit-state-badge';
import { formatLocalTime } from '../../../../shared/utils/date-utils';

// ─── Visit timing status ──────────────────────────────────────────────────────

type TimingStatus = 'on-time' | 'early' | 'late' | 'unknown';

@Component({
  selector: 'app-onboarding-checkin',
  imports: [CheckinStatusBadge, VisitStateBadge],
  templateUrl: './onboarding-checkin.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingCheckin implements OnInit {

  // ─── Services ────────────────────────────────────────────────────────────────

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private visitorService = inject(VisitorService);
  readonly session = inject(KioskSessionService);
  private cdr = inject(ChangeDetectorRef);

  // ─── State ───────────────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly checkingIn = signal(false);
  readonly error = signal<string | null>(null);
  readonly visit = signal<VisitDto | null>(null);
  readonly invitation = signal<VisitorInvitationDto | null>(null);
  readonly requiredDocs = signal<OnboardingData[]>([]);
  private readonly allLocations = signal<LocationDto[]>([]);

  // ─── Route params ─────────────────────────────────────────────────────────

  visitId = '';
  visitorId = '';

  // ─── Computed ─────────────────────────────────────────────────────────────

  readonly visitorName = computed(() => {
    const inv = this.invitation();
    if (!inv) return '';
    return [inv.visitor.firstName, inv.visitor.lastName].filter(Boolean).join(' ');
  });

  readonly initials = computed(() => {
    const inv = this.invitation();
    if (!inv) return '?';
    const f = inv.visitor.firstName?.[0] ?? '';
    const l = inv.visitor.lastName?.[0] ?? '';
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
    if (!v) return '—';
    const start = formatLocalTime(v.start);
    const end = formatLocalTime(v.end);
    if (!start && !end) return '—';
    if (!end) return start;
    return `${start} – ${end}`;
  });

  readonly timingStatus = computed<TimingStatus>(() => {
    const v = this.visit();
    if (!v?.start) return 'unknown';
    const now = Date.now();
    const start = new Date(v.start).getTime();
    const end = v.end ? new Date(v.end).getTime() : null;
    const earlyWindowMs = 30 * 60 * 1000;
    const lateWindowMs  = 15 * 60 * 1000;
    if (end && now > end) return 'late';
    if (now < start - earlyWindowMs) return 'early';
    if (now > start + lateWindowMs) return 'late';
    return 'on-time';
  });

  /**
   * Resolves the full location hierarchy (Site → Building → Room) from the
   * flat allLocations list, same pattern as LocationPicker.restoreFromLocation().
   * Returns ordered names from root to leaf.
   */
  readonly locationBreadcrumb = computed<string[]>(() => {
    const loc = this.visit()?.location;
    if (!loc) return [];
    const all = this.allLocations();
    // If locations haven't loaded yet, fall back to whatever the visit response gave us.
    if (all.length === 0) return [loc.name];

    const find = (id: string | undefined | null): LocationDto | null =>
      all.find(l => l.id === id) ?? null;

    const crumbs: string[] = [];
    if (loc.type === 'Room') {
      const room     = find(loc.id) ?? loc;
      const building = find(room.parent?.id);
      const site     = building ? find(building.parent?.id) : null;
      if (site)     crumbs.push(site.name);
      if (building) crumbs.push(building.name);
      crumbs.push(room.name);
    } else if (loc.type === 'Building') {
      const building = find(loc.id) ?? loc;
      const site     = find(building.parent?.id);
      if (site) crumbs.push(site.name);
      crumbs.push(building.name);
    } else {
      crumbs.push(loc.name);
    }
    return crumbs;
  });

  /** System-level organizers (OrganizerDto) — often null from the API. */
  readonly organizers = computed<OrganizerDto[]>(
    () => this.visit()?.organizers ?? []
  );

  /** Invited visitors whose role is Organizer. */
  readonly invitedOrganizers = computed<VisitorInvitationDto[]>(
    () => (this.visit()?.visitorInvitations ?? []).filter(i => i.role === 'Organizer')
  );

  readonly allRequiredCollected = computed(() => {
    const docs = this.requiredDocs();
    const collected = this.session.collectedDocs();
    return docs
      .filter(d => d.required)
      .every(d => collected.some(c => c.label === d.label));
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.visitId   = this.route.snapshot.paramMap.get('visitId')   ?? '';
    this.visitorId = this.route.snapshot.paramMap.get('visitorId') ?? '';

    if (!this.visitId || !this.visitorId) {
      this.error.set('Invalid route — visit or visitor ID missing.');
      this.loading.set(false);
      return;
    }

    // Store IDs in session so capture pages can return here.
    this.session.visitId.set(this.visitId);
    this.session.visitorId.set(this.visitorId);

    try {
      const [visit, badgeSettings, locationsPage] = await Promise.all([
        this.visitorService.getVisitById(this.visitId),
        this.visitorService.getBadgeSettings().catch(() => null),
        this.visitorService.getAllLocations({ PageSize: 500 }).catch(() => null),
      ]);

      this.visit.set(visit);
      this.allLocations.set(locationsPage?.items ?? []);

      const inv = (visit.visitorInvitations ?? []).find(i => i.visitor.id === this.visitorId) ?? null;
      this.invitation.set(inv);

      const docs = badgeSettings?.requiredOnboardingData ?? [];
      this.requiredDocs.set(docs);
    } catch {
      this.error.set('Failed to load visit details. Please try again.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Navigate to the appropriate capture page for the given document type. */
  collectDoc(doc: OnboardingData): void {
    const returnTo = `/reception/onboarding/checkin/${this.visitId}/${this.visitorId}`;
    switch (doc.dataType) {
      case 'Photo':
        this.router.navigate(['/reception/onboarding/selfie'], {
          queryParams: { label: doc.label, returnTo },
        });
        break;
      case 'IDCard':
      case 'Image':
      case 'Page':
        this.router.navigate(['/reception/onboarding/capture'], {
          queryParams: { label: doc.label, dataType: doc.dataType, returnTo },
        });
        break;
    }
  }

  /** Finalise the check-in: submit collected docs then call checkInVisitor. */
  async confirmCheckIn(): Promise<void> {
    if (!this.allRequiredCollected() || this.checkingIn()) return;
    this.checkingIn.set(true);
    this.error.set(null);
    this.cdr.markForCheck();

    try {
      // Build additionalData map from all collected docs.
      const additionalData: Record<string, AdditionalDataDto> = {};
      for (const doc of this.session.collectedDocs()) {
        additionalData[doc.label] = {
          label: doc.label,
          type: 'ImageBase64',
          data: doc.base64,
        };
      }

      const onboardingPayload: VisitorOnboardingDto = {
        visitId: this.visitId,
        visitorId: this.visitorId,
        additionalData,
      };

      await this.visitorService.visitorOnboarded(onboardingPayload);

      const visitor = await this.visitorService.checkInVisitor(this.visitorId, this.visitId);
      this.session.visitor.set(visitor);

      this.router.navigate(['/reception/onboarding/done']);
    } catch {
      this.error.set('Check-in failed. Please try again.');
      this.checkingIn.set(false);
      this.cdr.markForCheck();
    }
  }

  /** Returns to the QR scan page. */
  goBack(): void {
    this.router.navigate(['/reception/onboarding/qrcode']);
  }

  // ─── Template helpers ─────────────────────────────────────────────────────

  isDocCollected(label: string): boolean {
    return this.session.collectedDocs().some(d => d.label === label);
  }

  docPreview(label: string): string | null {
    return this.session.getDoc(label)?.base64 ?? null;
  }

  docTypeIcon(dataType: string): string {
    switch (dataType) {
      case 'Photo':   return 'pi pi-camera';
      case 'IDCard':  return 'pi pi-id-card';
      case 'Image':   return 'pi pi-image';
      case 'Page':    return 'pi pi-file';
      default:        return 'pi pi-file';
    }
  }
}
