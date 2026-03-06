import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { SettingsService, Role } from '../../facility/services/settings-service';
import { PermissionsService } from '../../../core/services/permissions-service';

@Component({
  selector: 'app-facility-roles',
  standalone: true,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    IconField,
    InputIcon,
    TranslateModule,
  ],
  templateUrl: './roles.html',
})
export class FacilityRoles implements OnInit {
  private settingsService = inject(SettingsService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  readonly canWriteRoles = computed(() => this.permissions.hasPermission('Settings Server', 'roles.write'));

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly allRoles = signal<Role[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Search ────────────────────────────────────────────────────────────────

  readonly searchQuery = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly filteredRoles = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.allRoles();
    return this.allRoles().filter(
      r =>
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
    );
  });

  readonly hasRoles = computed(() => this.filteredRoles().length > 0);

  // ── Create role ───────────────────────────────────────────────────────────

  readonly createOpen = signal(false);
  readonly createSaving = signal(false);
  readonly createError = signal<string | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });

  // ── Delete role ───────────────────────────────────────────────────────────

  readonly deleteConfirmingName = signal<string | null>(null);
  readonly deleteInProgressName = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const roles = await this.settingsService.getRoles({ sortColumn: 'Name', sortAscending: true });
      this.allRoles.set(roles);
    } catch {
      this.error.set(this.translate.instant('facility.roles.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const value = (event.target as HTMLInputElement).value;
    this.searchTimer = setTimeout(() => this.searchQuery.set(value), 250);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset();
    this.createError.set(null);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
  }

  async saveCreate(): Promise<void> {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;

    this.createSaving.set(true);
    this.createError.set(null);

    const { name, description } = this.createForm.controls;

    try {
      const created = await this.settingsService.createRole({
        name: name.value,
        description: description.value || null,
        permissions: [],
      });
      this.allRoles.update(list =>
        [...list, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      this.createOpen.set(false);
    } catch (err) {
      this.createError.set(this.extractApiError(err));
    } finally {
      this.createSaving.set(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  confirmDelete(roleName: string): void {
    this.deleteError.set(null);
    this.deleteConfirmingName.set(roleName);
  }

  abortDelete(): void {
    this.deleteConfirmingName.set(null);
  }

  async executeDelete(role: Role): Promise<void> {
    this.deleteInProgressName.set(role.name);
    this.deleteError.set(null);
    try {
      await this.settingsService.deleteRole(role.name);
      this.allRoles.update(list => list.filter(r => r.name !== role.name));
      this.deleteConfirmingName.set(null);
    } catch {
      this.deleteError.set(
        this.translate.instant('facility.roles.deleteError', { name: role.name })
      );
    } finally {
      this.deleteInProgressName.set(null);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  permissionCount(role: Role): number {
    return role.permissions.reduce((sum, p) => sum + p.permissions.length, 0);
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
    return this.translate.instant('facility.roles.unexpectedError');
  }
}
