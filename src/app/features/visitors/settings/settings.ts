import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { PermissionsService } from '../../../core/services/permissions-service';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import {
  VisitorService,
  TenantBadgeSettings,
  AcSystemDto,
  AcBadgeTypeDto,
  AcRuleDto,
  PrinterDto,
  OnboardingData,
  OnboardingDataType,
} from '../services/visitor-service';
import { CardEditor } from '../../../shared/components/card-editor/card-editor';
import { CardSize } from '../../../shared/components/card-editor/card-editor.types';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

const isLinked = (systemId: string) => systemId !== EMPTY_GUID;

@Component({
  selector: 'app-visitors-settings',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslateModule, SelectModule, ButtonModule, ToggleSwitchModule, InputTextModule, TextareaModule, CardEditor],
  templateUrl: './settings.html',
})
export class VisitorsSettings implements OnInit {
  private visitorService = inject(VisitorService);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  readonly canUpdateSettings = computed(() => this.permissions.hasPermission('Visitors Service', 'Settings:Update'));

  // ── Load state ────────────────────────────────────────────────────────────
  private currentSettings = signal<TenantBadgeSettings | null>(null);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  // ── Source data ───────────────────────────────────────────────────────────
  readonly acSystems = signal<AcSystemDto[]>([]);
  readonly badgeTypes = signal<AcBadgeTypeDto[]>([]);
  readonly accessLevels = signal<AcRuleDto[]>([]);
  readonly printers = signal<PrinterDto[]>([]);

  // ── Form state ────────────────────────────────────────────────────────────
  /** Whether the user wants to link an access control system. */
  readonly acEnabled = signal(false);

  readonly selectedSystemId = signal<string>(EMPTY_GUID);
  readonly selectedBadgeType = signal<string>(EMPTY_GUID);
  readonly selectedAccessLevelCreation = signal<string | null>(null);
  readonly selectedAccessLevelConfirmation = signal<string | null>(null);
  readonly selectedAccessLevelOnboarding = signal<string | null>(null);

  /** The currently selected system object, used to cascade-load dependent data. */
  readonly selectedSystem = computed(() =>
    this.acSystems().find(s => s.id === this.selectedSystemId()) ?? null
  );

  /** True when a real system is selected. */
  readonly systemSelected = computed(() => isLinked(this.selectedSystemId()));

  // ── Onboarding form state ─────────────────────────────────────────────────
  readonly selfOnboardingEnabled = signal(false);
  readonly guidedOnboardingEnabled = signal(false);
  readonly labelPrintingEnabled = signal(false);
  readonly selectedPrinterId = signal<string | null>(null);

  // ── Label template ────────────────────────────────────────────────────────
  readonly labelTemplate = signal<string | null>(null);

  // ── Onboarding data items ─────────────────────────────────────────────────
  readonly onboardingDataItems = signal<OnboardingData[]>([]);

  // ── Onboarded messages (self-onboarding only) ─────────────────────────────
  readonly onboardedMessages = signal<string[]>([]);

  // ── Label template ────────────────────────────────────────────────────────
  readonly cardSizes: CardSize[] = [
    // { label: 'CR80',         width: 85.6,  height: 54,    orientation: 'Landscape' },
    // { label: 'CR80',         width: 54,    height: 85.6,  orientation: 'Portrait'  },
    // { label: 'A7',           width: 105,   height: 74,    orientation: 'Landscape' },
    // { label: 'A7',           width: 74,    height: 105,   orientation: 'Portrait'  },
    // { label: 'Label 4×3 in', width: 101.6, height: 76.2,  orientation: 'Landscape' },
    // { label: 'Label 4×6 in', width: 152.4, height: 101.6, orientation: 'Landscape' },
    { label: 'VC500W', width: 50,   height: 75,   orientation: 'Portrait'  },
    { label: 'VC500W', width: 75,   height: 50,   orientation: 'Landscape' },
  ];

  onCardTemplateSave(json: string): void {
    this.labelTemplate.set(json);
  }

