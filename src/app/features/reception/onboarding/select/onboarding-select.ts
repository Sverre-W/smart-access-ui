import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { KioskSessionService } from '../services/kiosk-session-service';
import { VisitorTokenAssociationDto } from '../../../visitors/services/visitor-service';

@Component({
  selector: 'app-onboarding-select',
  imports: [],
  templateUrl: './onboarding-select.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingSelect implements OnInit {

  // ─── Services ────────────────────────────────────────────────────────────────

  private router = inject(Router);
  private session = inject(KioskSessionService);

  // ─── State ───────────────────────────────────────────────────────────────────

  readonly associations = signal<VisitorTokenAssociationDto[]>([]);

  /** Kept for template compatibility — navigation is now synchronous so this is always null. */
  readonly loadingId = signal<string | null>(null);

  /** Kept for template compatibility — errors are not expected in this simplified flow. */
  readonly errorMessage = signal<string | null>(null);

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const stored = this.session.associations();
    if (!stored.length) {
      this.router.navigate(['/reception/onboarding/home']);
      return;
    }
    this.associations.set(stored);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /** Navigate to the check-in overview for the chosen visit. */
  selectVisit(association: VisitorTokenAssociationDto): void {
    this.session.visitId.set(association.visitId);
    this.session.visitorId.set(association.visitorId);
    this.session.associations.set([]);
    this.router.navigate(['/reception/onboarding/checkin', association.visitId, association.visitorId]);
  }

  /** Cancels and returns to the QR scan page so the visitor can try again. */
  cancel(): void {
    this.session.associations.set([]);
    this.router.navigate(['/reception/onboarding/qrcode']);
  }

  /** Formats a raw ISO date string as a human-readable time only, e.g. "14:30". */
  formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
