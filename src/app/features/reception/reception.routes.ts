import { Routes } from '@angular/router';

export const receptionRoutes: Routes = [
  {
    path: '',
    redirectTo: 'arrivals',
    pathMatch: 'full',
  },
  {
    path: 'arrivals',
    loadComponent: () => import('./arrivals/arrivals').then(m => m.Arrivals),
  },
  {
    path: 'onboarding',
    redirectTo: '/reception/onboarding/home',
    pathMatch: 'prefix',
  },
  {
    path: 'onboarding-templates',
    loadComponent: () =>
      import('./onboarding-templates/onboarding-templates').then(m => m.FacilityOnboardingTemplates),
  },
  {
    path: 'onboarding-templates/:templateId',
    loadComponent: () =>
      import('./onboarding-templates/onboarding-template-detail').then(m => m.OnboardingTemplateDetail),
  },
];
