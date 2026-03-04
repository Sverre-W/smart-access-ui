import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import {
  SettingsService,
  TenantInfo,
  FeatureFlags,
} from '../services/settings-service';

interface FeatureToggle {
  flag: FeatureFlags;
  labelKey: string;
  descKey: string;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
  { flag: FeatureFlags.DesfireEncoding,  labelKey: 'facility.tenants.edit.featureDesfire',    descKey: 'facility.tenants.edit.featureDesfireDesc' },
  { flag: FeatureFlags.ReceptionDesk,    labelKey: 'facility.tenants.edit.featureReception',  descKey: 'facility.tenants.edit.featureReceptionDesc' },
  { flag: FeatureFlags.AutomationEngine, labelKey: 'facility.tenants.edit.featureAutomation', descKey: 'facility.tenants.edit.featureAutomationDesc' },
  { flag: FeatureFlags.Agents,           labelKey: 'facility.tenants.edit.featureAgents',     descKey: 'facility.tenants.edit.featureAgentsDesc' },
  { flag: FeatureFlags.Visitors,         labelKey: 'facility.tenants.edit.featureVisitors',   descKey: 'facility.tenants.edit.featureVisitorsDesc' },
  { flag: FeatureFlags.Kiosk,            labelKey: 'facility.tenants.edit.featureKiosk',      descKey: 'facility.tenants.edit.featureKioskDesc' },
  { flag: FeatureFlags.Notifications,    labelKey: 'facility.tenants.edit.featureNotifications', descKey: 'facility.tenants.edit.featureNotificationsDesc' },
  { flag: FeatureFlags.AccessPolicies,   labelKey: 'facility.tenants.edit.featureAccessPolicies', descKey: 'facility.tenants.edit.featureAccessPoliciesDesc' },
  { flag: FeatureFlags.Locations,        labelKey: 'facility.tenants.edit.featureLocations',  descKey: 'facility.tenants.edit.featureLocationsDesc' },
];

@Component({
  selector: 'app-edit-tenant',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    ButtonModule,
    InputTextModule,
    ToggleSwitchModule,
  ],
  templateUrl: './edit-tenant.html',
})
export class EditTenant implements OnInit {
  private service = inject(SettingsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  private tenantId = '';

  // ── Expose constants to template ──────────────────────────────────────────

  readonly featureToggles = FEATURE_TOGGLES;

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly tenant = signal<TenantInfo | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Settings form ─────────────────────────────────────────────────────────

  readonly settingsForm = this.fb.nonNullable.group({
    displayName:      ['', Validators.required],
    metadataUrl:      ['', Validators.required],
    clientId:         ['', Validators.required],
    responseTypes:    ['', Validators.required],
    loginRedirectUri: ['', Validators.required],
    logoutRedirectUri:['', Validators.required],
  });

  readonly settingsSaving  = signal(false);
  readonly settingsSuccess = signal(false);
  readonly settingsError   = signal<string | null>(null);

  // ── Features ──────────────────────────────────────────────────────────────

  /** Mutable bitmask that the feature toggles bind to. */
  readonly featureBits = signal<number>(FeatureFlags.None);

  readonly featuresSaving  = signal(false);
  readonly featuresSuccess = signal(false);
  readonly featuresError   = signal<string | null>(null);

  readonly isFeatureEnabled = computed(() => {
    const bits = this.featureBits();
    return (flag: FeatureFlags) => (bits & flag) !== 0;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.tenantId = this.route.snapshot.paramMap.get('tenantId') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const tenant = await this.service.getTenant(this.tenantId);
      this.tenant.set(tenant);
      this.settingsForm.patchValue({
        displayName:       tenant.displayName,
        metadataUrl:       tenant.idpSettings?.metadataUrl ?? '',
        clientId:          tenant.idpSettings?.clientId ?? '',
        responseTypes:     tenant.idpSettings?.responseTypes ?? '',
        loginRedirectUri:  tenant.idpSettings?.loginRedirectUri ?? '',
        logoutRedirectUri: tenant.idpSettings?.logoutRedirectUri ?? '',
      });
      this.featureBits.set(tenant.features);
    } catch {
      this.error.set(this.translate.instant('facility.tenants.edit.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    void this.router.navigate(['/facility/tenants']);
  }

  // ── Save settings ─────────────────────────────────────────────────────────

  async saveSettings(): Promise<void> {
    this.settingsForm.markAllAsTouched();
    if (this.settingsForm.invalid) return;

    this.settingsSaving.set(true);
    this.settingsError.set(null);
    this.settingsSuccess.set(false);

    const current = this.tenant()!;
    const { displayName, metadataUrl, clientId, responseTypes, loginRedirectUri, logoutRedirectUri } =
      this.settingsForm.controls;

    try {
      const updated = await this.service.updateTenant(this.tenantId, {
        ...current,
        displayName: displayName.value,
        idpSettings: {
          ...current.idpSettings,
          metadataUrl:       metadataUrl.value,
          clientId:          clientId.value,
          responseTypes:     responseTypes.value,
          loginRedirectUri:  loginRedirectUri.value,
          logoutRedirectUri: logoutRedirectUri.value,
        },
      });
      this.tenant.set(updated);
      this.settingsSuccess.set(true);
      setTimeout(() => this.settingsSuccess.set(false), 3000);
    } catch (err) {
      this.settingsError.set(this.extractApiError(err));
    } finally {
      this.settingsSaving.set(false);
    }
  }

  // ── Toggle feature ────────────────────────────────────────────────────────

  toggleFeature(flag: FeatureFlags, enabled: boolean): void {
    this.featureBits.update(bits => enabled ? (bits | flag) : (bits & ~flag));
  }

  // ── Save features ─────────────────────────────────────────────────────────

  async saveFeatures(): Promise<void> {
    this.featuresSaving.set(true);
    this.featuresError.set(null);
    this.featuresSuccess.set(false);

    const current = this.tenant()!;

    try {
      const updated = await this.service.updateTenant(this.tenantId, {
        ...current,
        features: this.featureBits(),
      });
      this.tenant.set(updated);
      this.featureBits.set(updated.features);
      this.featuresSuccess.set(true);
      setTimeout(() => this.featuresSuccess.set(false), 3000);
    } catch (err) {
      this.featuresError.set(this.extractApiError(err));
      // Roll back to last known good state
      this.featureBits.set(current.features);
    } finally {
      this.featuresSaving.set(false);
    }
  }

  // ── Error helper ──────────────────────────────────────────────────────────

  private extractApiError(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error: unknown }).error;
      if (e && typeof e === 'object') {
        if ('detail' in e && typeof (e as { detail: unknown }).detail === 'string') {
          return (e as { detail: string }).detail;
        }
        if ('title' in e && typeof (e as { title: unknown }).title === 'string') {
          return (e as { title: string }).title;
        }
        if ('errors' in e) {
          const errs = (e as { errors: Record<string, string[]> }).errors;
          return Object.values(errs).flat().join(' ');
        }
      }
    }
    return this.translate.instant('facility.tenants.edit.unexpectedError');
  }
}
