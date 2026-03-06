import { computed, Injectable, signal } from '@angular/core';
import { ConfigService } from './config-service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/** Maps UI app IDs to the backend application names they depend on. */
const APP_BACKEND_MAP: Record<string, string[]> = {
  'univisit':       ['Visitors Service'],
  'facility':       ['Settings Server', 'Agent Server', 'Access Policies', 'Locations Service'],
  'reception-desk': ['Visitors Service'],
  'settings':       ['Persons Service', 'Settings Server'],
};

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  constructor(private configService: ConfigService, private http: HttpClient) {}

  private readonly _permissions = signal<PermissionsSet[] | undefined>(undefined);

  /** Read-only view of the raw permissions array. Undefined until loaded. */
  readonly permissions = this._permissions.asReadonly();

  /** True once permissions have been loaded (even if the result is an empty array). */
  readonly loaded = computed(() => this._permissions() !== undefined);

  resetPermissions(): void {
    this._permissions.set(undefined);
  }

  async loadPermissions(): Promise<PermissionsSet[]> {
    const settings = this.configService.app;
    if (settings) {
      const result = await firstValueFrom(
        this.http.get<PermissionsSet[]>(settings.settingsServer + '/api/permissions')
      );
      this._permissions.set(result);
      return result;
    }
    this._permissions.set([]);
    return [];
  }

  /**
   * Returns true if the user has the exact `permission` string within the
   * named backend `application`. Defaults to false when permissions are not yet loaded.
   */
  hasPermission(app: string, permission: string): boolean {
    const perms = this._permissions();
    if (!perms) return false;
    const entry = perms.find(p => p.application === app);
    return entry?.permissions.includes(permission) ?? false;
  }

  /**
   * Returns true if the user has **any** of the listed permissions within the
   * named backend `application`. Defaults to false when permissions are not yet loaded.
   */
  hasAnyPermission(app: string, ...permissions: string[]): boolean {
    const perms = this._permissions();
    if (!perms) return false;
    const entry = perms.find(p => p.application === app);
    if (!entry) return false;
    return permissions.some(perm => entry.permissions.includes(perm));
  }

  /**
   * Returns true if the user has at least one permission across all backend
   * services that serve the given UI `appId` (e.g. 'univisit', 'facility').
   * Defaults to false when permissions are not yet loaded.
   */
  hasAppAccess(appId: string): boolean {
    const perms = this._permissions();
    if (!perms) return false;
    const backends = APP_BACKEND_MAP[appId];
    if (!backends) return false;
    return backends.some(backend => {
      const entry = perms.find(p => p.application === backend);
      return (entry?.totalPermissions ?? 0) > 0;
    });
  }
}

export interface PermissionsSet {
  application: string;
  permissions: string[];
  totalPermissions: number;
}
