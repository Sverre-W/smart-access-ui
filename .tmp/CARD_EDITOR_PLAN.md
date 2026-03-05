# Card Editor Component — Implementation Plan

## Overview

Rebuild the relevant subset of `IdCardEditorComponent` as a clean, focused Angular standalone
component. The new component retains only:

- Placing **text** and **images** on a Fabric.js canvas
- **Import** (load template from JSON)
- **Export** (download template JSON to browser)
- **Save** (emit template JSON to the host via an `@Output`)

All mail-merge, render/generate, and QR-code panels are excluded from the editor UI.
Mail-merge is handled elsewhere in the codebase; the component must preserve
`image-placeholder` objects so templates round-trip cleanly between the editor and the
mail-merge pipeline.

---

## Component API

**Name:** `CardEditorComponent`
**Selector:** `app-card-editor`
**File:** `src/app/components/card-editor/card-editor.component.ts`

### Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `cardSizes` | `CardSize[]` | — | List of available card dimensions to populate the size selector |
| `fonts` | `string[]` | `FALLBACK_FONTS` | Font-family names for all font pickers. If an empty array is provided the component substitutes a built-in list of common fonts (see **Font Fallback** below). The first entry in the resolved list is the default font applied to new text objects. The component does **not** fetch fonts itself. |
| `displayScale` | `number \| null` | `null` | CSS scale applied to the canvas wrapper. `null` = auto-fit to container width. Any non-null value is used as-is. |

### Outputs

| Output | Emits | Description |
|---|---|---|
| `save` | `string` | Serialised template JSON string, emitted when the user clicks the Save button |

### Types (`card-editor.types.ts`)

```ts
export interface CardSize {
  label: string;        // Display name, e.g. "CR80"
  width: number;        // Width in millimetres
  height: number;       // Height in millimetres
  orientation: string;  // "Portrait" | "Landscape"
}

export interface TemplateJson {
  version: 2;
  media: CardSize;
  dpi: 300;
  objects: object[];    // Fabric.js serialised objects array
}

export const EXTRA_PROPS = [
  'dataField',    // string | null — label / CSV column name / field identifier
  'fieldType',    // 'text' | 'image-fixed' | 'image-placeholder'
  'isBackground', // boolean — locked, sent to back
  'scaleX',
  'scaleY',
  'angle',
] as const;

/** Used when the host passes an empty fonts array. */
export const FALLBACK_FONTS: string[] = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'DejaVu Serif',
  'DejaVu Sans',
];
```

---

## Canvas Setup

- Use **Fabric.js v6** (already installed as `fabric ^6.7.1`).
- Resolution: **300 DPI** — convert mm to pixels: `px = (mm / 25.4) * 300`.
- Background colour: `#fff`.
- `preserveObjectStacking: true`.
- Monkey-patch `fabric.Object.prototype.toObject` at component init to always include `EXTRA_PROPS`
  (mirrors the approach in the existing `IdCardEditorComponent`, lines 170–177).
- Canvas is **re-initialised** whenever the user switches `CardSize`. If the canvas is non-empty,
  show `ConfirmDialogComponent` first (reuse the existing shared component at
  `src/app/components/shared/confirm-dialogue.component.ts`).

### Display Scale

At 300 DPI a CR80 card renders at ~1012 × 638 px — wider than most viewports.

- If `displayScale` input is **`null`** (default): the component calculates a scale automatically
  by comparing `canvas.width` against the content area's `clientWidth` via a `ResizeObserver`.
  The scale is recalculated whenever the container resizes.
- If `displayScale` is a **non-null number**: that value is used as-is, no auto-calculation.

The scale is applied as `transform: scale(value); transform-origin: top left` on the canvas
wrapper div. The canvas wrapper height is also explicitly set to `canvasHeight * scale` to
prevent the parent container from collapsing (since `transform` does not affect layout flow).

```ts
@Input() displayScale: number | null = null;
```

### Font Resolution

```ts
get resolvedFonts(): string[] {
  return this.fonts?.length ? this.fonts : FALLBACK_FONTS;
}

get defaultFont(): string {
  return this.resolvedFonts[0];
}
```

- New text objects always use `defaultFont` as their initial `fontFamily`.
- The font picker in the context menu lists all `resolvedFonts`.
- When `fonts` is non-empty the host is fully in control of the available fonts.

---

## Template JSON Schema

The schema is identical to the existing editor so that templates are interoperable:

```json
{
  "version": 2,
  "media": {
    "label": "CR80",
    "width": 85.6,
    "height": 54,
    "orientation": "Landscape"
  },
  "dpi": 300,
  "objects": [ /* Fabric serialised objects */ ]
}
```

---

## Layout

Angular Material `<mat-sidenav-container>` with:

