import { Injectable } from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Identifies which camera context the preference belongs to. */
export type CameraContext = 'selfie' | 'document' | 'qr';

export interface CameraPreference {
  /** Persisted deviceId, or null when no preference has been saved. */
  deviceId: string | null;
  /** Whether the feed should be horizontally mirrored. */
  mirrored: boolean;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_PREFERENCE: CameraPreference = { deviceId: null, mirrored: false };

const storageKey = (ctx: CameraContext): string => `camera-pref:${ctx}`;

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Persists per-context camera preferences (selected deviceId + mirror toggle)
 * in localStorage so kiosk operators keep their setup across page reloads.
 *
 * Non-sensitive preference data only — auth tokens are never stored here.
 * All reads/writes are wrapped in try/catch to handle SSR and private-browsing
 * environments where localStorage may be unavailable.
 */
@Injectable({ providedIn: 'root' })
export class CameraPreferenceService {

  load(ctx: CameraContext): CameraPreference {
    try {
      const raw = localStorage.getItem(storageKey(ctx));
      if (!raw) return { ...DEFAULT_PREFERENCE };
      const parsed = JSON.parse(raw) as Partial<CameraPreference>;
      return {
        deviceId: typeof parsed.deviceId === 'string' ? parsed.deviceId : null,
        mirrored: typeof parsed.mirrored === 'boolean' ? parsed.mirrored : false,
      };
    } catch {
      return { ...DEFAULT_PREFERENCE };
    }
  }

  save(ctx: CameraContext, pref: CameraPreference): void {
    try {
      localStorage.setItem(storageKey(ctx), JSON.stringify(pref));
    } catch {
      // Swallow write errors (storage quota exceeded, private browsing, etc.)
    }
  }

  saveDeviceId(ctx: CameraContext, deviceId: string): void {
    const current = this.load(ctx);
    this.save(ctx, { ...current, deviceId });
  }

  saveMirrored(ctx: CameraContext, mirrored: boolean): void {
    const current = this.load(ctx);
    this.save(ctx, { ...current, mirrored });
  }
}
