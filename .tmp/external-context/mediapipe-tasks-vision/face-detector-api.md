---
source: unpkg.com CDN (vision.d.ts)
library: "@mediapipe/tasks-vision"
package: "@mediapipe/tasks-vision"
version: "0.10.32 (latest as of 2026-03-05)"
topic: FaceDetector API — createFromOptions, detectForVideo, close, FaceDetectorOptions, FaceDetectorResult
fetched: 2026-03-05T00:00:00Z
official_docs: https://developers.google.com/mediapipe/solutions/vision/face_detector/web_js
d_ts_source: https://unpkg.com/@mediapipe/tasks-vision@0.10.32/vision.d.ts
---

# `@mediapipe/tasks-vision` — FaceDetector API
> Extracted directly from `vision.d.ts` v0.10.32 (latest stable)

---

## 1. Import Path

```typescript
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

// Also available if you need the result type explicitly:
import { FaceDetectorResult } from '@mediapipe/tasks-vision';
// Note: FaceDetectorResult is an alias for DetectionResult (see §5)
```

The package ships a **single entry point** — `vision.d.ts` bundles all types.
The main modules are `vision_bundle.cjs` (CommonJS) and `vision_bundle.mjs` (ESM).

---

## 2. `FilesetResolver.forVisionTasks()` Signature

```typescript
export declare class FilesetResolver {
  /**
   * Creates a fileset for the MediaPipe Vision tasks.
   *
   * @param basePath An optional base path to specify the directory the Wasm
   *    files should be loaded from. If not specified, the Wasm files are
   *    loaded from the host's root directory.
   * @return A `WasmFileset` that can be used to initialize MediaPipe Vision tasks.
   */
  static forVisionTasks(basePath?: string): Promise<WasmFileset>;

  // Other methods (not needed for FaceDetector):
  static isSimdSupported(): Promise<boolean>;
  static forAudioTasks(basePath?: string): Promise<WasmFileset>;
  static forTextTasks(basePath?: string): Promise<WasmFileset>;
  static forGenAiTasks(basePath?: string): Promise<WasmFileset>;
}
```

### `WasmFileset` shape (what `forVisionTasks()` returns)

```typescript
declare interface WasmFileset {
  /** The path to the Wasm loader script. */
  wasmLoaderPath: string;
  /** The path to the Wasm binary. */
  wasmBinaryPath: string;
}
```

### Usage pattern

```typescript
// Pointing to WASM files bundled in your app's assets:
const vision = await FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
  // OR a local path: '/assets/mediapipe/wasm'
);
```

---

## 3. `FaceDetector` Class API

```typescript
export declare class FaceDetector extends VisionTaskRunner {

  // ── Factory methods (use instead of constructor — constructor is private) ──

  /**
   * Initializes the Wasm runtime and creates a new face detector from options.
   * Either baseOptions.modelAssetPath or baseOptions.modelAssetBuffer is required.
   */
  static createFromOptions(
    wasmFileset: WasmFileset,
    faceDetectorOptions: FaceDetectorOptions
  ): Promise<FaceDetector>;

  /** Convenience: create from a model buffer directly */
  static createFromModelBuffer(
    wasmFileset: WasmFileset,
    modelAssetBuffer: Uint8Array | ReadableStreamDefaultReader
  ): Promise<FaceDetector>;

  /** Convenience: create from a model file path directly */
  static createFromModelPath(
    wasmFileset: WasmFileset,
    modelAssetPath: string
  ): Promise<FaceDetector>;

  // ── Instance methods ──

  /**
   * Update options at runtime (partial — only specified fields change).
   * Set a field to `undefined` to reset it to its default.
   */
  setOptions(options: FaceDetectorOptions): Promise<void>;

  /**
   * Performs face detection on a SINGLE IMAGE (synchronous).
   * ⚠️ Only use when created with runningMode: "IMAGE"
   */
  detect(
    image: ImageSource,
    imageProcessingOptions?: ImageProcessingOptions
  ): FaceDetectorResult;   // alias for DetectionResult

  /**
   * Performs face detection on a VIDEO FRAME (synchronous, blocks until done).
   * ⚠️ Only use when created with runningMode: "VIDEO"
   *
   * @param videoFrame  The frame to process — any ImageSource (HTMLVideoElement,
   *                    HTMLCanvasElement, ImageBitmap, etc.)
   * @param timestamp   The frame timestamp in milliseconds. Must be monotonically
   *                    increasing between calls.
   * @param imageProcessingOptions  Optional — crop/rotation of the input.
   * @return  FaceDetectorResult  (= { detections: Detection[] })
   */
  detectForVideo(
    videoFrame: ImageSource,
    timestamp: number,
    imageProcessingOptions?: ImageProcessingOptions
  ): FaceDetectorResult;   // alias for DetectionResult

  /**
   * Frees all Wasm/GPU resources held by this detector.
   * Call this when the service/component is destroyed.
   */
  close(): void;  // inherited from VisionTaskRunner → TaskRunner
}
```

