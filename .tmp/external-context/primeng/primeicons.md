---
source: Official Docs (v19.primeng.org/icons)
library: PrimeNG / PrimeIcons
package: primeicons (CSS) + primeng/api (constants)
topic: PrimeIcons usage in Angular — CSS classes, constants, Angular styles.scss
version: v19 (19.1.4) / primeicons latest
fetched: 2026-03-01T00:00:00Z
official_docs: https://v19.primeng.org/icons
---

# PrimeIcons Usage in Angular (PrimeNG v19)

## 1. Install

```bash
npm install primeicons
```

---

## 2. Global CSS Import

Add to `styles.scss` (or `styles.css`) in your Angular project:

```scss
@import "primeicons/primeicons.css";
```

Or in `angular.json` styles array:

```json
"styles": [
  "node_modules/primeicons/primeicons.css",
  "src/styles.scss"
]
```

> No Angular module or component import is needed for the CSS icons — it's a global font/CSS file.

---

## 3. Usage in HTML Templates

Icons use the `pi pi-{name}` CSS class pattern on any element:

```html
<!-- Standalone icon elements -->
<i class="pi pi-user"></i>
<i class="pi pi-sign-out"></i>
<i class="pi pi-cog"></i>
<span class="pi pi-search"></span>

<!-- With size control -->
<i class="pi pi-user" style="font-size: 1.5rem"></i>

<!-- With color -->
<i class="pi pi-sign-out" style="color: var(--primary-color)"></i>

<!-- Spinning loader -->
<i class="pi pi-spin pi-spinner" style="font-size: 2rem"></i>
```

---

## 4. In PrimeNG Component Properties

Any PrimeNG component that accepts an `icon` property expects the full CSS class string:

```html
<!-- p-button -->
<p-button icon="pi pi-user" label="Profile" />
<p-button icon="pi pi-sign-out" label="Sign out" />
<p-button icon="pi pi-ellipsis-v" (click)="menu.toggle($event)" />

<!-- p-menu trigger with icon -->
<p-button icon="pi pi-bars" (click)="menu.toggle($event)" />
```

---

## 5. In `MenuItem` items array

```typescript
import { MenuItem } from 'primeng/api';

items: MenuItem[] = [
  { label: 'Profile',   icon: 'pi pi-user'     },
  { label: 'Settings',  icon: 'pi pi-cog'      },
  { separator: true },
  { label: 'Sign out',  icon: 'pi pi-sign-out' },
];
```

---

## 6. `PrimeIcons` Constants (type-safe alternative)

```typescript
import { PrimeIcons, MenuItem } from 'primeng/api';

// PrimeIcons.USER === 'pi pi-user'
// PrimeIcons.SIGN_OUT === 'pi pi-sign-out'  (note: SIGN_OUT not SIGN-OUT)
// PrimeIcons.COG === 'pi pi-cog'

items: MenuItem[] = [
  { label: 'Profile',  icon: PrimeIcons.USER      },
  { label: 'Settings', icon: PrimeIcons.COG        },
  { label: 'Sign out', icon: PrimeIcons.SIGN_OUT   },
];

// Or directly in a template binding:
// [icon]="PrimeIcons.USER"
```

---

## 7. Common Icons for Auth / Navigation

| CSS Class            | `PrimeIcons` Constant     | Use Case |
|----------------------|---------------------------|----------|
| `pi pi-user`         | `PrimeIcons.USER`         | Profile, account |
| `pi pi-sign-out`     | `PrimeIcons.SIGN_OUT`     | Logout |
| `pi pi-sign-in`      | `PrimeIcons.SIGN_IN`      | Login |
| `pi pi-cog`          | `PrimeIcons.COG`          | Settings |
| `pi pi-home`         | `PrimeIcons.HOME`         | Dashboard / home |
| `pi pi-lock`         | `PrimeIcons.LOCK`         | Security / locked |
| `pi pi-lock-open`    | `PrimeIcons.LOCK_OPEN`    | Unlocked |
| `pi pi-shield`       | `PrimeIcons.SHIELD`       | Security |
| `pi pi-bell`         | `PrimeIcons.BELL`         | Notifications |
| `pi pi-ellipsis-v`   | `PrimeIcons.ELLIPSIS_V`   | Vertical 3-dot menu trigger |
| `pi pi-ellipsis-h`   | `PrimeIcons.ELLIPSIS_H`   | Horizontal 3-dot |
| `pi pi-bars`         | `PrimeIcons.BARS`         | Hamburger menu |
| `pi pi-times`        | `PrimeIcons.TIMES`        | Close / dismiss |
| `pi pi-check`        | `PrimeIcons.CHECK`        | Confirm / success |
| `pi pi-trash`        | `PrimeIcons.TRASH`        | Delete |
| `pi pi-pencil`       | `PrimeIcons.PENCIL`       | Edit |
| `pi pi-id-card`      | `PrimeIcons.ID_CARD`      | ID / account details |
| `pi pi-users`        | `PrimeIcons.USERS`        | User list / team |
| `pi pi-key`          | `PrimeIcons.KEY`          | Password / API key |

---

## 8. No Angular Module Needed for Icons

> PrimeIcons is a **pure CSS icon font** — it requires no Angular `NgModule` or component import.
> Just install the npm package and import the CSS in `styles.scss`.
>
> The `PrimeIcons` constants object (`import { PrimeIcons } from 'primeng/api'`) is
> a plain TypeScript object — no module needed, import directly in the component file.
