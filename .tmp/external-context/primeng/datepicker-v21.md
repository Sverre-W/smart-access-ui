---
source: Official PrimeNG docs (primeng.org) + GitHub source (primefaces/primeng master)
library: PrimeNG
package: primeng/datepicker
topic: DatePicker component - full API, Reactive Forms, time selection, v21 gotchas
fetched: 2026-03-01T00:00:00Z
official_docs: https://primeng.org/datepicker
version: 21.1.1 (master branch)
---

# PrimeNG 21 — DatePicker Component

## 1. Import Path

```typescript
// Module import (works in both standalone and NgModule-based apps)
import { DatePickerModule } from 'primeng/datepicker';

// Direct standalone component import (preferred for standalone Angular components)
import { DatePicker } from 'primeng/datepicker';
```

**Package path**: `primeng/datepicker`
**Component selector**: `p-datepicker`, `p-datePicker`, or `p-date-picker` (all valid, case-insensitive)
**Standalone**: `true` — the `DatePicker` class is a standalone component

### NgModule (DatePickerModule) exports:
```typescript
// DatePickerModule re-exports DatePicker + SharedModule
import { DatePickerModule } from 'primeng/datepicker';
```

---

## 2. Standalone Import (Angular 17+/19+/21)

```typescript
// Option A: Use DatePickerModule (includes SharedModule + template helpers)
@Component({
  standalone: true,
  imports: [DatePickerModule, ReactiveFormsModule],
  ...
})

// Option B: Import DatePicker directly (minimal)
@Component({
  standalone: true,
  imports: [DatePicker, ReactiveFormsModule],
  ...
})
```

Both work. `DatePickerModule` is slightly more convenient as it bundles `SharedModule` (needed for `ng-template` slot usage like `#date`, `#header`, `#footer`).

---

## 3. Reactive Forms — `formControlName` Binding

### Value Type: **`Date` object** (JavaScript `Date`)

By default, the DatePicker binds and emits **JavaScript `Date` objects**, not strings.

```typescript
// In your FormGroup:
form = new FormGroup({
  appointmentDate: new FormControl<Date | null>(null),
});

// After selection, form.value.appointmentDate is a Date object:
// Date { Sat Mar 01 2026 14:30:00 GMT+0000 }
```

### `dataType` input — switch to string output

There is an `@Input() dataType: string = 'date'` property. Set it to `'string'` to make the form control receive a **formatted string** instead of a Date object:

```html
<!-- Binds a Date object (default) -->
<p-datepicker formControlName="appointmentDate" />

<!-- Binds a formatted string (e.g. "03/01/2026") -->
<p-datepicker formControlName="appointmentDate" dataType="string" />
```

> ⚠️ **Gotcha**: When `dataType="string"`, the string format matches `dateFormat`. If you change `dateFormat`, the stored string format changes too. Prefer `Date` objects and format on display.

### Template example with reactive forms:

```html
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <p-datepicker formControlName="appointmentDate" />
  <button type="submit">Submit</button>
</form>
```

---

## 4. Time Selection

### Enable time picker: `[showTime]="true"`

```html
<!-- 24-hour format (default when showTime is true) -->
<p-datepicker [(ngModel)]="datetime" [showTime]="true" />

<!-- 12-hour format with AM/PM -->
<p-datepicker [(ngModel)]="datetime" [showTime]="true" hourFormat="12" />

<!-- Time only (no date grid) -->
<p-datepicker [(ngModel)]="timeOnly" [timeOnly]="true" />
```

### Time-related inputs:

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `showTime` | `boolean` | `false` | Show the time picker below the date grid |
| `hourFormat` | `'12' \| '24'` | `'24'` | 12h (AM/PM) or 24h format |
| `timeOnly` | `boolean` | `false` | Hide date grid, show only time picker |
| `showSeconds` | `boolean` | `false` | Show seconds spinner in time picker |
| `stepHour` | `number` | `1` | Hour increment step |
| `stepMinute` | `number` | `1` | Minute increment step |
| `stepSecond` | `number` | `1` | Second increment step |
| `timeSeparator` | `string` | `':'` | Separator character between h/m/s |

> **Value type with time**: Still a `Date` object. Hours/minutes/seconds are stored on the `Date` instance.

