---
source: Context7 API + PrimeNG official docs
library: ngx-translate
package: "@ngx-translate/core + @ngx-translate/http-loader"
topic: Complete guide for Angular 21 standalone components
fetched: 2026-03-02T00:00:00Z
official_docs: https://ngx-translate.org
context7_library_id: /websites/ngx-translate
angular_version: "21"
app_pattern: standalone components, no NgModules, signals, HttpClient with Promises
---

# ngx-translate — Complete Guide for Angular 21 Standalone Components

> **Library versions (as of Context7 fetch, 2026-03-02):**
> - `@ngx-translate/core` v17+ (standalone-first API)
> - `@ngx-translate/http-loader` v17+ (ships `provideTranslateHttpLoader`)
>
> **Key mindset shift from v15/v16 → v17:**
> - `TranslateModule.forRoot()` → `provideTranslateService()` ✅
> - `TranslateModule.forChild()` → `provideChildTranslateService()` ✅
> - `EventEmitter` on service → plain `Observable` ✅
> - `.currentLang` property → `.getCurrentLang()` method ✅
> - `.defaultLang` property → `.getFallbackLang()` method ✅
> - `.langs` property → `.getLangs()` method ✅

---

## 1. Installation

```bash
npm install @ngx-translate/core @ngx-translate/http-loader
```

Both packages are needed. `@ngx-translate/http-loader` provides
`TranslateHttpLoader` (manual factory style) and the newer
`provideTranslateHttpLoader` (shorthand helper).

---

## 2. Setup with Standalone Angular (app.config.ts)

### Option A — Modern shorthand (recommended for Angular 21)

```typescript
// app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',   // path to translation JSON files
        suffix: '.json'
      }),
      fallbackLang: 'en',          // used when a key is missing in current lang
      lang: 'en'                   // initial language (defaults to browser lang if omitted)
    })
  ],
};
```

### Option B — Explicit factory (more control)

```typescript
// app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

const httpLoaderFactory = (http: HttpClient): TranslateHttpLoader =>
  new TranslateHttpLoader(http, './assets/i18n/', '.json');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideTranslateService({
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient],
      },
      fallbackLang: 'en',
      lang: 'en',
    }),
  ],
};
```

### Option C — Legacy importProvidersFrom (v15/v16, avoid in v17+)

```typescript
// ⚠️ OLD pattern — only if stuck on v15/v16 or using NgModule-based libs
import { importProvidersFrom } from '@angular/core';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';

const httpLoaderFactory = (http: HttpClient) =>
  new TranslateHttpLoader(http, './assets/i18n/', '.json');

// In providers array:
importProvidersFrom([
  TranslateModule.forRoot({
    loader: {
      provide: TranslateLoader,
      useFactory: httpLoaderFactory,
      deps: [HttpClient],
    },
    defaultLanguage: 'en', // note: v15/v16 used defaultLanguage, v17+ uses lang
  })
])
```

### provideTranslateService() — Full Config Reference

```typescript
provideTranslateService({
  loader:                    // TranslateLoader provider — loads JSON files
  fallbackLang: 'en',        // fallback lang when key is missing in current lang
  lang: 'en',                // initial lang (defaults to navigator.language)
  extend: false,             // merge new translations with existing (don't replace)
  compiler:                  // TranslateCompiler provider (e.g. messageformat)
  parser:                    // TranslateParser provider (custom interpolation)
  missingTranslationHandler: // MissingTranslationHandler provider
})
```

---

## 3. HttpLoader Setup

### File structure convention

```
public/
  assets/
    i18n/
      en.json
      ar.json
      de.json
      fr.json
```

### How `TranslateHttpLoader` builds the URL

```
prefix + langCode + suffix
→ '/assets/i18n/' + 'en' + '.json'
→ '/assets/i18n/en.json'
```

### Manual constructor (for custom logic)

```typescript
// TranslateHttpLoader constructor signature:
constructor(
  private http: HttpClient,
  public prefix: string = '/assets/i18n/',
  public suffix: string = '.json'
)

// Example: load from a CDN with cache-busting
const httpLoaderFactory = (http: HttpClient) =>
  new TranslateHttpLoader(http, 'https://cdn.example.com/i18n/', '.json?v=42');
```

