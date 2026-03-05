import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-onboarding-home',
  imports: [],
  templateUrl: './onboarding-home.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingHome {
  private router = inject(Router);

  start(): void {
    this.router.navigate(['/reception/onboarding/qrcode']);
  }
}
