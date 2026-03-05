import { Injectable } from '@angular/core';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';

/** Bounding-box size window (canvas pixels) that constitutes a valid face. */
const BBOX_MIN_PX = 170;
const BBOX_MAX_PX = 250;

/** How far the face centre may stray from the canvas centre (fraction of canvas dimension). */
const CENTRE_TOLERANCE = 0.11;

/** Upward Y offset applied to the expected face centre (fraction of canvas height). */
const UPWARD_Y_OFFSET = 0.2;

// ─── Oval style helpers ───────────────────────────────────────────────────────

const STROKE_INVALID = 'rgba(255,0,0,0.6)';
const STROKE_VALID = 'rgba(0,255,0,0.6)';
const LINE_WIDTH_INVALID = 3;
const LINE_WIDTH_VALID = 6;

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * FaceDetectorService
 *
 * Wraps the MediaPipe BlazeFace short-range model.
 *
 * Usage pattern:
 *  1. Call `initialize()` once (or let `predictWebcam` do it lazily).
 *  2. Call `predictWebcam(videoEl, canvasEl, timestamp)` each RAF tick.
 *  3. Call `dispose()` when the page/component is destroyed.
 *
 * The service is lazy — the heavy Wasm/model download only happens on the first
 * call to `initialize()`.  Subsequent calls to `initialize()` are no-ops.
 */
@Injectable({ providedIn: 'root' })
export class FaceDetectorService {
  // ── Private state ──────────────────────────────────────────────────────────

  private faceDetector: FaceDetector | undefined;

  /**
   * Cached promise so that concurrent callers waiting for the first init
   * all resolve together rather than each triggering a duplicate download.
   */
  private initPromise: Promise<void> | null = null;

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Lazily initialises the BlazeFace detector.
   * Safe to call multiple times — only runs once.
   *
   * @param canvasEl  The canvas element that will be used for GPU rendering.
   *                  Pass the same canvas you will later pass to predictWebcam.
   */
  initialize(canvasEl?: HTMLCanvasElement): Promise<void> {
    if (this.initPromise) {
      // Already initialised or in-flight — return the shared promise.
      return this.initPromise;
    }

    this.initPromise = this.createDetector(canvasEl);
    return this.initPromise;
  }

  /**
   * Process one video frame:
   *  1. Crops the video to a centred square and draws it to the canvas.
   *  2. Runs face detection on the canvas contents.
   *  3. Draws the oval guide overlay on top.
   *
   * @param videoEl   The live webcam `<video>` element.
   * @param canvasEl  The `<canvas>` overlay element (same size as the viewfinder).
   * @param timestamp Monotonically-increasing millisecond timestamp (e.g. from rAF / performance.now()).
   * @returns         Base64 JPEG data-URL if exactly one valid face was detected, `null` otherwise.
   */
  predictWebcam(
    videoEl: HTMLVideoElement,
    canvasEl: HTMLCanvasElement,
    timestamp: number
  ): string | null {
    // Guard: detector must be ready before we can do anything.
    if (!this.faceDetector) {
      return null;
    }

    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      return null;
    }

    // ── Step 1: Draw centred-square crop from video to canvas ─────────────────
    const { videoWidth, videoHeight } = videoEl;
    const size = Math.min(videoWidth, videoHeight);
    const srcX = (videoWidth - size) / 2;
    const srcY = (videoHeight - size) / 2;

    ctx.drawImage(videoEl, srcX, srcY, size, size, 0, 0, canvasEl.width, canvasEl.height);

    // ── Step 2: Run face detection on the canvas (already a square crop) ─────
    const result = this.faceDetector.detectForVideo(canvasEl, timestamp);

    // ── Step 3: Evaluate face validity ────────────────────────────────────────
    const faceValid = this.isFaceValid(result.detections, canvasEl.width, canvasEl.height);

    // ── Step 4: Draw oval guide on top of the video frame ────────────────────
    this.drawOvalGuide(ctx, canvasEl.width, canvasEl.height, faceValid);

    // ── Step 5: Return captured image or null ─────────────────────────────────
    if (faceValid) {
      return canvasEl.toDataURL('image/jpeg', 0.9);
    }

    return null;
  }

  /**
   * Releases all Wasm / GPU resources held by the detector.
   * Call this in the component's `ngOnDestroy`.
   */
  dispose(): void {
    this.faceDetector?.close();
    this.faceDetector = undefined;
    // Reset initPromise so initialize() can be called again if the service
    // is somehow reused (e.g. in tests or after hot-reload).
    this.initPromise = null;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Performs the actual async detector creation.  Called exactly once. */
  private async createDetector(canvasEl?: HTMLCanvasElement): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

    this.faceDetector = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      // GPU delegate requires a canvas element to create the WebGL context.
      ...(canvasEl ? { canvas: canvasEl } : {}),
      runningMode: 'VIDEO',
      minDetectionConfidence: 0.5,
      minSuppressionThreshold: 0.3,
    });
  }

  /**
   * Returns true when all spec-defined validity conditions are met:
   *  - Exactly one face detected.
   *  - Bounding-box width AND height both within [170, 250] canvas pixels.
   *  - Face centre within 11% of canvas dimensions from the (adjusted) canvas centre.
   *    The expected Y centre is shifted 20% upward to account for the top of the head.
   */
  private isFaceValid(
    detections: ReturnType<FaceDetector['detectForVideo']>['detections'],
    canvasW: number,
    canvasH: number
  ): boolean {
    if (detections.length !== 1) {
      return false;
    }

    const detection = detections[0];
    const box = detection.boundingBox;

    // boundingBox is optional in the MediaPipe types — guard defensively.
    if (!box) {
      return false;
    }

    // ── Size check ────────────────────────────────────────────────────────────
    // The detection runs on the canvas (square crop), so bbox coords are already
    // in canvas-pixel space — no scaling needed.
    const { originX, originY, width, height } = box;

    if (width < BBOX_MIN_PX || width > BBOX_MAX_PX) {
      return false;
    }
    if (height < BBOX_MIN_PX || height > BBOX_MAX_PX) {
      return false;
    }

    // ── Centre check ──────────────────────────────────────────────────────────
    const faceCentreX = originX + width / 2;
    const faceCentreY = originY + height / 2;

    const canvasCentreX = canvasW / 2;
    // The expected face centre Y is shifted 20% upward from the true canvas centre.
    const canvasCentreY = canvasH / 2 - canvasH * UPWARD_Y_OFFSET;

    const toleranceX = canvasW * CENTRE_TOLERANCE;
    const toleranceY = canvasH * CENTRE_TOLERANCE;

    if (Math.abs(faceCentreX - canvasCentreX) > toleranceX) {
      return false;
    }
    if (Math.abs(faceCentreY - canvasCentreY) > toleranceY) {
      return false;
    }

    return true;
  }

  /**
   * Draws an oval/ellipse guide in the centre of the canvas.
   *
   * - Width : 60% of canvas width
   * - Height: 75% of canvas height
   * - Stroke: red (invalid) or green (valid)
   * - Line width: 3px (invalid) or 6px (valid)
   */
  private drawOvalGuide(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    faceValid: boolean
  ): void {
    const centreX = canvasW / 2;
    const centreY = canvasH / 2;
    const radiusX = (canvasW * 0.6) / 2;
    const radiusY = (canvasH * 0.75) / 2;

    ctx.beginPath();
    ctx.ellipse(centreX, centreY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.strokeStyle = faceValid ? STROKE_VALID : STROKE_INVALID;
    ctx.lineWidth = faceValid ? LINE_WIDTH_VALID : LINE_WIDTH_INVALID;
    ctx.stroke();
  }
}