```typescript
// showTime=true with reactive forms
form = new FormGroup({
  meetingTime: new FormControl<Date | null>(null),
});
// form.value.meetingTime.getHours() / .getMinutes() / .getSeconds()
```

---

## 5. Key Input Properties

### Core display & formatting

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `dateFormat` | `string` | `'mm/dd/yy'` | Date format string. See format tokens below. |
| `placeholder` | `string` | `undefined` | Input placeholder text |
| `showIcon` | `boolean` | `false` | Show calendar button icon next to input |
| `iconDisplay` | `'button' \| 'input'` | `'button'` | Icon placement: separate button or inside input field |
| `icon` | `string` | `undefined` | Custom icon CSS class (e.g. PrimeIcons class) |
| `inline` | `boolean` | `false` | Render inline (always visible, no popup) |
| `fluid` | inherited signal | — | Makes input take full container width (from `BaseInput`) |

### Date constraints

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `minDate` | `Date \| null \| undefined` | `undefined` | Minimum selectable date |
| `maxDate` | `Date \| null \| undefined` | `undefined` | Maximum selectable date |
| `disabledDates` | `Date[]` | `[]` | Array of specific dates to disable |
| `disabledDays` | `number[]` | `[]` | Weekday numbers to disable (0=Sun, 6=Sat) |

### Selection modes

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `selectionMode` | `'single' \| 'multiple' \| 'range'` | `'single'` | Single date, multiple dates, or a date range |
| `maxDateCount` | `number` | `undefined` | Max selectable dates in `multiple` mode |

### Behavior

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `readonlyInput` | `boolean` | `false` | Prevent manual keyboard input |
| `showOnFocus` | `boolean` | `true` | Show popup on input focus |
| `showButtonBar` | `boolean` | `false` | Show Today/Clear buttons in footer |
| `showClear` | `boolean` | `false` | Show ✕ clear icon on input |
| `showWeek` | `boolean` | `false` | Display week numbers |
| `keepInvalid` | `boolean` | `false` | Keep invalid typed value on blur |
| `hideOnDateTimeSelect` | `boolean` | `true` | Close popup after selection |
| `touchUI` | `boolean` | `false` | Optimized overlay for touch devices |
| `autofocus` | `boolean` | `false` | Auto-focus on load |
| `tabindex` | `number` | `undefined` | Tab order index |
| `dataType` | `'date' \| 'string'` | `'date'` | Value type bound to ngModel/formControl |
| `shortYearCutoff` | `any` | `'+10'` | Century cutoff for 2-digit years |

### Multiple months

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `numberOfMonths` | `number` | `1` | How many month calendars to display |
| `firstDayOfWeek` | `number` | `0` | First day of week (0=Sun, 1=Mon) |
| `view` | `'date' \| 'month' \| 'year'` | `'date'` | Show date, month-only, or year-only picker |
| `defaultDate` | `Date \| null` | `undefined` | Default highlighted date when field is empty |

### Overlay

| Input | Type | Default | Description |
|-------|------|---------|-------------|
| `appendTo` | `'self' \| 'body' \| HTMLElement \| ElementRef` | `undefined` | Where to attach the overlay |
| `panelStyleClass` | `string` | `undefined` | CSS class for the panel container |
| `panelStyle` | `object` | `undefined` | Inline style for the panel container |
| `autoZIndex` | `boolean` | `true` | Auto z-index management |
| `baseZIndex` | `number` | `0` | Base z-index value |
| `focusTrap` | `boolean` | `true` | Trap focus inside overlay |

### Accessibility

| Input | Type | Description |
|-------|------|-------------|
| `inputId` | `string` | `id` for the `<input>` element (for `<label for="">`) |
| `ariaLabel` | `string` | Aria label string |
| `ariaLabelledBy` | `string` | ID(s) of labelling elements |
| `iconAriaLabel` | `string` | Aria label for the calendar icon button |

---

## 6. dateFormat Tokens

| Token | Description |
|-------|-------------|
| `d` | Day of month (no leading zero) |
| `dd` | Day of month (two digit) |
| `D` | Day name short (Mon) |
| `DD` | Day name long (Monday) |
| `m` | Month (no leading zero) |
| `mm` | Month (two digit) |
| `M` | Month name short (Jan) |
| `MM` | Month name long (January) |
| `y` | Year (two digit) |
| `yy` | Year (four digit) |
| `@` | Unix timestamp (ms since 01/01/1970) |

