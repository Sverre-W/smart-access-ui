import { Injectable, signal } from '@angular/core';
import { VisitorWithAccessDto } from '../../../visitors/services/visitor-service';

@Injectable({ providedIn: 'root' })
export class KioskSessionService {
  // ─── Session State Signals ────────────────────────────────────────────────

  /** Raw QR code string decoded from the visitor's badge. */
  qrCode = signal<string | null>(null);

  /** Visitor record returned by the check-in API after a successful QR scan. */
  visitor = signal<VisitorWithAccessDto | null>(null);

  /** Base64-encoded selfie captured during the selfie step. */
  face = signal<string | null>(null);

  // ─── Actions ──────────────────────────────────────────────────────────────

  /** Resets the entire kiosk session — called on START OVER or after Done auto-navigates away. */
  reset(): void {
    this.qrCode.set(null);
    this.visitor.set(null);
    this.face.set(null);
  }
}
