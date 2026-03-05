---
source: Official Docs (jsverse.gitbook.io/transloco)
library: Transloco
package: @jsverse/transloco
topic: TranslocoService API, Signals API, runtime locale switching
fetched: 2026-03-02T00:00:00Z
official_docs: https://jsverse.gitbook.io/transloco/core-concepts/translation-api
---

# Transloco — Service API & Runtime Locale Switching

## Inject the service

```typescript
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export class MyComponent {
  private transloco = inject(TranslocoService);
}
```

---

## Language API

### Runtime locale switching
```typescript
// Switch language at runtime — re-renders all active *transloco directives
this.transloco.setActiveLang('ar');

// Get current language
const lang = this.transloco.getActiveLang(); // 'en'

// Subscribe to language changes
this.transloco.langChanges$.subscribe(lang => {
  console.log('Language changed to:', lang);
  // Good place to update <html dir> for RTL
});

// Get/set available langs
this.transloco.getAvailableLangs(); // ['en', 'nl', 'fr', 'ar']
this.transloco.setAvailableLangs(['en', 'nl', 'fr', 'ar']);

// Preload a language (returns Observable)
this.transloco.load('ar').subscribe(() => console.log('Arabic loaded'));
```

---

## Translation API

### `translate()` — synchronous (translation must already be loaded)
```typescript
this.transloco.translate('hello');
this.transloco.translate('hello', { value: 'world' });
this.transloco.translate(['key1', 'key2']);
this.transloco.translate('hello', {}, 'fr');           // specific language
this.transloco.translate('hello', {}, 'todos/en');     // from scope
```

### `selectTranslate()` — async/observable (auto-loads file)
```typescript
// Emits immediately and re-emits on language change
this.transloco.selectTranslate('hello').subscribe(value => ...);
this.transloco.selectTranslate('hello', { name: 'World' }).subscribe(v => ...);
this.transloco.selectTranslate('hello', {}, 'fr').subscribe(v => ...);
```

### `translateObject()` / `selectTranslateObject()`
```typescript
// Synchronous — returns whole nested object
const obj = this.transloco.translateObject('some.object');
// { hi: 'Hi', hey: 'Hey' }

// Async observable version
this.transloco.selectTranslateObject('path.to.object').subscribe(result => ...);
```

### Manually set translations (e.g., from API)
```typescript
this.transloco.setTranslation({ key: 'value' });
this.transloco.setTranslation({ key: 'value' }, 'ar');
this.transloco.setTranslationKey('title', 'New Title', 'en');
```

---

## Signals API (Angular 16+ / Transloco v7+)

```typescript
import { translateSignal, translateObjectSignal } from '@jsverse/transloco';

@Component({ standalone: true, ... })
export class MyComponent {
  // Static key
  title = translateSignal('pageTitle');

  // With params
  greeting = translateSignal('hello', { name: 'World' });

  // Language-specific
  frTitle = translateSignal('pageTitle', {}, 'fr');

  // Dynamic key from signal
  dynamicKey = signal('pageTitle');
  dynamicText = translateSignal(this.dynamicKey);

  // Object translation
  dashboardObj = translateObjectSignal('dashboard');
  get dashboardTitle() { return this.dashboardObj().title; }
}
```

---

## Events stream
```typescript
import { filter } from 'rxjs/operators';

this.transloco.events$
  .pipe(filter(e => e.type === 'langChanged'))
  .subscribe(({ payload }) => {
    console.log('Language changed to:', payload.langName);
  });

this.transloco.events$
  .pipe(filter(e => e.type === 'translationLoadSuccess'))
  .subscribe(({ payload }) => {
    console.log('Loaded:', payload.langName, 'scope:', payload.scope);
  });
```

> **Note:** `events$` only fires for HTTP loads, not cache hits.
