---
source: Official PrimeNG docs (primeng.org) + GitHub source (primefaces/primeng master)
library: PrimeNG
package: primeng/inputtext
topic: InputText directive — full API, reactive forms, standalone usage
version: 21.1.1
fetched: 2026-03-01T00:00:00Z
official_docs: https://primeng.org/inputtext
github_source: https://github.com/primefaces/primeng/blob/master/packages/primeng/src/inputtext/inputtext.ts
---

# PrimeNG v21 — InputText

## 1. What it is

`InputText` is a **directive** (NOT a component). It is applied as an attribute on a native
HTML `<input>` element to add PrimeNG theming and keyfiltering support.

## 2. Import Path

```typescript
import { InputTextModule } from 'primeng/inputtext';
// OR import the directive class directly (standalone):
import { InputText } from 'primeng/inputtext';
```

- `InputTextModule` — legacy NgModule wrapper (re-exports `InputText`)
- `InputText` — the standalone directive class (preferred for standalone Angular components)

## 3. Selector

```
[pInputText]   ← attribute selector (directive)
```

The selector is `pInputText` (camelCase attribute), **not** `p-inputtext`.

Usage in templates:
```html
<input pInputText type="text" />
```

## 4. Directive Class Signature (from GitHub master)

```typescript
@Directive({
    selector: '[pInputText]',
    standalone: true,
    // ...
})
export class InputText extends BaseModelHolder<InputTextPassThrough> {

    /** Size of the component: 'large' | 'small' | undefined */
    @Input('pSize') pSize: 'large' | 'small' | undefined;

    /** Input variant: 'filled' | 'outlined' | undefined  (default: inherits global config) */
    variant = input<'filled' | 'outlined' | undefined>();

    /** Spans 100% width of the container when true */
    fluid = input(undefined, { transform: booleanAttribute });

    /** Marks the field as invalid (error state styling) */
    invalid = input(undefined, { transform: booleanAttribute });

    /** PassThrough attributes (v21: use pInputTextPT, ptInputText is deprecated) */
    pInputTextPT = input<InputTextPassThrough>();
}

@NgModule({
    imports: [InputText],
    exports: [InputText]
})
export class InputTextModule {}
```

## 5. All Input Properties

| Property        | Type                          | Default     | Description                                              |
|-----------------|-------------------------------|-------------|----------------------------------------------------------|
| `pSize`         | `'large' \| 'small' \| undefined` | `undefined` | Visual size variant (`@Input('pSize')`)              |
| `variant`       | `'filled' \| 'outlined' \| undefined` | global config | Visual style variant                            |
| `fluid`         | `boolean`                     | `undefined` | Full-width (100% container width)                        |
| `invalid`       | `boolean`                     | `false`     | Error/invalid state styling                              |
| `pInputTextPT`  | `InputTextPassThrough`        | `undefined` | PassThrough attributes for DOM customization             |

> Native HTML attributes (`placeholder`, `disabled`, `type`, `id`, `aria-*`, etc.) are passed
> directly on the `<input>` element — they are NOT PrimeNG inputs.

## 6. Reactive Forms Usage

`InputText` is a **directive on a native `<input>`**, so `formControlName` binds directly to the
native element — no special wiring needed. Just add both `pInputText` and `formControlName`:

```html
<input
  pInputText
  type="text"
  formControlName="username"
  placeholder="Username"
  [invalid]="form.get('username')?.invalid && form.get('username')?.touched"
/>
```

The directive detects `NgControl` via `inject(NgControl, { optional: true, self: true })` and
reads the value automatically.

## 7. `[invalid]` Binding

Used to apply error/invalid-state styling. Accepts a boolean expression:

```html
<!-- Simple invalid flag -->
<input pInputText [invalid]="!value" />

<!-- With reactive forms: invalid after touched -->
<input pInputText formControlName="email" [invalid]="isInvalid('email')" />
```

```typescript
isInvalid(field: string): boolean {
  const ctrl = this.form.get(field);
  return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
}
```

## 8. `[fluid]` Binding

Makes the input span 100% width of its container:

