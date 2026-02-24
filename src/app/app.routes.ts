import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'visitors',
    loadChildren: () =>
      import('./features/visitors/visitors.routes')
        .then(m => m.visitorsRoutes)
  },
];