### Translation JSON format

```json
// en.json
{
  "app": {
    "title": "My App",
    "welcome": "Welcome, {{name}}!",
    "itemCount": "You have {{count}} items"
  },
  "nav": {
    "home": "Home",
    "settings": "Settings"
  },
  "primeng": {
    "accept": "Yes",
    "reject": "No",
    "choose": "Choose",
    "upload": "Upload",
    "cancel": "Cancel",
    "dayNames": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    "dayNamesShort": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    "dayNamesMin": ["Su","Mo","Tu","We","Th","Fr","Sa"],
    "monthNames": ["January","February","March","April","May","June","July","August","September","October","November","December"],
    "monthNamesShort": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    "today": "Today",
    "clear": "Clear",
    "dateFormat": "mm/dd/yy",
    "firstDayOfWeek": 0
  }
}
```

---

## 4. TranslateService API

### Injection (Angular 21 — use `inject()`)

```typescript
import { Component, inject, signal, effect, DestroyRef } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({ /* ... */ })
export class MyComponent {
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
}
```

### Core Methods

#### `use(lang: string): Observable<InterpolatableTranslationObject>`
Switches the current language. Loads translation file if not already loaded.
```typescript
// Fire-and-forget
this.translate.use('fr');

// Wait for translations to finish loading (Promise pattern for your codebase)
this.translate.use('ar').toPromise().then(() => {
  console.log('Arabic translations loaded');
});

// Observable pattern
this.translate.use('de').subscribe(translations => {
  console.log('Switched to German');
});

// ⚠️ v17+ deterministic: rapid calls → the LAST call always wins
```

#### `get(key: string | string[], params?: object): Observable<string | object>`
Async retrieval. Emits once and completes.
```typescript
// Single key
this.translate.get('app.welcome', { name: 'John' }).subscribe((res: string) => {
  console.log(res); // 'Welcome, John!'
});

// Multiple keys
this.translate.get(['app.title', 'nav.home']).subscribe(res => {
  // res = { 'app.title': 'My App', 'nav.home': 'Home' }
});

// As Promise (for your Promises pattern)
const msg = await this.translate.get('app.welcome', { name: 'Ali' }).toPromise();
```

#### `instant(key: string | string[], params?: object): string | object`
Synchronous retrieval. **Requires translations to be already loaded.**
```typescript
// Safe inside ngOnInit() after use() has resolved, or in event handlers
const label = this.translate.instant('app.title');

// With params
const msg = this.translate.instant('app.welcome', { name: 'Sara' });

// ⚠️ Returns the key itself if translations are not yet loaded — never call
//    at component construction time before translations load
```

#### `stream(key: string | string[], params?: object): Observable<string | object>`
Like `get()` but stays alive and re-emits on every language change.
```typescript
// Best for reactive patterns — auto-updates on language switch
const sub = this.translate.stream('app.title').subscribe(title => {
  this.pageTitle.set(title); // write to a signal
});
// Unsubscribe on destroy
```

#### `getStreamOnTranslationChange(key, params?): Observable<string | object>`
Like `stream()` but also emits when translations are manually updated (not just language changes).

#### Language Management

```typescript
// Add languages to the list (does NOT load files — loading is on-demand)
this.translate.addLangs(['de', 'en', 'ar', 'fr']);

// Get all registered languages
const langs: string[] = this.translate.getLangs(); // ['de', 'en', 'ar', 'fr']

// Get active language
const current: string = this.translate.getCurrentLang(); // 'en'

// Get fallback language
const fallback: string = this.translate.getFallbackLang(); // 'en'

// Set fallback language (v17: use method, not setDefaultLang)
this.translate.setFallbackLang('en');

// Manually inject translations (bypasses loader, useful for static default lang)
import enTranslations from '../assets/i18n/en.json';
this.translate.setTranslation('en', enTranslations);

// Merge additional translations into an existing language
this.translate.setTranslation('en', extraKeys, true /* shouldMerge */);
```

### Event Observables (v17+ — plain Observables, not EventEmitters)

