---
source: Official Docs + Angular best practices
library: Transloco
package: @jsverse/transloco + @jsverse/transloco-persist-lang
topic: Multi-locale EN/NL/FR/AR config, RTL direction switching, persist language plugin
fetched: 2026-03-02T00:00:00Z
official_docs: https://jsverse.gitbook.io/transloco/plugins-and-extensions/persist-lang
---

# Transloco — Multi-Locale Config, RTL & Language Persistence

## Multi-Locale Configuration (EN, NL, FR, AR)

```typescript
// app.config.ts
import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideTransloco } from '@jsverse/transloco';
import { provideTranslocoPersistLang } from '@jsverse/transloco-persist-lang';
import { TranslocoHttpLoader } from './transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideTransloco({
      config: {
        availableLangs: ['en', 'nl', 'fr', 'ar'],
        defaultLang: 'en',
        reRenderOnLangChange: true,       // required for runtime switching
        prodMode: !isDevMode(),
        fallbackLang: 'en',
        missingHandler: {
          useFallbackTranslation: true,
          logMissingKey: isDevMode(),
        },
      },
      loader: TranslocoHttpLoader,
    }),
    // Persist language choice across sessions:
    provideTranslocoPersistLang({
      storage: { useValue: localStorage },
    }),
  ],
};
```

Install the persist plugin:
```bash
npm install @jsverse/transloco-persist-lang
```

---

## Runtime Language Switcher Component (standalone)

```typescript
// lang-switcher.component.ts
import { Component, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';

interface Language {
  code: string;
  label: string;
  dir: 'ltr' | 'rtl';
}

@Component({
  selector: 'app-lang-switcher',
  standalone: true,
  template: `
    <button *ngFor="let lang of languages" (click)="switchLang(lang)">
      {{ lang.label }}
    </button>
  `,
})
export class LangSwitcherComponent {
  private transloco = inject(TranslocoService);
  private document = inject(DOCUMENT);

  languages: Language[] = [
    { code: 'en', label: 'English', dir: 'ltr' },
    { code: 'nl', label: 'Nederlands', dir: 'ltr' },
    { code: 'fr', label: 'Français', dir: 'ltr' },
    { code: 'ar', label: 'العربية', dir: 'rtl' },
  ];

  switchLang(lang: Language): void {
    this.transloco.setActiveLang(lang.code);
    this.updateDocumentDir(lang.dir);
  }

  private updateDocumentDir(dir: 'ltr' | 'rtl'): void {
    const html = this.document.documentElement;
    html.setAttribute('dir', dir);
    html.setAttribute('lang', this.transloco.getActiveLang());
  }
}
```

---

## RTL Direction Switching — Reactive Approach

Subscribe to language changes in your root `AppComponent` to reactively
update `<html dir>` whenever the active language changes:

```typescript
// app.component.ts
import { Component, inject, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur']);

@Component({
  selector: 'app-root',
  standalone: true,
  template: '<router-outlet />',
})
export class AppComponent implements OnInit {
  private transloco = inject(TranslocoService);
  private document = inject(DOCUMENT);

  constructor() {
    this.transloco.langChanges$
      .pipe(takeUntilDestroyed())
      .subscribe(lang => this.applyDirection(lang));
  }

  ngOnInit(): void {
    // Apply direction for the initial language
    this.applyDirection(this.transloco.getActiveLang());
  }

  private applyDirection(lang: string): void {
    const dir = RTL_LANGS.has(lang) ? 'rtl' : 'ltr';
    const html = this.document.documentElement;
    html.setAttribute('dir', dir);
    html.setAttribute('lang', lang);
  }
}
```

### CSS for RTL support

```css
/* styles.css or component styles */

/* Angular CDK BidiModule helper (optional) */
[dir="rtl"] .some-element {
  margin-left: 0;
  margin-right: 1rem;
}

/* Or use CSS logical properties (recommended) */
.card {
  padding-inline-start: 1rem;   /* left in LTR, right in RTL */
  padding-inline-end: 1rem;
  margin-inline-start: 0.5rem;
}
```

---

## Persist Language Plugin Options

```typescript
// Custom strategy: prefer browser language, then cached, then default
export function getLangFn({ cachedLang, browserLang, defaultLang }) {
  return cachedLang ?? browserLang ?? defaultLang;
}

provideTranslocoPersistLang({
  getLangFn,
  storage: { useValue: localStorage },
})

// For SSR — use cookies instead of localStorage
import { cookiesStorage } from '@jsverse/transloco-persist-lang';

provideTranslocoPersistLang({
  storage: { useValue: cookiesStorage() },
})
```
