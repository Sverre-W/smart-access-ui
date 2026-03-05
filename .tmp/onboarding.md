# Visitor Kiosk — Guided Onboarding App

## Overview

The app is a self-service visitor check-in kiosk designed to run full-screen on a tablet. It guides a visitor through a fully automated, touchless onboarding flow in three steps:

1. Scan a pre-issued QR code to identify yourself
2. Look into the camera so a selfie can be captured automatically
3. Receive confirmation that check-in is complete and a badge label has been printed

The entire flow is hands-free after the visitor taps **START**. There is no form to fill in, no keyboard input, and no manual button presses mid-flow. The app resets itself automatically after each session so the next visitor can begin immediately.

The app is branded as **Univisit**.

---

## Application Shell

A persistent shell wraps all pages. It renders:

- A large, bold, centered **title** ("Univisit") at the top of the screen
- A **content area** below that hosts whichever page is currently active via the router

The shell never changes between steps — only the content area swaps out.

The app runs full-screen with no scrollbars. The background is white throughout.

---

## Routing

| Path | Page | Purpose |
|------|------|---------|
| `/` | → redirects to `/home` | Default entry point |
| `/home` | Home | Welcome / start screen |
| `/qrcode` | QR Camera | QR code scanning step |
| `/selfie` | Selfie Camera | Face detection and photo capture step |
| `/done` | Done | Confirmation screen |

Navigation is always one-directional and driven by the app, not the user. The visitor never taps a "next" button between steps.

---

## Pages

### 1. Home Page (`/home`)

**Purpose:** Welcome screen. Waits for the visitor to initiate the flow.

**What is shown:**
- A single large **START** button with a play icon, centered on the screen
- The button is oversized to be easily tappable on a touchscreen (roughly 16% of viewport height)

**Behaviour:**
- Tapping the START button navigates immediately to `/qrcode`
- This is the only user interaction in the entire flow

---

### 2. QR Code Scan Page (`/qrcode`)

**Purpose:** Identify the visitor by scanning a QR code they were issued in advance.

**What is shown:**
- A live camera feed displayed as a square viewfinder (responsive, clipped between 400px and 800px, based on the smaller of 50vh/50vw)
- The camera feed is **mirrored horizontally** (so it behaves like a mirror, making it easier to align)
- A bold hint text below the viewfinder: **"Scan QR Code"**
- A coloured border around the viewfinder that changes state:
  - **Transparent** — idle, scanning in progress
  - **Green (semi-transparent)** — QR code successfully scanned and visitor verified
  - **Red (semi-transparent)** — an error occurred

**Behaviour — happy path:**
1. The camera activates automatically when the page loads
2. The scanner continuously reads frames looking for a QR code
3. When a valid QR code is detected, the app calls the visitor check-in API (see API section), passing the raw QR code value (which is a URL)
4. If the API responds successfully, the badge ID is returned and stored in memory
5. The viewfinder border turns green
6. After a minimum display time of **2 seconds** (the app waits for whichever is longer: the API call or the 2-second delay), the app navigates to `/selfie`

**Behaviour — error path:**
- If the API call fails, a user-facing error message is shown below the viewfinder: **"Something went wrong"**
- The border turns red
- After **5 seconds**, the app automatically navigates back to `/home`
- Camera or scanner errors (hardware/permission issues) also turn the border red, but do not trigger an automatic redirect

**Duplicate scan guard:**
- If the exact same QR code value is scanned again before navigation completes, it is ignored (deduplicated by comparing the new value to the last successfully scanned value)

**Debug mode:**
- Passing `?debug=true` in the URL query string enables a debug overlay that shows:
  - The raw scanned QR code value
  - The badge ID returned from the API
  - Any raw scan error messages
- Debug mode is off by default

---

### 3. Selfie Camera Page (`/selfie`)

**Purpose:** Automatically capture a photo of the visitor's face to be printed on their badge.

**What is shown:**
- A live camera feed displayed as a square viewfinder (same responsive sizing as QR page)
- A transparent **canvas overlay** drawn on top of the video feed that renders:
  - An **oval/ellipse guide** in the centre of the frame:
    - **Red (semi-transparent, thin stroke)** — face not yet detected or not properly positioned
    - **Green (semi-transparent, thick stroke)** — face is correctly positioned and the capture countdown is running
