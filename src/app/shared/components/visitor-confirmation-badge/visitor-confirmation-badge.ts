import { Component, input, computed } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { VisitorConfirmation } from '../../../features/visitors/services/visitor-service';

const CONFIRMATION_CLASSES: Record<VisitorConfirmation, string> = {
  ACCEPTED:  'bg-green-50 text-green-600',
  DECLINED:  'bg-red-50 text-red-500',
  TENTATIVE: 'bg-amber-50 text-amber-600',
  DELEGATED: 'bg-purple-50 text-purple-600',
  UNKNOWN:   'bg-zinc-100 text-zinc-500',
};

@Component({
  selector: 'app-visitor-confirmation-badge',
  imports: [TranslateModule],
  templateUrl: './visitor-confirmation-badge.html',
})
export class VisitorConfirmationBadge {
  readonly status = input<VisitorConfirmation | null>(null);

  readonly classes = computed(
    () => CONFIRMATION_CLASSES[this.status() ?? 'UNKNOWN'] ?? 'bg-zinc-100 text-zinc-500',
  );

  readonly labelKey = computed(
    () => `visitors.confirmationStatus.${this.status() ?? 'UNKNOWN'}`,
  );
}