### `ImageSource` — what can you pass as `videoFrame`?

```typescript
// Defined in vision.d.ts as:
export declare type ImageSource = TexImageSource;

// TexImageSource is a browser built-in union:
// = ImageBitmap | ImageData | HTMLImageElement
//   | HTMLCanvasElement | HTMLVideoElement
//   | OffscreenCanvas | VideoFrame
```

✅ So `HTMLCanvasElement` is a valid `ImageSource` for `detectForVideo()`.

---

## 4. `FaceDetectorOptions` — Full Options Shape

```typescript
// Full inheritance chain:
// FaceDetectorOptions → VisionTaskOptions → TaskRunnerOptions
//                                          → BaseOptions_2 (as baseOptions)

export declare interface FaceDetectorOptions extends VisionTaskOptions {
  /**
   * Minimum confidence score for a detection to be considered successful.
   * Default: 0.5    Range: [0.0, 1.0]
   */
  minDetectionConfidence?: number | undefined;

  /**
   * Minimum Non-Maximum-Suppression threshold.
   * Detections with IoU overlap above this threshold are suppressed.
   * Default: 0.3    Range: [0.0, 1.0]
   */
  minSuppressionThreshold?: number | undefined;
}

// ─── VisionTaskOptions (parent) ───────────────────────────────────────────────
declare interface VisionTaskOptions extends TaskRunnerOptions {
  /**
   * The running mode of the task.
   * "IMAGE" — for single images (detect() method)
   * "VIDEO" — for video frames (detectForVideo() method)
   * Default: "IMAGE"
   */
  runningMode?: RunningMode;  // = "IMAGE" | "VIDEO"

  /**
   * The canvas element to use for GPU rendering.
   * Required when using GPU delegate.
   */
  canvas?: HTMLCanvasElement | OffscreenCanvas | WebGL2RenderingContext;
}

// ─── TaskRunnerOptions (grandparent) ──────────────────────────────────────────
declare interface TaskRunnerOptions {
  /**
   * Options for loading the model and configuring the inference backend.
   */
  baseOptions?: BaseOptions_2;
}

// ─── BaseOptions_2 ────────────────────────────────────────────────────────────
declare interface BaseOptions_2 {
  /**
   * Path to the TFLite model file (.task bundle).
   * Mutually exclusive with modelAssetBuffer.
   */
  modelAssetPath?: string | undefined;

  /**
   * Binary model data in memory.
   * Mutually exclusive with modelAssetPath.
   */
  modelAssetBuffer?: Uint8Array | ReadableStreamDefaultReader | undefined;

  /**
   * The inference backend.
   * "CPU"  — TFLite CPU delegate (default, most compatible)
   * "GPU"  — WebGL GPU delegate (faster, requires canvas option in VisionTaskOptions)
   */
  delegate?: "CPU" | "GPU" | undefined;
}

// ─── RunningMode ──────────────────────────────────────────────────────────────
declare type RunningMode = "IMAGE" | "VIDEO";
```

### Complete options object for your video-detection service

```typescript
const faceDetector = await FaceDetector.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.task',
    delegate: 'GPU', // or 'CPU'
  },
  runningMode: 'VIDEO',
  minDetectionConfidence: 0.5,   // default
  minSuppressionThreshold: 0.3,  // default
});
```

---

## 5. `detectForVideo()` Return Type — Full Structure

```typescript
// FaceDetectorResult is a re-export alias:
export { DetectionResult as FaceDetectorResult }

// DetectionResult:
declare interface DetectionResult {
  /** Array of all detected faces in the frame */
  detections: Detection[];
}

// Each Detection:
export declare interface Detection {
  /**
   * Confidence scores for this detection.
   * For FaceDetector: array of 1 item, categories[0].score = face confidence.
   * categories[0].categoryName = "" (face detector has no category labels)
   */
  categories: Category[];

  /**
   * Axis-aligned bounding box of the detected face.
   * Coordinates are in PIXELS relative to the input image dimensions.
   * ⚠️ This field is OPTIONAL — check for undefined before accessing.
   */
  boundingBox?: BoundingBox;

  /**
   * Facial keypoints returned by the face detector model.
   * For BlazeFace model: 6 keypoints —
   *   [0] right eye, [1] left eye, [2] nose tip,
   *   [3] mouth center, [4] right ear tragion, [5] left ear tragion
   * Coordinates are NORMALIZED [0.0, 1.0] relative to image size.
   */
  keypoints: NormalizedKeypoint[];
}

// BoundingBox:
export declare interface BoundingBox {
  /** X coordinate of the TOP-LEFT corner, in pixels */
  originX: number;
  /** Y coordinate of the TOP-LEFT corner, in pixels */
  originY: number;
  /** Width of the bounding box, in pixels */
  width: number;
  /** Height of the bounding box, in pixels */
  height: number;
  /**
   * Rotation angle in CLOCKWISE DEGREES from the horizontal,
   * around the top-left corner of the un-rotated box.
   * Typically 0 for BlazeFace short-range model.
   */
  angle: number;
}

// Category (on each Detection):
export declare interface Category {
  /** The confidence score [0.0, 1.0] */
  score: number;
  /** Index in the label map. For FaceDetector: -1 (no labels) */
  index: number;
  /** Category name string. For FaceDetector: "" (no labels) */
  categoryName: string;
  /** Localized display name. For FaceDetector: "" */
  displayName: string;
}

// NormalizedKeypoint (on each Detection):
export declare interface NormalizedKeypoint {
  /** X coordinate normalized to [0.0, 1.0] */
  x: number;
  /** Y coordinate normalized to [0.0, 1.0] */
  y: number;
  /** Optional label for the keypoint */
  label?: string;
  /** Optional score for the keypoint */
  score?: number;
}
```

