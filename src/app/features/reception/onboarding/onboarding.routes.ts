import { Routes } from '@angular/router';

export const onboardingRoutes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadComponent: () => import('./home/onboarding-home').then(m => m.OnboardingHome),
  },
  {
    path: 'qrcode',
    loadComponent: () => import('./qrcode/onboarding-qrcode').then(m => m.OnboardingQrcode),
  },
  {
    path: 'select',
    loadComponent: () => import('./select/onboarding-select').then(m => m.OnboardingSelect),
  },
  {
    path: 'selfie',
    loadComponent: () => import('./selfie/onboarding-selfie').then(m => m.OnboardingSelfie),
  },
  {
    path: 'done',
    loadComponent: () => import('./done/onboarding-done').then(m => m.OnboardingDone),
  },
];
