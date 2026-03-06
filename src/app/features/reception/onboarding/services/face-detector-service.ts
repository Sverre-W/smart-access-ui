import { Injectable } from '@angular/core';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';

/**
 * Face must occupy between 15% and 80% of the canvas width to be considered valid.
 * This is deliberately wide so real-world conditions (distance, camera FOV) work.
 */
const BBOX_MIN_FRACTION = 0.15;
const BBOX_MAX_FRACTION = 0.80;

/** How far the face centre may stray from the canvas centre (fraction of canvas dimension). */
const CENTRE_TOLERANCE = 0.25;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FaceDetectionResult {
  /** True when exactly one properly-positioned face is detected. */
  faceValid: boolean;
  /** Contextual hint for the user when faceValid is false. */
  hint: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * FaceDetectorService
 *
 * Wraps the MediaPipe BlazeFace short-range model.
 * Detection runs against the live <video> element directly (not a canvas),
 * which is the recommended pattern for VIDEO running mode.
 *
 * Usage:
 *  1. Call `initialize()` once and await it.
 *  2. Call `detect(videoEl, timestamp)` each RAF tick — returns FaceDetectionResult.
 *  3. Draw the video frame + overlay onto your canvas using `drawOverlay()`.
 *  4. Call `dispose()` on component destroy.
 */
@Injectable({ providedIn: 'root' })
export class FaceDetectorService {

  private faceDetector: FaceDetector | undefined;
  private initPromise: Promise<void> | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.createDetector();
    return this.initPromise;
  }

  /**
   * Run face detection against the current video frame.
   * Does NOT draw anything — drawing is handled separately by drawOverlay().
   */
  detect(videoEl: HTMLVideoElement, timestamp: number): FaceDetectionResult {
    if (!this.faceDetector || videoEl.readyState < 2) {
      return { faceValid: false, hint: 'Position your face in the oval' };
    }

    const result = this.faceDetector.detectForVideo(videoEl, timestamp);
    const detections = result.detections;

    if (detections.length === 0) {
      return { faceValid: false, hint: 'Position your face in the oval' };
    }
    if (detections.length > 1) {
      return { faceValid: false, hint: 'Only one face should be visible' };
    }

    const box = detections[0].boundingBox;
    if (!box) {
      return { faceValid: false, hint: 'Position your face in the oval' };
    }

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const size = Math.min(vw, vh); // square crop size

    // bbox coords from detectForVideo are in the video's native pixel space.
    // Translate to the square-crop coordinate space used by drawOverlay.
    const cropOffsetX = (vw - size) / 2;
    const cropOffsetY = (vh - size) / 2;

    const bboxX = box.originX - cropOffsetX;
    const bboxY = box.originY - cropOffsetY;
    const bboxW = box.width;
    const bboxH = box.height;

    // ── Size check (as fraction of the square crop) ───────────────────────────
    const wFrac = bboxW / size;
    const hFrac = bboxH / size;

    if (wFrac < BBOX_MIN_FRACTION || wFrac > BBOX_MAX_FRACTION) {
      return {
        faceValid: false,
        hint: wFrac < BBOX_MIN_FRACTION ? 'Move closer to the camera' : 'Move further from the camera',
      };
    }
    if (hFrac < BBOX_MIN_FRACTION || hFrac > BBOX_MAX_FRACTION) {
      return {
        faceValid: false,
        hint: hFrac < BBOX_MIN_FRACTION ? 'Move closer to the camera' : 'Move further from the camera',
      };
    }

    // ── Centre check (in square-crop space, Y shifted upward) ─────────────────
    const faceCentreX = bboxX + bboxW / 2;
    const faceCentreY = bboxY + bboxH / 2;

    const targetX = size / 2;
    const targetY = size / 2; // oval is drawn at true centre now

    if (
      Math.abs(faceCentreX - targetX) > size * CENTRE_TOLERANCE ||
      Math.abs(faceCentreY - targetY) > size * CENTRE_TOLERANCE
    ) {
      return { faceValid: false, hint: 'Centre your face in the oval' };
    }

    return { faceValid: true, hint: '' };
  }

  /**
   * Draw one frame to the canvas:
   *  1. Crops the video to a centred square — sharp, no blur.
   *  2. Draws a blurred copy of the same frame clipped to the area OUTSIDE the oval.
   *  3. Draws a dark scrim (also clipped outside the oval) on top of the blur.
   *  4. Draws the oval border (green when valid, white otherwise).
   *  5. Draws hint text below oval or countdown number inside oval.
   *
   * The result: clear video inside the oval, blurred+darkened outside.
   */
  drawOverlay(
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement,
    faceValid: boolean,
    hint: string,
    countdown: number | null,
    /** When true the canvas has CSS scaleX(-1); counter-mirror text so it reads correctly. */
    mirrored = true,
  ): void {
    const ctx = canvasEl.getContext('2d');
    if (!ctx || videoEl.readyState < 2) return;

    const cw = canvasEl.width;
    const ch = canvasEl.height;

    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const srcSize = Math.min(vw, vh);
    const srcX = (vw - srcSize) / 2;
    const srcY = (vh - srcSize) / 2;

    const centreX = cw / 2;
    const centreY = ch / 2;
    const radiusX = (cw * 0.55) / 2;
    const radiusY = (ch * 0.72) / 2;

    // ── 1. Clear sharp video frame (full canvas) ──────────────────────────────
    ctx.filter = 'none';
    ctx.drawImage(videoEl, srcX, srcY, srcSize, srcSize, 0, 0, cw, ch);

    // ── 2. Blurred + darkened layer clipped to OUTSIDE the oval ───────────────
    ctx.save();

    // Clip path = full rect minus the oval (even-odd rule gives us the outside).
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.ellipse(centreX, centreY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.clip('evenodd');

    // Blurred video — drawn slightly larger so blur edge doesn't expose gaps.
    const bleed = 16;
    ctx.filter = 'blur(10px)';
    ctx.drawImage(videoEl, srcX, srcY, srcSize, srcSize, -bleed, -bleed, cw + bleed * 2, ch + bleed * 2);

    // Dark scrim on top of the blur (no additional filter needed).
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    ctx.fillRect(0, 0, cw, ch);

    ctx.restore();

    // ── 3. Oval border ────────────────────────────────────────────────────────
    const strokeColor = faceValid ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.7)';
    const lineWidth   = faceValid ? 6 : 3;

    ctx.beginPath();
    ctx.ellipse(centreX, centreY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    // ── 4. Countdown number inside oval OR hint text below oval ───────────────
    // Counter-mirror the canvas CSS scaleX(-1) so text is legible (only when mirrored).
    const fontSize = Math.round(cw * 0.045);
    ctx.save();
    if (mirrored) {
      ctx.translate(centreX, 0);
      ctx.scale(-1, 1);
      ctx.translate(-centreX, 0);
    }
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 6;

    if (countdown !== null) {
      ctx.font = `bold ${Math.round(cw * 0.28)}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillText(String(countdown), centreX, centreY + Math.round(cw * 0.09));
    } else if (hint) {
      ctx.font = `600 ${fontSize}px sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillText(hint, centreX, centreY + radiusY + Math.round(ch * 0.06));
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  dispose(): void {
    this.faceDetector?.close();
    this.faceDetector = undefined;
    this.initPromise = null;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async createDetector(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    this.faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });
  }
}