- **Sidenav** (left, fixed width ~280 px): accordion panels (see below).
- **Content area** (right): canvas wrapper div + `<canvas #fabricCanvas>`.

The canvas wrapper uses `overflow: hidden` when display scale is active so that the
scaled-down canvas does not affect document flow.

---

## Sidebar Panels (`<mat-accordion>`)

### Panel 1 — Canvas

- `<mat-select>` bound to `selectedCardSize`, populated from the `cardSizes` input.
- **Clear Canvas** button — opens `ConfirmDialogComponent`, then calls `canvas.clear()`.

### Panel 2 — Template

| Button | Behaviour |
|---|---|
| **Import** | Triggers hidden `<input type="file" accept=".json">`. On file selected: show `ConfirmDialogComponent` if canvas non-empty, read file as text, parse JSON, call `loadTemplateFromJson()`. |
| **Save** | Calls `serializeCanvas()`, emits `save` output event with the JSON string. |
| **Export** | Calls `serializeCanvas()`, creates a `Blob`, triggers a browser download of `card-template.json`. |

### Panel 3 — Add

| Button | Behaviour |
|---|---|
| **Add Text** | Creates a `fabric.Textbox` at `{left: 100, top: 100}` with `fontSize: 24`, `fontFamily` set to `defaultFont` (first entry of `resolvedFonts`), `fill: '#000'`. Sets `fieldType = 'text'`. Applies horizontal-resize-only controls (only `ml`/`mr` handles visible). Adds to canvas, makes active, calls `requestRenderAll()`. |
| **Add Image** | Triggers hidden `<input type="file" accept="image/*">`. Reads file as DataURL, creates `HTMLImageElement`, creates `new fabric.Image(el)` at `{left: 100, top: 100}`. Sets `fieldType = 'image-fixed'`. Adds to canvas. |
| **Add Image Placeholder** | Opens a small inline prompt (or `MatDialog`) for a field name. Creates a `fabric.Rect` with dashed stroke (`strokeDashArray: [4, 4]`), semi-transparent fill, default 140 × 160 px. Sets `fieldType = 'image-placeholder'`, `dataField = <entered field name>`. Adds to canvas. This object type is used by the mail-merge pipeline and must survive import/export round-trips. |

---

## Canvas Event Handling

### Selection Tracking

```
canvas.on('selection:created')
canvas.on('selection:updated')
canvas.on('selection:cleared')
```
Update `selectedObject` (component property) — drives context menu visibility and action targets.

### Movement Clamping (`object:moving`)

Clamp `left` and `top` so no part of the object leaves the canvas bounds:

```
left = clamp(left, 0, canvasWidth  - objectWidth)
top  = clamp(top,  0, canvasHeight - objectHeight)
```

### Resize Clamping (`object:scaling`)

Prevent width or height from exceeding the canvas dimensions.

### Textbox Commit (`object:modified`)

For `Textbox` objects: `obj.width = obj.width * obj.scaleX`, `obj.scaleX = 1`,
then call `obj.initDimensions()` to recalculate line wrapping.

### Right-click Context Menu

- `canvas.on('mouse:down')` detects `e.button === 2`; record cursor position.
- `(contextmenu)` on the canvas host element opens a `<mat-menu>` via `MatMenuTrigger.openMenu()`.
- Menu is rendered in the template but hidden from normal flow.

---

## Context Menu Actions

| Action | Condition | Implementation |
|---|---|---|
| **Toggle Bold** | `fieldType === 'text'` | `textbox.set('fontWeight', current === 'bold' ? 'normal' : 'bold')` |
| **Toggle Italic** | `fieldType === 'text'` | `textbox.set('fontStyle', current === 'italic' ? 'normal' : 'italic')` |
| **Toggle Underline** | `fieldType === 'text'` | `textbox.set('underline', !current)` |
| **Change Font** | `fieldType === 'text'` | Sub-menu listing all entries from `resolvedFonts`; calls `textbox.set('fontFamily', name)` |
| **Change Font Size** | `fieldType === 'text'` | Number input in menu; calls `textbox.set('fontSize', size)` + `initDimensions()` |
| **Change Text Color** | `fieldType === 'text'` | Color input; calls `obj.set('fill', color)` |
| **Change Text BG Color** | `fieldType === 'text'` | Color input; calls `textbox.set('textBackgroundColor', color)` |
| **Rename Field** | `fieldType === 'image-placeholder'` | Inline prompt; updates `obj.dataField` |
| **Set as Background** | `fieldType === 'image-fixed'` | `canvas.sendObjectToBack(obj)`, set `obj.selectable = false`, `obj.evented = false`, `obj.isBackground = true` |
| **Bring Forward** | all | `canvas.bringObjectForward(obj)` |
| **Bring to Front** | all | `canvas.bringObjectToFront(obj)` |
| **Send Backward** | all | `canvas.sendObjectBackwards(obj)` |
| **Send to Back** | all | `canvas.sendObjectToBack(obj)` |
| **Delete** | all | `canvas.remove(obj)`, `canvas.discardActiveObject()`, `requestRenderAll()` |