```html
<!-- Boolean binding -->
<input pInputText [fluid]="true" formControlName="username" />

<!-- Attribute shorthand (booleanAttribute transform) -->
<input pInputText fluid formControlName="username" />
```

> Fluid can also be inherited automatically if the input is wrapped in a `<p-fluid>` container
> component (the directive calls `inject(Fluid, { optional: true, host: true })`).

## 9. `variant` Property

```html
<!-- Filled style (higher visual emphasis) -->
<input pInputText variant="filled" formControlName="username" />

<!-- Outlined (default) — explicit -->
<input pInputText variant="outlined" formControlName="username" />
```

## 10. `pSize` Property

Controls visual size. Note the input alias: use `pSize` in templates, NOT `size`
(which would set the native HTML `size` attribute for character width):

```html
<input pInputText pSize="small" formControlName="username" />
<input pInputText pSize="large" formControlName="username" />
```

## 11. `placeholder`

`placeholder` is a **native HTML attribute** — pass it directly on the `<input>`:

```html
<input pInputText placeholder="Enter your username" formControlName="username" />
```

## 12. Minimal Standalone Component Example with ReactiveFormsModule

```typescript
// my-form.component.ts
import { Component } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';  // or: InputText

@Component({
  selector: 'app-my-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextModule,          // provides [pInputText] directive
  ],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" class="flex flex-col gap-4 w-80">

      <!-- Username field -->
      <div class="flex flex-col gap-1">
        <label for="username">Username</label>
        <input
          pInputText
          id="username"
          type="text"
          formControlName="username"
          placeholder="Enter username"
          fluid
          [invalid]="isInvalid('username')"
        />
        @if (isInvalid('username')) {
          <small class="text-red-500">Username is required.</small>
        }
      </div>

      <!-- Email field — filled variant, large size -->
      <div class="flex flex-col gap-1">
        <label for="email">Email</label>
        <input
          pInputText
          id="email"
          type="email"
          formControlName="email"
          placeholder="Enter email"
          variant="filled"
          pSize="large"
          fluid
          [invalid]="isInvalid('email')"
        />
        @if (isInvalid('email')) {
          <small class="text-red-500">Valid email is required.</small>
        }
      </div>

      <button type="submit">Submit</button>
    </form>
  `
})
export class MyFormComponent {
  form = this.fb.group({
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
  });

  constructor(private fb: FormBuilder) {}

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && (ctrl.dirty || ctrl.touched));
  }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.valid) {
      console.log(this.form.value);
    }
  }
}
```

## 13. Direct Directive Import (alternative to InputTextModule)

```typescript
import { InputText } from 'primeng/inputtext';  // standalone directive class

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, InputText],  // ← use class directly
  // ...
})
```

Both `InputTextModule` and `InputText` (standalone class) work identically in standalone components.

## 14. Key Facts Summary

| Question                        | Answer                                                      |
|---------------------------------|-------------------------------------------------------------|
| Is it a directive or component? | **Directive** — applied to `<input>` as `pInputText`        |
| Selector                        | `[pInputText]` (attribute selector)                         |
| Import path                     | `primeng/inputtext`                                         |
| Standalone class name           | `InputText`                                                 |
| NgModule name                   | `InputTextModule`                                           |
| Reactive forms                  | `formControlName` on the `<input>` directly — works natively |
| Invalid binding                 | `[invalid]="booleanExpression"`                             |
| Fluid binding                   | `[fluid]="true"` or just `fluid` (attribute)                |
| Size prop                       | `pSize="small"` or `pSize="large"` (NOT `size=`)            |
| Variant prop                    | `variant="filled"` or `variant="outlined"`                  |
| Placeholder                     | Native HTML attribute — `placeholder="..."`                 |
| v21 breaking changes            | None for InputText. `showTransitionOptions`/`hideTransitionOptions` deprecated globally. |

## 15. v21 Migration Notes

- **No breaking changes** specific to InputText in v21
- `ptInputText` PassThrough attribute is **deprecated** in v21 → use `pInputTextPT` instead
- `provideAnimationsAsync` can be safely removed (v21 uses CSS-based animations)
- v21 is otherwise a **drop-in upgrade** from v20
