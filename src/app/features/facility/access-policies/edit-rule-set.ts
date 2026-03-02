import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormArray, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AccessPolicyService,
  ConfiguredRuleSet,
  ConfiguredRule,
  ConfiguredCondition,
  RuleCondition,
  ConditionParameterInfo,
  ParameterType,
  ValueProviderType,
  SubjectTypes,
  EntityLink,
} from '../services/access-policy-service';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

// ── Subject type options ───────────────────────────────────────────────────────

const SUBJECT_TYPE_OPTIONS: { label: string; value: SubjectTypes }[] = [
  { label: 'Visitor',    value: SubjectTypes.Visitor },
  { label: 'Employee',   value: SubjectTypes.Employee },
  { label: 'Contractor', value: SubjectTypes.Contractor },
];

@Component({
  selector: 'app-edit-rule-set',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    CheckboxModule,
  ],
  templateUrl: './edit-rule-set.html',
})
export class EditRuleSet implements OnInit {
  private service = inject(AccessPolicyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // ── Page state ────────────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly ruleSet = signal<ConfiguredRuleSet | null>(null);

  // ── Details form ──────────────────────────────────────────────────────────

  readonly detailsSaving = signal(false);
  readonly detailsSaveError = signal<string | null>(null);
  readonly detailsSaveSuccess = signal(false);

  readonly detailsForm = this.fb.nonNullable.group({
    name:     ['', Validators.required],
    isActive: [false],
  });

  // ── Rules form ────────────────────────────────────────────────────────────

  readonly rulesSaving = signal(false);
  readonly rulesSaveError = signal<string | null>(null);
  readonly rulesSaveSuccess = signal(false);

  readonly rulesForm = this.fb.array<FormGroup>([]);

  // ── Condition definitions cache (keyed by SubjectTypes) ───────────────────

  // Map of subjectType → condition definitions fetched from API
  readonly conditionDefs = signal<Map<SubjectTypes, RuleCondition[]>>(new Map());
  readonly conditionDefsLoading = signal<Set<SubjectTypes>>(new Set());

  // Map of ruleSetId + providerName → EntityLink[] for provider-backed dropdowns
  readonly providerValues = signal<Map<string, EntityLink[]>>(new Map());

  // ── Static options ────────────────────────────────────────────────────────

  readonly subjectTypeOptions = SUBJECT_TYPE_OPTIONS;

  readonly ParameterType = ParameterType;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('ruleSetId')!;
    await this.load(id);
  }

