---
source: Official PrimeNG GitHub source (packages/primeng/src/paginator/paginator.ts)
library: PrimeNG
package: primeng/paginator
topic: Paginator component API — v21
fetched: 2026-03-01T00:00:00Z
official_docs: https://primeng.org/paginator
---

# PrimeNG v21 — Paginator

## Import

```ts
// Standalone / tree-shakeable (preferred in v21)
import { Paginator } from 'primeng/paginator';

// NgModule wrapper (includes SharedModule)
import { PaginatorModule } from 'primeng/paginator';
```

- **Standalone class**: `Paginator`
- **NgModule**: `PaginatorModule`
- **Selector**: `p-paginator`

---

## Key Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `[rows]` | `number` | `0` | Number of rows (items) per page |
| `[totalRecords]` | `number` | `0` | Total number of records across all pages |
| `[first]` | `number` | `0` | Zero-based index of the **first record** on the current page |
| `[rowsPerPageOptions]` | `any[]` | `undefined` | Array of page-size options, e.g. `[10, 25, 50]`. Renders a dropdown. Add `{showAll:'All'}` to include an "All" option |
| `[showCurrentPageReport]` | `boolean` | `false` | Whether to display the current page report text |
| `[currentPageReportTemplate]` | `string` | `'{currentPage} of {totalPages}'` | Template string. Available placeholders: `{currentPage}`, `{totalPages}`, `{rows}`, `{first}`, `{last}`, `{totalRecords}` |
| `[pageLinkSize]` | `number` | `5` | Number of page-number buttons visible at once |
| `[showFirstLastIcon]` | `boolean` | `true` | Whether to show ⏮/⏭ first/last-page buttons |
| `[showPageLinks]` | `boolean` | `true` | Whether to show individual page-number links |
| `[showJumpToPageDropdown]` | `boolean` | `false` | Whether to show a dropdown to jump to any page |
| `[showJumpToPageInput]` | `boolean` | `false` | Whether to show a text input to jump to any page |
| `[alwaysShow]` | `boolean` | `true` | When `false`, hides the paginator if there is only one page |
| `[appendTo]` | `'body' \| 'self' \| ElementRef \| TemplateRef \| null` | `undefined` | Where to attach dropdown overlays |
| `[locale]` | `string` | `undefined` | Locale string for number formatting (e.g. `'de-DE'`) |
| `[dropdownScrollHeight]` | `string` | `'200px'` | Max height of rows-per-page dropdown viewport |
| `[templateLeft]` | `TemplateRef` | `undefined` | Custom content injected left of the paginator |
| `[templateRight]` | `TemplateRef` | `undefined` | Custom content injected right of the paginator |

---

## Output Event

```ts
@Output() onPageChange: EventEmitter<PaginatorState>
```

### `PaginatorState` — emitted object shape

Emitted by `(onPageChange)` every time the user navigates pages or changes the rows-per-page. Constructed directly in `changePage()`:

```ts
// From source — packages/primeng/src/paginator/paginator.ts
{
  page:       number;   // 0-based index of the new page
  first:      number;   // 0-based index of the first record on this page  (= page * rows)
  rows:       number;   // current rows-per-page value
  pageCount:  number;   // total number of pages (= Math.ceil(totalRecords / rows))
}
```

> **Note**: `totalRecords` is NOT included in the emitted event — it is a separate component input you already hold. Import `PaginatorState` from `'primeng/types/paginator'` if you want to type your handler parameter.

```ts
import { PaginatorState } from 'primeng/types/paginator';
```

---

## currentPageReportTemplate Placeholders

| Placeholder | Resolves to |
|---|---|
| `{currentPage}` | 1-based current page number |
| `{totalPages}` | Total page count |
| `{first}` | 1-based index of first record on this page |
| `{last}` | Index of last record on this page |
| `{rows}` | Current rows-per-page |
| `{totalRecords}` | Total record count |

---

## Minimal Reactive-Forms-Compatible Example

### Component (TypeScript)

```ts
import { Component, signal } from '@angular/core';
import { PaginatorModule } from 'primeng/paginator';
import { PaginatorState } from 'primeng/types/paginator';

@Component({
  selector: 'app-my-list',
  standalone: true,
  imports: [PaginatorModule],
  template: `
    <p-paginator
      [first]="first()"
      [rows]="rows()"
      [totalRecords]="totalRecords"
      [rowsPerPageOptions]="[10, 25, 50]"
      [showCurrentPageReport]="true"
      currentPageReportTemplate="Showing {first} to {last} of {totalRecords}"
      (onPageChange)="onPageChange($event)"
    />
  `
})
export class MyListComponent {
  totalRecords = 520;
  first   = signal(0);
  rows    = signal(10);

  onPageChange(event: PaginatorState): void {
    this.first.set(event.first);  // 0-based offset
    this.rows.set(event.rows);    // new page size
    // event.page      → 0-based page index
    // event.pageCount → total pages
    this.loadData(event.first, event.rows);
  }

  private loadData(first: number, rows: number): void {
    // e.g. call your service with offset = first, limit = rows
  }
}
```

### Template-only binding (two-way-style)

```html
<p-paginator
  [(first)]="first"
  [rows]="rows"
  [totalRecords]="totalRecords"
  [rowsPerPageOptions]="[10, 25, 50]"
  (onPageChange)="onPageChange($event)"
/>
```

> `[first]` is a **one-way** input; you must update it yourself in `(onPageChange)` to keep the paginator in sync. There is no `[(first)]` two-way binding — update `first` from the event handler.

---

## NgModule import (non-standalone)

```ts
@NgModule({
  imports: [PaginatorModule]
})
export class MyModule {}
```
