import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import {
  SettingsService,
  TenantInfo,
  FeatureFlags,
} from '../services/settings-service';
import { PermissionsService } from '../../../core/services/permissions-service';

@Component({
  selector: 'app-facility-tenants',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    IconField,
    InputIcon,
    TranslateModule,
  ],
  templateUrl: './tenants.html',
})
export class FacilityTenants implements OnInit {
  private settingsService = inject(SettingsService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  readonly canWriteTenants = computed(() => this.permissions.hasPermission('Settings Server', 'tenants.write'));

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly allTenants = signal<TenantInfo[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Search ────────────────────────────────────────────────────────────────

  readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filteredTenants = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.allTenants();
    return this.allTenants().filter(
      t =>
        t.displayName.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q)
    );
  });

  readonly hasTenants = computed(() => this.filteredTenants().length > 0);

  // ── Create tenant ─────────────────────────────────────────────────────────

  readonly createOpen = signal(false);
  readonly createSaving = signal(false);
  readonly createError = signal<string | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    tenantId: ['', Validators.required],
    displayName: ['', Validators.required],
    defaultRole: ['admin', Validators.required],
    metadataUrl: ['', Validators.required],
    clientId: ['', Validators.required],
    responseTypes: ['code', Validators.required],
    loginRedirectUri: ['', Validators.required],
    logoutRedirectUri: ['', Validators.required],
  });

  // ── Delete tenant ─────────────────────────────────────────────────────────

  readonly deleteConfirmingId = signal<string | null>(null);
  readonly deleteInProgressId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const tenants = await this.settingsService.getTenants({ sortColumn: 'DisplayName', sortAscending: true });
      this.allTenants.set(tenants);
    } catch {
      this.error.set(this.translate.instant('facility.tenants.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const value = (event.target as HTMLInputElement).value;
    this.searchTimer = setTimeout(() => this.searchQuery.set(value), 250);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset({ defaultRole: 'admin', responseTypes: 'code' });
    this.createError.set(null);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  async saveCreate(): Promise<void> {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;

    this.createSaving.set(true);
    this.createError.set(null);

    const { tenantId, displayName, defaultRole, metadataUrl, clientId, responseTypes, loginRedirectUri, logoutRedirectUri } =
      this.createForm.controls;

    try {
      const created = await this.settingsService.createTenant({
        tenantId: tenantId.value,
        displayName: displayName.value,
        isRootTenant: false,
        features: FeatureFlags.None,
        defaultRole: defaultRole.value,
        idpSettings: {
          metadataUrl: metadataUrl.value,
          authority: '',
          clientId: clientId.value,
          responseTypes: responseTypes.value,
          scopes: ['openid', 'profile'],
          loginRedirectUri: loginRedirectUri.value,
          logoutRedirectUri: logoutRedirectUri.value,
        },
      });
      this.allTenants.update(list =>
        [...list, created].sort((a, b) => a.displayName.localeCompare(b.displayName))
      );
      this.createOpen.set(false);
    } catch (err) {
      this.createError.set(this.extractApiError(err));
    } finally {
      this.createSaving.set(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  confirmDelete(tenantId: string): void {
    this.deleteError.set(null);
    this.deleteConfirmingId.set(tenantId);
  }

  abortDelete(): void {
    this.deleteConfirmingId.set(null);
  }

  async executeDelete(tenant: TenantInfo): Promise<void> {
    this.deleteInProgressId.set(tenant.tenantId);
    this.deleteError.set(null);
    try {
      await this.settingsService.deleteTenant(tenant.tenantId);
      this.allTenants.update(list => list.filter(t => t.tenantId !== tenant.tenantId));
      this.deleteConfirmingId.set(null);
    } catch {
      this.deleteError.set(
        this.translate.instant('facility.tenants.deleteError', { name: tenant.displayName })
      );
    } finally {
      this.deleteInProgressId.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  featureBadges(tenant: TenantInfo): string[] {
    const flags: [FeatureFlags, string][] = [
      [FeatureFlags.DesfireEncoding,  'DESFire'],
      [FeatureFlags.ReceptionDesk,    'Reception'],
      [FeatureFlags.AutomationEngine, 'Automation'],
      [FeatureFlags.Agents,           'Agents'],
      [FeatureFlags.Visitors,         'Visitors'],
      [FeatureFlags.Kiosk,            'Kiosk'],
      [FeatureFlags.Notifications,    'Notifications'],
      [FeatureFlags.AccessPolicies,   'Access Policies'],
      [FeatureFlags.Locations,        'Locations'],
      [FeatureFlags.Users,            'Users'],
    ];
    return flags.filter(([flag]) => (tenant.features & flag) !== 0).map(([, label]) => label);
  }

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
    return 'An unexpected error occurred. Please try again.';
  }
}
