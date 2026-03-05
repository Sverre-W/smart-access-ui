import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../../core/services/config-service';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SortOrder {
  Asc = 0,
  Desc = 1,
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Page<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number | null;
  totalItems: number | null;
  isLastPage: boolean;
  items: T[];
}

export interface PagedRequest {
  page?: number;
  pageSize?: number;
  sort?: string;
  sortDir?: SortOrder;
}

// ─── Person (User) Models ──────────────────────────────────────────────────────

export interface PersonDto {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  attributes: Record<string, string[]>;
  enabled: boolean;
  realmRoles: string[];
  clientRoles: Record<string, string[]>;
  groups: string[];
}

export interface RegisterPersonRequest extends PersonDto { }

export interface UpdatePersonRequest {
  firstName: string;
  lastName: string;
  enabled: boolean;
}

export interface MergePersonRequest {
  sourcePersonId: string;
  strategy?: string | null;
}

export interface ChangeCredentialsRequest {
  password: string;
  temporary: boolean;
}

// ─── Person Query Params ───────────────────────────────────────────────────────

export interface PersonsQuery extends PagedRequest {
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  enabled?: boolean | null;
  search?: string | null;
  filter?: string | null;
}

// ─── Role Models ──────────────────────────────────────────────────────────────

export interface RoleDto {
  id: string;
  name: string;
  description: string;
  composite: boolean;
  clientRole: boolean;
}

export interface CreateRoleRequest {
  name: string;
  description: string;
}

export interface UpdateRoleRequest {
  name: string;
  description: string;
}

export interface AssignRoleMappingsRequest {
  roleNames: string[];
}

// ─── Role Query Params ────────────────────────────────────────────────────────

export interface RolesQuery extends PagedRequest {
  search?: string | null;
}

// ─── Group Models ─────────────────────────────────────────────────────────────

