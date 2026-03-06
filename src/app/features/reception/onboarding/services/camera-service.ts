import { Injectable, signal } from '@angular/core';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface CameraDevice {
  deviceId: string;
  label: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root',
})
export class CameraService {

  // ── State ──────────────────────────────────────────────────────────────────

  /** All available video input devices. */
  readonly cameras = signal<CameraDevice[]>([]);

  /** The currently selected camera device. */
  readonly selectedCamera = signal<CameraDevice | null>(null);

  /** Whether the camera feed is horizontally mirrored. */
  readonly mirrored = signal(false);

  /** The active MediaStream, kept for track cleanup on camera switches. */
  private activeStream: MediaStream | null = null;

  // ── Device Enumeration ─────────────────────────────────────────────────────

  /**
   * Queries the browser for all video input devices and populates `cameras`.
   * Restores the previously selected camera by `savedDeviceId` if provided and
   * still available; otherwise falls back to the first device.
   */
  async enumerateDevices(savedDeviceId?: string | null): Promise<void> {
    const allDevices = await navigator.mediaDevices.enumerateDevices();

    const videoDevices: CameraDevice[] = allDevices
      .filter(d => d.kind === 'videoinput')
      .map(d => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId}` }));

    this.cameras.set(videoDevices);

    const preferred = savedDeviceId
      ? (videoDevices.find(d => d.deviceId === savedDeviceId) ?? videoDevices[0])
      : videoDevices[0];

    this.selectedCamera.set(preferred ?? null);
  }

  // ── Stream Management ──────────────────────────────────────────────────────

  /**
   * Opens a getUserMedia stream for the given deviceId, attaches it to the
   * provided video element, and calls `onReady` once metadata is available.
   * Any previously active stream is stopped first.
   */
  async enableCameraForVideoElement(
    videoEl: HTMLVideoElement,
    deviceId: string,
    onReady: () => void,
  ): Promise<void> {
    // Always clean up previous stream before opening a new one.
    this.stopStream();

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
    });

    this.activeStream = stream;
    videoEl.srcObject = stream;

    // Fire `onReady` once the video dimensions are known.
    videoEl.addEventListener('loadedmetadata', onReady, { once: true });
  }

  /**
   * Stops all tracks on the active stream and releases the reference.
   * Safe to call when no stream is active.
   */
  stopStream(): void {
    if (!this.activeStream) return;

    for (const track of this.activeStream.getTracks()) {
      track.stop();
    }

    this.activeStream = null;
  }

  // ── Camera Switching ───────────────────────────────────────────────────────

  /**
   * Stops the current stream and starts a new one for `deviceId`.
   * The component is responsible for providing the video element and ready callback.
   */
  async switchCamera(
    videoEl: HTMLVideoElement,
    deviceId: string,
    onReady: () => void,
  ): Promise<void> {
    this.stopStream();
    await this.enableCameraForVideoElement(videoEl, deviceId, onReady);
  }
}
