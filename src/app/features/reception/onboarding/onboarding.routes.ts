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
    path: 'checkin/:visitId/:visitorId',
    loadComponent: () => import('./checkin/onboarding-checkin').then(m => m.OnboardingCheckin),
  },
  {
    path: 'selfie',
    loadComponent: () => import('./selfie/onboarding-selfie').then(m => m.OnboardingSelfie),
  },
  {
    path: 'capture',
    loadComponent: () => import('./capture/onboarding-capture').then(m => m.OnboardingCapture),
  },
  {
    path: 'done',
    loadComponent: () => import('./done/onboarding-done').then(m => m.OnboardingDone),
  },
];
