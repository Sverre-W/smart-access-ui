---
source: Official Docs (v19.primeng.org/tieredmenu)
library: PrimeNG
package: primeng/tieredmenu
topic: TieredMenu component — popup mode and comparison with p-menu
version: v19 (19.1.4)
fetched: 2026-03-01T00:00:00Z
official_docs: https://v19.primeng.org/tieredmenu
---

# PrimeNG `p-tieredmenu` (v19)

## When to use `p-tieredmenu` vs `p-menu`

| Feature | `p-menu` | `p-tieredmenu` |
|---------|----------|----------------|
| Flat item lists | ✅ | ✅ |
| One-level groups (`label` + `items[]`) | ✅ | ✅ |
| **Multi-level nested submenus** | ❌ (one level only) | ✅ (unlimited depth) |
| Popup / overlay mode | ✅ | ✅ |
| `toggle()` method | ✅ | ✅ |

**For single-level dropdowns** (your use case), **`p-menu` is the recommended component**.  
Use `p-tieredmenu` only when you need fly-out submenus (items within items, 2+ levels deep).

---

## Import

```typescript
import { TieredMenuModule } from 'primeng/tieredmenu';
import { ButtonModule }     from 'primeng/button';
import { MenuItem }         from 'primeng/api';
```

Standalone component:

```typescript
@Component({
  standalone: true,
  imports: [TieredMenuModule, ButtonModule],
  ...
})
```

---

## Popup Mode Template

```html
<p-button label="Toggle" (click)="menu.toggle($event)" />
<p-tieredmenu #menu [model]="items" [popup]="true" />
```

The pattern is **identical** to `p-menu` — same `#menu` reference variable, same `.toggle($event)` call.

---

## Component Class Example

```typescript
import { Component, OnInit } from '@angular/core';
import { MenuItem }          from 'primeng/api';
import { TieredMenuModule }  from 'primeng/tieredmenu';
import { ButtonModule }      from 'primeng/button';

@Component({
  selector: 'app-tiered-nav',
  standalone: true,
  imports: [TieredMenuModule, ButtonModule],
  template: `
    <p-button icon="pi pi-bars" (click)="menu.toggle($event)" />
    <p-tieredmenu #menu [model]="items" [popup]="true" />
  `
})
export class TieredNavComponent implements OnInit {
  items: MenuItem[] = [];

  ngOnInit(): void {
    this.items = [
      {
        label: 'File',
        icon: 'pi pi-file',
        items: [                           // Nested submenu (fly-out)
          { label: 'New',   icon: 'pi pi-plus',  command: () => {} },
          { label: 'Open',  icon: 'pi pi-folder-open' },
          { separator: true },
          { label: 'Print', icon: 'pi pi-print' }
        ]
      },
      {
        label: 'Edit',
        icon: 'pi pi-pencil',
        items: [
          { label: 'Copy',   icon: 'pi pi-copy'  },
          { label: 'Delete', icon: 'pi pi-trash' }
        ]
      },
      { label: 'Search', icon: 'pi pi-search', command: () => {} }
    ];
  }
}
```

---

## TieredMenu API

### Properties (`@Input`)

| Property               | Type         | Default   | Description |
|------------------------|--------------|-----------|-------------|
| `model`                | `MenuItem[]` | `null`    | Array of menu items |
| `popup`                | `boolean`    | `false`   | Enable overlay/popup mode |
| `appendTo`             | `any`        | `null`    | Attach overlay to `"body"` or element ref |
| `breakpoint`           | `string`     | `960px`   | Max-width boundary for responsive layout |
| `autoDisplay`          | `boolean`    | `true`    | Show root submenu on hover |
| `autoZIndex`           | `boolean`    | `true`    | Auto z-index management |
| `baseZIndex`           | `number`     | `0`       | Base z-index value |
| `disabled`             | `boolean`    | `false`   | Disable entire menu |
| `style`                | `object`     | `null`    | Root element inline style |
| `styleClass`           | `string`     | `null`    | Root element CSS class |
| `id`                   | `string`     | `null`    | Element id |
| `ariaLabel`            | `string`     | `null`    | Accessibility label |
| `tabindex`             | `number`     | `0`       | Tab order index |

### Events (`@Output`)

| Event    | Description |
|----------|-------------|
| `onShow` | Emitted when popup overlay is shown |
| `onHide` | Emitted when popup overlay is hidden |

### Methods (via `#menu` template reference)

| Method   | Parameters                          | Description |
|----------|-------------------------------------|-------------|
| `toggle` | `event: any`                        | Toggle popup visibility |
| `show`   | `event: any, isFocus: any`          | Show the popup |
| `hide`   | `event: any, isFocus: boolean`      | Hide the popup |

### Item Template (custom rendering)

```html
<p-tieredmenu [model]="items" [popup]="true">
  <ng-template #item let-item let-hasSubmenu="hasSubmenu">
    <a pRipple class="flex items-center p-tieredmenu-item-link">
      <span [class]="item.icon" class="p-tieredmenu-item-icon"></span>
      <span class="ml-2">{{ item.label }}</span>
      <i *ngIf="hasSubmenu" class="pi pi-angle-right ml-auto"></i>
    </a>
  </ng-template>
</p-tieredmenu>
```

The `hasSubmenu` context variable is unique to `p-tieredmenu` (not in `p-menu`).

---

## Verdict for Single-Level Dropdowns

For a user account dropdown or nav dropdown with **no nested fly-outs**, use **`p-menu`**:
- Simpler API
- `label` + `items[]` gives you visual grouping headers
- Same `[popup]="true"` + `toggle($event)` pattern
- Lighter weight than `p-tieredmenu`
