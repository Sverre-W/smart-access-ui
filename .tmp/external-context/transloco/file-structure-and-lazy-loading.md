---
source: Official Docs (jsverse.gitbook.io/transloco)
library: Transloco
package: @jsverse/transloco
topic: File structure, lazy loading scopes, inline loaders — standalone Angular
fetched: 2026-03-02T00:00:00Z
official_docs: https://jsverse.gitbook.io/transloco/advanced-features/lazy-load
---

# Transloco — File Structure & Lazy Loading

## Recommended File Structure

```
src/
├── assets/
│   └── i18n/
│       ├── en.json          ← global translations
│       ├── nl.json
│       ├── fr.json
│       ├── ar.json
│       ├── admin/           ← feature scope (lazy-loaded)
│       │   ├── en.json
│       │   ├── nl.json
│       │   ├── fr.json
│       │   └── ar.json
│       └── dashboard/       ← another scope
│           ├── en.json
│           ├── nl.json
│           ├── fr.json
│           └── ar.json
├── app/
│   ├── app.config.ts
│   ├── transloco-loader.ts
│   └── transloco.config.ts  ← global tooling config
```

---

## Lazy Loading via Route Providers (standalone)

```typescript
// admin.routes.ts
import { Route } from '@angular/router';
import { provideTranslocoScope } from '@jsverse/transloco';

export const ADMIN_ROUTES: Route = {
  path: 'admin',
  loadComponent: () =>
    import('./admin.component').then(c => c.AdminComponent),
  providers: [
    provideTranslocoScope('admin'),
    // Multiple scopes: provideTranslocoScope('admin', { scope: 'shared', alias: 'shared' }),
  ],
};
```

Transloco loads `assets/i18n/admin/en.json` (for active lang `en`) and merges:
```json
// Merged result in memory:
{
  "header": "...",
  "admin": {
    "title": "Admin Panel",
    "users": "Users"
  }
}
```

### Access scoped keys in template:
```html
<ng-container *transloco="let t">
  <h1>{{ t('admin.title') }}</h1>
</ng-container>

{{ 'admin.title' | transloco }}
<span transloco="admin.users"></span>
```

### Custom scope alias:
```typescript
provideTranslocoScope({ scope: 'admin', alias: 'adm' });
// Then use: t('adm.title')
```

---

## Lazy Loading via Component Providers

```typescript
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [TranslocoDirective],
  templateUrl: './dashboard.component.html',
  providers: [provideTranslocoScope('dashboard')],
})
export class DashboardComponent {}
```

---

## Inline Loaders (co-located translations in feature libs/monorepos)

Put JSON files alongside the feature and use dynamic `import()`:

```typescript
// feature.routes.ts
import { provideTranslocoScope } from '@jsverse/transloco';

export const loader = ['en', 'nl', 'fr', 'ar'].reduce((acc, lang) => {
  acc[lang] = () => import(`./i18n/${lang}.json`);
  return acc;
}, {} as Record<string, () => Promise<unknown>>);

export const FEATURE_ROUTES: Route = {
  path: 'feature',
  loadComponent: () =>
    import('./feature.component').then(c => c.FeatureComponent),
  providers: [
    provideTranslocoScope({ scope: 'myFeature', loader }),
  ],
};
```

```typescript
// feature.component.ts
@Component({
  standalone: true,
  imports: [TranslocoDirective],
  template: `
    <ng-container *transloco="let t">
      <p>{{ t('myFeature.title') }}</p>
    </ng-container>
  `,
})
export default class FeatureComponent {}
```

File layout for inline loaders:
```
projects/
└── feature/
    └── src/
        └── lib/
            ├── i18n/
            │   ├── en.json
            │   ├── nl.json
            │   ├── fr.json
            │   └── ar.json
            ├── feature.routes.ts
            └── feature.component.ts
```

> **Note:** When using an inline loader, the `scope` value also serves as the translation namespace (alias).

---

## Scope Inline Directive Input

```html
<ng-container *transloco="let t; scope: 'todos'">
  <h1>{{ t('todos.keyFromTodos') }}</h1>
</ng-container>
```