```typescript
// Language changed
this.translate.onLangChange.subscribe((event: LangChangeEvent) => {
  console.log(event.lang);         // 'ar'
  console.log(event.translations); // { ... ar translations object ... }
});

// Translations updated for current lang (e.g. setTranslation called)
this.translate.onTranslationChange.subscribe(event => {
  console.log(event.lang, event.translations);
});

// Fallback language changed
this.translate.onFallbackLangChange.subscribe(event => {
  console.log(event.lang);
});
```

---

## 5. TranslatePipe & TranslateDirective in Templates

### Import in standalone component

```typescript
import { Component } from '@angular/core';
import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';

@Component({
  selector: 'app-my',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective], // import both for full flexibility
  templateUrl: './my.component.html',
})
export class MyComponent {}
```

### TranslatePipe — template usage

```html
<!-- Basic key -->
<h1>{{ 'app.title' | translate }}</h1>

<!-- With interpolation params (object literal) -->
<p>{{ 'app.welcome' | translate: { name: 'John' } }}</p>

<!-- Dynamic key from component property -->
<span>{{ dynamicKey | translate }}</span>

<!-- With HTML in translations — use [innerHTML] -->
<div [innerHTML]="'app.richText' | translate"></div>

<!-- With async pipe for reactive stream -->
<p>{{ 'app.title' | translate }}</p>
<!-- TranslatePipe auto-detects language changes in v17+ — no async needed -->
```

### TranslateDirective — attribute usage

```html
<!-- Bind key to [translate] input -->
<div [translate]="'app.hello'" [translateParams]="{ name: 'John' }"></div>

<!-- Use element content as the key -->
<div translate [translateParams]="{ name: 'John' }">app.hello</div>

<!-- Useful for translating button labels -->
<button [translate]="'actions.save'"></button>
```

### Using `_()` helper for type-safe keys (v17+)

```typescript
import { _, TranslateService } from '@ngx-translate/core';

// Marks string as a translation key — enables tooling/extraction
this.translate.get(_('app.title')).subscribe(/* ... */);
```

---

## 6. Language Switching at Runtime

### Language switcher component (signals pattern)

```typescript
import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="lang-switcher">
      @for (lang of availableLangs(); track lang) {
        <button
          [class.active]="currentLang() === lang"
          (click)="switchLang(lang)">
          {{ lang.toUpperCase() }}
        </button>
      }
    </div>
  `
})
export class LangSwitcherComponent {
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);
  private destroyRef = inject(DestroyRef);

  readonly availableLangs = signal<string[]>([]);
  readonly currentLang = signal<string>('en');

  constructor() {
    // Initialize from service
    this.availableLangs.set(this.translate.getLangs());
    this.currentLang.set(this.translate.getCurrentLang() ?? 'en');

    // Keep signal in sync with service
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event: LangChangeEvent) => {
        this.currentLang.set(event.lang);
      });
  }

  switchLang(lang: string): void {
    this.translate.use(lang).subscribe(() => {
      // Update <html lang="..."> for accessibility & SEO
      this.document.documentElement.setAttribute('lang', lang);
      // Persist to localStorage
      localStorage.setItem('preferredLang', lang);
    });
  }
}
```

### Initialize language from localStorage / browser

```typescript
// app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DOCUMENT } from '@angular/common';

@Component({ selector: 'app-root', standalone: true, /* ... */ })
export class AppComponent implements OnInit {
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);

  ngOnInit(): void {
    this.translate.addLangs(['en', 'ar', 'de', 'fr']);
    this.translate.setFallbackLang('en');

    const savedLang = localStorage.getItem('preferredLang')
      ?? this.translate.getBrowserLang()
      ?? 'en';

    // Only use a lang that is in the supported list
    const langToUse = this.translate.getLangs().includes(savedLang)
      ? savedLang
      : 'en';

    this.translate.use(langToUse).subscribe(() => {
      this.document.documentElement.setAttribute('lang', langToUse);
    });
  }
}
```

---

## 7. RTL / LTR Direction Handling

ngx-translate itself has **no built-in RTL handling** — you manage `dir` yourself.
The pattern is: listen to `onLangChange`, then set `document.documentElement.dir`.

### RTL language detector service

```typescript
// services/i18n.service.ts
import { Injectable, inject, signal, DOCUMENT } from '@angular/core';
import { TranslateService, LangChangeEvent } from '@ngx-translate/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'dv', 'ku']);