- A bold hint text below the viewfinder: **"Scan your face"**
- Status messages below the hint:
  - **"Printing a label..."** — shown while the print API call is in progress
  - **"Label is printed successfully"** — shown on success
  - **"Something went wrong: [error]"** — shown if printing fails

**Behaviour — face detection loop:**
1. On load, the camera activates and a face detection model runs continuously frame-by-frame using `requestAnimationFrame`
2. Each frame is analysed by the on-device face detector (MediaPipe BlazeFace)
3. The frame is **cropped to a square** (centred crop) before detection, so the viewfinder always shows a square image
4. A face is considered **valid** only when ALL of the following are true simultaneously:
   - Exactly **one** face is detected (not zero, not two or more)
   - The face bounding box is **big enough**: width and height must both be between 170px and 250px
   - The face is **centred**: the centre of the bounding box must be within 11% of the smaller video dimension from the centre of the frame (with a 20% upward offset applied to Y, accounting for the top of the head)

**Behaviour — capture logic:**
1. When a valid face is first detected, a timer starts
2. The face must remain valid continuously for **2 seconds**
3. If the face leaves the frame or fails validation at any point, the timer resets to zero
4. After 2 continuous seconds of a valid face:
   - The current frame is captured as a JPEG image (base64 encoded) from the canvas
   - This image is stored in memory as the visitor's selfie
5. The print API is called immediately with the selfie image + the visitor data collected in the QR step (see API section)
6. After a minimum of **2 seconds** display time for the print status message, the app navigates to `/done`

**Behaviour — error path:**
- If printing fails, an error message is shown and the app navigates to `/done` after **5 seconds** regardless

**Cleanup:**
- When the page is destroyed (on navigation away), the camera stream is stopped, the face detector is disposed, and all animation frames and subscriptions are cancelled

**Camera selection (hidden feature):**
- The component supports selecting between multiple cameras and toggling mirror mode, but this UI is hidden by default (wrapped in `@if (false)`) and is not shown to visitors — it exists for developer/admin use during setup

---

### 4. Done Page (`/done`)

**Purpose:** Confirm the process is complete and reset for the next visitor.

**What is shown:**
- A large bold **"DONE"** text in green, centred on the screen
- A **START OVER** button with a play icon (same oversized style as the HOME button)

**Behaviour:**
- After **5 seconds**, the app automatically navigates back to `/home` — no interaction required
- Tapping **START OVER** immediately navigates back to `/home`, skipping the wait

---

## State Management

There is no global state store. A single shared service (`VisitorsService`) acts as in-memory session state for the duration of one visitor's flow:

| Field | Type | Description |
|-------|------|-------------|
| `qrCode` | `string \| null` | The raw QR code value scanned in step 2 |
| `face` | `string \| null` | Base64-encoded JPEG selfie image captured in step 3 |
| `_visitor` | `VisitorWithAccessDto \| null` | Full visitor record returned by the check-in API |

State is reset at the start of each relevant page:
- `face` is set to `null` when the selfie page loads, ensuring no stale image from a previous session is used

---

## Services

### VisitorsService

Handles all backend communication and holds the current session's visitor data.

**Methods:**

- `visitorCheckedInAsync(url: string): Promise<VisitorWithAccessDto>`
  Performs an HTTP GET to the URL encoded in the QR code. Returns visitor details including `visitId`, `visitorId`, `tenantId`, and `badgeId`.

- `printIfReady(): Promise<void>`
  Checks that both the selfie image and full visitor record are available, then calls the print API.

- `printLabel(visitor, faceImageBase64): Promise<void>` _(private)_
  Performs an HTTP POST to the render/print API endpoint with the full label payload.

### FaceDetectorService

Runs entirely on-device using the MediaPipe BlazeFace model loaded from CDN.

**Key behaviour:**
- Initialised lazily when the selfie page loads
- Runs in `VIDEO` mode (frame-by-frame)
- Minimum detection confidence: `0.5`
- Minimum suppression threshold: `0.3`
- GPU delegate used when available
- `predictWebcam()` returns a base64 JPEG string if a valid face is detected, or `null` otherwise
- Draws the oval guide overlay on the canvas on every frame regardless of detection result
- `dispose()` clears the detector instance on page teardown

### CameraService

Manages camera device enumeration and stream lifecycle.

