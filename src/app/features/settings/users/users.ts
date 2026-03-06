import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { PaginatorModule } from 'primeng/paginator';
import type { PaginatorState } from 'primeng/paginator';
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

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'app-settings-users',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ButtonModule, InputTextModule, IconField, InputIcon, PaginatorModule, TranslateModule],
  templateUrl: './users.html',
})
export class SettingsUsers implements OnInit, OnDestroy {
  private service = inject(UserManagementService);
  private config = inject(ConfigService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  private readonly destroy$ = new Subject<void>();

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

  readonly users         = signal<PersonDto[]>([]);
  readonly usersTotal    = signal(0);
  readonly usersFirst    = signal(0);
  readonly usersPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly usersLoading  = signal(true);
  readonly usersError    = signal<string | null>(null);
  readonly userSearch    = signal('');

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly hasUsers        = computed(() => this.users().length > 0);

  private readonly userSearch$ = new Subject<string>();

  // ── Create user ───────────────────────────────────────────────────────────

  readonly createUserOpen  = signal(false);
  readonly createUserSaving = signal(false);
  readonly createUserError = signal<string | null>(null);

  readonly createUserForm = this.fb.nonNullable.group({
    username:  ['', Validators.required],
    firstName: ['', Validators.required],
    lastName:  ['', Validators.required],
    email:     ['', [Validators.required, Validators.email]],
    password:  ['', Validators.required],
  });

  // ── Delete user ───────────────────────────────────────────────────────────

  readonly deleteUserConfirmingId  = signal<string | null>(null);
  readonly deleteUserInProgressId  = signal<string | null>(null);
  readonly deleteUserError         = signal<string | null>(null);

  // ── Groups ────────────────────────────────────────────────────────────────

  readonly groups        = signal<GroupDto[]>([]);
  readonly groupsTotal   = signal(0);
  readonly groupsFirst    = signal(0);
  readonly groupsPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly groupsLoading = signal(true);
  readonly groupsError   = signal<string | null>(null);
  readonly groupSearch   = signal('');

  readonly hasGroups        = computed(() => this.groups().length > 0);

  private readonly groupSearch$ = new Subject<string>();

  // ── Create group ──────────────────────────────────────────────────────────

  readonly createGroupOpen  = signal(false);
  readonly createGroupSaving = signal(false);
  readonly createGroupError = signal<string | null>(null);

  readonly createGroupForm = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    description: [''],
  });

  // ── Delete group ──────────────────────────────────────────────────────────

  readonly deleteGroupConfirmingId  = signal<string | null>(null);
  readonly deleteGroupInProgressId  = signal<string | null>(null);
  readonly deleteGroupError         = signal<string | null>(null);

  // ── Roles ─────────────────────────────────────────────────────────────────

  readonly roles        = signal<RoleDto[]>([]);
  readonly rolesTotal   = signal(0);
  readonly rolesFirst    = signal(0);
  readonly rolesPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly rolesLoading = signal(true);
  readonly rolesError   = signal<string | null>(null);
  readonly roleSearch   = signal('');

  readonly hasRoles        = computed(() => this.roles().length > 0);

  private readonly roleSearch$ = new Subject<string>();

  // ── Create role ───────────────────────────────────────────────────────────

  readonly createRoleOpen  = signal(false);
  readonly createRoleSaving = signal(false);
  readonly createRoleError = signal<string | null>(null);

  readonly createRoleForm = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    description: [''],
  });

  // ── Edit role ─────────────────────────────────────────────────────────────

  readonly editRoleId    = signal<string | null>(null);
  readonly editRoleSaving = signal(false);
  readonly editRoleError = signal<string | null>(null);

  readonly editRoleForm = this.fb.nonNullable.group({
    name:        ['', Validators.required],
    description: [''],
  });

  // ── Delete role ───────────────────────────────────────────────────────────

  readonly deleteRoleConfirmingId  = signal<string | null>(null);
  readonly deleteRoleInProgressId  = signal<string | null>(null);
  readonly deleteRoleError         = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.wireSearch(this.userSearch$,  q => this.searchUsers(q));
    this.wireSearch(this.groupSearch$, q => this.searchGroups(q));
    this.wireSearch(this.roleSearch$,  q => this.searchRoles(q));

    this.loadUsers();
    this.loadGroups();
    this.loadRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private wireSearch(subject$: Subject<string>, handler: (q: string) => void): void {
    subject$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    ).subscribe(handler);
  }

  // ── User search & paging ──────────────────────────────────────────────────

  onUserSearchInput(value: string): void {
    this.userSearch.set(value);
    this.userSearch$.next(value);
  }

  private searchUsers(q: string): void {
    this.usersFirst.set(0);
    this.loadUsers(q, 0);
  }

  async onUsersPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    const newRows  = event.rows ?? this.usersPageSize();
    if (newRows !== this.usersPageSize()) {
      this.usersPageSize.set(newRows);
      this.usersFirst.set(0);
      await this.loadUsers(this.userSearch(), 0);
    } else {
      this.usersFirst.set(newFirst);
      await this.loadUsers(this.userSearch(), newFirst);
    }
  }

  private async loadUsers(search = '', firstOffset = 0): Promise<void> {
    this.usersLoading.set(true);
    this.usersError.set(null);
    try {
      const size = this.usersPageSize();
      const result = await this.service.getAllPersons(this.tenant, {
        search: search || null,
        page: Math.floor(firstOffset / size),
        pageSize: size,
      });
      this.users.set(result.items);
      this.usersTotal.set(result.totalItems ?? result.items.length);
    } catch {
      this.usersError.set(this.translate.instant('settings.users.users.loadError'));
    } finally {
      this.usersLoading.set(false);
    }
  }

  // ── Group search & paging ─────────────────────────────────────────────────

  onGroupSearchInput(value: string): void {
    this.groupSearch.set(value);
    this.groupSearch$.next(value);
  }

  private searchGroups(q: string): void {
    this.groupsFirst.set(0);
    this.loadGroups(q, 0);
  }

  async onGroupsPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    const newRows  = event.rows ?? this.groupsPageSize();
    if (newRows !== this.groupsPageSize()) {
      this.groupsPageSize.set(newRows);
      this.groupsFirst.set(0);
      await this.loadGroups(this.groupSearch(), 0);
    } else {
      this.groupsFirst.set(newFirst);
      await this.loadGroups(this.groupSearch(), newFirst);
    }
  }

  private async loadGroups(search = '', firstOffset = 0): Promise<void> {
    this.groupsLoading.set(true);
    this.groupsError.set(null);
    try {
      const size = this.groupsPageSize();
      const result = await this.service.getAllGroups(this.tenant, {
        search: search || null,
        page: Math.floor(firstOffset / size),
        pageSize: size,
      });
      this.groups.set(result.items);
      this.groupsTotal.set(result.totalItems ?? result.items.length);
    } catch {
      this.groupsError.set(this.translate.instant('settings.users.groups.loadError'));
    } finally {
      this.groupsLoading.set(false);
    }
  }

  // ── Role search & paging ──────────────────────────────────────────────────

  onRoleSearchInput(value: string): void {
    this.roleSearch.set(value);
    this.roleSearch$.next(value);
  }

  private searchRoles(q: string): void {
    this.rolesFirst.set(0);
    this.loadRoles(q, 0);
  }

  async onRolesPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    const newRows  = event.rows ?? this.rolesPageSize();
    if (newRows !== this.rolesPageSize()) {
      this.rolesPageSize.set(newRows);
      this.rolesFirst.set(0);
      await this.loadRoles(this.roleSearch(), 0);
    } else {
      this.rolesFirst.set(newFirst);
      await this.loadRoles(this.roleSearch(), newFirst);
    }
  }

  private async loadRoles(search = '', firstOffset = 0): Promise<void> {
    this.rolesLoading.set(true);
    this.rolesError.set(null);
    try {
      const size = this.rolesPageSize();
      const result = await this.service.getAllRoles(this.tenant, {
        search: search || null,
        page: Math.floor(firstOffset / size),
        pageSize: size,
      });
      this.roles.set(result.items);
      this.rolesTotal.set(result.totalItems ?? result.items.length);
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
      // Reload current page so totals and order stay consistent
      this.loadUsers(this.userSearch(), this.usersFirst());
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
      this.deleteUserConfirmingId.set(null);
      // If we deleted the last item on this page, go back one page
      const newTotal   = this.usersTotal() - 1;
      const size       = this.usersPageSize();
      const targetFirst = this.users().length === 1 && this.usersFirst() > 0
        ? Math.max(0, this.usersFirst() - size)
        : this.usersFirst();
      this.usersTotal.set(newTotal);
      this.usersFirst.set(targetFirst);
      this.loadUsers(this.userSearch(), targetFirst);
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
      await this.service.createGroup(this.tenant, {
        name: name.value,
        description: description.value || undefined,
      });
      this.loadGroups(this.groupSearch(), this.groupsFirst());
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
      this.deleteGroupConfirmingId.set(null);
      const newTotal    = this.groupsTotal() - 1;
      const size        = this.groupsPageSize();
      const targetFirst = this.groups().length === 1 && this.groupsFirst() > 0
        ? Math.max(0, this.groupsFirst() - size)
        : this.groupsFirst();
      this.groupsTotal.set(newTotal);
      this.groupsFirst.set(targetFirst);
      this.loadGroups(this.groupSearch(), targetFirst);
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
      await this.service.createRole(this.tenant, body);
      this.loadRoles(this.roleSearch(), this.rolesFirst());
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
      this.roles.update(list =>
        list.map(r => (r.id === role.id ? updated : r)),
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
      this.deleteRoleConfirmingId.set(null);
      const newTotal    = this.rolesTotal() - 1;
      const size        = this.rolesPageSize();
      const targetFirst = this.roles().length === 1 && this.rolesFirst() > 0
        ? Math.max(0, this.rolesFirst() - size)
        : this.rolesFirst();
      this.rolesTotal.set(newTotal);
      this.rolesFirst.set(targetFirst);
      this.loadRoles(this.roleSearch(), targetFirst);
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
