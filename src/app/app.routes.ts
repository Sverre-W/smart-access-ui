import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
  },
  {
    path: 'visitors/confirm',
    loadComponent: () =>
      import('./features/reception/onboarding/shell/onboarding-shell')
        .then(m => m.OnboardingShell),
    loadChildren: () =>
      import('./features/visitors/confirm.routes')
        .then(m => m.confirmVisitRoutes),
  },
  {
    path: 'visitors',
    loadChildren: () =>
      import('./features/visitors/visitors.routes')
        .then(m => m.visitorsRoutes)
  },
  {
    path: 'facility',
    loadChildren: () =>
      import('./features/facility/facility.routes')
        .then(m => m.facilityRoutes)
  },
  {
    path: 'reception/onboarding',
    loadComponent: () =>
      import('./features/reception/onboarding/shell/onboarding-shell')
        .then(m => m.OnboardingShell),
    loadChildren: () =>
      import('./features/reception/onboarding/onboarding.routes')
        .then(m => m.onboardingRoutes),
  },
  {
    path: 'reception',
    loadChildren: () =>
      import('./features/reception/reception.routes')
        .then(m => m.receptionRoutes)
  },
  {
    path: 'visitor',
    loadComponent: () =>
      import('./features/reception/onboarding/shell/onboarding-shell')
        .then(m => m.OnboardingShell),
    loadChildren: () =>
      import('./features/visitors/confirm.routes')
        .then(m => m.confirmVisitRoutes),
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/settings/settings.routes')
        .then(m => m.settingsRoutes)
  },
  {
    path: '**',
    redirectTo: '',
  },
];