All actions call `canvas.requestRenderAll()` after mutating objects.

---

## Import Logic

```ts
async loadTemplateFromJson(json: TemplateJson): Promise<void>
```

1. Restore the `selectedCardSize` from `json.media`.
2. Resize the canvas to match the restored card size (mm → px at 300 DPI).
3. `canvas.clear()`.
4. `await canvas.loadFromJSON(json)` (Fabric built-in, returns a Promise in v6).
5. Walk `canvas.getObjects()` to restore runtime state lost during serialisation:
   - `fieldType === 'text'`: re-apply horizontal-resize-only controls.
   - `fieldType === 'image-placeholder'`: re-apply `evented = true`, `selectable = true`,
     `hoverCursor = 'move'` so they remain interactive in the editor.
   - `isBackground === true`: set `selectable = false`, `evented = false`.
6. `canvas.calcOffset()`.
7. `canvas.requestRenderAll()`.
8. Rebind canvas event listeners (Fabric may clear them during `loadFromJSON`).

`image-placeholder` objects are fully preserved on import so that templates remain usable
by the mail-merge pipeline after being saved from this editor.

---

## Serialisation Logic

```ts
private serializeCanvas(): string
```

1. For every object where `fieldType !== 'image-fixed'`:
   - `obj.width  = obj.width  * obj.scaleX`, `obj.scaleX = 1`
   - `obj.height = obj.height * obj.scaleY`, `obj.scaleY = 1`
2. `const fabricData = canvas.toObject(EXTRA_PROPS)`.
3. Build template:
   ```ts
   const template: TemplateJson = {
     version: 2,
     media: this.selectedCardSize,
     dpi: 300,
     objects: fabricData.objects,
   };
   ```
4. Return `JSON.stringify(template)`.

---

## File Structure

```
src/app/components/card-editor/
├── card-editor.component.ts       # Standalone component — all logic
├── card-editor.component.html     # Template (sidenav layout, panels, canvas, context menu)
├── card-editor.component.scss     # Styles (container, canvas wrapper, scale transform)
└── card-editor.types.ts           # CardSize, TemplateJson, EXTRA_PROPS
```

The existing `IdCardEditorComponent` and all its support files are left **untouched**.

---

## Angular Material Modules Required

All already present in the project; import into the standalone component:

- `MatSidenavModule`
- `MatExpansionModule` (accordion)
- `MatSelectModule`
- `MatButtonModule`
- `MatMenuModule`
- `MatDialogModule`
- `MatIconModule`
- `MatInputModule`

---

## Dependencies

No new packages need to be installed. Everything required is already present:

| Package | Purpose |
|---|---|
| `fabric ^6.7.1` | Canvas engine |
| `@angular/material ^19` | UI components |
| `@angular/cdk ^19` | Dialog, overlay |

---

## Out of Scope

The following features from `IdCardEditorComponent` are explicitly **excluded**:

| Feature | Reason |
|---|---|
| Mail merge UI (CSV picker, `requestMerge` output) | Handled elsewhere in the codebase |
| File generation (PDF, BMP, JPEG, PNG, Fargo) | Not required |
| QR code placement (`QrCodeComponent`) | Not required |
| `AssignFieldDialogComponent` | Not required |
| `showMerge` / `showRender` inputs | Not required |
| All HTTP services (`RenderService`, `MailMergeService`, `FontsService`, `QrCodeService`) | Not required |
| Web component packaging (`webcomponent-main.ts`) | Can be added later if needed |
| Companion app detection | Not required |

> **Note:** `image-placeholder` objects **are** supported in the editor (Add panel + import/export
> round-trip) even though the mail-merge execution itself lives outside this component.

---

## Resolved Decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | Image placeholders on import | **Preserve and support fully.** `image-placeholder` (`fabric.Rect` with dashed stroke) is a first-class object type in this editor. It can be added, moved, resized, renamed (via context menu), and survives import/export so the mail-merge pipeline can consume it. |
| 2 | `displayScale` nullable vs fixed | **Nullable input.** `displayScale: number \| null = null`. When `null` the component auto-fits the canvas to the content area width via `ResizeObserver`. When a value is provided it is used as-is. |
| 3 | Font fallback | **Prefill with common fonts.** If `fonts` input is an empty array (or not provided), the component uses `FALLBACK_FONTS` (a built-in list of 8 common fonts). The first entry in the resolved list is always the default `fontFamily` for new text objects. The font picker is always visible. |