Examples:
```
dateFormat="dd/mm/yy"   → "01/03/2026"
dateFormat="yy-mm-dd"   → "2026-03-01"
dateFormat="DD, MM d, yy" → "Sunday, March 1, 2026"
```

---

## 7. Output Events

| Output | Emits | Description |
|--------|-------|-------------|
| `onSelect` | `Date` | Date selected from popup |
| `onFocus` | `Event` | Input focused |
| `onBlur` | `Event` | Input blurred |
| `onClose` | `HTMLElement` | Panel closed |
| `onShow` | `HTMLElement` | Panel opened |
| `onInput` | `Event` | User typed in input |
| `onClear` | `any` | Clear icon clicked |
| `onTodayClick` | `Date` | Today button clicked |
| `onClearClick` | `any` | Clear button (in footer) clicked |
| `onMonthChange` | `DatePickerMonthChangeEvent` | Month navigated |
| `onYearChange` | `DatePickerYearChangeEvent` | Year navigated |
| `onClickOutside` | `any` | Clicked outside the panel |

---

## 8. PrimeNG v21 Gotchas & Migration Notes

### ✅ Component renamed (v17+): `p-calendar` → `p-datepicker`
The old `p-calendar` selector and `CalendarModule` from `primeng/calendar` are **removed**.  
Use `p-datepicker` and `DatePickerModule` / `DatePicker` from `primeng/datepicker`.

### ✅ `styleClass` deprecated (v20+)
```html
<!-- ❌ Deprecated since v20 -->
<p-datepicker styleClass="my-class" />

<!-- ✅ Use standard class binding instead -->
<p-datepicker class="my-class" />
```

### ✅ Animation options deprecated (v21)
`showTransitionOptions` and `hideTransitionOptions` are **deprecated in v21** and no longer functional. PrimeNG v21 migrated to native CSS animations (due to Angular v20.2 deprecating `@angular/animations`).

```typescript
// ❌ No longer works in v21:
showTransitionOptions=".12s cubic-bezier(0, 0, 0.2, 1)"
hideTransitionOptions=".1s linear"

// ✅ Use new motionOptions input instead
[motionOptions]="{ ... }"
// Or use CSS custom properties / theme designer
```

### ✅ `provideAnimationsAsync()` can be removed
Since v21 uses native CSS animations, `provideAnimationsAsync()` in `app.config.ts` is safe to remove. `provideAnimations()` is also no longer needed for PrimeNG components.

### ✅ `fluid` is now a signal input (inherited from BaseInput)
In v21, `fluid` is handled as a signal via `BaseInput`. It works with both property binding and the `<p-fluid>` wrapper component.

### ✅ `appendTo` is now a signal `input()`
```typescript
// In the source: appendTo = input<...>(undefined);
// This means it MUST use [] binding, NOT property binding:
// ✅ Correct:
[appendTo]="'body'"
// ❌ Wrong (won't work for signal inputs):
appendTo="body"
```

### ✅ `variant` prop for filled style
The old `variant="filled"` from global PrimeNG config now works per-component:
```html
<p-datepicker variant="filled" />
```

### ✅ PT (PassThrough) attributes naming changed (v21)
Directive PT attribute names changed from `ptInputText` → `pInputTextPT` (suffix at end). Deprecated in v21, removed in v22.

### ✅ `invalid` input for form validation state
Use the `[invalid]` input directly instead of CSS hacks:
```html
<p-datepicker [invalid]="form.controls.date.invalid && form.controls.date.touched" />
```

---

## 9. Minimal Working Example — Standalone Component with ReactiveFormsModule

