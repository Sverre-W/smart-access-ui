import { Component, input, computed } from '@angular/core';
import { VisitorCheckInStatus } from '../../../features/visitors/services/visitor-service';

const CHECKIN_CLASSES: Record<VisitorCheckInStatus, string> = {
  Expected: 'bg-zinc-100 text-zinc-500',
  Arrived:  'bg-green-50 text-green-600',
  Late:     'bg-amber-50 text-amber-600',
  Left:     'bg-zinc-100 text-zinc-400',
};

@Component({
  selector: 'app-checkin-status-badge',
  standalone: true,
  templateUrl: './checkin-status-badge.html',
})
export class CheckinStatusBadge {
  readonly status = input.required<VisitorCheckInStatus>();

  readonly classes = computed(() => CHECKIN_CLASSES[this.status()] ?? 'bg-zinc-100 text-zinc-500');
}
