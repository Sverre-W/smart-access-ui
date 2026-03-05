import { Component, input, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { VisitState } from '../../../features/visitors/services/visitor-service';

const STATE_CLASSES: Record<VisitState, string> = {
  SCHEDULED: 'bg-zinc-100 text-zinc-500',
  APPROVED:  'bg-blue-50 text-blue-600',
  STARTED:   'bg-green-50 text-green-600',
  FINISHED:  'bg-zinc-100 text-zinc-400',
  CANCELED:  'bg-red-50 text-red-400',
  REJECTED:  'bg-red-50 text-red-400',
  LOCKED:    'bg-amber-50 text-amber-600',
};

@Component({
  selector: 'app-visit-state-badge',
  imports: [TranslateModule],
  templateUrl: './visit-state-badge.html',
})
export class VisitStateBadge {
  readonly state = input.required<VisitState>();

  readonly classes = computed(() => STATE_CLASSES[this.state()] ?? 'bg-zinc-100 text-zinc-500');

  readonly labelKey = computed(() => `visitors.visitState.${this.state()}`);
}
