import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { ConfigService } from '../../../core/services/config-service';
import { PermissionsService } from '../../../core/services/permissions-service';

@Component({
  selector: 'app-settings-dashboard',
  standalone: true,
  imports: [RouterLink, TranslateModule],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsDashboard {
  private permissions = inject(PermissionsService);
  private configService = inject(ConfigService);

  readonly canSeeUserManagement = computed(() =>
    this.permissions.hasAnyPermission('Persons Service', 'Persons:Read', 'Groups:Read', 'Roles:Read')
  );

  readonly canSeeTenants = computed(() =>
    this.configService.app?.tenant?.isRootTenant === true &&
    this.permissions.hasAnyPermission('Settings Server', 'tenants.read')
  );

  readonly canSeeRoles = computed(() =>
    this.permissions.hasAnyPermission('Settings Server', 'roles.read')
  );
}
