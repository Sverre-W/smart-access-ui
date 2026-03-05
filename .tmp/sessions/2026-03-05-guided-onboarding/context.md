# Task Context: Guided Onboarding Kiosk

Session ID: 2026-03-05-guided-onboarding
Created: 2026-03-05T00:00:00Z
Status: in_progress

## Current Request
Add a Guided Onboarding kiosk flow under `reception/onboarding/*` as part of the reception-desk app.
A new "Guided Onboarding" sidebar nav item launches a full-screen kiosk experience (custom shell,
no main nav/sidebar) that guides a visitor through: QR Scan → Selfie Capture → Done, then
auto-navigates back to `/reception/arrivals`. Auth is already handled — no new guards needed.

## Context Files (Standards to Follow)
- .opencode/context/core/standards/code-quality.md
- .opencode/context/project-intelligence/technical-domain.md
- .opencode/context/core/workflows/component-planning.md
- .opencode/context/ui/web/ui-styling-standards.md
- .opencode/context/core/standards/security-patterns.md

## Reference Files (Source Material to Look At)
- src/app/app.routes.ts
- src/app/features/reception/reception.routes.ts
- src/app/features/reception/arrivals/arrivals.ts
- src/app/features/visitors/services/visitor-service.ts
- src/app/core/services/sidebar-nav-service.ts
- src/app/core/services/app-switcher-service.ts
- src/app/core/components/layout/layout.ts
- src/app/core/components/layout/layout.html
- src/app/app.config.ts
- public/assets/i18n/en.json
- public/assets/i18n/nl.json
- public/assets/i18n/fr.json
- public/assets/i18n/ar.json
- package.json

## Angular Best Practices (Angular 21)
- NO `standalone: true` in decorators (implicit default in v20+)
- Use `inject()` function, NOT constructor injection
- Use `signal<T>()`, `computed()` for all reactive state
- Native control flow: `@if`, `@for`, `@switch` — NO `*ngIf`, `*ngFor`
- `ChangeDetectionStrategy.OnPush` on all components
- `input()` / `output()` functions, NOT `@Input()` / `@Output()` decorators
- Files: kebab-case, no Angular suffixes (e.g. `camera-service.ts`, `onboarding-shell.ts`)
- Classes: PascalCase, no suffix (e.g. `CameraService`, `OnboardingShell`)
- Interfaces co-located in same file as the service that uses them
- HTTP always wrapped with `firstValueFrom()`
- NO NgModules anywhere — use `imports: []` on each component

## Architecture Decisions

### Shell Strategy
The onboarding pages use a PARALLEL route branch in `app.routes.ts`:
- `/reception` → main `Layout` component → `reception.routes.ts` (existing, untouched)
- `/reception/onboarding` → `OnboardingShell` component → `onboarding.routes.ts` (NEW)

This is registered ABOVE the `/reception` entry so Angular matches it first.
`OnboardingShell` renders the full-screen kiosk: "Univisit" title + `<router-outlet>`.
The main nav/sidebar is completely bypassed.

### Done → Back to Arrivals
`OnboardingDone` auto-navigates to `/reception/arrivals` after 5 seconds, or immediately on
"START OVER" tap.

### New npm Packages Required
- `@zxing/browser` — QR code scanning
- `@zxing/library` — ZXing core (peer dep of @zxing/browser)
- `@mediapipe/tasks-vision` — BlazeFace on-device face detection

### API Methods to Add
`VisitorService.visitorCheckedInAsync(url: string): Promise<VisitorWithAccessDto>`
→ HTTP GET to the raw URL embedded in the QR code (not the existing checkInVisitor endpoint).
The existing `printLabel(body: LabelDataDto)` method already exists and matches the spec.

### State Service (KioskSessionService)
Signals: `qrCode: signal<string | null>`, `visitor: signal<VisitorWithAccessDto | null>`, `face: signal<string | null>`
`face` is reset to null when the selfie page loads.
No global store — just this one service scoped to the onboarding flow.

## New Files To Create

```
src/app/features/reception/onboarding/
├── onboarding.routes.ts
├── shell/
│   ├── onboarding-shell.ts
│   └── onboarding-shell.html
├── services/
│   ├── kiosk-session-service.ts
│   ├── camera-service.ts
│   └── face-detector-service.ts
├── home/
│   ├── onboarding-home.ts
│   └── onboarding-home.html
├── qrcode/
│   ├── onboarding-qrcode.ts
│   └── onboarding-qrcode.html
├── selfie/
│   ├── onboarding-selfie.ts
│   └── onboarding-selfie.html
└── done/
    ├── onboarding-done.ts
    └── onboarding-done.html
```

## Files To Modify

- `src/app/app.routes.ts` — add parallel `/reception/onboarding` route
- `src/app/features/reception/reception.routes.ts` — add `onboarding` redirect entry
- `src/app/core/services/sidebar-nav-service.ts` — add `guidedOnboarding` nav item
- `src/app/features/visitors/services/visitor-service.ts` — add `visitorCheckedInAsync(url)`
- `public/assets/i18n/en.json` — add translation keys
- `public/assets/i18n/nl.json` — mirror keys
- `public/assets/i18n/fr.json` — mirror keys
- `public/assets/i18n/ar.json` — mirror keys

## Spec Reference: .tmp/onboarding.md
Full product spec lives at `.tmp/onboarding.md`. All behaviour, timing, visual design and API
contracts are defined there. Key spec items:

### Timing
| Event | Delay |
|-------|-------|
| After successful QR scan + API response | navigate to /selfie after max(API duration, 2000ms) |
| After QR scan API error | navigate to /home after 5000ms |
| Face held steady before capture | 2000ms continuous valid detection |
| After print API response | navigate to /done after max(API duration, 2000ms) |
| After print API error | navigate to /done after 5000ms |
| Done page auto-reset | navigate to /reception/arrivals after 5000ms |

### Face validity (BlazeFace)
- Exactly 1 face detected
- Bounding box width AND height both between 170px and 250px
- Face centre within 11% of smaller video dimension from frame centre (20% upward Y offset)

### Viewfinder (shared QR + Selfie)
- Size: `clamp(400px, min(50vh, 50vw), 800px)` square
- 25px border: transparent=idle, rgba(0,255,0,0.3)=success, rgba(255,0,0,0.3)=error
- Video mirrored: `transform: scaleX(-1)`

### Visual Design
- Full screen: 100vw × 100vh, white background, no scroll
- Shell title "Univisit": centred, bold, 5rem, letter-spacing
- Content: column flex, centred vertically and horizontally
- Font: Roboto from Google Fonts
- START / START OVER buttons: 8vh font, 16vh height, oversized for touch
- DONE text: 10vh, bold, green
- Hint text: 3rem bold
- Status/error messages: 2rem bold (errors in red)

## Exit Criteria
- [ ] npm packages installed (@zxing/browser, @zxing/library, @mediapipe/tasks-vision)
- [ ] All 4 onboarding pages render correctly
- [ ] OnboardingShell is full-screen with no main nav/sidebar visible
- [ ] Sidebar nav "Guided Onboarding" link appears under reception-desk
- [ ] QR scan → API call → navigate to selfie (with 2s minimum display)
- [ ] Face detection loop runs, oval overlay draws correctly
- [ ] 2s valid face hold triggers capture + print API call
- [ ] Done page auto-navigates to /reception/arrivals after 5s
- [ ] All translation keys added in all 4 locales
- [ ] Build passes with no TypeScript errors