@Injectable({ providedIn: 'root' })
export class I18nService {
  private translate = inject(TranslateService);
  private document = inject(DOCUMENT);

  /** Signal: true when current language is RTL */
  readonly isRtl = toSignal(
    this.translate.onLangChange.pipe(
      map((event: LangChangeEvent) => RTL_LANGS.has(event.lang))
    ),
    { initialValue: RTL_LANGS.has(this.translate.getCurrentLang() ?? 'en') }
  );

  /** Signal: 'rtl' | 'ltr' */
  readonly dir = toSignal(
    this.translate.onLangChange.pipe(
      map((event: LangChangeEvent) => RTL_LANGS.has(event.lang) ? 'rtl' : 'ltr')
    ),
    { initialValue: RTL_LANGS.has(this.translate.getCurrentLang() ?? 'en') ? 'rtl' : 'ltr' }
  );

  switchLang(lang: string): Promise<void> {
    return new Promise((resolve) => {
      this.translate.use(lang).subscribe(() => {
        const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
        this.document.documentElement.setAttribute('lang', lang);
        this.document.documentElement.setAttribute('dir', dir);
        this.document.body.setAttribute('dir', dir);
        resolve();
      });
    });
  }
}
```

### Apply in root component

```typescript
// app.component.ts
import { Component, inject, effect } from '@angular/core';
import { I18nService } from './services/i18n.service';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div [attr.dir]="i18n.dir()">
      <router-outlet />
    </div>
  `
})
export class AppComponent {
  readonly i18n = inject(I18nService);
}
```

### CSS for RTL/LTR layout

```css
/* Use CSS logical properties — these flip automatically with dir attribute */
.card {
  padding-inline-start: 1rem;   /* left in LTR, right in RTL */
  padding-inline-end: 1rem;
  margin-inline-start: 0.5rem;
  border-inline-start: 3px solid var(--primary);
}

/* Explicit RTL overrides if needed */
[dir="rtl"] .sidebar {
  transform: scaleX(-1); /* flip icons if needed */
}
```

---

## 8. Handling Missing Translations

### Default behavior
- If `fallbackLang` is set → look up key in fallback language first
- If still not found → call `MissingTranslationHandler` (default: return the key string)

### Custom MissingTranslationHandler

```typescript
// handlers/custom-missing-translation.handler.ts
import { Injectable } from '@angular/core';
import {
  MissingTranslationHandler,
  MissingTranslationHandlerParams
} from '@ngx-translate/core';

@Injectable()
export class CustomMissingTranslationHandler implements MissingTranslationHandler {
  handle(params: MissingTranslationHandlerParams): string {
    // Log for debugging (send to monitoring in production)
    if (!environment.production) {
      console.warn(`[i18n] Missing translation: "${params.key}" (lang: ${params.translateService?.getCurrentLang()})`);
    }

    // Option A: return the key as-is (default)
    return params.key;

    // Option B: return a styled placeholder
    // return `[${params.key}]`;

    // Option C: try fallback language manually
    // const fallback = params.translateService?.instant(params.key, params.interpolateParams);
    // return fallback !== params.key ? fallback : params.key;
  }
}
```

### Register handler in app.config.ts

```typescript
import { provideTranslateService, provideMissingTranslationHandler } from '@ngx-translate/core';
import { CustomMissingTranslationHandler } from './handlers/custom-missing-translation.handler';

provideTranslateService({
  loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/' }),
  fallbackLang: 'en',
  missingTranslationHandler: provideMissingTranslationHandler(CustomMissingTranslationHandler),
})
```

### MissingTranslationHandlerParams interface

```typescript
interface MissingTranslationHandlerParams {
  key: string;                           // the missing translation key
  translateService: TranslateService;    // access to the service
  interpolateParams?: object;            // params passed to get()/instant()
}
```

---

## 9. Interpolation Syntax

### Default parser — double curly braces `{{ }}`

