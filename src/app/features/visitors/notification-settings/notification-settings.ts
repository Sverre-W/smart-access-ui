import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { NotificationEditor } from '../../../shared/components/notification-editor/notification-editor';

@Component({
  selector: 'app-notification-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, NotificationEditor],
  templateUrl: './notification-settings.html',
})
export class NotificationSettings implements OnInit {
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  readonly category = signal('');
  readonly canGoBack = signal(history.length > 1);

  ngOnInit(): void {
    this.category.set(this.route.snapshot.paramMap.get('category') ?? '');
  }

  goBack(): void {
    this.location.back();
  }
}
