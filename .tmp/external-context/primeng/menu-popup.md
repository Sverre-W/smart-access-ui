---
source: Context7 API + Official Docs (v19.primeng.org/menu)
library: PrimeNG
package: primeng/menu
topic: p-menu popup mode with button toggle
version: v19 (19.1.4)
fetched: 2026-03-01T00:00:00Z
official_docs: https://v19.primeng.org/menu
---

# PrimeNG `p-menu` — Popup Mode (v19)

## 1. Module Import

```typescript
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { MenuItem }     from 'primeng/api';
```

For **standalone Angular components**, add both modules to the `imports` array:

```typescript
@Component({
  standalone: true,
  imports: [MenuModule, ButtonModule, /* CommonModule if needed */],
  ...
})
```

---

## 2. Template — Popup Mode

Popup mode is enabled by setting `[popup]="true"` and calling `menu.toggle($event)` from the trigger button.

```html
<!-- Trigger button wires directly to the menu template-reference variable -->
<p-button
  (click)="menu.toggle($event)"
  icon="pi pi-ellipsis-v"
  label="Options"
/>

<!-- Menu declared after (or before) the button — order doesn't matter -->
<p-menu #menu [model]="items" [popup]="true" />
```

> The `#menu` template reference variable exposes the component instance.
> `menu.toggle($event)` passes the click event so PrimeNG positions the overlay
> relative to the button element.

### With a plain HTML button (no `p-button`):

```html
<button type="button" (click)="menu.toggle($event)">
  <i class="pi pi-user"></i> Account
</button>
<p-menu #menu [model]="items" [popup]="true" />
```

---

## 3. Component Class (TypeScript)

```typescript
import { Component, OnInit } from '@angular/core';
import { MenuItem }          from 'primeng/api';
import { MenuModule }        from 'primeng/menu';
import { ButtonModule }      from 'primeng/button';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [MenuModule, ButtonModule],
  template: `
    <p-button (click)="menu.toggle($event)" icon="pi pi-user" />
    <p-menu #menu [model]="items" [popup]="true" />
  `
})
export class UserMenuComponent implements OnInit {
  items: MenuItem[] = [];

  ngOnInit(): void {
    this.items = [
      {
        label: 'Profile',
        icon: 'pi pi-user',
        command: () => this.onProfile()
      },
      {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: () => this.onSettings()
      },
      { separator: true },
      {
        label: 'Sign out',
        icon: 'pi pi-sign-out',
        command: () => this.onSignOut()
      }
    ];
  }

  onProfile()  { /* navigate or open dialog */ }
  onSettings() { /* navigate to settings    */ }
  onSignOut()  { /* clear session + redirect */ }
}
```

---

## 4. `p-menu` Component API

### Properties (`@Input`)

| Property               | Type          | Default                         | Description |
|------------------------|---------------|---------------------------------|-------------|
| `model`                | `MenuItem[]`  | `null`                          | Array of menu items |
| `popup`                | `boolean`     | `false`                         | **Set to `true` for overlay/popup mode** |
| `appendTo`             | `any`         | `null`                          | Target to attach overlay (`"body"` or element ref) |
| `autoZIndex`           | `boolean`     | `true`                          | Automatically manage z-index layering |
| `baseZIndex`           | `number`      | `0`                             | Base z-index value |
| `style`                | `object`      | `null`                          | Inline styles on root element |
| `styleClass`           | `string`      | `null`                          | CSS class on root element |
| `showTransitionOptions`| `string`      | `.12s cubic-bezier(0,0,0.2,1)` | Show animation easing |
| `hideTransitionOptions`| `string`      | `.1s linear`                   | Hide animation easing |
| `ariaLabel`            | `string`      | `null`                          | Accessibility label |
| `id`                   | `string`      | `null`                          | Element id |
| `tabindex`             | `number`      | `0`                             | Tab order index |

### Events (`@Output`)

| Event    | Parameters  | Description |
|----------|-------------|-------------|
| `onShow` | `value: any`| Emitted when popup overlay becomes visible |
| `onHide` | `value: any`| Emitted when popup overlay is hidden |
| `onBlur` | `event: Event` | List loses focus |
| `onFocus`| `event: Event` | List receives focus |

### Methods (via template reference `#menu`)

| Method   | Parameters     | Description |
|----------|----------------|-------------|
| `toggle` | `event: Event` | **Toggle popup visibility** — pass `$event` from click handler |
| `show`   | `event: any`   | Programmatically show the popup |
| `hide`   | —              | Programmatically hide the popup |

---

## 5. Popup Behaviour Notes

- In popup mode, PrimeNG **implicitly manages** `aria-expanded`, `aria-haspopup`, and `aria-controls` on the trigger element.
- Pressing `Escape` closes the popup and returns focus to the trigger.
- Pressing `Enter` or `Space` on a focused item activates it and closes the popup.
- `appendTo="body"` avoids z-index / overflow clipping issues in complex layouts.

---

## 6. Grouped Items (one level of nesting via `items`)

```typescript
this.items = [
  {
    label: 'Account',
    items: [
      { label: 'Profile',  icon: 'pi pi-user',     command: () => {} },
      { label: 'Settings', icon: 'pi pi-cog',      command: () => {} },
    ]
  },
  { separator: true },
  { label: 'Sign out', icon: 'pi pi-sign-out', command: () => {} }
];
```

> `p-menu` supports **one level** of grouping via `label` + `items`.
> For **multi-level submenus**, use `p-tieredmenu` instead.