```json
{
  "greeting": "Hello, {{name}}!",
  "itemCount": "You have {{count}} item(s)",
  "welcome": "Welcome to {{appName}}, {{name}}!"
}
```

```typescript
// In TypeScript
this.translate.get('greeting', { name: 'Sara' }).subscribe(console.log);
// → 'Hello, Sara!'

this.translate.instant('welcome', { appName: 'SmartAccess', name: 'Admin' });
// → 'Welcome to SmartAccess, Admin!'
```

```html
<!-- In template -->
<p>{{ 'greeting' | translate: { name: userName() } }}</p>
<p>{{ 'itemCount' | translate: { count: items().length } }}</p>
```

### HTML in translations

```json
{
  "richText": "Click <strong>here</strong> to continue"
}
```

```html
<!-- Must use [innerHTML] — TranslatePipe returns the raw HTML string -->
<div [innerHTML]="'richText' | translate"></div>
<!-- Angular's DomSanitizer strips dangerous tags automatically -->
```

### Function-based translations (via custom compiler)

```typescript
// In translation file value (when using a function-capable compiler):
// Can provide a function instead of string for complex logic
parser.interpolate((params) => `Result: ${params.value}`, { value: 42 });
```

### Custom parser for different syntax (e.g., `%{key}`)

```typescript
// Extend TranslateParser to support %{varName} syntax if needed
import { TranslateParser } from '@ngx-translate/core';

@Injectable()
export class CustomTranslateParser extends TranslateParser {
  interpolate(expr: string | Function, params?: any): string {
    if (typeof expr === 'string') {
      return expr.replace(/%\{(\w+)\}/g, (_, key) => params?.[key] ?? `%{${key}}`);
    }
    return typeof expr === 'function' ? expr(params) : expr;
  }
  getValue(target: any, key: string): any {
    // Navigate nested keys: 'app.title' → target.app.title
    return key.split('.').reduce((obj, k) => obj?.[k], target);
  }
}
```

---

## 10. Pluralization Support

### ngx-translate has NO built-in plural support
The default parser only does `{{param}}` interpolation.

### Option A — Manual plural via separate keys (simple, works everywhere)

```json
{
  "items": {
    "zero": "No items",
    "one": "1 item",
    "other": "{{count}} items"
  }
}
```

```typescript
// In component
getPluralKey(count: number): string {
  if (count === 0) return 'items.zero';
  if (count === 1) return 'items.one';
  return 'items.other';
}
```

```html
<p>{{ getPluralKey(items().length) | translate: { count: items().length } }}</p>
```

### Option B — ICU Message Format (full pluralization, recommended for production)

Install `ngx-translate-messageformat-compiler`:
```bash
npm install ngx-translate-messageformat-compiler messageformat
```

```typescript
// app.config.ts
import { provideTranslateService, provideTranslateCompiler } from '@ngx-translate/core';
import { TranslateMessageFormatCompiler } from 'ngx-translate-messageformat-compiler';

provideTranslateService({
  loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/' }),
  fallbackLang: 'en',
  compiler: provideTranslateCompiler(TranslateMessageFormatCompiler),
})
```

```json
{
  "items": "{count, plural, =0 {No items} one {1 item} other {# items}}",
  "gender": "{gender, select, male {He} female {She} other {They}} liked this"
}
```

```html
<p>{{ 'items' | translate: { count: 5 } }}</p>
<!-- → '5 items' -->

<p>{{ 'gender' | translate: { gender: 'female' } }}</p>
<!-- → 'She liked this' -->
```

---

## 11. Best Practices for Large Apps — Lazy Loading Translations

### Strategy overview

| Strategy | When to use | Trade-off |
|---|---|---|
| Global JSON per language | Small/medium apps | Simple but grows unbounded |
| Feature-scoped JSON files | Large apps, lazy routes | Optimal bundle sizes |
| Static import for default lang | Eliminate loading flash | Bundles default lang |
| CDN-hosted translation files | Multi-tenant / CMS-driven | Cache control flexibility |

