import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
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
    path: 'reception',
    loadChildren: () =>
      import('./features/reception/reception.routes')
        .then(m => m.receptionRoutes)
  },
  {
    path: '**',
    redirectTo: '',
  },
];
