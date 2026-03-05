---
source: Official PrimeNG GitHub source (cdn.jsdelivr.net/npm/primeng@21.1.1) + primeng.org
library: PrimeNG
package: primeng/autocomplete
topic: AutoComplete component API - standalone Angular v21
fetched: 2026-03-01T00:00:00Z
official_docs: https://primeng.org/autocomplete
---

# PrimeNG v21 — AutoComplete API Reference

## 1. Import Path

```ts
// Module import (works in both standalone and NgModule-based components)
import { AutoCompleteModule } from 'primeng/autocomplete';

// Direct standalone component import (preferred for standalone Angular)
import { AutoComplete } from 'primeng/autocomplete';
```

> **Note:** The component is declared `standalone: true` in PrimeNG 21 source.
> `AutoCompleteModule` is an NgModule wrapper that re-exports `AutoComplete` — either works in `imports: []`.
> Prefer `AutoCompleteModule` for consistency with other PrimeNG modules, or `AutoComplete` for tree-shaking.

---

## 2. Standalone Component `imports: []`

```ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
// OR: import { AutoComplete } from 'primeng/autocomplete';

@Component({
  standalone: true,
  imports: [
    FormsModule,        // required for [(ngModel)]
    AutoCompleteModule  // provides <p-autocomplete>
  ],
  template: `...`
})
export class MyComponent {}
```

---

## 3. `[suggestions]` Binding

**Type:** `any[]`

The array of suggestions to display in the dropdown overlay.
Set this in your `completeMethod` handler after filtering.

```ts
// In component class:
suggestions: any[] = [];
// or typed:
suggestions: Room[] = [];
```

```html
<p-autocomplete
  [(ngModel)]="selectedRoom"
  [suggestions]="suggestions"
  (completeMethod)="search($event)"
/>
```

---

## 4. `(completeMethod)` Event

**Emits:** `AutoCompleteCompleteEvent`

```ts
// Interface (from primeng/types/autocomplete):
interface AutoCompleteCompleteEvent {
  originalEvent: Event;   // the browser input event
  query: string;          // the current typed text
}
```

```ts
search(event: AutoCompleteCompleteEvent) {
  // event.query is the typed string
  this.suggestions = this.allItems.filter(item =>
    item.name.toLowerCase().includes(event.query.toLowerCase())
  );
}
```

> Import the type:
> ```ts
> import { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
> ```

---

## 5. `field` / `optionLabel` — Display Label Property

PrimeNG 21 uses **`optionLabel`** (not `field`). The old `field` attribute from v17/v18 has been replaced.

**Type:** `string | ((item: any) => string)`

```html
<!-- String key: -->
<p-autocomplete
  [(ngModel)]="selected"
  [suggestions]="suggestions"
  optionLabel="name"
  (completeMethod)="search($event)"
/>

<!-- Or a getter function in the template: -->
<p-autocomplete
  [optionLabel]="getLabel"
/>
```

```ts
// Function form:
getLabel = (item: Room) => `${item.name} (Floor ${item.floor})`;
```

> `optionLabel` controls what text is shown in the input field when an item is selected,
> and what label appears in the dropdown list (when no custom item template is used).

---

## 6. Custom Item Template (show name + type + floor)

Use `<ng-template #item let-item>` inside `<p-autocomplete>`.

The template context provides:
- `$implicit` → the suggestion object
- `index` → numeric index

```html
<p-autocomplete
  [(ngModel)]="selectedRoom"
  [suggestions]="suggestions"
  optionLabel="name"
  (completeMethod)="search($event)"
  [dropdown]="true"
  placeholder="Search rooms..."
>
  <!-- Item row template -->
  <ng-template #item let-room>
    <div class="flex flex-column gap-1">
      <span class="font-semibold">{{ room.name }}</span>
      <span class="text-sm text-color-secondary">
        {{ room.type }} &bull; Floor {{ room.floor }}
      </span>
    </div>
  </ng-template>
</p-autocomplete>
```

> `#item` is the template name recognized by the AutoComplete via `@ContentChild('item')`.
> The `$implicit` variable receives each suggestion object.

### Selected Item Template (what shows in the input chip/text after selection)

```html
<ng-template #selecteditem let-room>
  {{ room.name }} ({{ room.type }})
</ng-template>
```

---

