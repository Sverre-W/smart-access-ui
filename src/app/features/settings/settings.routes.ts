import { Routes } from '@angular/router';

export const settingsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard/dashboard').then(m => m.SettingsDashboard),
  },
  {
    path: 'users',
    loadComponent: () => import('./users/users').then(m => m.SettingsUsers),
  },
  {
    path: 'users/:userId',
    loadComponent: () => import('./users/edit-user').then(m => m.EditUser),
  },
  {
    path: 'users/groups/:groupId',
    loadComponent: () => import('./users/edit-group').then(m => m.EditGroup),
  },
  {
    path: 'roles',
    loadComponent: () => import('./roles/roles').then(m => m.FacilityRoles),
  },
  {
    path: 'roles/:roleName',
    loadComponent: () => import('./roles/edit-role').then(m => m.EditRole),
  },
  {
    path: 'tenants',
    loadComponent: () => import('./tenants/tenants').then(m => m.FacilityTenants),
  },
  {
    path: 'tenants/:tenantId',
    loadComponent: () => import('./tenants/edit-tenant').then(m => m.EditTenant),
  },
  {
    path: 'notifications',
    loadComponent: () => import('./notifications/notifications').then(m => m.SettingsNotifications),
  },
  {
    path: 'notifications/logs',
    loadComponent: () => import('./notifications/notification-logs').then(m => m.NotificationLogs),
  },
  {
    path: 'notifications/:id',
    loadComponent: () => import('./notifications/edit-notification').then(m => m.EditNotification),
  },
];
