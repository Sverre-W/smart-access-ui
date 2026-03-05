import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { KioskSessionService } from '../services/kiosk-session-service';

@Component({
  selector: 'app-onboarding-capture',
  imports: [],
  templateUrl: './onboarding-capture.html',
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingCapture implements OnInit, AfterViewInit, OnDestroy {

  // ── Services ────────────────────────────────────────────────────────────────

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private session = inject(KioskSessionService);
  private cdr = inject(ChangeDetectorRef);

  // ── Element Refs ────────────────────────────────────────────────────────────

  private videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  // ── Route query params ──────────────────────────────────────────────────────

  label = '';
  dataType = '';
  private returnTo = '/reception/onboarding/done';

  // ── State ───────────────────────────────────────────────────────────────────

  readonly cameraReady = signal(false);
  readonly preview = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  /** Active MediaStream — stopped on destroy or after capture. */
  private activeStream: MediaStream | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.label    = params.get('label')    ?? 'Document';
    this.dataType = params.get('dataType') ?? 'Image';
    this.returnTo = params.get('returnTo') ?? '/reception/onboarding/done';
  }

  ngAfterViewInit(): void {
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  private startCamera(): void {
    const videoRef = this.videoEl();
    if (!videoRef) return;

    const video = videoRef.nativeElement;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      .then(stream => {
        this.activeStream = stream;
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
          this.cameraReady.set(true);
          this.cdr.markForCheck();
        }, { once: true });
      })
      .catch(err => {
        this.errorMessage.set('Camera access denied: ' + String(err));
        this.cdr.markForCheck();
      });
  }

  private stopCamera(): void {
    if (this.activeStream) {
      for (const track of this.activeStream.getTracks()) track.stop();
      this.activeStream = null;
    }
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  takePhoto(): void {
    const videoRef = this.videoEl();
    const canvasRef = this.canvasEl();
    if (!videoRef || !canvasRef) return;

    const video = videoRef.nativeElement;
    const canvas = canvasRef.nativeElement;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.9);

    // Pause the stream while the user reviews the preview.
    this.stopCamera();
    this.preview.set(base64);
    this.cdr.markForCheck();
  }

  confirmPhoto(): void {
    const base64 = this.preview();
    if (!base64) return;
    this.session.setDoc(this.label, base64);
    this.router.navigateByUrl(this.returnTo);
  }

  retake(): void {
    this.preview.set(null);
    this.cdr.markForCheck();
    // Restart the camera stream for another attempt.
    this.startCamera();
  }

  cancel(): void {
    this.router.navigateByUrl(this.returnTo);
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  dataTypeIcon(): string {
    switch (this.dataType) {
      case 'IDCard': return 'pi pi-id-card';
      case 'Image':  return 'pi pi-image';
      case 'Page':   return 'pi pi-file';
      default:       return 'pi pi-camera';
    }
  }
}
