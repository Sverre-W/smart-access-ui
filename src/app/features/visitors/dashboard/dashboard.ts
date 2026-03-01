import { Component } from '@angular/core';

@Component({
  selector: 'app-visitors-dashboard',
  templateUrl: './dashboard.html',
})
export class VisitorsDashboard {
  readonly statCards = [
    { label: 'Expected today',  icon: 'pi pi-calendar',      value: '—', sub: 'No data yet' },
    { label: 'Checked in',      icon: 'pi pi-check-circle',  value: '—', sub: 'No data yet' },
    { label: 'On-site now',     icon: 'pi pi-map-marker',    value: '—', sub: 'No data yet' },
    { label: 'Checked out',     icon: 'pi pi-sign-out',      value: '—', sub: 'No data yet' },
  ];
}