export interface GroupDto {
  id: string;
  name: string;
  description: string;
  path: string;
  subGroups: GroupDto[];
  attributes: Record<string, string[]>;
  realmRoles: string[];
  clientRoles: Record<string, string[]>;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface UpdateGroupRequest {
  name: string;
  description?: string;
}

// ─── Group Query Params ───────────────────────────────────────────────────────

export interface GroupsQuery extends PagedRequest {
  search?: string | null;
}

export interface GroupMembersQuery extends PagedRequest {
  search?: string | null;
}

// ─── Tenant Models ────────────────────────────────────────────────────────────

export interface RealmRepresentation {
  id: string | null;
  realm: string | null;
  displayName: string | null;
  enabled: boolean;
  [key: string]: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds HttpParams, expanding array values as repeatable query params. */
function toParams(query?: object | null): HttpParams {
  if (!query) return new HttpParams();
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        params = params.append(key, String(item));
      }
    } else {
      params = params.set(key, String(value));
    }
  }
  return params;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private baseUrl: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.baseUrl = this.config.getModule('Users')?.baseEndpoint ?? '';
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Persons ───────────────────────────────────────────────────────────────────

  getAllPersons(tenant: string, query?: PersonsQuery): Promise<Page<PersonDto>> {
    return firstValueFrom(
      this.http.get<Page<PersonDto>>(
        this.url(`/api/v1/tenants/${tenant}/persons`),
        { params: toParams(query) }
      )
    );
  }

  getPerson(tenant: string, personId: string): Promise<PersonDto> {
    return firstValueFrom(
      this.http.get<PersonDto>(this.url(`/api/v1/tenants/${tenant}/persons/${personId}`))
    );
  }

  registerPerson(tenant: string, body: RegisterPersonRequest): Promise<PersonDto> {
    return firstValueFrom(
      this.http.post<PersonDto>(this.url(`/api/v1/tenants/${tenant}/persons`), body)
    );
  }

  updatePerson(tenant: string, personId: string, body: UpdatePersonRequest): Promise<PersonDto> {
    return firstValueFrom(
      this.http.put<PersonDto>(this.url(`/api/v1/tenants/${tenant}/persons/${personId}`), body)
    );
  }

  deletePerson(tenant: string, personId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/api/v1/tenants/${tenant}/persons/${personId}`))
    );
  }

  mergePerson(tenant: string, personId: string, body: MergePersonRequest): Promise<PersonDto> {
    return firstValueFrom(
      this.http.post<PersonDto>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/merge`),
        body
      )
    );
  }

  changeCredentials(tenant: string, personId: string, body: ChangeCredentialsRequest): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/credentials`),
        body
      )
    );
  }

  // ── Roles ─────────────────────────────────────────────────────────────────────

  getAllRoles(tenant: string, query?: RolesQuery): Promise<Page<RoleDto>> {
    return firstValueFrom(
      this.http.get<Page<RoleDto>>(
        this.url(`/api/v1/tenants/${tenant}/roles`),
        { params: toParams(query) }
      )
    );
  }

  getRole(tenant: string, roleName: string): Promise<RoleDto> {
    return firstValueFrom(
      this.http.get<RoleDto>(this.url(`/api/v1/tenants/${tenant}/roles/${roleName}`))
    );
  }

  createRole(tenant: string, body: CreateRoleRequest): Promise<RoleDto> {
    return firstValueFrom(
      this.http.post<RoleDto>(this.url(`/api/v1/tenants/${tenant}/roles`), body)
    );
  }

  updateRole(tenant: string, roleName: string, body: UpdateRoleRequest): Promise<RoleDto> {
    return firstValueFrom(
      this.http.put<RoleDto>(this.url(`/api/v1/tenants/${tenant}/roles/${roleName}`), body)
    );
  }

  deleteRole(tenant: string, roleName: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/api/v1/tenants/${tenant}/roles/${roleName}`))
    );
  }

  getUserRoleMappings(tenant: string, personId: string): Promise<RoleDto[]> {
    return firstValueFrom(
      this.http.get<RoleDto[]>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/role-mappings`)
      )
    );
  }

  assignRolesToUser(tenant: string, personId: string, body: AssignRoleMappingsRequest): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/role-mappings`),
        body
      )
    );
  }

  removeRolesFromUser(tenant: string, personId: string, body: AssignRoleMappingsRequest): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/role-mappings`),
        { body }
      )
    );
  }

  // ── Groups ────────────────────────────────────────────────────────────────────

  getAllGroups(tenant: string, query?: GroupsQuery): Promise<Page<GroupDto>> {
    return firstValueFrom(
      this.http.get<Page<GroupDto>>(
        this.url(`/api/v1/tenants/${tenant}/groups`),
        { params: toParams(query) }
      )
    );
  }

  getGroup(tenant: string, groupId: string): Promise<GroupDto> {
    return firstValueFrom(
      this.http.get<GroupDto>(this.url(`/api/v1/tenants/${tenant}/groups/${groupId}`))
    );
  }

  createGroup(tenant: string, body: CreateGroupRequest): Promise<GroupDto> {
    return firstValueFrom(
      this.http.post<GroupDto>(this.url(`/api/v1/tenants/${tenant}/groups`), body)
    );
  }

  updateGroup(tenant: string, groupId: string, body: UpdateGroupRequest): Promise<GroupDto> {
    return firstValueFrom(
      this.http.put<GroupDto>(this.url(`/api/v1/tenants/${tenant}/groups/${groupId}`), body)
    );
  }

  deleteGroup(tenant: string, groupId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/api/v1/tenants/${tenant}/groups/${groupId}`))
    );
  }

  getGroupMembers(tenant: string, groupId: string, query?: GroupMembersQuery): Promise<Page<PersonDto>> {
    return firstValueFrom(
      this.http.get<Page<PersonDto>>(
        this.url(`/api/v1/tenants/${tenant}/groups/${groupId}/members`),
        { params: toParams(query) }
      )
    );
  }

  getUserGroups(tenant: string, personId: string): Promise<GroupDto[]> {
    return firstValueFrom(
      this.http.get<GroupDto[]>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/groups`)
      )
    );
  }

  addUserToGroup(tenant: string, personId: string, groupId: string): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/groups/${groupId}`),
        null
      )
    );
  }

  removeUserFromGroup(tenant: string, personId: string, groupId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        this.url(`/api/v1/tenants/${tenant}/persons/${personId}/groups/${groupId}`)
      )
    );
  }

  getGroupRoleMappings(tenant: string, groupId: string): Promise<RoleDto[]> {
    return firstValueFrom(
      this.http.get<RoleDto[]>(
        this.url(`/api/v1/tenants/${tenant}/groups/${groupId}/role-mappings`)
      )
    );
  }

  assignRolesToGroup(tenant: string, groupId: string, body: AssignRoleMappingsRequest): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        this.url(`/api/v1/tenants/${tenant}/groups/${groupId}/role-mappings`),
        body
      )
    );
  }

  removeRolesFromGroup(tenant: string, groupId: string, body: AssignRoleMappingsRequest): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        this.url(`/api/v1/tenants/${tenant}/groups/${groupId}/role-mappings`),
        { body }
      )
    );
  }

  // ── Tenants ───────────────────────────────────────────────────────────────────

  getTenant(tenantName: string): Promise<RealmRepresentation> {
    return firstValueFrom(
      this.http.get<RealmRepresentation>(this.url(`/api/v1/tenants/${tenantName}`))
    );
  }

  createTenant(tenantName: string): Promise<RealmRepresentation> {
    return firstValueFrom(
      this.http.post<RealmRepresentation>(this.url(`/api/v1/tenants/${tenantName}`), null)
    );
  }
}