```typescript
// appointment-form.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { DatePickerModule } from 'primeng/datepicker';
import { ButtonModule } from 'primeng/button';

@Component({
  selector: 'app-appointment-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DatePickerModule,
    ButtonModule,
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">

      <!-- Basic date picker -->
      <div class="field">
        <label for="appointment">Appointment Date</label>
        <p-datepicker
          inputId="appointment"
          formControlName="appointmentDate"
          dateFormat="dd/mm/yy"
          placeholder="Select a date"
          [showIcon]="true"
          [minDate]="minDate"
          [maxDate]="maxDate"
          [fluid]="true"
          [invalid]="isInvalid('appointmentDate')"
        />
        <small *ngIf="isInvalid('appointmentDate')" class="p-error">
          Date is required.
        </small>
      </div>

      <!-- Date + Time picker (12h) -->
      <div class="field">
        <label for="meetingTime">Meeting Date & Time</label>
        <p-datepicker
          inputId="meetingTime"
          formControlName="meetingDateTime"
          dateFormat="dd/mm/yy"
          [showTime]="true"
          hourFormat="12"
          placeholder="Select date and time"
          [fluid]="true"
        />
      </div>

      <!-- Date range picker -->
      <div class="field">
        <label for="dateRange">Date Range</label>
        <p-datepicker
          inputId="dateRange"
          formControlName="dateRange"
          selectionMode="range"
          [showButtonBar]="true"
          placeholder="Select date range"
          [fluid]="true"
        />
      </div>

      <p-button type="submit" label="Submit" [disabled]="form.invalid" />
    </form>

    <pre *ngIf="submitted">{{ formValue | json }}</pre>
  `,
})
export class AppointmentFormComponent {
  minDate = new Date(); // today
  maxDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)); // +1 year

  submitted = false;
  formValue: any = null;

  form = new FormGroup({
    // Value is a Date object (default dataType="date")
    appointmentDate: new FormControl<Date | null>(null, Validators.required),

    // Date + time — still a Date object, getHours()/getMinutes() for time
    meetingDateTime: new FormControl<Date | null>(null),

    // Range — value is [Date, Date] | null
    dateRange: new FormControl<Date[] | null>(null),
  });

  isInvalid(controlName: string): boolean {
    const ctrl = this.form.get(controlName);
    return !!(ctrl?.invalid && ctrl?.touched);
  }

  onSubmit() {
    if (this.form.valid) {
      this.submitted = true;
      this.formValue = this.form.value;

      const apptDate: Date = this.form.value.appointmentDate!;
      console.log('ISO string:', apptDate.toISOString()); // "2026-03-15T00:00:00.000Z"
      console.log('Year:', apptDate.getFullYear());

      const meetingDT: Date = this.form.value.meetingDateTime!;
      if (meetingDT) {
        console.log('Meeting time:', meetingDT.getHours(), meetingDT.getMinutes());
      }
    } else {
      this.form.markAllAsTouched();
    }
  }
}
```

---

## 10. Time-Only Picker Example

```typescript
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, DatePickerModule],
  template: `
    <p-datepicker
      formControlName="startTime"
      [timeOnly]="true"
      hourFormat="24"
      [showSeconds]="false"
      placeholder="HH:MM"
    />
  `
})
export class TimePickerComponent {
  form = new FormGroup({
    // Value is still a Date — only h/m matter, date part is today
    startTime: new FormControl<Date | null>(null),
  });
}
```

---

## 11. Template-Driven (ngModel) for Reference

```html
<!-- Two-way binding with Date -->
<p-datepicker [(ngModel)]="selectedDate" dateFormat="yy-mm-dd" />

<!-- Typed template-driven form -->
<p-datepicker
  [(ngModel)]="selectedDate"
  [showTime]="true"
  hourFormat="24"
  [minDate]="min"
  [maxDate]="max"
  [showIcon]="true"
  [fluid]="true"
/>
```

```typescript
selectedDate: Date | null = null;
min = new Date(2020, 0, 1);
max = new Date(2030, 11, 31);
```

---

## 12. Source File Location (for reference)

```
packages/primeng/src/datepicker/datepicker.ts   — Main component
packages/primeng/src/datepicker/public_api.ts   — Public exports
packages/primeng/src/datepicker/style/          — Style tokens
```

Component class: `DatePicker extends BaseInput<DatePickerPassThrough>`
Module class: `DatePickerModule` (wraps `DatePicker` + `SharedModule`)
NG_VALUE_ACCESSOR: Registered via `DATEPICKER_VALUE_ACCESSOR` — fully compatible with `formControlName` and `ngModel`.
