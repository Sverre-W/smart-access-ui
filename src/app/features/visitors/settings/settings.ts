import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
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

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

const isLinked = (systemId: string) => systemId !== EMPTY_GUID;

@Component({
  selector: 'app-visitors-settings',
  standalone: true,
  imports: [FormsModule, SelectModule, ButtonModule, ToggleSwitchModule, CheckboxModule, InputTextModule],
  templateUrl: './settings.html',
})
export class VisitorsSettings implements OnInit {
  private visitorService = inject(VisitorService);

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

  // ── Notification form state (unwired) ─────────────────────────────────────
  readonly notifyOrganizerOnConfirmation = signal(false);
  readonly notifyOrganizerOnArrival = signal(false);
  readonly sendConfirmationEmailOnQrAvailable = signal(false);

  // ── Onboarding data items ─────────────────────────────────────────────────
  readonly onboardingDataItems = signal<OnboardingData[]>([]);

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
      }
      await Promise.all(dependents);
    } catch {
      this.loadError.set('Failed to load access control settings.');
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
    if (enabled && this.printers().length === 0) {
      await this.loadPrinters();
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

  async save(): Promise<void> {
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const body = this.buildPayload();

    try {
      await this.visitorService.configureBadgeType(body);
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch {
      this.saveError.set('Failed to save settings. Please try again.');
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
      onboardedMessages:      existing?.onboardedMessages      ?? [],
    };
  }
}
