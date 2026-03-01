import { Component } from '@angular/core';

@Component({
  selector: 'app-visitors-settings',
  templateUrl: './settings.html',
})
export class VisitorsSettings {
  readonly sections = [
    {
      title: 'General',
      icon: 'pi pi-sliders-h',
      description: 'Site name, default check-in flow, and language preferences.',
    },
    {
      title: 'Notifications',
      icon: 'pi pi-bell',
      description: 'Email and push notification rules for arrivals and overdue visits.',
    },
    {
      title: 'Integrations',
      icon: 'pi pi-link',
      description: 'Connect with access control systems, Active Directory, and calendars.',
    },
    {
      title: 'Danger Zone',
      icon: 'pi pi-exclamation-triangle',
      description: 'Reset configuration or remove all visitor data.',
    },
  ];
}
