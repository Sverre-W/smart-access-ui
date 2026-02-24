import { Injectable } from '@angular/core';
import { ConfigService } from './config-service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  constructor(private configService: ConfigService, private http: HttpClient) {
  }

  private permissions: PermissionsSet[] | undefined;

  resetPermissions(): void {
    this.permissions = undefined;
  }

  async loadPermissions(): Promise<PermissionsSet[]> {
    var settings = this.configService.app;
    if (settings) {
      this.permissions = await firstValueFrom(this.http.get<PermissionsSet[]>(
        settings.settingsServer + "/api/permissions"));
    }
    return this.permissions ?? [];
  }

}

export interface PermissionsSet {
  application: string;
  permissions: string[];
  totalPermissions: number;
}
