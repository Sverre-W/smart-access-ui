import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { KioskSessionService } from '../services/kiosk-session-service';

@Component({
  selector: 'app-onboarding-done',
  imports: [],
  templateUrl: './onboarding-done.html',
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingDone implements OnInit, OnDestroy {
  private router = inject(Router);
  private session = inject(KioskSessionService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    // Auto-navigate back to arrivals after 5 seconds — no interaction required
    this.timer = setTimeout(() => this.goToArrivals(), 5000);
  }

  ngOnDestroy(): void {
    // Clean up timer to prevent navigation after component is destroyed
    if (this.timer) clearTimeout(this.timer);
  }

  goToArrivals(): void {
    this.session.reset();
    this.router.navigate(['/reception/arrivals']);
  }
}
