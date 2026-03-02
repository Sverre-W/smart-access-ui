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
];
