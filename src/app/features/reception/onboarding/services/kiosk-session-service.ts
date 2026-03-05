import { Injectable, signal } from '@angular/core';
import { VisitorTokenAssociationDto, VisitorWithAccessDto } from '../../../visitors/services/visitor-service';

/** A single collected onboarding document stored in the session. */
export interface CollectedDoc {
  /** Matches OnboardingData.label from badge settings. */
  label: string;
  /** Base64 JPEG data-URL captured from camera. */
  base64: string;
}

@Injectable({ providedIn: 'root' })
export class KioskSessionService {
  // ─── Session State Signals ────────────────────────────────────────────────

  /** Raw QR code string decoded from the visitor's badge. */
  qrCode = signal<string | null>(null);

  /** Multiple associations returned when a token matches more than one visit today. */
  associations = signal<VisitorTokenAssociationDto[]>([]);

  /** visitId resolved from the QR scan or direct navigation. */
  visitId = signal<string | null>(null);

  /** visitorId resolved from the QR scan or direct navigation. */
  visitorId = signal<string | null>(null);

  /**
   * Visitor record returned by the check-in API after the guard finalises check-in.
   * Not set until the guard taps the final "Check In" button on the checkin page.
   */
  visitor = signal<VisitorWithAccessDto | null>(null);

  /**
   * Documents collected during this kiosk session, keyed by label.
   * Each capture page writes its result here so the checkin page can
   * show previews and track completion.
   */
  collectedDocs = signal<CollectedDoc[]>([]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Stores or replaces a collected document by label. */
  setDoc(label: string, base64: string): void {
    this.collectedDocs.update(docs => {
      const existing = docs.findIndex(d => d.label === label);
      if (existing >= 0) {
        const updated = [...docs];
        updated[existing] = { label, base64 };
        return updated;
      }
      return [...docs, { label, base64 }];
    });
  }

  /** Returns the collected doc for a given label, or null. */
  getDoc(label: string): CollectedDoc | null {
    return this.collectedDocs().find(d => d.label === label) ?? null;
  }

  /** Resets the entire kiosk session — called on START OVER or after Done auto-navigates away. */
  reset(): void {
    this.qrCode.set(null);
    this.associations.set([]);
    this.visitId.set(null);
    this.visitorId.set(null);
    this.visitor.set(null);
    this.collectedDocs.set([]);
  }
}
