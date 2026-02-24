import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'visitors',
    loadChildren: () =>
      import('./features/visitors/visitors-module')
        .then(m => m.VisitorsModule)
  },
];