### Feature-scoped lazy translations with `provideChildTranslateService`

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { provideChildTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

export const routes: Routes = [
  {
    path: 'dashboard',
    providers: [
      provideChildTranslateService({
        loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/dashboard/' }),
      }),
    ],
    loadChildren: () => import('./features/dashboard/dashboard.routes'),
  },
  {
    path: 'users',
    providers: [
      provideChildTranslateService({
        loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/users/' }),
      }),
    ],
    loadChildren: () => import('./features/users/users.routes'),
  },
];
```

```
assets/i18n/
  en.json               ← Global shared strings
  ar.json
  dashboard/
    en.json             ← Dashboard-specific strings
    ar.json
  users/
    en.json             ← Users-feature-specific strings
    ar.json
```

> **How it works:**
> - `provideChildTranslateService()` creates a child injector scope linked to root
> - Language changes in root propagate to all children
> - New translations loaded by child are **merged into the root service** (default `extend: false` replaced, set `extend: true` to merge)
> - Only loaded when the route is navigated to

### Eliminate loading flash — static default language

```typescript
// app.component.ts
import { Component, OnInit, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import defaultEn from '../assets/i18n/en.json';  // bundled

@Component({ selector: 'app-root', standalone: true, /* ... */ })
export class AppComponent implements OnInit {
  private translate = inject(TranslateService);

  ngOnInit(): void {
    // Make English available immediately (no HTTP request)
    this.translate.setTranslation('en', defaultEn);
    this.translate.setFallbackLang('en');

    const savedLang = localStorage.getItem('lang') ?? 'en';
    if (savedLang !== 'en') {
      // Other languages still load via HTTP
      this.translate.use(savedLang);
    } else {
      this.translate.use('en');
    }
  }
}
```

### Signal-based translation helper (reactive, efficient)

```typescript
// utils/translate.util.ts
import { inject, Signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Returns a signal that automatically updates when the language changes.
 * Usage: const title = translateSignal('app.title');
 *        const msg = translateSignal('app.welcome', { name: 'Sara' });
 */
export function translateSignal(
  key: string,
  params?: object
): Signal<string> {
  const translate = inject(TranslateService);
  return toSignal(
    translate.stream(key, params),
    { initialValue: translate.instant(key, params) }
  );
}
```

```typescript
// In component
@Component({ /* ... */ })
export class MyComponent {
  readonly title = translateSignal('app.title');
  readonly welcomeMsg = translateSignal('app.welcome', { name: 'Admin' });
}
```

```html
<h1>{{ title() }}</h1>
<p>{{ welcomeMsg() }}</p>
```

### Preloading translations via APP_INITIALIZER pattern (Promises style)

```typescript
// app.config.ts
import { APP_INITIALIZER, ApplicationConfig, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

function initTranslations(): () => Promise<void> {
  const translate = inject(TranslateService);
  return async () => {
    translate.addLangs(['en', 'ar']);
    translate.setFallbackLang('en');
    const savedLang = localStorage.getItem('lang') ?? 'en';
    await firstValueFrom(translate.use(savedLang));
    document.documentElement.setAttribute('lang', savedLang);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideTranslateService({
      loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/' }),
      fallbackLang: 'en',
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: initTranslations,
      multi: true,
    },
  ],
};
```

---

## 12. PrimeNG Integration

PrimeNG components (DatePicker, DataTable, etc.) use their own internal locale system
(`PrimeNG` service). You must **bridge** ngx-translate to PrimeNG manually.

### Setup (app.component.ts)

```typescript
import { Component, OnInit, inject, DestroyRef } from '@angular/core';
import { PrimeNG } from 'primeng/config';
import { TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private primeng = inject(PrimeNG);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.translate.setDefaultLang('en');

    // Initial load
    this.applyPrimeNGTranslations(this.translate.currentLang ?? 'en');

    // Re-apply on every language switch
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ lang }) => this.applyPrimeNGTranslations(lang));
  }

  private applyPrimeNGTranslations(lang: string): void {
    this.translate.get('primeng').subscribe(res => {
      this.primeng.setTranslation(res);
    });
  }
}
```

### Translation JSON structure for PrimeNG

The key `"primeng"` in your translation files maps directly to PrimeNG's locale options:

```json
// en.json
{
  "primeng": {
    "accept": "Yes",
    "reject": "No",
    "choose": "Choose",
    "upload": "Upload",
    "cancel": "Cancel",
    "clear": "Clear",
    "completed": "Completed",
    "pending": "Pending",
    "dayNames": ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
    "dayNamesShort": ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"],
    "dayNamesMin": ["Su","Mo","Tu","We","Th","Fr","Sa"],
    "monthNames": ["January","February","March","April","May","June","July","August","September","October","November","December"],
    "monthNamesShort": ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
    "today": "Today",
    "weekHeader": "Wk",
    "firstDayOfWeek": 0,
    "dateFormat": "mm/dd/yy",
    "weak": "Weak",
    "medium": "Medium",
    "strong": "Strong",
    "passwordPrompt": "Enter a password",
    "emptyMessage": "No results found",
    "emptyFilterMessage": "No results found",
    "searchMessage": "{0} results are available",
    "selectionMessage": "{0} items selected"
  }
}

// ar.json
{
  "primeng": {
    "accept": "نعم",
    "reject": "لا",
    "choose": "اختر",
    "upload": "رفع",
    "cancel": "إلغاء",
    "clear": "مسح",
    "dayNames": ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"],
    "dayNamesShort": ["أحد","اثن","ثلا","أرب","خمي","جمع","سبت"],
    "dayNamesMin": ["أ","ا","ث","ر","خ","ج","س"],
    "monthNames": ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],
    "monthNamesShort": ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],
    "today": "اليوم",
    "weekHeader": "أسبوع",
    "firstDayOfWeek": 6,
    "dateFormat": "dd/mm/yy"
  }
}
```

> **PrimeLocale repository:** https://github.com/primefaces/primelocale
> Ready-made locale JSON for 50+ languages — copy into your `primeng` key.

### PrimeNG RTL setup (separate from ngx-translate)

```typescript
// app.config.ts
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';

