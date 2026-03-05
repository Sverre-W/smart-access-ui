import { Injectable, signal } from '@angular/core';
import { VisitorTokenAssociationDto, VisitorWithAccessDto } from '../../../visitors/services/visitor-service';

@Injectable({ providedIn: 'root' })
export class KioskSessionService {
  // ─── Session State Signals ────────────────────────────────────────────────

  /** Raw QR code string decoded from the visitor's badge. */
  qrCode = signal<string | null>(null);

  /** Multiple associations returned when a token matches more than one visit today. */
  associations = signal<VisitorTokenAssociationDto[]>([]);

  /** Visitor record returned by the check-in API after a successful QR scan. */
  visitor = signal<VisitorWithAccessDto | null>(null);

  /** Base64-encoded selfie captured during the selfie step. */
  face = signal<string | null>(null);

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Resets the entire kiosk session — called on START OVER or after Done auto-navigates away. */
  reset(): void {
    this.qrCode.set(null);
    this.associations.set([]);
    this.visitor.set(null);
    this.face.set(null);
  }
}
