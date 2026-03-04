import { Component, inject, OnInit, signal } from '@angular/core';
import { Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LocationService,
  SiteDto,
  BuildingDto,
} from '../services/location-service';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-site',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule, CheckboxModule],
  templateUrl: './edit-site.html',
})
export class EditSite implements OnInit {
  private service = inject(LocationService);
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private fb = inject(FormBuilder);

  readonly canGoBack = signal(history.length > 1);

  private siteId = '';

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly site = signal<SiteDto | null>(null);
  readonly allBuildings = signal<BuildingDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Details form ──────────────────────────────────────────────────────────

  readonly detailsForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    externalId: [''],
  });

  readonly detailsSaving = signal(false);
  readonly detailsSuccess = signal(false);
  readonly detailsError = signal<string | null>(null);

  // ── Assign buildings ──────────────────────────────────────────────────────

  /** Buildings not yet assigned to this site (candidates to add). */
  readonly unassignedBuildings = signal<BuildingDto[]>([]);
  readonly assignBuildingId = signal<string | null>(null);
  readonly assignSaving = signal(false);
  readonly assignError = signal<string | null>(null);

  // ── Create building ───────────────────────────────────────────────────────

  readonly showCreateBuilding = signal(false);

  readonly createBuildingForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    externalId: [''],
    country: [''],
    city: [''],
    street: [''],
    zipCode: [''],
    state: [''],
  });

  readonly createBuildingSaving = signal(false);
  readonly createBuildingError = signal<string | null>(null);

  // ── Remove buildings ──────────────────────────────────────────────────────

  readonly removeBuildingConfirmingId = signal<string | null>(null);
  readonly removeBuildingInProgressId = signal<string | null>(null);
  readonly removeBuildingAction = signal<'unlink' | 'delete' | null>(null);
  readonly removeBuildingError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.siteId = this.route.snapshot.paramMap.get('siteId') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [site, buildingsPage] = await Promise.all([
        this.service.getSite(this.siteId),
        this.service.getBuildings({ PageSize: 200 }),
      ]);
      this.site.set(site);
      this.allBuildings.set(buildingsPage.items);
      this.detailsForm.patchValue({
        name: site.Name,
        externalId: site.ExternalId ?? '',
      });
      this.refreshUnassigned(site, buildingsPage.items);
    } catch {
      this.error.set('Failed to load site. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  private refreshUnassigned(site: SiteDto, all: BuildingDto[]): void {
    const assignedIds = new Set(site.Buildings.map(b => b.id));
    this.unassignedBuildings.set(all.filter(b => !assignedIds.has(b.id)));
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    this.location.back();
  }

  // ── Save details ──────────────────────────────────────────────────────────

  async saveDetails(): Promise<void> {
    this.detailsForm.markAllAsTouched();
    if (this.detailsForm.invalid) return;
    this.detailsSaving.set(true);
    this.detailsError.set(null);
    this.detailsSuccess.set(false);
    try {
      const { name, externalId } = this.detailsForm.controls;
      const updated = await this.service.updateSite(this.siteId, {
        Name: name.value,
        ExternalId: externalId.value || null,
      });
      this.site.set(updated);
      this.detailsSuccess.set(true);
      setTimeout(() => this.detailsSuccess.set(false), 3000);
    } catch (err) {
      this.detailsError.set(this.extractApiError(err));
    } finally {
      this.detailsSaving.set(false);
    }
  }

  // ── Create building ───────────────────────────────────────────────────────

  toggleCreateBuilding(): void {
    this.showCreateBuilding.update(v => !v);
    if (!this.showCreateBuilding()) {
      this.createBuildingForm.reset({ name: '', externalId: '', country: '', city: '', street: '', zipCode: '', state: '' });
      this.createBuildingError.set(null);
    }
  }

  async createBuilding(): Promise<void> {
    this.createBuildingForm.markAllAsTouched();
    if (this.createBuildingForm.invalid) return;
    this.createBuildingSaving.set(true);
    this.createBuildingError.set(null);
    try {
      const { name, externalId, country, city, street, zipCode, state } = this.createBuildingForm.controls;
      const hasAddress = country.value || city.value || street.value || zipCode.value || state.value;
      await this.service.registerBuilding({
        Name: name.value,
        ExternalId: externalId.value || null,
        SiteId: this.siteId,
        Address: hasAddress
          ? { Country: country.value, City: city.value, Street: street.value, ZipCode: zipCode.value, State: state.value }
          : null,
      });
      // Refresh site + all buildings so unassigned list and tree are up to date
      const [updatedSite, buildingsPage] = await Promise.all([
        this.service.getSite(this.siteId),
        this.service.getBuildings({ PageSize: 200 }),
      ]);
      this.site.set(updatedSite);
      this.allBuildings.set(buildingsPage.items);
      this.refreshUnassigned(updatedSite, buildingsPage.items);
      this.createBuildingForm.reset({ name: '', externalId: '', country: '', city: '', street: '', zipCode: '', state: '' });
      this.showCreateBuilding.set(false);
    } catch (err) {
      this.createBuildingError.set(this.extractApiError(err));
    } finally {
      this.createBuildingSaving.set(false);
    }
  }

  // ── Assign building ───────────────────────────────────────────────────────

  async assignBuilding(): Promise<void> {
    const buildingId = this.assignBuildingId();
    if (!buildingId) return;
    this.assignSaving.set(true);
    this.assignError.set(null);
    try {
      const updated = await this.service.assignBuildingsToSite(this.siteId, [buildingId]);
      this.site.set(updated);
      this.assignBuildingId.set(null);
      this.refreshUnassigned(updated, this.allBuildings());
    } catch (err) {
      this.assignError.set(this.extractApiError(err));
    } finally {
      this.assignSaving.set(false);
    }
  }

  // ── Remove building ───────────────────────────────────────────────────────

  confirmRemoveBuilding(id: string): void {
    this.removeBuildingError.set(null);
    this.removeBuildingConfirmingId.set(id);
  }

  abortRemoveBuilding(): void {
    this.removeBuildingConfirmingId.set(null);
    this.removeBuildingAction.set(null);
  }

  async executeUnlinkBuilding(building: BuildingDto): Promise<void> {
    this.removeBuildingInProgressId.set(building.id);
    this.removeBuildingAction.set('unlink');
    this.removeBuildingError.set(null);
    try {
      const updated = await this.service.removeBuildingsFromSite(this.siteId, [building.id]);
      this.site.set(updated);
      this.removeBuildingConfirmingId.set(null);
      this.removeBuildingAction.set(null);
      this.refreshUnassigned(updated, this.allBuildings());
    } catch {
      this.removeBuildingError.set(`Failed to unlink "${building.Name}". Please try again.`);
    } finally {
      this.removeBuildingInProgressId.set(null);
    }
  }

  async executeDeleteBuilding(building: BuildingDto): Promise<void> {
    this.removeBuildingInProgressId.set(building.id);
    this.removeBuildingAction.set('delete');
    this.removeBuildingError.set(null);
    try {
      await this.service.deleteBuilding(building.id);
      const [updatedSite, buildingsPage] = await Promise.all([
        this.service.getSite(this.siteId),
        this.service.getBuildings({ PageSize: 200 }),
      ]);
      this.site.set(updatedSite);
      this.allBuildings.set(buildingsPage.items);
      this.removeBuildingConfirmingId.set(null);
      this.removeBuildingAction.set(null);
      this.refreshUnassigned(updatedSite, buildingsPage.items);
    } catch {
      this.removeBuildingError.set(`Failed to delete "${building.Name}". Please try again.`);
    } finally {
      this.removeBuildingInProgressId.set(null);
    }
  }

  // ── Error helper ──────────────────────────────────────────────────────────

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
    return 'An unexpected error occurred. Please try again.';
  }
}
