import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-onboarding-shell',
  imports: [RouterOutlet],
  templateUrl: './onboarding-shell.html',
  styleUrl: './onboarding-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingShell {}