**Key behaviour:**
- On startup, enumerates all `videoinput` devices and selects the first one
- `enableCameraForVideoElement()` opens a `getUserMedia` stream for the selected device and attaches it to a video element, firing a callback once data is loaded
- When a camera is changed, the current stream is explicitly stopped before starting a new one
- Exposes selected camera and camera list as RxJS observables

---

## API Contracts

### 1. Visitor Check-In

- **Method:** `GET`
- **URL:** The raw string value decoded from the QR code (the QR code itself encodes a full URL)
- **Response:** JSON object with the following fields:

```json
{
  "visitId": "string",
  "visitorId": "string",
  "tenantId": "string",
  "badgeId": "string"
}
```

### 2. Label Print

- **Method:** `POST`
- **URL:** `{renderApi}/label/print`
  - In production: `/visitors-svc/api/v1/visitors/label/print`
- **Request body:** JSON object:

```json
{
  "visitId": "string",
  "visitorId": "string",
  "tenantId": "string",
  "badgeId": "string",
  "faceImageBase64": "string"
}
```

- **Response:** Not inspected — success is determined by a non-error HTTP status

---

## Visual Design

### Layout

- The app is always **full-screen** (`100vw × 100vh`), no scroll, no overflow
- The shell title is centered, bold, large (`5rem`), with letter-spacing
- Content is centred both vertically and horizontally within its area
- All pages use a **column flex layout** with centred alignment

### Viewfinder (shared between QR and Selfie pages)

- Square, responsive size: `clamp(400px, min(50vh, 50vw), 800px)`
- Surrounded by a **25px border** that changes colour to indicate state:
  - Transparent = idle
  - Semi-transparent green = success / valid detection
  - Semi-transparent red = error
- Video feed is mirrored horizontally (`transform: scaleX(-1)`) on both pages
- Video fills the container with `object-fit: cover`

### Typography

- Font: **Roboto** (loaded from Google Fonts)
- Hint text below viewfinders: `3rem`, bold
- Status/error messages: `2rem`, bold (errors have red `<b>` text)
- DONE text: `10vh`, bold, green
- START / START OVER buttons: `8vh` font size, `16vh` height

### Colour scheme

- Background: white
- Primary theme: Azure / Blue (Material Design palette)
- Success indicators: `rgba(0, 255, 0, 0.3)`
- Error indicators: `rgba(255, 0, 0, 0.3)` / `red`
- "DONE" text: `green`

---

## Timing Summary

| Event | Delay |
|-------|-------|
| After successful QR scan + API response | Navigate to selfie after max(API duration, 2000ms) |
| After QR scan API error | Navigate to home after 5000ms |
| Face must be held steady before capture | 2000ms continuous valid detection |
| After print API response | Navigate to done after max(API duration, 2000ms) |
| After print API error | Navigate to done after 5000ms |
| Done page auto-reset | Navigate to home after 5000ms |

---

## Error Handling Summary

| Scenario | User-facing message | Auto-recovery |
|----------|--------------------|--------------:|
| QR check-in API fails | "Something went wrong: [error]" | → `/home` after 5s |
| Camera/scanner hardware error | No message (border turns red) | None |
| Print API fails | "Something went wrong: [error]" | → `/done` after 5s |
| No face detected | Oval stays red | Loop continues |
| Multiple faces detected | Oval stays red | Loop continues |
| Face not centred/sized correctly | Oval stays red | Loop continues |

---

## Environment Configuration

The app uses environment files to configure API base URLs. Only `renderApi` is used at runtime in production. The QR code URL is dynamic (embedded in the code itself), so the check-in API URL is not hardcoded in the environment.

| Key | Dev value | Prod value |
|-----|-----------|------------|
| `renderApi` | `""` (empty) | `/visitors-svc/api/v1/visitors` |
| `production` | `false` | `true` |

---

## Tech Stack (reference only)

- **Framework:** Angular 21 (standalone components + NgModule hybrid)
- **QR scanning:** ZXing (browser-based, QR_CODE format only)
- **Face detection:** MediaPipe Tasks Vision — BlazeFace short-range model, GPU delegate, video mode
- **HTTP:** Angular `HttpClient`
- **Reactivity:** RxJS (`BehaviorSubject`, `timer`, `firstValueFrom`)
- **Change detection:** `OnPush` on the selfie camera component (manual `detectChanges()` calls)
- **Base href:** Dynamically resolved from the DOM at bootstrap time (supports subdirectory deployments)
