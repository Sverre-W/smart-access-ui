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
];
