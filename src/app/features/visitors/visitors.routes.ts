import { Routes } from '@angular/router';

export const visitorsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard/dashboard').then(m => m.VisitorsDashboard),
  },
  {
    path: 'list',
    loadComponent: () => import('./list/list').then(m => m.VisitorsList),
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings').then(m => m.VisitorsSettings),
  },
  {
    path: 'settings/notifications/:category',
    loadComponent: () =>
      import('./notification-settings/notification-settings').then(m => m.NotificationSettings),
  },
  {
    path: 'create',
    loadComponent: () => import('./create-visit/create-visit').then(m => m.CreateVisit),
  },
  {
    path: 'edit/:id',
    loadComponent: () => import('./edit-visit/edit-visit').then(m => m.EditVisit),
  },
  {
    path: 'visitor/:id',
    loadComponent: () => import('./visitor-detail/visitor-detail').then(m => m.VisitorDetail),
  },
  {
    path: 'onboarding/:visitId/:visitorId',
    loadComponent: () => import('./onboarding-detail/onboarding-detail').then(m => m.OnboardingDetail),
  },
  {
    path: 'reports',
    loadComponent: () => import('./reports/reports').then(m => m.Reports),
  },
];
