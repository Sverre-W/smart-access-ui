---
source: Context7 API + angular.dev official docs (v21)
library: Angular
package: @angular/forms
topic: ControlValueAccessor - standalone components, reactive forms, signals
fetched: 2026-03-02T00:00:00Z
official_docs: https://angular.dev/api/forms/ControlValueAccessor
---

# ControlValueAccessor in Angular (v17–v21)

## The Interface Contract

```typescript
interface ControlValueAccessor {
  writeValue(obj: any): void;
  registerOnChange(fn: any): void;
  registerOnTouched(fn: any): void;
  setDisabledState?(isDisabled: boolean): void; // optional
}
```

---

## Pattern 1 — Classic `providers: [NG_VALUE_ACCESSOR]` (still current)

Works with `formControlName` in reactive forms. The standard approach for
wrapping a native element or third-party widget.

```typescript
import {
  Component, forwardRef, ChangeDetectionStrategy,
  signal, HostListener
} from '@angular/core';
import {
  NG_VALUE_ACCESSOR, ControlValueAccessor, ReactiveFormsModule
} from '@angular/forms';

@Component({
  selector: 'app-custom-input',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <input
      [value]="value()"
      [disabled]="isDisabled()"
      (input)="onInput($event)"
      (blur)="onTouched()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomInputComponent),
      multi: true,
    },
  ],
})
export class CustomInputComponent implements ControlValueAccessor {
  // Internal signal state
  protected value = signal<string>('');
  protected isDisabled = signal(false);

  // Callbacks registered by Angular forms
  private onChange: (v: any) => void = () => {};
  protected onTouched: () => void = () => {};

  // --- Required CVA methods ---

  /** Called by Angular when the form model changes → push to view */
  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  /** Angular stores the fn to call when view value changes → push to model */
  registerOnChange(fn: (v: any) => void): void {
    this.onChange = fn;
  }

  /** Angular stores the fn to call when the control is "touched" */
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /** Optional — called when form control is enabled/disabled */
  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  // --- View → Model bridge ---
  onInput(event: Event): void {
    const newValue = (event.target as HTMLInputElement).value;
    this.value.set(newValue);
    this.onChange(newValue);   // notify Angular forms
  }
}
```

**Usage with `formControlName`:**
```typescript
// Parent component
@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CustomInputComponent],
  template: `
    <form [formGroup]="form">
      <app-custom-input formControlName="email" />
    </form>
  `,
})
export class ParentComponent {
  form = new FormGroup({
    email: new FormControl(''),
  });
}
```

---

## Pattern 2 — `inject(NgControl)` at construction time (modern, no `forwardRef`)

Avoids the `forwardRef` boilerplate by using `inject(NgControl, { self: true, optional: true })`
and manually setting `valueAccessor` on the directive. Prevents circular
dependency errors by using `afterNextRender` or `afterViewInit` if needed.

```typescript
import {
  Component, OnInit, inject, signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { NgControl, ControlValueAccessor } from '@angular/forms';

@Component({
  selector: 'app-custom-input',
  standalone: true,
  template: `
    <input
      [value]="value()"
      [disabled]="isDisabled()"
      (input)="onInput($event)"
      (blur)="onTouched()" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // NOTE: No providers needed — we inject the existing NgControl
})
export class CustomInputComponent implements ControlValueAccessor, OnInit {
  private ngControl = inject(NgControl, { self: true, optional: true });

  protected value = signal<string>('');
  protected isDisabled = signal(false);

  private onChange: (v: any) => void = () => {};
  protected onTouched: () => void = () => {};

  constructor() {
    // Wire ourselves as the value accessor for the NgControl on this host
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }
  }

  ngOnInit() {
    // Optionally sync initial disabled state from the form control
    if (this.ngControl?.control) {
      this.isDisabled.set(this.ngControl.control.disabled);
    }
  }

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (v: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onInput(event: Event): void {
    const newValue = (event.target as HTMLInputElement).value;
    this.value.set(newValue);
    this.onChange(newValue);
  }
}
```

**Key difference:** No `providers` array, no `forwardRef`. The `NgControl` that
`formControlName` creates is already on the host element's injector — you grab
it with `{ self: true }` and assign yourself as its `valueAccessor`.

---

## Pattern 3 — Angular Signal Forms (NEW in v20, `@angular/forms/signals`)

A **fundamentally different API** introduced in Angular v20 alongside the
classic API. Replaces `ControlValueAccessor` entirely with signal-based
interfaces. Works with the new `[formField]` directive (not `formControlName`).

```typescript
import { Component, model, input, ChangeDetectionStrategy } from '@angular/core';
import {
  FormValueControl,
  ValidationError,
  DisabledReason,
  WithOptionalFieldTree
} from '@angular/forms/signals';

