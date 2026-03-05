---
source: Official Docs (jsverse.gitbook.io/transloco)
library: Transloco
package: @jsverse/transloco
topic: Translation in templates — pipe, structural directive, attribute directive
fetched: 2026-03-02T00:00:00Z
official_docs: https://jsverse.gitbook.io/transloco/core-concepts/translation-in-the-template
---

# Transloco — Translation in Templates

## Required imports for standalone components

Add `TranslocoDirective` and/or `TranslocoPipe` to your component's `imports`:

```typescript
import { Component } from '@angular/core';
import { TranslocoDirective, TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [TranslocoDirective, TranslocoPipe],
  templateUrl: './home.component.html',
})
export class HomeComponent {}
```

---

## 1. Structural Directive (recommended — DRY, single subscription)

```html
<ng-container *transloco="let t">
  <h1>{{ t('title') }}</h1>
  <p>{{ t('name', { name: 'Transloco' }) }}</p>
  <my-comp [label]="t('buttonLabel')"></my-comp>
</ng-container>
```

### Using a `prefix` (nested key namespace)

```html
<!-- en.json: { "dashboard": { "title": "Dashboard", "desc": "..." } } -->
<ng-container *transloco="let t; prefix: 'dashboard'">
  <h1>{{ t('title') }}</h1>
  <p>{{ t('desc') }}</p>
</ng-container>
```

### Force a specific language inline

```html
<ng-container *transloco="let t; lang: 'fr'">
  <p>{{ t('welcome') }}</p>
</ng-container>
```

---

## 2. Transloco Pipe

```html
<!-- Basic -->
<span>{{ 'home' | transloco }}</span>

<!-- With params -->
<span>{{ 'alert' | transloco: { value: dynamicValue } }}</span>

<!-- With attribute/property binding -->
<img [attr.alt]="'logoAlt' | transloco" />
<my-comp [title]="'pageTitle' | transloco" />

<!-- Force specific language -->
<span>{{ 'alert' | transloco:params:'fr' }}</span>
```

---

## 3. Attribute Directive

```html
<!-- Basic -->
<span transloco="home"></span>

<!-- With params -->
<span transloco="alert" [translocoParams]="{ value: dynamic }"></span>

<!-- Force language -->
<span transloco="home" translocoLang="ar"></span>
```

---

## Translation JSON example

```json
// en.json
{
  "title": "Hello World",
  "name": "My name is {{name}}",
  "dashboard": {
    "title": "Dashboard Title",
    "desc": "Dashboard Description"
  }
}
```
