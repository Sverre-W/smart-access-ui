---
source: Official Docs (jsverse.gitbook.io/transloco)
library: Transloco
package: @jsverse/transloco
topic: Installation, setup, config options — Angular 21 standalone
fetched: 2026-03-02T00:00:00Z
official_docs: https://jsverse.gitbook.io/transloco/getting-started/installation
---

# Transloco — Installation & Setup (Angular Standalone)

## 1. Install via Schematics (recommended)

```bash
ng add @jsverse/transloco
```

The schematic prompts for languages and auto-generates all boilerplate.

---

## 2. Manual Setup — `app.config.ts`

```typescript
// app.config.ts
import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['en', 'nl', 'fr', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,   // required for runtime switching
        prodMode: !isDevMode(),
        fallbackLang: 'en',
        missingHandler: {
          useFallbackTranslation: true,
          logMissingKey: isDevMode(),
        },
      },
      loader: TranslocoHttpLoader,
    }),
  ],
};
```

> **`reRenderOnLangChange: true`** — MUST be set for runtime locale switching. Set to `false` only for build-time-only i18n.

---

## 3. HTTP Loader (`transloco-loader.ts`)

```typescript
import { inject, Injectable } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private http = inject(HttpClient);

  getTranslation(lang: string) {
    // Use relative path if deployment causes 404s
    return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
  }
}
```

---

## 4. Global Config (`transloco.config.ts` — for tooling/plugins)

```typescript
import { TranslocoGlobalConfig } from '@jsverse/transloco-utils';

const config: TranslocoGlobalConfig = {
  rootTranslationsPath: 'src/assets/i18n/',
  langs: ['en', 'nl', 'fr', 'ar'],
  keysManager: {},
};

export default config;
```

---

## 5. Full Config Options Reference

| Option | Default | Description |
|--------|---------|-------------|
| `availableLangs` | `[]` | All supported language codes |
| `defaultLang` | `'en'` | Language loaded on startup |
| `reRenderOnLangChange` | `false` | **Set `true` for runtime switching** |
| `fallbackLang` | — | Fallback when key is missing |
| `prodMode` | `false` | Suppresses console warnings in prod |
| `failedRetries` | `2` | Retries for failed HTTP loads |
| `missingHandler.allowEmpty` | `false` | Allow empty string for missing keys |
| `missingHandler.useFallbackTranslation` | `false` | Use fallback lang for missing keys |
| `missingHandler.logMissingKey` | `true` | Log warning for missing keys |
| `interpolation` | `['{{','}}']` | Custom param delimiters |
| `scopes.keepCasing` | `false` | Preserve scope name casing |
