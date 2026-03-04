import { Routes } from '@angular/router';

export const facilityRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard/dashboard').then(m => m.FacilityDashboard),
  },
  {
    path: 'agents',
    loadComponent: () => import('./agents/agents').then(m => m.FacilityAgents),
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
    path: 'access-policies',
    loadComponent: () => import('./access-policies/access-policies').then(m => m.FacilityAccessPolicies),
  },
  {
    path: 'access-policies/systems/:systemId',
    loadComponent: () => import('./access-policies/edit-system').then(m => m.EditSystem),
  },
  {
    path: 'access-policies/rule-sets/:ruleSetId',
    loadComponent: () => import('./access-policies/edit-rule-set').then(m => m.EditRuleSet),
  },
  {
    path: 'locations',
    loadComponent: () => import('./locations/locations').then(m => m.FacilityLocations),
  },
  {
    path: 'locations/sites/:siteId',
    loadComponent: () => import('./locations/edit-site').then(m => m.EditSite),
  },
  {
    path: 'locations/buildings/:buildingId',
    loadComponent: () => import('./locations/edit-building').then(m => m.EditBuilding),
  },
  {
    path: 'roles',
    loadComponent: () => import('./roles/roles').then(m => m.FacilityRoles),
  },
  {
    path: 'roles/:roleName',
    loadComponent: () => import('./roles/edit-role').then(m => m.EditRole),
  },
];
