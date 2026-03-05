import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { KioskSessionService } from '../services/kiosk-session-service';
import { FaceDetectorService } from '../services/face-detector-service';

/** How many milliseconds of continuous valid-face before the photo is taken. */
const CAPTURE_DELAY_MS = 3000;

@Component({
  selector: 'app-onboarding-selfie',
  imports: [],
  templateUrl: './onboarding-selfie.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingSelfie implements OnInit, AfterViewInit, OnDestroy {

  // ── Services ────────────────────────────────────────────────────────────────

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private session = inject(KioskSessionService);
  private faceDetector = inject(FaceDetectorService);
  private cdr = inject(ChangeDetectorRef);

  // ── Element Refs ────────────────────────────────────────────────────────────

  private videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  // ── Route query params ──────────────────────────────────────────────────────

  private label = 'Photo';
  private returnTo = '/reception/onboarding/done';

  // ── State Signals ───────────────────────────────────────────────────────────

  /** Whether the face is currently valid (drives border colour). */
  readonly faceValid = signal(false);

  /** Countdown digit shown in the oval (3 → 2 → 1 → capture). Null = not counting. */
  readonly countdown = signal<number | null>(null);

  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  /** Timestamp when the face first became continuously valid. */
  private faceValidSince: number | null = null;

  /** Last countdown digit rendered — avoids redundant cdr.markForCheck calls. */
  private lastCountdownRendered: number | null = null;

  /** Guard: capture runs at most once per page visit. */
  private captureStarted = false;

  private rafId: number | null = null;
  private activeStream: MediaStream | null = null;

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly borderCss = computed(() =>
    this.faceValid()
      ? '6px solid rgba(34,197,94,0.8)'
      : '6px solid transparent'
  );

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.label    = params.get('label')    ?? 'Photo';
    this.returnTo = params.get('returnTo') ?? '/reception/onboarding/done';
  }

  ngAfterViewInit(): void {
    const videoRef  = this.videoEl();
    const canvasRef = this.canvasEl();
    if (!videoRef || !canvasRef) return;

    const video  = videoRef.nativeElement;
    const canvas = canvasRef.nativeElement;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then(async stream => {
        this.activeStream = stream;
        video.srcObject = stream;

        await new Promise<void>(resolve => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });

        // Canvas internal resolution = square matching the video crop.
        const size = Math.min(video.videoWidth || 640, video.videoHeight || 640);
        canvas.width  = size;
        canvas.height = size;

        await this.faceDetector.initialize();
        this.startLoop(video, canvas);
      })
      .catch(err => {
        this.errorMessage.set('Camera access denied: ' + String(err));
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.stopCamera();
    this.faceDetector.dispose();
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnTo);
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private stopCamera(): void {
    if (this.activeStream) {
      for (const track of this.activeStream.getTracks()) track.stop();
      this.activeStream = null;
    }
  }

  private startLoop(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
    const loop = (timestamp: number) => {
      if (this.captureStarted) return;

      // ── Detect ──────────────────────────────────────────────────────────────
      const { faceValid, hint } = this.faceDetector.detect(video, timestamp);

      // ── Countdown logic ─────────────────────────────────────────────────────
      let countdown: number | null = null;

      if (faceValid) {
        if (this.faceValidSince === null) {
          this.faceValidSince = timestamp;
        }

        const elapsed = timestamp - this.faceValidSince;
        const remaining = CAPTURE_DELAY_MS - elapsed;

        if (remaining <= 0) {
          // Time's up — capture.
          this.captureStarted = true;
          this.faceDetector.drawOverlay(video, canvas, true, '', null);
          this.capture(canvas);
          return;
        }

        // Show ceiling of remaining seconds: 3 → 2 → 1
        countdown = Math.ceil(remaining / 1000);
      } else {
        this.faceValidSince = null;
      }

      // ── Draw overlay ────────────────────────────────────────────────────────
      this.faceDetector.drawOverlay(video, canvas, faceValid, hint, countdown);

      // ── Update Angular signals only when something changed ──────────────────
      const newValid = faceValid;
      const newCountdown = countdown;

      if (
        this.faceValid()   !== newValid ||
        this.lastCountdownRendered !== newCountdown
      ) {
        this.faceValid.set(newValid);
        this.countdown.set(newCountdown);
        this.lastCountdownRendered = newCountdown;
        this.cdr.markForCheck();
      }

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  private capture(canvas: HTMLCanvasElement): void {
    // Capture from the raw video feed — no overlay, no scrim, no oval.
    const video = this.videoEl()?.nativeElement;
    let base64: string;

    if (video && video.readyState >= 2) {
      const offscreen = document.createElement('canvas');
      offscreen.width  = canvas.width;
      offscreen.height = canvas.height;
      const ctx = offscreen.getContext('2d')!;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const srcSize = Math.min(vw, vh);
      const srcX = (vw - srcSize) / 2;
      const srcY = (vh - srcSize) / 2;
      ctx.drawImage(video, srcX, srcY, srcSize, srcSize, 0, 0, offscreen.width, offscreen.height);
      base64 = offscreen.toDataURL('image/jpeg', 0.9);
    } else {
      // Fallback: use the overlay canvas if video is unavailable.
      base64 = canvas.toDataURL('image/jpeg', 0.9);
    }

    this.session.setDoc(this.label, base64);

    this.stopCamera();
    this.statusMessage.set('Photo captured!');
    this.faceValid.set(true);
    this.cdr.markForCheck();

    setTimeout(() => this.router.navigateByUrl(this.returnTo), 600);
  }
}
