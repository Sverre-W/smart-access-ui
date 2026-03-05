---
source: Official Docs (v19.primeng.org/menu + v19.primeng.org/tieredmenu)
library: PrimeNG
package: primeng/api
topic: MenuItem interface — all properties
version: v19 (19.1.4)
fetched: 2026-03-01T00:00:00Z
official_docs: https://v19.primeng.org/menu#api
---

# PrimeNG `MenuItem` Interface (v19)

## Import

```typescript
import { MenuItem } from 'primeng/api';
// Optional: typed icon constants
import { PrimeIcons } from 'primeng/api';
```

Both `MenuItem` and `PrimeIcons` live in the same `primeng/api` barrel — no extra module needed.

---

## Interface Definition

```typescript
interface MenuItem {
  // ─── Core display ────────────────────────────────────
  label?:       string;          // Display text
  icon?:        string;          // CSS class(es): 'pi pi-user', 'pi pi-sign-out', etc.
  iconClass?:   string;          // Additional CSS classes for the icon element
  iconStyle?:   { [k: string]: any };  // Inline styles for the icon

  // ─── Interaction ─────────────────────────────────────
  command?:     (event: MenuItemCommandEvent) => void;  // Click / keyboard handler
  url?:         string;          // External href (opens in browser)
  routerLink?:  any;             // Angular RouterLink value (array or string)
  target?:      string;          // Link target: '_blank', '_self', etc.

  // ─── Sub-items / structure ───────────────────────────
  items?:       MenuItem[];      // Child items (one level in p-menu, multi in p-tieredmenu)
  expanded?:    boolean;         // Initial expansion state of submenu
  separator?:   boolean;         // Render as a visual divider line (ignores other props)

  // ─── State ───────────────────────────────────────────
  disabled?:    boolean;         // Grey out and prevent activation
  visible?:     boolean;         // Show/hide the DOM element for this item

  // ─── Routing extras ──────────────────────────────────
  queryParams?:          { [k: string]: any };
  fragment?:             string;
  queryParamsHandling?:  QueryParamsHandling;  // 'merge' | 'preserve'
  preserveFragment?:     boolean;
  skipLocationChange?:   boolean;
  replaceUrl?:           boolean;
  routerLinkActiveOptions?: any;
  state?:                { [k: string]: any };

  // ─── Badges & tooltips ───────────────────────────────
  badge?:              string;
  badgeStyleClass?:    string;
  tooltip?:            string;
  tooltipPosition?:    string;
  tooltipOptions?:     TooltipOptions;

  // ─── Misc ─────────────────────────────────────────────
  id?:           string;
  automationId?: any;
  tabindex?:     string;
  title?:        string;     // HTML title attribute (tooltip on hover)
  escape?:       boolean;    // false = render label as raw HTML (default true)
  style?:        { [k: string]: any };
  styleClass?:   string;
}
```

---

## Most-Used Properties at a Glance

| Property   | Type       | Example value              | Notes |
|------------|------------|----------------------------|-------|
| `label`    | `string`   | `'Sign out'`               | Display text |
| `icon`     | `string`   | `'pi pi-sign-out'`         | PrimeIcons CSS class string |
| `command`  | `function` | `() => signOut()`          | Called on click or Enter/Space |
| `items`    | `MenuItem[]` | `[{label:'...'}]`        | Child items (submenu) |
| `separator`| `boolean`  | `true`                     | Divider line; other properties ignored |
| `disabled` | `boolean`  | `true`                     | Greys out item |
| `routerLink` | `any`    | `['/profile']`             | Angular router navigation |
| `url`      | `string`   | `'https://example.com'`    | External link |

---

## Usage Examples

### Simple flat list

```typescript
items: MenuItem[] = [
  { label: 'Dashboard', icon: 'pi pi-home',     command: () => this.router.navigate(['/']) },
  { label: 'Profile',   icon: 'pi pi-user',     command: () => this.router.navigate(['/profile']) },
  { label: 'Settings',  icon: 'pi pi-cog',      routerLink: ['/settings'] },
  { separator: true },
  { label: 'Sign out',  icon: 'pi pi-sign-out', command: () => this.authService.signOut() },
];
```

### Using `PrimeIcons` constants (type-safe)

```typescript
import { PrimeIcons, MenuItem } from 'primeng/api';

items: MenuItem[] = [
  { label: 'New',    icon: PrimeIcons.PLUS  },
  { label: 'Delete', icon: PrimeIcons.TRASH },
  { label: 'User',   icon: PrimeIcons.USER  },
];
```

> `PrimeIcons.USER` resolves to `'pi pi-user'` — identical to the string literal.
> Use constants when you want autocomplete / compile-time safety.

### Grouped items (for `p-menu`)

```typescript
items: MenuItem[] = [
  {
    label: 'Account',       // Group header (no icon/command needed)
    items: [
      { label: 'Profile',  icon: 'pi pi-user' },
      { label: 'Settings', icon: 'pi pi-cog'  },
    ]
  },
  { separator: true },
  { label: 'Sign out', icon: 'pi pi-sign-out', command: () => this.onSignOut() }
];
```

### `command` event object

```typescript
// Full signature — event param is optional
command?: (event: { originalEvent: Event; item: MenuItem }) => void;

// Usage:
{ label: 'Save', icon: 'pi pi-save', command: (e) => {
    console.log('Clicked item:', e.item.label);
    console.log('Original DOM event:', e.originalEvent);
}}
```

---

## Icon String Format

All PrimeIcons follow the pattern `pi pi-{name}`:

```
pi pi-user          → user avatar
pi pi-sign-out      → logout arrow
pi pi-sign-in       → login arrow
pi pi-cog           → settings gear
pi pi-home          → home icon
pi pi-ellipsis-v    → vertical three-dots (common menu trigger)
pi pi-ellipsis-h    → horizontal three-dots
pi pi-bars          → hamburger
pi pi-lock          → padlock
pi pi-shield        → security shield
pi pi-bell          → notification bell
```

The `icon` property on `MenuItem` accepts **the full CSS class string**, e.g. `'pi pi-sign-out'`.
