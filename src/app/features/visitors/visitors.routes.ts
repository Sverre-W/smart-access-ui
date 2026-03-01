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
];
