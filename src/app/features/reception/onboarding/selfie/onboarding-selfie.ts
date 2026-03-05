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
import { Router } from '@angular/router';
import { KioskSessionService } from '../services/kiosk-session-service';
import { FaceDetectorService } from '../services/face-detector-service';
import { LabelDataDto, VisitorService } from '../../../visitors/services/visitor-service';

@Component({
  selector: 'app-onboarding-selfie',
  imports: [],
  templateUrl: './onboarding-selfie.html',
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingSelfie implements OnInit, AfterViewInit, OnDestroy {

  // ── Services ────────────────────────────────────────────────────────────────

  private router = inject(Router);
  private session = inject(KioskSessionService);
  private visitorService = inject(VisitorService);
  private faceDetector = inject(FaceDetectorService);
  private cdr = inject(ChangeDetectorRef);

  // ── Element Refs ────────────────────────────────────────────────────────────

  private videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  // ── State Signals ───────────────────────────────────────────────────────────

  readonly borderColor = signal<'transparent' | 'green' | 'red'>('transparent');
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  /** Timestamp (performance.now()) when the face first became continuously valid. */
  private faceValidSince = signal<number | null>(null);

  /** Guard: ensures capture + print is triggered only once per page visit. */
  private captureStarted = signal(false);

  /** Active requestAnimationFrame handle, stored for cleanup on destroy. */
  private rafId: number | null = null;

  /** Active MediaStream — stopped on destroy. */
  private activeStream: MediaStream | null = null;

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly viewfinderBorder = computed(() => {
    const c = this.borderColor();
    if (c === 'green') return 'rgba(0, 255, 0, 0.3)';
    if (c === 'red') return 'rgba(255, 0, 0, 0.3)';
    return 'transparent';
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Reset any selfie from a previous kiosk session so stale data is never sent.
    this.session.face.set(null);
  }

  ngAfterViewInit(): void {
    const videoRef = this.videoEl();
    const canvasRef = this.canvasEl();
    if (!videoRef || !canvasRef) return;

    const video = videoRef.nativeElement;
    const canvas = canvasRef.nativeElement;

    // Request the front-facing camera directly — no pre-enumeration needed.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' } })
      .then(async stream => {
        this.activeStream = stream;
        video.srcObject = stream;

        await new Promise<void>(resolve => {
          video.addEventListener('loadedmetadata', () => resolve(), { once: true });
        });

        // Sync canvas to actual video dimensions.
        canvas.width = video.videoWidth || 400;
        canvas.height = video.videoHeight || 400;

        // Load face detection model (lazy — downloads once per session).
        await this.faceDetector.initialize(canvas);

        this.startDetectionLoop(video, canvas);
      })
      .catch(err => {
        this.errorMessage.set('Camera access denied: ' + String(err));
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    if (this.activeStream) {
      for (const track of this.activeStream.getTracks()) track.stop();
      this.activeStream = null;
    }
    this.faceDetector.dispose();
  }

  // ── Private: Detection Loop ─────────────────────────────────────────────────

  /**
   * Runs a requestAnimationFrame loop that:
   *  1. Draws each video frame to the canvas (with oval guide overlay).
   *  2. Checks face validity via FaceDetectorService.
   *  3. Accumulates valid-face time; once 2 000 ms of continuous validity
   *     is reached, triggers capture and stops the loop.
   */
  private startDetectionLoop(videoEl: HTMLVideoElement, canvasEl: HTMLCanvasElement): void {
    const loop = () => {
      if (this.captureStarted()) return;

      const timestamp = performance.now();

      // predictWebcam draws the frame + oval overlay and returns a JPEG
      // data-URL when exactly one valid face is detected; null otherwise.
      const base64 = this.faceDetector.predictWebcam(videoEl, canvasEl, timestamp);

      if (base64) {
        this.borderColor.set('green');

        if (!this.faceValidSince()) {
          this.faceValidSince.set(timestamp);
        } else if (timestamp - this.faceValidSince()! >= 2000) {
          // 2 seconds of continuous valid face — trigger capture.
          this.captureStarted.set(true);
          this.capture(base64, canvasEl);
          return;
        }
      } else {
        this.borderColor.set('transparent');
        this.faceValidSince.set(null);
      }

      this.cdr.markForCheck();
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  // ── Private: Capture & Print ────────────────────────────────────────────────

  private async capture(base64: string, _canvasEl: HTMLCanvasElement): Promise<void> {
    this.session.face.set(base64);

    const visitor = this.session.visitor();

    if (!visitor) {
      this.router.navigate(['/reception/onboarding/done']);
      return;
    }

    this.statusMessage.set('Printing label…');
    this.cdr.markForCheck();

    const printBody: LabelDataDto = {
      visitId: visitor.visitId,
      visitorId: visitor.visitorId,
      badgeId: visitor.badgeId,
      faceImageBase64: base64,
    };

    try {
      await Promise.all([
        this.visitorService.printLabel(printBody),
        new Promise(r => setTimeout(r, 2000)),
      ]);

      this.statusMessage.set('Label printed successfully!');
      this.cdr.markForCheck();

      await new Promise(r => setTimeout(r, 100));
      this.router.navigate(['/reception/onboarding/done']);
    } catch (err) {
      this.statusMessage.set(null);
      this.errorMessage.set('Something went wrong: ' + String(err));
      this.cdr.markForCheck();

      setTimeout(() => this.router.navigate(['/reception/onboarding/done']), 5000);
    }
  }
}
