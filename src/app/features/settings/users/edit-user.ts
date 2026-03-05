import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  UserManagementService,
  PersonDto,
  RoleDto,
} from '../../facility/services/user-management-service';
import { ConfigService } from '../../../core/services/config-service';

@Component({
  selector: 'app-edit-user',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    ToggleSwitchModule,
    TranslateModule,
  ],
  templateUrl: './edit-user.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditUser implements OnInit {
  private service = inject(UserManagementService);
  private config = inject(ConfigService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  private userId = '';

  private get tenant(): string {
    const authority = this.config.app?.authenticationOptions?.authority ?? '';
    return authority.split('/realms/')[1] ?? '';
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly user = signal<PersonDto | null>(null);
  readonly allRoles = signal<RoleDto[]>([]);
  readonly assignedRoles = signal<RoleDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Details form (created after data loads) ───────────────────────────────

  readonly detailsForm = signal<FormGroup | null>(null);
  readonly enabledToggle = signal(true);

  readonly detailsSaving = signal(false);
  readonly detailsSuccess = signal(false);
  readonly detailsError = signal<string | null>(null);

  // ── Password form ─────────────────────────────────────────────────────────

  readonly passwordForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: ['', Validators.required],
  });

  readonly passwordSaving = signal(false);
  readonly passwordSuccess = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordMismatch = computed(() => {
    const { password, confirm } = this.passwordForm.controls;
    return password.value !== confirm.value && confirm.touched;
  });

  // ── Roles ─────────────────────────────────────────────────────────────────

  readonly rolesSearch = signal('');
  private rolesSearchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly availableRoles = computed(() => {
    const assignedNames = new Set(this.assignedRoles().map(r => r.name));
    const q = this.rolesSearch().trim().toLowerCase();
    return this.allRoles()
      .filter(r => !assignedNames.has(r.name))
      .filter(r => !q || r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q));
  });

  readonly rolesSaving = signal(false);
  readonly rolesError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.userId = this.route.snapshot.paramMap.get('userId') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [user, rolesPage, assignedRoles] = await Promise.all([
        this.service.getPerson(this.tenant, this.userId),
        this.service.getAllRoles(this.tenant, { pageSize: 200 }),
        this.service.getUserRoleMappings(this.tenant, this.userId),
      ]);
      this.user.set(user);
      this.allRoles.set(rolesPage.items);
      this.assignedRoles.set(assignedRoles);
      this.enabledToggle.set(user.enabled);
      this.detailsForm.set(this.fb.nonNullable.group({
        firstName: [user.firstName, Validators.required],
        lastName:  [user.lastName,  Validators.required],
      }));
    } catch {
      this.error.set(this.translate.instant('settings.users.editUser.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    this.location.back();
  }

  // ── Save details ──────────────────────────────────────────────────────────

  async saveDetails(): Promise<void> {
    const form = this.detailsForm();
    if (!form) return;
    form.markAllAsTouched();
    if (form.invalid) return;

    this.detailsSaving.set(true);
    this.detailsError.set(null);
    this.detailsSuccess.set(false);

    try {
      const updated = await this.service.updatePerson(this.tenant, this.userId, {
        firstName: form.controls['firstName'].value,
        lastName:  form.controls['lastName'].value,
        enabled:   this.enabledToggle(),
      });
      this.user.set({ ...this.user()!, ...updated });
      this.detailsSuccess.set(true);
      setTimeout(() => this.detailsSuccess.set(false), 3000);
    } catch (err) {
      this.detailsError.set(this.extractApiError(err));
    } finally {
      this.detailsSaving.set(false);
    }
  }

  // ── Set password ──────────────────────────────────────────────────────────

  async savePassword(): Promise<void> {
    this.passwordForm.markAllAsTouched();
    if (this.passwordForm.invalid || this.passwordMismatch()) return;

    this.passwordSaving.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(false);

    try {
      await this.service.changeCredentials(this.tenant, this.userId, {
        password: this.passwordForm.controls.password.value,
        temporary: false,
      });
      this.passwordForm.reset();
      this.passwordSuccess.set(true);
      setTimeout(() => this.passwordSuccess.set(false), 3000);
    } catch (err) {
      this.passwordError.set(this.extractApiError(err));
    } finally {
      this.passwordSaving.set(false);
    }
  }

  // ── Roles search ──────────────────────────────────────────────────────────

  onRolesSearchInput(event: Event): void {
    if (this.rolesSearchTimer) clearTimeout(this.rolesSearchTimer);
    const value = (event.target as HTMLInputElement).value;
    this.rolesSearchTimer = setTimeout(() => this.rolesSearch.set(value), 250);
  }

  // ── Assign role ───────────────────────────────────────────────────────────

  async assignRole(role: RoleDto): Promise<void> {
    this.rolesSaving.set(true);
    this.rolesError.set(null);
    try {
      await this.service.assignRolesToUser(this.tenant, this.userId, { roleNames: [role.name] });
      this.assignedRoles.update(list => [...list, role].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      this.rolesError.set(this.extractApiError(err));
    } finally {
      this.rolesSaving.set(false);
    }
  }

  // ── Remove role ───────────────────────────────────────────────────────────

  readonly removeRoleConfirmingName = signal<string | null>(null);
  readonly removeRoleInProgressName = signal<string | null>(null);

  confirmRemoveRole(roleName: string): void {
    this.rolesError.set(null);
    this.removeRoleConfirmingName.set(roleName);
  }

  abortRemoveRole(): void {
    this.removeRoleConfirmingName.set(null);
  }

  async executeRemoveRole(role: RoleDto): Promise<void> {
    this.removeRoleInProgressName.set(role.name);
    this.rolesError.set(null);
    try {
      await this.service.removeRolesFromUser(this.tenant, this.userId, { roleNames: [role.name] });
      this.assignedRoles.update(list => list.filter(r => r.name !== role.name));
      this.removeRoleConfirmingName.set(null);
    } catch (err) {
      this.rolesError.set(this.extractApiError(err));
    } finally {
      this.removeRoleInProgressName.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  fullName(): string {
    const u = this.user();
    if (!u) return '';
    return `${u.firstName} ${u.lastName}`.trim() || u.username;
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
    return this.translate.instant('settings.users.editUser.unexpectedError');
  }
}
