import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class ConfigService {
  private settings!: AppSettings;

  constructor(private http: HttpClient) { }

  async load(): Promise<void> {
    // Use an absolute URL so the request always hits the root-relative /api/settings
    // regardless of the <base href> value set for Angular's client-side routing.
    this.settings = await firstValueFrom(
      this.http.get<AppSettings>(`${window.location.origin}/api/settings`)
    );
  }


  get app(): AppSettings {
    return this.settings;
  }

  get auth(): OpenIdConnectSettings {
    return this.settings.authenticationOptions;
  }

  getModule(name: string): ModuleConfiguration | undefined {
    return this.settings.modules[name];
  }
}

export interface AppSettings {
  modules: Record<string, ModuleConfiguration>;
  authenticationOptions: OpenIdConnectSettings;
  baseEndpoint: string;
  settingsServer: string;
  tenant: TenantDetails;
}

export interface TenantDetails {
  name: string;
  isRootTenant: boolean;
}

export interface OpenIdConnectSettings {
  authority?: string;
  metadataUrl?: string;
  clientId?: string;
  defaultScopes: string[];
  redirectUri?: string;
  postLogoutRedirectUri?: string;
  responseType?: string;
  responseMode?: string;
  additionalProviderParameters: Record<string, string>;
}

export interface ModuleConfiguration {
  isEnabled: boolean;
  baseEndpoint: string;
}
