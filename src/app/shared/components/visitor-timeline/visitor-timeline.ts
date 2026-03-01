import { Component, input, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  VisitorInvitationDto,
  VisitorConfirmation,
  VisitorCheckInStatus,
} from '../../../features/visitors/services/visitor-service';

export type TimelineStepStatus = 'completed' | 'active' | 'warning' | 'skipped' | 'pending';

export interface TimelineStep {
  key: string;
  label: string;
  sublabel: string | null;
  status: TimelineStepStatus;
  icon: string;
  timestamp: string | null;
}

// Maps VisitorConfirmation to a human label
const CONFIRMATION_LABEL: Record<VisitorConfirmation, string> = {
  UNKNOWN:   'No response yet',
  ACCEPTED:  'Accepted',
  DECLINED:  'Declined',
  TENTATIVE: 'Tentative',
  DELEGATED: 'Delegated',
};

@Component({
  selector: 'app-visitor-timeline',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './visitor-timeline.html',
})
export class VisitorTimeline {
  /** The visitor invitation to render a timeline for. */
  readonly invitation = input.required<VisitorInvitationDto>();

  readonly steps = computed<TimelineStep[]>(() => {
    const inv = this.invitation();
    const conf = inv.confirmation ?? 'UNKNOWN';
    const checkIn = inv.checkInStatus;

    // ── Step 1: Invited ────────────────────────────────────────────────────
    const invited: TimelineStep = {
      key: 'invited',
      label: 'Invited',
      sublabel: inv.confirmationSentOn
        ? `Invitation sent`
        : inv.confirmationSent === false
          ? 'Invitation pending'
          : null,
      status: 'completed',
      icon: 'pi-envelope',
      timestamp: inv.confirmationSentOn,
    };

    // ── Step 2: Confirmation ───────────────────────────────────────────────
    // Skipped when declined — we still show it but mark it as such.
    let confirmedStatus: TimelineStepStatus;
    if (conf === 'ACCEPTED') {
      confirmedStatus = 'completed';
    } else if (conf === 'DECLINED') {
      confirmedStatus = 'skipped';
    } else if (conf === 'TENTATIVE' || conf === 'DELEGATED') {
      confirmedStatus = 'active';
    } else {
      // UNKNOWN — visitor hasn't responded, never auto-promote to completed
      confirmedStatus = 'active';
    }

    const confirmed: TimelineStep = {
      key: 'confirmed',
      label: 'Confirmed',
      sublabel: CONFIRMATION_LABEL[conf],
      status: confirmedStatus,
      icon: 'pi-check-circle',
      timestamp: null, // no timestamp available on the DTO for confirmation date
    };

    // ── Step 3: Arrived ────────────────────────────────────────────────────
    let arrivedStatus: TimelineStepStatus;
    if (checkIn === 'Arrived' || checkIn === 'Left') {
      arrivedStatus = 'completed';
    } else if (checkIn === 'Late') {
      arrivedStatus = 'warning';
    } else if (conf === 'DECLINED') {
      arrivedStatus = 'skipped';
    } else {
      arrivedStatus = 'pending';
    }

    const arrived: TimelineStep = {
      key: 'arrived',
      label: 'Arrived',
      sublabel: checkIn === 'Late' ? 'Overdue' : null,
      status: arrivedStatus,
      icon: 'pi-building',
      timestamp: inv.arrivedOn,
    };

    // ── Step 4: Left ───────────────────────────────────────────────────────
    let leftStatus: TimelineStepStatus;
    if (checkIn === 'Left') {
      leftStatus = 'completed';
    } else if (conf === 'DECLINED') {
      leftStatus = 'skipped';
    } else {
      leftStatus = 'pending';
    }

    const left: TimelineStep = {
      key: 'left',
      label: 'Left',
      sublabel: null,
      status: leftStatus,
      icon: 'pi-sign-out',
      timestamp: inv.leftOn,
    };

    return [invited, confirmed, arrived, left];
  });
}
