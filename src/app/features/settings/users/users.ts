import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  UserManagementService,
  PersonDto,
  GroupDto,
  RoleDto,
  CreateRoleRequest,
  UpdateRoleRequest,
} from '../../facility/services/user-management-service';
import { ConfigService } from '../../../core/services/config-service';
import { PermissionsService } from '../../../core/services/permissions-service';

@Component({
  selector: 'app-settings-users',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ButtonModule, InputTextModule, IconField, InputIcon, TranslateModule],
  templateUrl: './users.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsUsers implements OnInit {
  private service = inject(UserManagementService);
  private config = inject(ConfigService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  // ── Permissions ───────────────────────────────────────────────────────────

  private readonly APP = 'Persons Service';

  readonly canCreateUser  = computed(() => this.permissions.hasPermission(this.APP, 'Persons:Create'));
  readonly canUpdateUser  = computed(() => this.permissions.hasPermission(this.APP, 'Persons:Update'));
  readonly canDeleteUser  = computed(() => this.permissions.hasPermission(this.APP, 'Persons:Delete'));

  readonly canCreateGroup = computed(() => this.permissions.hasPermission(this.APP, 'Groups:Create'));
  readonly canUpdateGroup = computed(() => this.permissions.hasPermission(this.APP, 'Groups:Update'));
  readonly canDeleteGroup = computed(() => this.permissions.hasPermission(this.APP, 'Groups:Delete'));

  readonly canCreateRole  = computed(() => this.permissions.hasPermission(this.APP, 'Roles:Create'));
  readonly canUpdateRole  = computed(() => this.permissions.hasPermission(this.APP, 'Roles:Update'));
  readonly canDeleteRole  = computed(() => this.permissions.hasPermission(this.APP, 'Roles:Delete'));

  private get tenant(): string {
    const authority = this.config.app?.authenticationOptions?.authority ?? '';
    return authority.split('/realms/')[1] ?? '';
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  readonly allUsers = signal<PersonDto[]>([]);
  readonly usersLoading = signal(true);
  readonly usersError = signal<string | null>(null);

  readonly userSearch = signal('');

  readonly filteredUsers = computed(() => {
    const q = this.userSearch().trim().toLowerCase();
    if (!q) return this.allUsers();
    return this.allUsers().filter(
      u =>
        (u.username ?? '').toLowerCase().includes(q) ||
        (u.firstName ?? '').toLowerCase().includes(q) ||
        (u.lastName ?? '').toLowerCase().includes(q) ||
        (u.email ?? '').toLowerCase().includes(q),
    );
  });

  readonly hasUsers = computed(() => this.filteredUsers().length > 0);

  // ── Create user ───────────────────────────────────────────────────────────

  readonly createUserOpen = signal(false);
  readonly createUserSaving = signal(false);
  readonly createUserError = signal<string | null>(null);

  readonly createUserForm = this.fb.nonNullable.group({
    username: ['', Validators.required],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  // ── Delete user ───────────────────────────────────────────────────────────

  readonly deleteUserConfirmingId = signal<string | null>(null);
  readonly deleteUserInProgressId = signal<string | null>(null);
  readonly deleteUserError = signal<string | null>(null);

  // ── Groups ────────────────────────────────────────────────────────────────

  readonly allGroups = signal<GroupDto[]>([]);
  readonly groupsLoading = signal(true);
  readonly groupsError = signal<string | null>(null);

  readonly groupSearch = signal('');

  readonly filteredGroups = computed(() => {
    const q = this.groupSearch().trim().toLowerCase();
    if (!q) return this.allGroups();
    return this.allGroups().filter(
      g =>
        g.name.toLowerCase().includes(q) ||
        (g.description ?? '').toLowerCase().includes(q),
    );
  });

  readonly hasGroups = computed(() => this.filteredGroups().length > 0);

  // ── Create group ──────────────────────────────────────────────────────────

  readonly createGroupOpen = signal(false);
  readonly createGroupSaving = signal(false);
  readonly createGroupError = signal<string | null>(null);

  readonly createGroupForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  // ── Delete group ──────────────────────────────────────────────────────────

  readonly deleteGroupConfirmingId = signal<string | null>(null);
  readonly deleteGroupInProgressId = signal<string | null>(null);
  readonly deleteGroupError = signal<string | null>(null);

  // ── Roles ─────────────────────────────────────────────────────────────────

  readonly allRoles = signal<RoleDto[]>([]);
  readonly rolesLoading = signal(true);
  readonly rolesError = signal<string | null>(null);

  readonly roleSearch = signal('');

  readonly filteredRoles = computed(() => {
    const q = this.roleSearch().trim().toLowerCase();
    if (!q) return this.allRoles();
    return this.allRoles().filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  });

  readonly hasRoles = computed(() => this.filteredRoles().length > 0);

  // ── Create role ───────────────────────────────────────────────────────────

  readonly createRoleOpen = signal(false);
  readonly createRoleSaving = signal(false);
  readonly createRoleError = signal<string | null>(null);

  readonly createRoleForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  // ── Edit role ─────────────────────────────────────────────────────────────

  readonly editRoleId = signal<string | null>(null);
  readonly editRoleSaving = signal(false);
  readonly editRoleError = signal<string | null>(null);

  readonly editRoleForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  // ── Delete role ───────────────────────────────────────────────────────────

  readonly deleteRoleConfirmingId = signal<string | null>(null);
  readonly deleteRoleInProgressId = signal<string | null>(null);
  readonly deleteRoleError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadUsers(), this.loadGroups(), this.loadRoles()]);
  }

  private async loadUsers(): Promise<void> {
    this.usersLoading.set(true);
    this.usersError.set(null);
    try {
      const page = await this.service.getAllPersons(this.tenant, { pageSize: 200 });
      this.allUsers.set(page.items);
    } catch {
      this.usersError.set(this.translate.instant('settings.users.users.loadError'));
    } finally {
      this.usersLoading.set(false);
    }
  }

  private async loadGroups(): Promise<void> {
    this.groupsLoading.set(true);
    this.groupsError.set(null);
    try {
      const page = await this.service.getAllGroups(this.tenant, { pageSize: 200 });
      this.allGroups.set(page.items);
    } catch {
      this.groupsError.set(this.translate.instant('settings.users.groups.loadError'));
    } finally {
      this.groupsLoading.set(false);
    }
  }

  private async loadRoles(): Promise<void> {
    this.rolesLoading.set(true);
    this.rolesError.set(null);
    try {
      const page = await this.service.getAllRoles(this.tenant, { pageSize: 200 });
      this.allRoles.set(page.items);
    } catch {
      this.rolesError.set(this.translate.instant('settings.users.roles.loadError'));
    } finally {
      this.rolesLoading.set(false);
    }
  }

  // ── Create user ───────────────────────────────────────────────────────────

  openCreateUser(): void {
    this.createUserForm.reset();
    this.createUserError.set(null);
    this.createUserOpen.set(true);
  }

  closeCreateUser(): void {
    this.createUserOpen.set(false);
  }

  async saveCreateUser(): Promise<void> {
    this.createUserForm.markAllAsTouched();
    if (this.createUserForm.invalid) return;

    this.createUserSaving.set(true);
    this.createUserError.set(null);

    const { username, firstName, lastName, email, password } = this.createUserForm.controls;

    try {
      const created = await this.service.registerPerson(this.tenant, {
        id: '',
        username: username.value,
        firstName: firstName.value,
        lastName: lastName.value,
        email: email.value,
        emailVerified: false,
        attributes: {},
        enabled: true,
        realmRoles: [],
        clientRoles: {},
        groups: [],
      });
      await this.service.changeCredentials(this.tenant, created.id, {
        password: password.value,
        temporary: false,
      });
      this.allUsers.update(list =>
        [...list, created].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
        ),
      );
      this.createUserOpen.set(false);
    } catch (err) {
      this.createUserError.set(this.extractApiError(err));
    } finally {
      this.createUserSaving.set(false);
    }
  }

  // ── Delete user ───────────────────────────────────────────────────────────

  confirmDeleteUser(userId: string): void {
    this.deleteUserError.set(null);
    this.deleteUserConfirmingId.set(userId);
  }

  abortDeleteUser(): void {
    this.deleteUserConfirmingId.set(null);
  }

  async executeDeleteUser(user: PersonDto): Promise<void> {
    this.deleteUserInProgressId.set(user.id);
    this.deleteUserError.set(null);
    try {
      await this.service.deletePerson(this.tenant, user.id);
      this.allUsers.update(list => list.filter(u => u.id !== user.id));
      this.deleteUserConfirmingId.set(null);
    } catch {
      this.deleteUserError.set(
        this.translate.instant('settings.users.users.deleteError', { name: user.username }),
      );
    } finally {
      this.deleteUserInProgressId.set(null);
    }
  }

  // ── Create group ──────────────────────────────────────────────────────────

  openCreateGroup(): void {
    this.createGroupForm.reset();
    this.createGroupError.set(null);
    this.createGroupOpen.set(true);
  }

  closeCreateGroup(): void {
    this.createGroupOpen.set(false);
  }

  async saveCreateGroup(): Promise<void> {
    this.createGroupForm.markAllAsTouched();
    if (this.createGroupForm.invalid) return;

    this.createGroupSaving.set(true);
    this.createGroupError.set(null);

    const { name, description } = this.createGroupForm.controls;

    try {
      const created = await this.service.createGroup(this.tenant, {
        name: name.value,
        description: description.value || undefined,
      });
      this.allGroups.update(list =>
        [...list, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.createGroupOpen.set(false);
    } catch (err) {
      this.createGroupError.set(this.extractApiError(err));
    } finally {
      this.createGroupSaving.set(false);
    }
  }

  // ── Delete group ──────────────────────────────────────────────────────────

  confirmDeleteGroup(groupId: string): void {
    this.deleteGroupError.set(null);
    this.deleteGroupConfirmingId.set(groupId);
  }

  abortDeleteGroup(): void {
    this.deleteGroupConfirmingId.set(null);
  }

  async executeDeleteGroup(group: GroupDto): Promise<void> {
    this.deleteGroupInProgressId.set(group.id);
    this.deleteGroupError.set(null);
    try {
      await this.service.deleteGroup(this.tenant, group.id);
      this.allGroups.update(list => list.filter(g => g.id !== group.id));
      this.deleteGroupConfirmingId.set(null);
    } catch {
      this.deleteGroupError.set(
        this.translate.instant('settings.users.groups.deleteError', { name: group.name }),
      );
    } finally {
      this.deleteGroupInProgressId.set(null);
    }
  }

  // ── Create role ───────────────────────────────────────────────────────────

  openCreateRole(): void {
    this.createRoleForm.reset();
    this.createRoleError.set(null);
    this.editRoleId.set(null);
    this.createRoleOpen.set(true);
  }

  closeCreateRole(): void {
    this.createRoleOpen.set(false);
  }

  async saveCreateRole(): Promise<void> {
    this.createRoleForm.markAllAsTouched();
    if (this.createRoleForm.invalid) return;

    this.createRoleSaving.set(true);
    this.createRoleError.set(null);

    const { name, description } = this.createRoleForm.controls;
    const body: CreateRoleRequest = { name: name.value, description: description.value };

    try {
      const created = await this.service.createRole(this.tenant, body);
      this.allRoles.update(list =>
        [...list, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.createRoleOpen.set(false);
    } catch (err) {
      this.createRoleError.set(this.extractApiError(err));
    } finally {
      this.createRoleSaving.set(false);
    }
  }

  // ── Edit role ─────────────────────────────────────────────────────────────

  openEditRole(role: RoleDto): void {
    this.deleteRoleConfirmingId.set(null);
    this.createRoleOpen.set(false);
    this.editRoleError.set(null);
    this.editRoleForm.patchValue({ name: role.name, description: role.description ?? '' });
    this.editRoleId.set(role.id);
  }

  closeEditRole(): void {
    this.editRoleId.set(null);
  }

  async saveEditRole(role: RoleDto): Promise<void> {
    this.editRoleForm.markAllAsTouched();
    if (this.editRoleForm.invalid) return;

    this.editRoleSaving.set(true);
    this.editRoleError.set(null);

    const { name, description } = this.editRoleForm.controls;
    const body: UpdateRoleRequest = { name: name.value, description: description.value };

    try {
      const updated = await this.service.updateRole(this.tenant, role.name, body);
      this.allRoles.update(list =>
        list.map(r => (r.id === role.id ? updated : r))
            .sort((a, b) => a.name.localeCompare(b.name)),
      );
      this.editRoleId.set(null);
    } catch (err) {
      this.editRoleError.set(this.extractApiError(err));
    } finally {
      this.editRoleSaving.set(false);
    }
  }

  // ── Delete role ───────────────────────────────────────────────────────────

  confirmDeleteRole(roleId: string): void {
    this.deleteRoleError.set(null);
    this.editRoleId.set(null);
    this.deleteRoleConfirmingId.set(roleId);
  }

  abortDeleteRole(): void {
    this.deleteRoleConfirmingId.set(null);
  }

  async executeDeleteRole(role: RoleDto): Promise<void> {
    this.deleteRoleInProgressId.set(role.id);
    this.deleteRoleError.set(null);
    try {
      await this.service.deleteRole(this.tenant, role.name);
      this.allRoles.update(list => list.filter(r => r.id !== role.id));
      this.deleteRoleConfirmingId.set(null);
    } catch {
      this.deleteRoleError.set(
        this.translate.instant('settings.users.roles.deleteError', { name: role.name }),
      );
    } finally {
      this.deleteRoleInProgressId.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  fullName(user: PersonDto): string {
    return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username;
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