  private async load(ruleSetId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const rs = await this.service.getRuleSet(ruleSetId);
      this.ruleSet.set(rs);
      this.detailsForm.patchValue({ name: rs.name, isActive: rs.isActive });
      this.buildRulesForm(rs.rules);

      // Pre-fetch condition defs for all subject types upfront — they're cheap,
      // finite, and needed to render any existing conditions correctly.
      await Promise.all(
        Object.values(SubjectTypes).map(st => this.ensureConditionDefs(st))
      );
    } catch {
      this.error.set('Failed to load rule set. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  goBack(): void {
    this.router.navigate(['..', '..'], { relativeTo: this.route });
  }

  // ── Rules form builders ───────────────────────────────────────────────────

  private buildRulesForm(rules: ConfiguredRule[]): void {
    this.rulesForm.clear();
    for (const rule of rules) {
      this.rulesForm.push(this.makeRuleGroup(rule));
    }
  }

  private makeRuleGroup(rule?: Partial<ConfiguredRule>): FormGroup {
    const conditionsArray = this.fb.array<FormGroup>(
      (rule?.conditions ?? []).map(c => this.makeConditionGroup(c))
    );
    return this.fb.group({
      name:        [rule?.name ?? '', Validators.required],
      subjectType: [rule?.subjectType ?? SubjectTypes.Visitor, Validators.required],
      conditions:  conditionsArray,
    });
  }

  private makeConditionGroup(c?: Partial<ConfiguredCondition>): FormGroup {
    return this.fb.group({
      canonicalName: [c?.canonicalName ?? null, Validators.required],
      parameters:    this.fb.group({}),  // rebuilt dynamically when condition type changes
    });
  }

  asGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  conditionsOf(ruleGroup: AbstractControl): FormArray<FormGroup> {
    return this.asGroup(ruleGroup).get('conditions') as FormArray<FormGroup>;
  }

  // ── Rule CRUD ─────────────────────────────────────────────────────────────

  addRule(): void {
    this.rulesForm.push(this.makeRuleGroup());
    // Ensure defs are available for the default subject type (Visitor)
    void this.ensureConditionDefs(SubjectTypes.Visitor);
  }

  removeRule(index: number): void {
    this.rulesForm.removeAt(index);
  }

  // ── Condition CRUD ────────────────────────────────────────────────────────

  addCondition(ruleIndex: number): void {
    const conditions = this.conditionsOf(this.rulesForm.at(ruleIndex));
    conditions.push(this.makeConditionGroup());
  }

  removeCondition(ruleIndex: number, condIndex: number): void {
    this.conditionsOf(this.rulesForm.at(ruleIndex)).removeAt(condIndex);
  }

  // ── Subject type change ───────────────────────────────────────────────────

  async onSubjectTypeChange(ruleIndex: number): Promise<void> {
    const ruleGroup = this.asGroup(this.rulesForm.at(ruleIndex));
    const subjectType: SubjectTypes = ruleGroup.get('subjectType')!.value;

    // Clear all conditions for this rule — they're subject-type-specific
    const conditions = this.conditionsOf(ruleGroup);
    conditions.clear();

    await this.ensureConditionDefs(subjectType);
  }

  // ── Condition type change ─────────────────────────────────────────────────

  async onConditionTypeChange(ruleIndex: number, condIndex: number): Promise<void> {
    const ruleGroup = this.asGroup(this.rulesForm.at(ruleIndex));
    const condGroup = this.asGroup(this.conditionsOf(ruleGroup).at(condIndex));
    const canonicalName: string = condGroup.get('canonicalName')!.value;
    const subjectType: SubjectTypes = ruleGroup.get('subjectType')!.value;

    const defs = this.conditionDefs().get(subjectType) ?? [];
    const def = defs.find(d => d.canonicalName === canonicalName);
    if (!def) return;

    // Rebuild parameters group to match the condition's schema
    const paramsGroup = this.buildParametersGroup(def);
    condGroup.setControl('parameters', paramsGroup);

    // Pre-fetch provider values for any provider-backed parameters
    const ruleSetId = this.ruleSet()!.id;
    await Promise.all(
      def.parameters
        .filter(p => p.fixedValueProvider)
        .map(p => this.ensureProviderValues(ruleSetId, p.fixedValueProvider as ValueProviderType))
    );
  }

  private buildParametersGroup(def: RuleCondition, existing?: Record<string, unknown>): FormGroup {
    const controls: Record<string, unknown> = {};
    for (const param of def.parameters) {
      const existingVal = existing?.[param.name];
      if (param.isList) {
        // Lists are stored as comma-separated string in the form, converted on save
        controls[param.name] = [
          existingVal != null ? (existingVal as unknown[]).join(', ') : '',
          Validators.required,
        ];
      } else if (param.type === ParameterType.BooleanValue) {
        controls[param.name] = [existingVal ?? false];
      } else if (param.type === ParameterType.IntegerValue) {
        controls[param.name] = [existingVal ?? null, Validators.required];
      } else {
        // StringValue or provider-backed
        controls[param.name] = [existingVal ?? null, Validators.required];
      }
    }
    return this.fb.group(controls);
  }

  // ── Condition defs & provider values ─────────────────────────────────────

  async ensureConditionDefs(subjectType: SubjectTypes): Promise<void> {
    if (this.conditionDefs().has(subjectType)) return;

    this.conditionDefsLoading.update(s => new Set([...s, subjectType]));
    try {
      const defs = await this.service.getRuleConditions(subjectType);
      this.conditionDefs.update(m => new Map([...m, [subjectType, defs]]));
    } catch {
      // Non-fatal — condition dropdowns will be empty
    } finally {
      this.conditionDefsLoading.update(s => {
        const next = new Set(s);
        next.delete(subjectType);
        return next;
      });
    }
  }

  async ensureProviderValues(ruleSetId: string, provider: ValueProviderType): Promise<void> {
    const key = `${ruleSetId}:${provider}`;
    if (this.providerValues().has(key)) return;
    try {
      const values = await this.service.getRuleSetProviderValues(ruleSetId, provider);
      this.providerValues.update(m => new Map([...m, [key, values]]));
    } catch {
      // Non-fatal
    }
  }

  // ── Helpers for template ─────────────────────────────────────────────────

  conditionOptions(subjectType: SubjectTypes): { label: string; value: string }[] {
    return (this.conditionDefs().get(subjectType) ?? []).map(d => ({
      label: d.name,
      value: d.canonicalName,
    }));
  }

  isConditionDefsLoading(subjectType: SubjectTypes): boolean {
    return this.conditionDefsLoading().has(subjectType);
  }

  conditionDefFor(subjectType: SubjectTypes, canonicalName: string): RuleCondition | null {
    return (this.conditionDefs().get(subjectType) ?? []).find(d => d.canonicalName === canonicalName) ?? null;
  }

  parameterDefs(subjectType: SubjectTypes, canonicalName: string): ConditionParameterInfo[] {
    return this.conditionDefFor(subjectType, canonicalName)?.parameters ?? [];
  }

  providerOptions(ruleSetId: string, provider: string): EntityLink[] {
    return this.providerValues().get(`${ruleSetId}:${provider}`) ?? [];
  }

  isProviderBacked(param: ConditionParameterInfo): boolean {
    return !!param.fixedValueProvider;
  }

  // ── Save details ──────────────────────────────────────────────────────────

  async saveDetails(): Promise<void> {
    this.detailsForm.markAllAsTouched();
    if (this.detailsForm.invalid) return;

    const rs = this.ruleSet();
    if (!rs) return;

    this.detailsSaving.set(true);
    this.detailsSaveError.set(null);
    this.detailsSaveSuccess.set(false);

    const { name, isActive } = this.detailsForm.getRawValue();
    const body: ConfiguredRuleSet = { ...rs, name, isActive };

    try {
      const updated = await this.service.updateRuleSet(rs.id, body);
      this.ruleSet.set(updated);
      this.detailsSaveSuccess.set(true);
      setTimeout(() => this.detailsSaveSuccess.set(false), 3000);
    } catch (err) {
      this.detailsSaveError.set(this.extractApiError(err) ?? 'Failed to save. Please try again.');
    } finally {
      this.detailsSaving.set(false);
    }
  }

  // ── Save rules ────────────────────────────────────────────────────────────

  async saveRules(): Promise<void> {
    this.rulesForm.markAllAsTouched();
    if (this.rulesForm.invalid) return;

    const rs = this.ruleSet();
    if (!rs) return;

    this.rulesSaving.set(true);
    this.rulesSaveError.set(null);
    this.rulesSaveSuccess.set(false);

    type RawRule = {
      name: string;
      subjectType: SubjectTypes;
      conditions: { canonicalName: string; parameters: Record<string, unknown> }[];
    };
    const rules: ConfiguredRule[] = (this.rulesForm.getRawValue() as RawRule[]).map(r => ({
      name: r.name,
      subjectType: r.subjectType,
      conditions: r.conditions.map(c => ({
        canonicalName: c.canonicalName,
        parameters: this.serializeParameters(r.subjectType, c.canonicalName, c.parameters),
      })),
    }));

    const body: ConfiguredRuleSet = { ...rs, rules };

    try {
      const updated = await this.service.updateRuleSet(rs.id, body);
      this.ruleSet.set(updated);
      this.rulesSaveSuccess.set(true);
      setTimeout(() => this.rulesSaveSuccess.set(false), 3000);
    } catch (err) {
      this.rulesSaveError.set(this.extractApiError(err) ?? 'Failed to save rules. Please try again.');
    } finally {
      this.rulesSaving.set(false);
    }
  }

  /** Convert form values back to the API's parameter shape. */
  private serializeParameters(
    subjectType: SubjectTypes,
    canonicalName: string,
    formParams: Record<string, unknown>
  ): Record<string, unknown> {
    const def = this.conditionDefFor(subjectType, canonicalName);
    if (!def) return formParams;

    const result: Record<string, unknown> = {};
    for (const param of def.parameters) {
      const val = formParams[param.name];
      if (param.isList && typeof val === 'string') {
        // Comma-separated string → array
        result[param.name] = val.split(',').map(s => s.trim()).filter(Boolean);
      } else {
        result[param.name] = val;
      }
    }
    return result;
  }

  activeSeverity(isActive: boolean): 'success' | 'secondary' {
    return isActive ? 'success' : 'secondary';
  }

  // ── Error helper ──────────────────────────────────────────────────────────

  private extractApiError(err: unknown): string | null {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error?: { detail?: string; title?: string; errors?: Record<string, string[]> } }).error;
      if (e?.detail) return e.detail;
      if (e?.errors) return Object.values(e.errors).flat().join(' ');
      if (e?.title) return e.title;
    }
    return null;
  }
}
