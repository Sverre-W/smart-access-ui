import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { KioskSessionService } from '../services/kiosk-session-service';
import { VisitorService } from '../../../visitors/services/visitor-service';

@Component({
  selector: 'app-onboarding-qrcode',
  templateUrl: './onboarding-qrcode.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingQrcode implements OnInit, AfterViewInit, OnDestroy {

  // ─── Services ────────────────────────────────────────────────────────────────

  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private session = inject(KioskSessionService);
  private visitorService = inject(VisitorService);
  private cdr = inject(ChangeDetectorRef);

  // ─── Element Refs ─────────────────────────────────────────────────────────

  readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  // ─── State Signals ────────────────────────────────────────────────────────

  /** Border color representing current scan state. */
  readonly borderColor = signal<'transparent' | 'green' | 'red'>('transparent');

  /** User-facing error message shown below the viewfinder. */
  readonly errorMessage = signal<string | null>(null);

  /** Whether the debug overlay is shown (activated via ?debug=true). */
  readonly isDebugMode = signal(false);

  /** Debug overlay data — visible only when ?debug=true. */
  readonly debugInfo = signal<{
    qrValue: string | null;
    visitId: string | null;
    visitorId: string | null;
    error: string | null;
  }>({ qrValue: null, visitId: null, visitorId: null, error: null });

  /** Last successfully scanned QR value — used to deduplicate rapid re-scans. */
  private lastScannedQr = signal<string | null>(null);

  // ─── Computed ─────────────────────────────────────────────────────────────

  readonly viewfinderBorder = computed(() => {
    const c = this.borderColor();
    if (c === 'green') return 'rgba(0, 255, 0, 0.3)';
    if (c === 'red') return 'rgba(255, 0, 0, 0.3)';
    return 'transparent';
  });

  // ─── Scanner Controls ─────────────────────────────────────────────────────

  private scannerControls: IScannerControls | null = null;

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const isDebug = this.activatedRoute.snapshot.queryParams['debug'] === 'true';
    this.isDebugMode.set(isDebug);
  }

  ngAfterViewInit(): void {
    const videoEl = this.videoEl()?.nativeElement;
    if (!videoEl) return;
    this.startScanner(videoEl);
  }

  ngOnDestroy(): void {
    this.scannerControls?.stop();
  }

  // ─── Scanner ──────────────────────────────────────────────────────────────

  /**
   * Uses ZXing's decodeFromConstraints which handles camera permission,
   * stream setup and the decode loop internally — no pre-enumeration needed.
   * The environment-facing camera is preferred so visitors can scan a code
   * they're holding; falls back to any available camera.
   */
  private startScanner(videoEl: HTMLVideoElement): void {
    const reader = new BrowserQRCodeReader();

    reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      videoEl,
      (result, error, controls) => {
        if (controls && !this.scannerControls) {
          this.scannerControls = controls;
        }

        if (result) {
          this.handleSuccessfulScan(result.getText());
          return;
        }

        // NotFoundException fires on every frame without a QR code — normal.
        if (error && !(error instanceof NotFoundException)) {
          this.handleScanError(error);
        }
      },
    );
  }

  // ─── Scan Handlers ────────────────────────────────────────────────────────

  /**
   * Called when a QR code frame is decoded.
   *
   * Flow:
   *  1. Deduplicate: ignore if same code is already being processed.
   *  2. Look up the token via getTokenAssociation (404 → treated as empty).
   *  3. 0 results → "Invalid QR code" error, return to home after 5 s.
   *  4. 1 result  → check in immediately, navigate to /selfie.
   *  5. 2+ results → store associations in session, navigate to /select
   *                  so the guard can pick the correct visit.
   */
  private handleSuccessfulScan(qrValue: string): void {
    if (qrValue === this.lastScannedQr()) return;
    this.lastScannedQr.set(qrValue);
    this.session.qrCode.set(qrValue);

    this.debugInfo.update(d => ({ ...d, qrValue }));

    // Minimum 2 s green flash so the visitor sees feedback.
    const minDelay = new Promise<void>(resolve => setTimeout(resolve, 2000));

    const lookup = this.visitorService
      .getTokenAssociation(qrValue)
      .then(associations => {
        if (!associations || associations.length === 0) {
          return Promise.reject(new InvalidQrError());
        }
        return associations;
      });

    Promise.all([lookup, minDelay])
      .then(([associations]) => {
        this.borderColor.set('green');
        this.cdr.markForCheck();
        this.scannerControls?.stop();

        if (associations.length === 1) {
          // Single match — go straight to the check-in overview.
          const { visitId, visitorId } = associations[0];
          this.debugInfo.update(d => ({ ...d, visitId, visitorId }));
          this.session.visitId.set(visitId);
          this.session.visitorId.set(visitorId);
          this.router.navigate(['/reception/onboarding/checkin', visitId, visitorId]);
          return Promise.resolve();
        }

        // Multiple matches — let the guard pick the visit.
        this.session.associations.set(associations);
        this.router.navigate(['/reception/onboarding/select']);
        return Promise.resolve();
      })
      .catch(err => {
        this.borderColor.set('red');
        this.errorMessage.set(
          err instanceof InvalidQrError
            ? 'Invalid QR code — no visitor found.'
            : 'Something went wrong. Please try again.'
        );
        this.debugInfo.update(d => ({ ...d, error: String(err) }));
        this.cdr.markForCheck();

        setTimeout(() => {
          this.router.navigate(['/reception/onboarding/home']);
        }, 5000);
      });
  }

  private handleScanError(error: Error): void {
    this.borderColor.set('red');
    this.debugInfo.update(d => ({ ...d, error: String(error) }));
    this.cdr.markForCheck();
  }
}

// ─── Sentinel error type ──────────────────────────────────────────────────────

class InvalidQrError extends Error {
  constructor() {
    super('Invalid QR code');
  }
}
