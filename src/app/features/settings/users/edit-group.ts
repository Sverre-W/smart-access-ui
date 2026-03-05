import { ChangeDetectionStrategy, Component, inject, signal, computed, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  UserManagementService,
  GroupDto,
  PersonDto,
  RoleDto,
} from '../../facility/services/user-management-service';
import { ConfigService } from '../../../core/services/config-service';

@Component({
  selector: 'app-edit-group',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ButtonModule, InputTextModule, TranslateModule],
  templateUrl: './edit-group.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditGroup implements OnInit {
  private service = inject(UserManagementService);
  private config = inject(ConfigService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  private groupId = '';

  private get tenant(): string {
    const authority = this.config.app?.authenticationOptions?.authority ?? '';
    return authority.split('/realms/')[1] ?? '';
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly group = signal<GroupDto | null>(null);
  readonly members = signal<PersonDto[]>([]);
  readonly allUsers = signal<PersonDto[]>([]);
  readonly allRoles = signal<RoleDto[]>([]);
  readonly assignedRoles = signal<RoleDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Details form (created after data loads) ───────────────────────────────

  readonly detailsForm = signal<FormGroup | null>(null);

  readonly detailsSaving = signal(false);
  readonly detailsSuccess = signal(false);
  readonly detailsError = signal<string | null>(null);

  // ── Members ───────────────────────────────────────────────────────────────

  readonly memberSearch = signal('');
  private memberSearchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly availableUsers = computed(() => {
    const memberIds = new Set(this.members().map(m => m.id));
    const q = this.memberSearch().trim().toLowerCase();
    return this.allUsers()
      .filter(u => !memberIds.has(u.id))
      .filter(
        u =>
          !q ||
          u.username.toLowerCase().includes(q) ||
          u.firstName.toLowerCase().includes(q) ||
          u.lastName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
  });

  readonly membersSaving = signal(false);
  readonly membersError = signal<string | null>(null);
  readonly removeMemberConfirmingId = signal<string | null>(null);
  readonly removeMemberInProgressId = signal<string | null>(null);

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
  readonly removeRoleConfirmingName = signal<string | null>(null);
  readonly removeRoleInProgressName = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.groupId = this.route.snapshot.paramMap.get('groupId') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [group, membersPage, usersPage, rolesPage, assignedRoles] = await Promise.all([
        this.service.getGroup(this.tenant, this.groupId),
        this.service.getGroupMembers(this.tenant, this.groupId, { pageSize: 200 }),
        this.service.getAllPersons(this.tenant, { pageSize: 200 }),
        this.service.getAllRoles(this.tenant, { pageSize: 200 }),
        this.service.getGroupRoleMappings(this.tenant, this.groupId),
      ]);
      this.group.set(group);
      this.members.set(membersPage.items);
      this.allUsers.set(usersPage.items);
      this.allRoles.set(rolesPage.items);
      this.assignedRoles.set(assignedRoles);
      this.detailsForm.set(this.fb.nonNullable.group({
        name:        [group.name,                Validators.required],
        description: [group.description ?? ''],
      }));
    } catch {
      this.error.set(this.translate.instant('settings.users.editGroup.loadError'));
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
      const updated = await this.service.updateGroup(this.tenant, this.groupId, {
        name:        form.controls['name'].value,
        description: form.controls['description'].value || undefined,
      });
      this.group.set(updated);
      this.detailsSuccess.set(true);
      setTimeout(() => this.detailsSuccess.set(false), 3000);
    } catch (err) {
      this.detailsError.set(this.extractApiError(err));
    } finally {
      this.detailsSaving.set(false);
    }
  }

  // ── Members search ────────────────────────────────────────────────────────

  onMemberSearchInput(event: Event): void {
    if (this.memberSearchTimer) clearTimeout(this.memberSearchTimer);
    const value = (event.target as HTMLInputElement).value;
    this.memberSearchTimer = setTimeout(() => this.memberSearch.set(value), 250);
  }

  // ── Add member ────────────────────────────────────────────────────────────

  async addMember(user: PersonDto): Promise<void> {
    this.membersSaving.set(true);
    this.membersError.set(null);
    try {
      await this.service.addUserToGroup(this.tenant, user.id, this.groupId);
      this.members.update(list =>
        [...list, user].sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
        ),
      );
    } catch (err) {
      this.membersError.set(this.extractApiError(err));
    } finally {
      this.membersSaving.set(false);
    }
  }

  // ── Remove member ─────────────────────────────────────────────────────────

  confirmRemoveMember(userId: string): void {
    this.membersError.set(null);
    this.removeMemberConfirmingId.set(userId);
  }

  abortRemoveMember(): void {
    this.removeMemberConfirmingId.set(null);
  }

  async executeRemoveMember(user: PersonDto): Promise<void> {
    this.removeMemberInProgressId.set(user.id);
    this.membersError.set(null);
    try {
      await this.service.removeUserFromGroup(this.tenant, user.id, this.groupId);
      this.members.update(list => list.filter(m => m.id !== user.id));
      this.removeMemberConfirmingId.set(null);
    } catch (err) {
      this.membersError.set(this.extractApiError(err));
    } finally {
      this.removeMemberInProgressId.set(null);
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
      await this.service.assignRolesToGroup(this.tenant, this.groupId, { roleNames: [role.name] });
      this.assignedRoles.update(list => [...list, role].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      this.rolesError.set(this.extractApiError(err));
    } finally {
      this.rolesSaving.set(false);
    }
  }

  // ── Remove role ───────────────────────────────────────────────────────────

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
      await this.service.removeRolesFromGroup(this.tenant, this.groupId, { roleNames: [role.name] });
      this.assignedRoles.update(list => list.filter(r => r.name !== role.name));
      this.removeRoleConfirmingName.set(null);
    } catch (err) {
      this.rolesError.set(this.extractApiError(err));
    } finally {
      this.removeRoleInProgressName.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  fullName(user: PersonDto): string {
    return `${user.firstName} ${user.lastName}`.trim() || user.username;
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
    return this.translate.instant('settings.users.editGroup.unexpectedError');
  }
}
