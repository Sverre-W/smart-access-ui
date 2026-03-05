import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { KioskSessionService } from '../services/kiosk-session-service';
import { VisitorService, VisitorTokenAssociationDto } from '../../../visitors/services/visitor-service';

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
  private visitorService = inject(VisitorService);
  private cdr = inject(ChangeDetectorRef);

  // ─── State ───────────────────────────────────────────────────────────────────

  readonly associations = signal<VisitorTokenAssociationDto[]>([]);
  readonly loadingId = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const stored = this.session.associations();
    if (!stored.length) {
      // No associations in session — guard against direct navigation.
      this.router.navigate(['/reception/onboarding/home']);
      return;
    }
    this.associations.set(stored);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  /** Called when the guard taps a visit row. Checks the visitor in and proceeds to selfie. */
  selectVisit(association: VisitorTokenAssociationDto): void {
    if (this.loadingId()) return;

    this.loadingId.set(association.visitId);
    this.errorMessage.set(null);
    this.cdr.markForCheck();

    this.visitorService
      .checkInVisitor(association.visitorId, association.visitId)
      .then(visitor => {
        this.session.visitor.set(visitor);
        this.session.associations.set([]);
        this.router.navigate(['/reception/onboarding/selfie']);
      })
      .catch(() => {
        this.loadingId.set(null);
        this.errorMessage.set('Check-in failed. Please try again.');
        this.cdr.markForCheck();
      });
  }

  /** Cancels and returns to the QR scan page so the visitor can try again. */
  cancel(): void {
    this.session.associations.set([]);
    this.router.navigate(['/reception/onboarding/qrcode']);
  }

  /** Formats a raw ISO date string as a human-readable time range for the card. */
  formatTime(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
