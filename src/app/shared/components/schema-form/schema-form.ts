import { Component, computed, input, output, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MailTemplateOption {
  label: string;
  value: string;
}

interface SchemaProperty {
  key: string;
  type: 'boolean' | 'integer' | 'string' | 'mail-template';
  description: string;
  default: unknown;
}

interface ParsedSchema {
  properties: SchemaProperty[];
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function parseSchema(schemaJson: string | null): ParsedSchema | null {
  if (!schemaJson) return null;
  try {
    const raw = JSON.parse(schemaJson);
    if (raw?.type !== 'object' || !raw.properties) return null;
    const properties: SchemaProperty[] = Object.entries(
      raw.properties as Record<string, { type?: string; description?: string; default?: unknown }>,
    ).map(([key, def]) => ({
      key,
      type: (
        def.type === 'boolean' ? 'boolean' :
        def.type === 'integer' ? 'integer' :
        def.type === 'mail-template' ? 'mail-template' :
        'string'
      ) as SchemaProperty['type'],
      description: def.description ?? '',
      default: def.default ?? null,
    }));
    return { properties };
  } catch {
    return null;
  }
}

function parseValues(parametersJson: string): Record<string, unknown> {
  if (!parametersJson) return {};
  try {
    const parsed = JSON.parse(parametersJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function serializeValues(values: Record<string, unknown>): string {
  return JSON.stringify(values, null, 2);
}

function defaultValuesFor(schema: ParsedSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const prop of schema.properties) {
    out[prop.key] =
      prop.default ??
      (prop.type === 'boolean' ? false : prop.type === 'integer' ? 0 : '');
  }
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-schema-form',
  standalone: true,
  imports: [FormsModule, TranslateModule, CheckboxModule, InputNumberModule, InputTextModule, SelectModule, TextareaModule],
  templateUrl: './schema-form.html',
})
export class SchemaForm {
  readonly schema = input<string | null>(null);
  readonly value = input<string>('');
  readonly readonly = input(false);
  readonly mailTemplates = input<MailTemplateOption[]>([]);

  readonly valueChange = output<string>();

  readonly parsedSchema = computed(() => parseSchema(this.schema()));

  readonly fieldValues = signal<Record<string, unknown>>({});

  constructor() {
    // Seed field values whenever the incoming value or schema changes
    effect(() => {
      const schema = this.parsedSchema();
      const raw = this.value();
      if (!schema) return;
      const parsed = parseValues(raw);
      const defaults = defaultValuesFor(schema);
      this.fieldValues.set({ ...defaults, ...parsed });
    });
  }

  booleanValue(key: string): boolean {
    return !!this.fieldValues()[key];
  }

  numberValue(key: string): number {
    const v = this.fieldValues()[key];
    return typeof v === 'number' ? v : 0;
  }

  stringValue(key: string): string {
    const v = this.fieldValues()[key];
    return typeof v === 'string' ? v : '';
  }

  onBooleanChange(key: string, checked: boolean): void {
    this.updateField(key, checked);
  }

  onNumberChange(key: string, value: number | null): void {
    this.updateField(key, value ?? 0);
  }

  onStringChange(key: string, value: string): void {
    this.updateField(key, value);
  }

  onRawChange(value: string): void {
    this.valueChange.emit(value);
  }

  private updateField(key: string, value: unknown): void {
    this.fieldValues.update(prev => ({ ...prev, [key]: value }));
    this.valueChange.emit(serializeValues(this.fieldValues()));
  }
}