providePrimeNG({
  theme: { preset: Aura },
  ripple: true,
  // RTL is handled via [dir="rtl"] CSS — not a PrimeNG config option in v21
})
```

```typescript
// In I18nService.switchLang() — set both lang and dir when switching to RTL:
this.document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
// PrimeNG v21 respects [dir="rtl"] on documentElement automatically
```

---

## Quick Migration Reference (v15/v16 → v17)

| Old (v15/v16) | New (v17+) |
|---|---|
| `TranslateModule.forRoot(config)` | `provideTranslateService(config)` |
| `TranslateModule.forChild(config)` | `provideChildTranslateService(config)` |
| `importProvidersFrom(TranslateModule.forRoot())` | `provideTranslateService()` directly |
| `defaultLanguage: 'en'` config key | `lang: 'en'` config key |
| `translate.currentLang` | `translate.getCurrentLang()` |
| `translate.defaultLang` | `translate.getFallbackLang()` |
| `translate.setDefaultLang('en')` | `translate.setFallbackLang('en')` |
| `translate.langs` | `translate.getLangs()` |
| `onLangChange.emit()` | N/A — now an Observable, not EventEmitter |
| Import `TranslateModule` in component | Import `TranslatePipe, TranslateDirective` |

---

## Common Gotchas

1. **`instant()` before translations load** → returns the key. Use `stream()` or await `use()` first.
2. **`onLangChange` not firing on initial load** → it only fires on *changes*. Read initial state from `getCurrentLang()`.
3. **Child service translations replacing parent** → set `extend: true` in `provideChildTranslateService` config if you want to merge.
4. **PrimeNG locale not updating** → must manually call `primeng.setTranslation()` — it does NOT react to ngx-translate automatically.
5. **TranslatePipe not updating after lang switch** → ensure `TranslatePipe` is imported (not `TranslateModule`) in the standalone component's `imports` array.
6. **RTL layout not applying** → must set `dir` attribute on `<html>` or wrapping element; CSS logical properties require this.
7. **`use()` race condition (v16 and below)** → v17+ is deterministic; last call wins. Safe to call rapidly.
8. **Translation keys with dots** → default parser uses dot-notation for nested JSON. `'app.title'` maps to `{ app: { title: '...' } }`.