@Component({
  selector: 'app-signal-input',
  standalone: true,
  template: `
    @if (!hidden()) {
      <div>
        <input
          type="text"
          [value]="value()"
          (input)="value.set($event.target.value)"
          [disabled]="disabled()"
          [class.invalid]="invalid()"
          (blur)="touched.set(true)" />

        @if (invalid()) {
          <div role="alert">
            @for (error of errors(); track error) {
              <span>{{ error.message }}</span>
            }
          </div>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignalInputComponent implements FormValueControl<string> {
  // Required — two-way model signal
  value = model<string>('');

  // Writable interaction state (control owns these)
  touched = model<boolean>(false);

  // Read-only form state (form system writes these via input binding)
  disabled        = input<boolean>(false);
  disabledReasons = input<readonly DisabledReason[]>([]);
  readonly        = input<boolean>(false);
  hidden          = input<boolean>(false);
  invalid         = input<boolean>(false);
  errors          = input<readonly WithOptionalFieldTree<ValidationError>[]>([]);
}
```

**Usage with Signal Forms (replaces `formControlName`):**
```typescript
import { Component, signal } from '@angular/core';
import { form, FormField, required, email } from '@angular/forms/signals';
import { SignalInputComponent } from './signal-input';

@Component({
  standalone: true,
  imports: [FormField, SignalInputComponent],
  template: `
    <form novalidate>
      <app-signal-input [formField]="loginForm.email" />
    </form>
  `,
})
export class LoginComponent {
  loginModel = signal({ email: '' });
  loginForm = form(this.loginModel, (s) => {
    required(s.email, { message: 'Email is required' });
    email(s.email,   { message: 'Enter a valid email' });
  });
}
```

---

## Decision Guide

| Situation | Use |
|---|---|
| Working with existing `ReactiveFormsModule` + `formControlName` | Pattern 1 (NG_VALUE_ACCESSOR) |
| Want cleaner code, no `forwardRef`, still uses `formControlName` | Pattern 2 (`inject(NgControl)`) |
| Greenfield project, Angular v20+, OK to adopt Signal Forms | Pattern 3 (`FormValueControl` + `model()`) |
| Must support template-driven forms (`ngModel`) | Pattern 1 or 2 |

---

## Required Interface Methods (Patterns 1 & 2)

| Method | Direction | Called when |
|---|---|---|
| `writeValue(value)` | Form → View | Form model changes programmatically |
| `registerOnChange(fn)` | Registers callback | Angular sets up the control |
| `registerOnTouched(fn)` | Registers callback | Angular sets up the control |
| `setDisabledState(bool)` | Form → View | `control.disable()` / `control.enable()` |

**Important:** Call `this.onChange(newValue)` in your event handler to push view
changes back to the form model. Call `this.onTouched()` on blur.

---

## Common Gotchas

1. **Circular DI with Pattern 2**: If `inject(NgControl)` causes circular DI,
   move the `this.ngControl.valueAccessor = this` assignment to a deferred
   callback using `afterNextRender(() => { ... })`.

2. **`forwardRef` requirement in Pattern 1**: Needed because the class isn't
   fully defined when the `providers` array is evaluated. Always required.

3. **`multi: true`**: Must be set in Pattern 1 — Angular collects multiple
   value accessors and picks the most specific one.

4. **`setDisabledState` is optional but recommended**: Without it, `control.disable()`
   won't visually disable your custom input.

5. **Signal Forms vs Reactive Forms**: `@angular/forms/signals` is a separate
   system. `FormValueControl` controls do NOT implement `ControlValueAccessor`
   and cannot be used with `formControlName`.
