import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SettingsService, Role, ApplicationPermissionSet } from '../services/settings-service';

// ── Local types ───────────────────────────────────────────────────────────────

interface PermissionRow {
  application: string;
  permission: string;
  isRootOnly: boolean;
}

interface AppGroup {
  application: string;
  permissions: PermissionRow[];
  rootPermissions: PermissionRow[];
}

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-edit-role',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    FormsModule,
    TranslateModule,
    ButtonModule,
    InputTextModule,
  ],
  templateUrl: './edit-role.html',
})
export class EditRole implements OnInit {
  private service = inject(SettingsService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  private roleName = '';

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly role = signal<Role | null>(null);
  readonly availableApps = signal<ApplicationPermissionSet[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── App groups for permission UI ──────────────────────────────────────────

  readonly appGroups = computed<AppGroup[]>(() => {
    return this.availableApps().map(app => ({
      application: app.application,
      permissions: app.permissions.map(p => ({ application: app.application, permission: p, isRootOnly: false })),
      rootPermissions: (app.rootTenantPermissions ?? []).map(p => ({
        application: app.application,
        permission: p,
        isRootOnly: true,
      })),
    }));
  });

  // ── Enabled permissions set (for O(1) lookup) ─────────────────────────────

  readonly enabledPermissions = signal<Set<string>>(new Set());

  // ── Details form ──────────────────────────────────────────────────────────

  readonly detailsForm = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    description: [''],
  });

  readonly detailsSaving  = signal(false);
  readonly detailsSuccess = signal(false);
  readonly detailsError   = signal<string | null>(null);

  // ── Permissions save ──────────────────────────────────────────────────────

  readonly permissionsSaving  = signal(false);
  readonly permissionsSuccess = signal(false);
  readonly permissionsError   = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.roleName = this.route.snapshot.paramMap.get('roleName') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [roles, apps] = await Promise.all([
        this.service.getRoles(),
        this.service.getApplicationPermissions(),
      ]);
      const role = roles.find(r => r.name === this.roleName) ?? null;
      if (!role) {
        this.error.set(this.translate.instant('facility.roles.edit.notFound'));
        return;
      }
      this.role.set(role);
      this.availableApps.set(apps);
      this.detailsForm.patchValue({
        name:        role.name,
        description: role.description ?? '',
      });
      this.enabledPermissions.set(this.buildEnabledSet(role));
    } catch {
      this.error.set(this.translate.instant('facility.roles.edit.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    void this.router.navigate(['/facility/roles']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  isEnabled(application: string, permission: string): boolean {
    return this.enabledPermissions().has(permissionKey(application, permission));
  }

  togglePermission(application: string, permission: string, enabled: boolean): void {
    const key = permissionKey(application, permission);
    this.enabledPermissions.update(set => {
      const next = new Set(set);
      if (enabled) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  totalEnabled(): number {
    return this.enabledPermissions().size;
  }

  // ── Save details ──────────────────────────────────────────────────────────

  async saveDetails(): Promise<void> {
    this.detailsForm.markAllAsTouched();
    if (this.detailsForm.invalid) return;

    this.detailsSaving.set(true);
    this.detailsError.set(null);
    this.detailsSuccess.set(false);

    const current = this.role()!;
    const { name, description } = this.detailsForm.controls;

    try {
      const updated = await this.service.updateRole(this.roleName, {
        ...current,
        name: name.value,
        description: description.value || null,
      });
      this.role.set(updated);
      this.roleName = updated.name;
      this.detailsSuccess.set(true);
      setTimeout(() => this.detailsSuccess.set(false), 3000);
      // If the name changed, update the URL to reflect the new role name
      // without pushing a new history entry, so the back button still works.
      if (updated.name !== current.name) {
        void this.router.navigate(['/facility/roles', updated.name], { replaceUrl: true });
      }
    } catch (err) {
      this.detailsError.set(this.extractApiError(err));
    } finally {
      this.detailsSaving.set(false);
    }
  }

  // ── Save permissions ──────────────────────────────────────────────────────

  async savePermissions(): Promise<void> {
    this.permissionsSaving.set(true);
    this.permissionsError.set(null);
    this.permissionsSuccess.set(false);

    const current = this.role()!;
    const permissionSets = this.buildPermissionSets();

    try {
      const updated = await this.service.updateRole(this.roleName, {
        ...current,
        permissions: permissionSets,
      });
      this.role.set(updated);
      this.enabledPermissions.set(this.buildEnabledSet(updated));
      this.permissionsSuccess.set(true);
      setTimeout(() => this.permissionsSuccess.set(false), 3000);
    } catch (err) {
      this.permissionsError.set(this.extractApiError(err));
      // Roll back to last known good state
      this.enabledPermissions.set(this.buildEnabledSet(current));
    } finally {
      this.permissionsSaving.set(false);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildEnabledSet(role: Role): Set<string> {
    const set = new Set<string>();
    for (const appSet of role.permissions) {
      for (const perm of appSet.permissions) {
        set.add(permissionKey(appSet.application, perm));
      }
    }
    return set;
  }

  private buildPermissionSets(): ApplicationPermissionSet[] {
    const map = new Map<string, string[]>();
    for (const key of this.enabledPermissions()) {
      const [app, ...permParts] = key.split('::');
      const perm = permParts.join('::');
      if (!map.has(app)) map.set(app, []);
      map.get(app)!.push(perm);
    }
    return Array.from(map.entries()).map(([application, permissions]) => ({
      application,
      permissions,
      rootTenantPermissions: [],
    }));
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
    return this.translate.instant('facility.roles.edit.unexpectedError');
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

function permissionKey(application: string, permission: string): string {
  return `${application}::${permission}`;
}