---

## 6. Usage Pattern — Service Implementation

```typescript
import { FaceDetector, FilesetResolver, FaceDetectorResult, BoundingBox } from '@mediapipe/tasks-vision';

// ── Initialization ──────────────────────────────────────────────────────────

async function initFaceDetector(wasmBasePath: string): Promise<FaceDetector> {
  const vision = await FilesetResolver.forVisionTasks(wasmBasePath);

  return FaceDetector.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: '/assets/models/blaze_face_short_range.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    minDetectionConfidence: 0.5,
    minSuppressionThreshold: 0.3,
  });
}

// ── Per-frame detection ────────────────────────────────────────────────────

function detectFaces(
  detector: FaceDetector,
  canvas: HTMLCanvasElement,  // HTMLCanvasElement is a valid ImageSource
  timestampMs: number         // must be monotonically increasing
): FaceDetectorResult {
  return detector.detectForVideo(canvas, timestampMs);
}

// ── Reading bounding boxes ─────────────────────────────────────────────────

function validateFacePosition(result: FaceDetectorResult, imageWidth: number, imageHeight: number): boolean {
  if (result.detections.length === 0) return false;

  const detection = result.detections[0];
  const box: BoundingBox | undefined = detection.boundingBox;

  if (!box) return false;  // ⚠️ boundingBox is optional — always guard

  // All values are in PIXELS:
  const { originX, originY, width, height, angle } = box;

  // Center of face:
  const centerX = originX + width / 2;
  const centerY = originY + height / 2;

  // Face confidence score:
  const confidence = detection.categories[0]?.score ?? 0;

  // Example: check face is centered and large enough
  const isCentered =
    centerX > imageWidth * 0.3 && centerX < imageWidth * 0.7 &&
    centerY > imageHeight * 0.2 && centerY < imageHeight * 0.8;
  const isLargeEnough = width > imageWidth * 0.15 && height > imageHeight * 0.15;

  return isCentered && isLargeEnough && confidence > 0.7;
}

// ── Cleanup ────────────────────────────────────────────────────────────────

function destroyDetector(detector: FaceDetector): void {
  detector.close();  // frees Wasm/GPU memory
}
```

---

## 7. Critical Notes & Gotchas

### ⚠️ `boundingBox` is OPTIONAL
The type is `boundingBox?: BoundingBox` — always guard against `undefined`:
```typescript
const box = detection.boundingBox;
if (!box) return;
// now safe: box.originX, box.originY, box.width, box.height
```

### ⚠️ `runningMode` must match which method you call
- `runningMode: "IMAGE"` → only use `detect()` 
- `runningMode: "VIDEO"` → only use `detectForVideo()`
- Calling the wrong method for the mode will throw a runtime error.

### ⚠️ Timestamp must be monotonically increasing
```typescript
// Correct — use performance.now() or video.currentTime * 1000
const timestamp = performance.now();
detector.detectForVideo(canvas, timestamp);

// Wrong — if timestamp is <= previous call's timestamp, you get stale or no results
```

### ⚠️ `FaceDetectorResult` is a type alias only
It is exported as `export { DetectionResult as FaceDetectorResult }`.
Structurally identical to `ObjectDetectorResult`. Both are `{ detections: Detection[] }`.

### ⚠️ `close()` is inherited — not directly declared on `FaceDetector`
Defined on the base `VisionTaskRunner` → `TaskRunner` chain. But it IS available on every detector instance.

### ⚠️ BoundingBox coordinates are in PIXELS, keypoints are NORMALIZED
- `BoundingBox.originX/Y/width/height` → pixels (relative to input image size)
- `NormalizedKeypoint.x/y` → normalized [0.0, 1.0] (multiply by image width/height to get pixels)

### ⚠️ `delegate: "GPU"` requires the `canvas` option in VisionTaskOptions
```typescript
// If using GPU delegate:
{
  baseOptions: { delegate: 'GPU' },
  canvas: myCanvasElement,   // required for WebGL context
  runningMode: 'VIDEO',
}
```