## 7. Key Input Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `[suggestions]` | `any[]` | — | Array of suggestion objects to show |
| `optionLabel` | `string \| Function` | — | Field name or fn for display label |
| `optionValue` | `string \| Function` | — | Field name or fn for the bound value (ngModel receives this) |
| `placeholder` | `string` | — | Input placeholder text |
| `[forceSelection]` | `boolean` | `false` | Clears input if typed value is not in suggestions |
| `minLength` | `number` | `1` | ⚠️ Deprecated since v20 — use `minQueryLength` |
| `minQueryLength` | `number` | — | Min chars before search fires (replaces `minLength`) |
| `[dropdown]` | `boolean` | `false` | Shows a dropdown arrow button beside the input |
| `dropdownMode` | `'blank' \| 'current'` | `'blank'` | Blank = searches with empty string; current = searches with current value |
| `[multiple]` | `boolean` | `false` | Multi-select chips mode |
| `[forceSelection]` | `boolean` | — | Validates input against suggestions, clears if no match |
| `delay` | `number` | `300` | Debounce delay (ms) between keystrokes and search |
| `scrollHeight` | `string` | `'200px'` | Max height of the dropdown panel |
| `[showClear]` | `boolean` | `false` | Shows a clear (×) icon |
| `[disabled]` | `boolean` | — | Disables the component |
| `[invalid]` | `boolean` | — | Marks as invalid (Angular Forms integration) |
| `[completeOnFocus]` | `boolean` | `false` | Triggers search on input focus |
| `[autoHighlight]` | `boolean` | — | Highlights first item automatically |
| `dataKey` | `string` | — | Unique key field for equality checks (use with objects) |
| `[fluid]` | `boolean` | — | Full-width of container |
| `variant` | `'outlined' \| 'filled'` | `'outlined'` | Visual style variant |

---

## 8. Output Events

| Event | Type | Description |
|---|---|---|
| `(completeMethod)` | `AutoCompleteCompleteEvent` | Fired on each keystroke when minQueryLength reached |
| `(onSelect)` | `AutoCompleteSelectEvent` | Fired when user selects a suggestion |
| `(onUnselect)` | `AutoCompleteUnselectEvent` | Fired when a chip is removed (multiple mode) |
| `(onFocus)` | `Event` | Input receives focus |
| `(onBlur)` | `Event` | Input loses focus |
| `(onDropdownClick)` | `AutoCompleteDropdownClickEvent` | Dropdown button clicked |
| `(onClear)` | `Event` | Clear button clicked |
| `(onShow)` | `Event` | Panel shown |
| `(onHide)` | `Event` | Panel hidden |

```ts
// Event type imports:
import {
  AutoCompleteCompleteEvent,
  AutoCompleteSelectEvent,
  AutoCompleteUnselectEvent,
  AutoCompleteDropdownClickEvent,
} from 'primeng/autocomplete';
```

---

## 9. Available Templates (ng-template names)

| `#name` | Context variable | Purpose |
|---|---|---|
| `#item` | `$implicit: T`, `index: number` | Each suggestion row |
| `#selecteditem` | `$implicit: T` | Selected value display in chips (multiple mode) |
| `#group` | `$implicit: group` | Group header row |
| `#header` | — | Panel header |
| `#footer` | — | Panel footer |
| `#empty` | — | Empty state message |
| `#loader` | `options` | Virtual scroll loader |
| `#dropdownicon` | — | Custom dropdown button icon |
| `#clearicon` | — | Custom clear icon |
| `#removeicon` | `removeCallback, index, class` | Custom chip remove icon |

---

## 10. Full Working Example — Rooms with name + type + floor

```ts
// room-search.component.ts
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';

interface Room {
  id: number;
  name: string;
  type: string;
  floor: number;
}

@Component({
  standalone: true,
  imports: [FormsModule, AutoCompleteModule],
  template: `
    <p-autocomplete
      [(ngModel)]="selectedRoom"
      [suggestions]="filteredRooms"
      optionLabel="name"
      placeholder="Search rooms..."
      [dropdown]="true"
      [forceSelection]="true"
      [minQueryLength]="1"
      (completeMethod)="filterRooms($event)"
      (onSelect)="onRoomSelected($event)"
    >
      <ng-template #item let-room>
        <div style="display:flex; flex-direction:column; gap:2px;">
          <strong>{{ room.name }}</strong>
          <small style="color: var(--p-text-muted-color)">
            {{ room.type }} &bull; Floor {{ room.floor }}
          </small>
        </div>
      </ng-template>
    </p-autocomplete>
  `
})
export class RoomSearchComponent {
  selectedRoom: Room | null = null;

  filteredRooms: Room[] = [];

  private allRooms: Room[] = [
    { id: 1, name: 'Meeting Room A', type: 'Meeting', floor: 1 },
    { id: 2, name: 'Conference Hall B', type: 'Conference', floor: 2 },
    { id: 3, name: 'Open Desk 12', type: 'Desk', floor: 3 },
  ];

  filterRooms(event: AutoCompleteCompleteEvent): void {
    const q = event.query.toLowerCase();
    this.filteredRooms = this.allRooms.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q)
    );
  }

  onRoomSelected(event: AutoCompleteSelectEvent): void {
    console.log('Selected room:', event.value); // full Room object
  }
}
```

---

## 11. `minLength` vs `minQueryLength`

```ts
// ❌ Deprecated since v20 — still works but shows warning:
[minLength]="2"

// ✅ Use this in v21:
[minQueryLength]="2"
```

---

## 12. Selector Aliases

The component responds to all three selectors:
```html
<p-autoComplete .../>   <!-- camelCase alias -->
<p-autocomplete .../>   <!-- lowercase (recommended) -->
<p-auto-complete .../>  <!-- kebab-case alias -->
```
