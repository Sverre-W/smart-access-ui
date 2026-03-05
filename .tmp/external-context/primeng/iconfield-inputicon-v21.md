---
source: Official PrimeNG GitHub source (packages/primeng/src/iconfield/iconfield.ts + src/inputicon/inputicon.ts)
library: PrimeNG
package: primeng/iconfield + primeng/inputicon
topic: IconField and InputIcon component API — v21
fetched: 2026-03-01T00:00:00Z
official_docs: https://primeng.org/iconfield
---

# PrimeNG v21 — IconField + InputIcon

## Import

```ts
// Standalone / tree-shakeable (preferred in v21)
import { IconField }  from 'primeng/iconfield';
import { InputIcon }  from 'primeng/inputicon';

// NgModule wrappers
import { IconFieldModule }  from 'primeng/iconfield';
import { InputIconModule }  from 'primeng/inputicon';
```

- **IconField standalone class**: `IconField`
- **IconField NgModule**: `IconFieldModule`
- **InputIcon standalone class**: `InputIcon`
- **InputIcon NgModule**: `InputIconModule`

---

## Selectors

| Component | Valid selectors |
|---|---|
| `IconField` | `p-iconfield`, `p-iconField`, `p-icon-field` |
| `InputIcon` | `p-inputicon`, `p-inputIcon` |

---

## IconField Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `[iconPosition]` | `'left' \| 'right'` | **`'left'`** | Position of the icon relative to the input |
| `styleClass` *(deprecated v20+)* | `string` | — | Use `class` attribute directly instead |

> **Important**: The default `iconPosition` is `'left'` in the v21 source. Set `iconPosition="right"` to place the icon on the right.

---

## InputIcon Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `styleClass` *(deprecated v20+)* | `string` | — | Use `class` attribute directly instead |

`InputIcon` has **no functional inputs** — it is purely a layout wrapper. The icon itself goes inside as projected content (usually a `<i class="pi pi-...">` or any HTML element).

---

## Pattern: Search Input with Icon on the LEFT

This is the standard PrimeNG v21 usage:

```html
<p-iconfield iconPosition="left">
  <p-inputicon>
    <i class="pi pi-search"></i>
  </p-inputicon>
  <input pInputText type="text" placeholder="Search..." />
</p-iconfield>
```

> `iconPosition="left"` is actually the **default** — you may omit it.  
> Use `iconPosition="right"` for a right-side icon.

---

## Pattern: Icon on the RIGHT

```html
<p-iconfield iconPosition="right">
  <p-inputicon>
    <i class="pi pi-search"></i>
  </p-inputicon>
  <input pInputText type="text" placeholder="Search..." />
</p-iconfield>
```

---

## Minimal Reactive-Forms Example — Search with Left Icon

### Component (TypeScript)

```ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { IconField }   from 'primeng/iconfield';
import { InputIcon }   from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [ReactiveFormsModule, IconField, InputIcon, InputTextModule],
  template: `
    <p-iconfield iconPosition="left">
      <p-inputicon>
        <i class="pi pi-search"></i>
      </p-inputicon>
      <input
        pInputText
        type="text"
        placeholder="Search..."
        [formControl]="searchControl"
      />
    </p-iconfield>
  `
})
export class SearchBarComponent {
  searchControl = new FormControl('');
}
```

---

## With FloatLabel

```html
<p-iconfield iconPosition="left">
  <p-inputicon>
    <i class="pi pi-search"></i>
  </p-inputicon>
  <p-floatlabel>
    <input pInputText id="search" type="text" [formControl]="searchControl" />
    <label for="search">Search</label>
  </p-floatlabel>
</p-iconfield>
```

---

## With pSize (input sizing)

`IconField` respects the `pSize` directive on the inner input:

```html
<p-iconfield>
  <p-inputicon><i class="pi pi-search"></i></p-inputicon>
  <input pInputText pSize="large" type="text" placeholder="Large search..." />
</p-iconfield>
```

---

## NgModule import (non-standalone)

```ts
@NgModule({
  imports: [IconFieldModule, InputIconModule, InputTextModule]
})
export class MyModule {}
```

---

## Notes

- `IconField` and `InputIcon` have **no ARIA roles or keyboard interaction** — they are purely layout/visual wrappers.
- Both are **standalone components** in v21; prefer direct class imports over module imports.
- The icon content inside `<p-inputicon>` is fully free-form — use PrimeIcons (`pi pi-*`), Material Icons, SVGs, or any inline HTML.
