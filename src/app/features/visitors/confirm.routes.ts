import { Routes } from '@angular/router';

export const confirmVisitRoutes: Routes = [
  {
    path: ':visitId/:visitorId',
    loadComponent: () => import('./confirm-visit/confirm-visit').then(m => m.ConfirmVisit),
  },
];
