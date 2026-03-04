import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../../core/services/config-service';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum FeatureFlags {
  None             = 0,
  DesfireEncoding  = 1,
  ReceptionDesk    = 2,
  AutomationEngine = 4,
  Agents           = 8,
  Visitors         = 16,
  Kiosk            = 32,
  Notifications    = 64,
  AccessPolicies   = 128,
  Locations        = 256,
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface QueryRequest {
  sortColumn?: string | null;
  sortAscending?: boolean;
  query?: string | null;
}

// ─── Identity Provider ────────────────────────────────────────────────────────

export interface IdpSettings {
  metadataUrl: string;
  authority: string;
  clientId: string;
  responseTypes: string;
  scopes: string[];
  loginRedirectUri: string;
  logoutRedirectUri: string;
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export interface TenantInfo {
  tenantId: string;
  displayName: string;
  isRootTenant: boolean;
  features: FeatureFlags;
  idpSettings: IdpSettings;
}

export interface CreateTenantRequest extends TenantInfo {
  defaultRole: string;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

export interface ThemeColors {
  primary: string;
  primaryContrastText: string;
  secondary: string;
  secondaryContrastText: string;
  info: string;
  infoContrastText: string;
  warning: string;
  warningContrastText: string;
  error: string;
  errorContrastText: string;
  success: string;
  successContrastText: string;
  tertiary: string;
  tertiaryContrastText: string;
}

export interface ThemeSettings {
  tenantId: string;
  lightTheme: ThemeColors;
  darkTheme: ThemeColors;
}

// ─── Authorization ────────────────────────────────────────────────────────────

export interface ApplicationPermissionSet {
  application: string;
  permissions: string[];
  rootTenantPermissions: string[];
}

export interface Role {
  name: string;
  description?: string | null;
  permissions: ApplicationPermissionSet[];
}

export interface PermissionData {
  role: string;
  permissions: string[];
}

// ─── Service Configuration ────────────────────────────────────────────────────

export interface ServiceConfigurationDto {
  dataType: string;
  dataVersion: string;
  data: string;
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
export class SettingsService {
  private baseUrl: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.baseUrl = this.config.app.settingsServer;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Tenants ───────────────────────────────────────────────────────────────

  /** Bootstrap the platform by creating the root tenant. Only succeeds if no tenants exist yet. */
  createRootTenant(body: CreateTenantRequest): Promise<CreateTenantRequest> {
    return firstValueFrom(
      this.http.post<CreateTenantRequest>(this.url('/api/tenants/root'), body)
    );
  }

  /** Create a new (non-root) tenant. Requires root-tenant permissions. */
  createTenant(body: CreateTenantRequest): Promise<CreateTenantRequest> {
    return firstValueFrom(
      this.http.post<CreateTenantRequest>(this.url('/api/tenants'), body)
    );
  }

  /** List all tenants. Requires root-tenant permissions. */
  getTenants(params?: QueryRequest): Promise<TenantInfo[]> {
    return firstValueFrom(
      this.http.get<TenantInfo[]>(this.url('/api/tenants'), { params: toParams(params) })
    );
  }

  /** Get a single tenant by ID. Requires root-tenant permissions. */
  getTenant(tenantId: string): Promise<TenantInfo> {
    return firstValueFrom(this.http.get<TenantInfo>(this.url(`/api/tenants/${tenantId}`)));
  }

  /** Update an existing tenant. The path parameter is authoritative; tenantId in the body is ignored. */
  updateTenant(tenantId: string, body: TenantInfo): Promise<TenantInfo> {
    return firstValueFrom(
      this.http.put<TenantInfo>(this.url(`/api/tenants/${tenantId}`), body)
    );
  }

  /** Delete a tenant. Requires root-tenant permissions. */
  deleteTenant(tenantId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/api/tenants/${tenantId}`)));
  }

  // ── Themes ────────────────────────────────────────────────────────────────

  /** Get the UI theme settings for a tenant. Returns defaults if not yet configured. */
  getTenantTheme(tenantId: string): Promise<ThemeSettings> {
    return firstValueFrom(
      this.http.get<ThemeSettings>(this.url(`/api/tenants/${tenantId}/theme`))
    );
  }

  /** Store or replace the UI theme settings for a tenant. */
  updateTenantTheme(tenantId: string, body: ThemeSettings): Promise<ThemeSettings> {
    return firstValueFrom(
      this.http.put<ThemeSettings>(this.url(`/api/tenants/${tenantId}/theme`), body)
    );
  }

  // ── Roles ─────────────────────────────────────────────────────────────────

  /** List roles for the current tenant. */
  getRoles(params?: QueryRequest): Promise<Role[]> {
    return firstValueFrom(
      this.http.get<Role[]>(this.url('/api/authorization/roles'), { params: toParams(params) })
    );
  }

  /** Create a new role in the current tenant. */
  createRole(body: Role): Promise<Role> {
    return firstValueFrom(this.http.post<Role>(this.url('/api/authorization/roles'), body));
  }

  /** Update an existing role by its current name. */
  updateRole(roleName: string, body: Role): Promise<Role> {
    return firstValueFrom(
      this.http.put<Role>(this.url(`/api/authorization/roles/${encodeURIComponent(roleName)}`), body)
    );
  }

  /** Delete a role from the current tenant. */
  deleteRole(roleName: string): Promise<Role> {
    return firstValueFrom(
      this.http.delete<Role>(
        this.url(`/api/authorization/roles/${encodeURIComponent(roleName)}`)
      )
    );
  }

  /** List all registered application permission sets, ordered by application name. */
  getApplicationPermissions(): Promise<ApplicationPermissionSet[]> {
    return firstValueFrom(
      this.http.get<ApplicationPermissionSet[]>(this.url('/api/authorization/applications'))
    );
  }

  // ── Permissions ───────────────────────────────────────────────────────────

  /** Resolve all permissions held by the currently authenticated user across all applications. */
  getUserPermissions(): Promise<ApplicationPermissionSet[]> {
    return firstValueFrom(
      this.http.get<ApplicationPermissionSet[]>(this.url('/api/permissions'))
    );
  }

  // ── Service Configuration ─────────────────────────────────────────────────

  /** Retrieve the stored configuration for a specific service and tenant. */
  getServiceConfiguration(tenantId: string, service: string): Promise<ServiceConfigurationDto> {
    return firstValueFrom(
      this.http.get<ServiceConfigurationDto>(
        this.url(`/api/tenants/${tenantId}/configuration/${service}`)
      )
    );
  }

  /** Create or update the configuration for a specific service and tenant (upsert). */
  upsertServiceConfiguration(
    tenantId: string,
    service: string,
    body: ServiceConfigurationDto
  ): Promise<ServiceConfigurationDto> {
    return firstValueFrom(
      this.http.post<ServiceConfigurationDto>(
        this.url(`/api/tenants/${tenantId}/configuration/${service}`),
        body
      )
    );
  }

  /** Delete the stored configuration for a specific service and tenant. */
  deleteServiceConfiguration(tenantId: string, service: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/api/tenants/${tenantId}/configuration/${service}`))
    );
  }
}
