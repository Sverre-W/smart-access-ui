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
import { FormsModule } from '@angular/forms';
import { KioskSessionService } from '../services/kiosk-session-service';
import { CameraService } from '../services/camera-service';
import { CameraPreferenceService } from '../services/camera-preference-service';

@Component({
  selector: 'app-onboarding-capture',
  imports: [FormsModule],
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

  readonly camera = inject(CameraService);
  private prefs = inject(CameraPreferenceService);

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

  // ── Computed ────────────────────────────────────────────────────────────────

  readonly videoTransform = computed(() =>
    this.camera.mirrored() ? 'scaleX(-1)' : 'none'
  );

  readonly hasMultipleCameras = computed(() => this.camera.cameras().length > 1);

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.label    = params.get('label')    ?? 'Document';
    this.dataType = params.get('dataType') ?? 'Image';
    this.returnTo = params.get('returnTo') ?? '/reception/onboarding/done';
  }

  ngAfterViewInit(): void {
    // Restore saved preferences before starting stream.
    const pref = this.prefs.load('document');
    this.camera.mirrored.set(pref.mirrored);

    this.startCamera(pref.deviceId ?? undefined);
  }

  ngOnDestroy(): void {
    this.camera.stopStream();
  }

  // ── Camera ──────────────────────────────────────────────────────────────────

  private startCamera(savedDeviceId?: string): void {
    const videoRef = this.videoEl();
    if (!videoRef) return;

    const video = videoRef.nativeElement;

    this.camera.enumerateDevices(savedDeviceId).then(async () => {
      const selected = this.camera.selectedCamera();
      if (!selected) {
        this.errorMessage.set('No camera found.');
        this.cdr.markForCheck();
        return;
      }

      try {
        await this.camera.enableCameraForVideoElement(video, selected.deviceId, () => {
          this.cameraReady.set(true);
          this.cdr.markForCheck();
        });
      } catch (err) {
        this.errorMessage.set('Camera access denied: ' + String(err));
        this.cdr.markForCheck();
      }
    });
  }

  // ── Camera controls ─────────────────────────────────────────────────────────

  async onCameraChange(deviceId: string): Promise<void> {
    const videoRef = this.videoEl();
    if (!videoRef) return;

    const device = this.camera.cameras().find(c => c.deviceId === deviceId);
    if (!device) return;

    this.camera.selectedCamera.set(device);
    this.prefs.saveDeviceId('document', deviceId);
    this.cameraReady.set(false);
    this.cdr.markForCheck();

    try {
      await this.camera.switchCamera(videoRef.nativeElement, deviceId, () => {
        this.cameraReady.set(true);
        this.cdr.markForCheck();
      });
    } catch (err) {
      this.errorMessage.set('Could not switch camera: ' + String(err));
      this.cdr.markForCheck();
    }
  }

  toggleMirror(): void {
    const next = !this.camera.mirrored();
    this.camera.mirrored.set(next);
    this.prefs.saveMirrored('document', next);
    this.cdr.markForCheck();
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

    // Apply mirror flip to the captured image if mirrored mode is on.
    if (this.camera.mirrored()) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.9);

    // Pause the stream while the user reviews the preview.
    this.camera.stopStream();
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
    this.cameraReady.set(false);
    this.cdr.markForCheck();
    // Restart the camera stream for another attempt.
    const pref = this.prefs.load('document');
    this.startCamera(pref.deviceId ?? undefined);
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