  readonly dataTypeOptions: { label: string; value: OnboardingDataType }[] = [
    { label: 'Photo',   value: 'Photo'  },
    { label: 'ID Card', value: 'IDCard' },
    { label: 'Image',   value: 'Image'  },
    { label: 'Page',    value: 'Page'   },
  ];

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    try {
      const [settings, systems] = await Promise.all([
        this.visitorService.getBadgeSettings(),
        this.visitorService.getAccessControlSystems(),
      ]);

      this.acSystems.set(systems);
      this.currentSettings.set(settings);
      this.applySettings(settings);

      const dependents: Promise<void>[] = [];
      if (isLinked(settings.systemId)) {
        dependents.push(this.loadSystemDependents(settings.systemId));
      }
      if (settings.labelPrintingConfiguration?.enabled) {
        dependents.push(this.loadPrinters());
        dependents.push(this.loadLabelTemplate());
      }
      await Promise.all(dependents);
    } catch {
      this.loadError.set(this.translate.instant('visitors.settings.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  async onSystemChange(systemId: string | null): Promise<void> {
    const id = systemId ?? EMPTY_GUID;
    this.selectedSystemId.set(id);
    this.selectedBadgeType.set(EMPTY_GUID);
    this.selectedAccessLevelCreation.set(null);
    this.selectedAccessLevelConfirmation.set(null);
    this.selectedAccessLevelOnboarding.set(null);
    this.badgeTypes.set([]);
    this.accessLevels.set([]);

    if (isLinked(id)) {
      await this.loadSystemDependents(id);
    }
  }

  onToggleChange(enabled: boolean): void {
    this.acEnabled.set(enabled);
    if (!enabled) {
      this.selectedSystemId.set(EMPTY_GUID);
      this.selectedBadgeType.set(EMPTY_GUID);
      this.selectedAccessLevelCreation.set(null);
      this.selectedAccessLevelConfirmation.set(null);
      this.selectedAccessLevelOnboarding.set(null);
      this.badgeTypes.set([]);
      this.accessLevels.set([]);
    }
  }

  async onLabelPrintingChange(enabled: boolean): Promise<void> {
    this.labelPrintingEnabled.set(enabled);
    this.selectedPrinterId.set(null);
    if (enabled) {
      const tasks: Promise<void>[] = [];
      if (this.printers().length === 0) tasks.push(this.loadPrinters());
      tasks.push(this.loadLabelTemplate());
      await Promise.all(tasks);
    } else {
      this.labelTemplate.set(null);
    }
  }

  addOnboardingDataItem(): void {
    this.onboardingDataItems.update(items => [
      ...items,
      { label: '', dataType: 'Photo', required: false },
    ]);
  }

  updateOnboardingDataItem(index: number, patch: Partial<OnboardingData>): void {
    this.onboardingDataItems.update(items =>
      items.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
  }

  removeOnboardingDataItem(index: number): void {
    this.onboardingDataItems.update(items => items.filter((_, i) => i !== index));
  }

  addMessage(): void {
    this.onboardedMessages.update(msgs => [...msgs, '']);
  }

  updateMessage(index: number, value: string): void {
    this.onboardedMessages.update(msgs => msgs.map((m, i) => (i === index ? value : m)));
  }

  removeMessage(index: number): void {
    this.onboardedMessages.update(msgs => msgs.filter((_, i) => i !== index));
  }

  moveMessageUp(index: number): void {
    if (index === 0) return;
    this.onboardedMessages.update(msgs => {
      const next = [...msgs];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  moveMessageDown(index: number): void {
    this.onboardedMessages.update(msgs => {
      if (index === msgs.length - 1) return msgs;
      const next = [...msgs];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  async save(): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const body = this.buildPayload();
    const template = this.labelTemplate();

    try {
      const tasks: Promise<unknown>[] = [this.visitorService.configureBadgeType(body)];
      if (this.labelPrintingEnabled() && template) {
        tasks.push(this.visitorService.addTemplate({ purpose: 'label-print', template }));
      }
      await Promise.all(tasks);
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch {
      this.saveError.set(this.translate.instant('visitors.settings.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private applySettings(settings: TenantBadgeSettings): void {
    const linked = isLinked(settings.systemId);
    this.acEnabled.set(linked);
    this.selectedSystemId.set(settings.systemId);
    this.selectedBadgeType.set(settings.badgeType);
    this.selectedAccessLevelCreation.set(settings.accessLevelForVisitorCreation);
    this.selectedAccessLevelConfirmation.set(settings.accessLevelForVisitorConfirmation);
    this.selectedAccessLevelOnboarding.set(settings.accessLevelForVisitorOnboarding);

    this.selfOnboardingEnabled.set(settings.selfOnboardingEnabled ?? false);
    this.guidedOnboardingEnabled.set(settings.guidedOnboardingEnabled ?? false);
    const printingEnabled = settings.labelPrintingConfiguration?.enabled ?? false;
    this.labelPrintingEnabled.set(printingEnabled);
    this.selectedPrinterId.set(settings.labelPrintingConfiguration?.printerId ?? null);
    this.onboardingDataItems.set(settings.requiredOnboardingData ?? []);
    this.onboardedMessages.set(settings.onboardedMessages ?? []);
  }

  private async loadSystemDependents(systemId: string): Promise<void> {
    const [badgeTypes, rules] = await Promise.all([
      this.visitorService.getAccessControlBadgeTypes(systemId),
      this.visitorService.getAccessControlRules(systemId),
    ]);
    this.badgeTypes.set(badgeTypes);
    this.accessLevels.set(rules);
  }

  private async loadPrinters(): Promise<void> {
    const printers = await this.visitorService.getAvailablePrinters();
    this.printers.set(printers);
  }

  private async loadLabelTemplate(): Promise<void> {
    try {
      const result = await this.visitorService.getTemplate('label-print');
      this.labelTemplate.set(result.template);
    } catch {
      // No template saved yet — leave the editor blank
      this.labelTemplate.set(null);
    }
  }

  private buildPayload(): TenantBadgeSettings {
    const linked = this.acEnabled();
    const existing = this.currentSettings();
    const printingEnabled = this.labelPrintingEnabled();
    return {
      ...(existing ?? {}),
      systemId:                          linked ? this.selectedSystemId()  : EMPTY_GUID,
      badgeType:                         linked ? this.selectedBadgeType() : EMPTY_GUID,
      accessLevelForVisitorCreation:     linked ? this.selectedAccessLevelCreation()     : null,
      accessLevelForVisitorConfirmation: linked ? this.selectedAccessLevelConfirmation() : null,
      accessLevelForVisitorOnboarding:   linked ? this.selectedAccessLevelOnboarding()   : null,
      selfOnboardingEnabled:    this.selfOnboardingEnabled(),
      guidedOnboardingEnabled:  this.guidedOnboardingEnabled(),
      requiredOnboardingData:   this.onboardingDataItems().filter(i => i.label.trim() !== ''),
      labelPrintingConfiguration: {
        enabled:   printingEnabled,
        printerId: printingEnabled ? this.selectedPrinterId() : null,
      },
      // Fields not managed by this form — fall back to existing or safe defaults
      badgeAssignmentTiming:  existing?.badgeAssignmentTiming  ?? 'OnVisitorOnboarding',
      onboardingMode:         existing?.onboardingMode         ?? null,
      onboardedMessages:      this.onboardedMessages(),
    };
  }
}
