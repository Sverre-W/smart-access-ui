import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  LocationService,
  SiteDto,
  BuildingDto,
  ParkingDto,
} from '../services/location-service';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PaginatorModule } from 'primeng/paginator';
import type { PaginatorState } from 'primeng/paginator';
import { PermissionsService } from '../../../core/services/permissions-service';

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

@Component({
  selector: 'app-facility-locations',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, ButtonModule, InputTextModule, PaginatorModule, TranslateModule],
  templateUrl: './locations.html',
})
export class FacilityLocations implements OnInit {
  private service = inject(LocationService);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);
  private permissions = inject(PermissionsService);

  readonly canWriteLocations = computed(() => this.permissions.hasPermission('Locations Service', 'Locations:Create'));

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly sites = signal<SiteDto[]>([]);
  readonly parkings = signal<ParkingDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Sites pagination ──────────────────────────────────────────────────────

  readonly sitesFirst = signal(0);
  readonly sitesPageSize = signal(DEFAULT_PAGE_SIZE);
  readonly sitesTotalRecords = signal(0);
  readonly sitesLoading = signal(false);
  readonly sitesPageSizeOptions = PAGE_SIZE_OPTIONS;

  // ── Expanded rows ─────────────────────────────────────────────────────────

  /** Set of site IDs whose buildings are expanded. */
  readonly expandedSites = signal<Set<string>>(new Set());
  /** Set of building IDs whose rooms are expanded. */
  readonly expandedBuildings = signal<Set<string>>(new Set());
  /** Cache of fully-loaded buildings (with rooms) keyed by building ID. */
  readonly loadedBuildings = signal<Map<string, BuildingDto>>(new Map());
  /** Building IDs currently being fetched. */
  readonly buildingsLoading = signal<Set<string>>(new Set());

  // ── Create site ───────────────────────────────────────────────────────────

  readonly createSiteOpen = signal(false);
  readonly createSiteSaving = signal(false);
  readonly createSiteError = signal<string | null>(null);

  readonly createSiteForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    externalId: [''],
  });

  // ── Create parking ────────────────────────────────────────────────────────

  readonly createParkingOpen = signal(false);
  readonly createParkingSaving = signal(false);
  readonly createParkingError = signal<string | null>(null);

  readonly createParkingForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    externalId: [''],
    capacity: this.fb.control<number | null>(null),
  });

  // ── Delete site ───────────────────────────────────────────────────────────

  readonly deleteSiteConfirmingId = signal<string | null>(null);
  readonly deleteSiteInProgressId = signal<string | null>(null);
  readonly deleteSiteError = signal<string | null>(null);

  // ── Delete parking ────────────────────────────────────────────────────────

  readonly deleteParkingConfirmingId = signal<string | null>(null);
  readonly deleteParkingInProgressId = signal<string | null>(null);
  readonly deleteParkingError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [sitesPage, parkingsPage] = await Promise.all([
        this.service.getSites({ Page: 0, PageSize: this.sitesPageSize() }),
        this.service.getParkings({ PageSize: 200 }),
      ]);
      this.sites.set(sitesPage.items);
      this.sitesTotalRecords.set(sitesPage.totalItems ?? sitesPage.items.length);
      this.parkings.set(parkingsPage.items);
    } catch {
      this.error.set(this.translate.instant('facility.locations.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadSites(firstOffset: number): Promise<void> {
    this.sitesLoading.set(true);
    const size = this.sitesPageSize();
    const page = Math.floor(firstOffset / size);
    try {
      const result = await this.service.getSites({ Page: page, PageSize: size });
      this.sites.set(result.items);
      this.sitesTotalRecords.set(result.totalItems ?? result.items.length);
    } catch {
      this.error.set(this.translate.instant('facility.locations.loadSitesError'));
    } finally {
      this.sitesLoading.set(false);
    }
  }

  async onSitesPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    const newRows = event.rows ?? this.sitesPageSize();
    if (newRows !== this.sitesPageSize()) {
      this.sitesPageSize.set(newRows);
      this.sitesFirst.set(0);
      await this.loadSites(0);
    } else {
      this.sitesFirst.set(newFirst);
      await this.loadSites(newFirst);
    }
  }

  // ── Tree expansion ────────────────────────────────────────────────────────

  toggleSite(siteId: string): void {
    this.expandedSites.update(set => {
      const next = new Set(set);
      next.has(siteId) ? next.delete(siteId) : next.add(siteId);
      return next;
    });
  }

  isSiteExpanded(siteId: string): boolean {
    return this.expandedSites().has(siteId);
  }

  toggleBuilding(buildingId: string): void {
    this.expandedBuildings.update(set => {
      const next = new Set(set);
      next.has(buildingId) ? next.delete(buildingId) : next.add(buildingId);
      return next;
    });
    // Fetch full building (with rooms) on first expand
    if (this.expandedBuildings().has(buildingId) && !this.loadedBuildings().has(buildingId)) {
      void this.fetchBuilding(buildingId);
    }
  }

  private async fetchBuilding(buildingId: string): Promise<void> {
    this.buildingsLoading.update(set => new Set(set).add(buildingId));
    try {
      const building = await this.service.getBuilding(buildingId);
      this.loadedBuildings.update(map => new Map(map).set(buildingId, building));
    } catch {
      // silently ignore — rooms just won't show
    } finally {
      this.buildingsLoading.update(set => {
        const next = new Set(set);
        next.delete(buildingId);
        return next;
      });
    }
  }

  isBuildingExpanded(buildingId: string): boolean {
    return this.expandedBuildings().has(buildingId);
  }

  isBuildingLoading(buildingId: string): boolean {
    return this.buildingsLoading().has(buildingId);
  }

  getRooms(buildingId: string): BuildingDto['Rooms'] {
    return this.loadedBuildings().get(buildingId)?.Rooms ?? [];
  }

  // ── Create site ───────────────────────────────────────────────────────────

  openCreateSite(): void {
    this.createSiteForm.reset();
    this.createSiteError.set(null);
    this.createSiteOpen.set(true);
  }

  closeCreateSite(): void {
    this.createSiteOpen.set(false);
  }

  async saveCreateSite(): Promise<void> {
    this.createSiteForm.markAllAsTouched();
    if (this.createSiteForm.invalid) return;
    this.createSiteSaving.set(true);
    this.createSiteError.set(null);
    try {
      const { name, externalId } = this.createSiteForm.controls;
      await this.service.registerSite({
        Name: name.value,
        ExternalId: externalId.value || null,
      });
      this.createSiteOpen.set(false);
      // Reload first page so the new item is visible
      this.sitesFirst.set(0);
      await this.loadSites(0);
    } catch (err) {
      this.createSiteError.set(this.extractApiError(err));
    } finally {
      this.createSiteSaving.set(false);
    }
  }

  // ── Create parking ────────────────────────────────────────────────────────

  openCreateParking(): void {
    this.createParkingForm.reset();
    this.createParkingError.set(null);
    this.createParkingOpen.set(true);
  }

  closeCreateParking(): void {
    this.createParkingOpen.set(false);
  }

  async saveCreateParking(): Promise<void> {
    this.createParkingForm.markAllAsTouched();
    if (this.createParkingForm.invalid) return;
    this.createParkingSaving.set(true);
    this.createParkingError.set(null);
    try {
      const { name, externalId, capacity } = this.createParkingForm.controls;
      const created = await this.service.registerParking({
        Name: name.value,
        ExternalId: externalId.value || null,
        Capacity: capacity.value ?? null,
      });
      this.parkings.update(list =>
        [...list, created].sort((a, b) => a.Name.localeCompare(b.Name))
      );
      this.createParkingOpen.set(false);
    } catch (err) {
      this.createParkingError.set(this.extractApiError(err));
    } finally {
      this.createParkingSaving.set(false);
    }
  }

  // ── Delete site ───────────────────────────────────────────────────────────

  confirmDeleteSite(id: string): void {
    this.deleteSiteError.set(null);
    this.deleteSiteConfirmingId.set(id);
  }

  abortDeleteSite(): void {
    this.deleteSiteConfirmingId.set(null);
  }

  async executeDeleteSite(site: SiteDto): Promise<void> {
    this.deleteSiteInProgressId.set(site.id);
    this.deleteSiteError.set(null);
    try {
      await this.service.deleteSite(site.id);
      this.deleteSiteConfirmingId.set(null);
      // Step back a page if we just deleted the only item on a non-first page
      const newTotal = this.sitesTotalRecords() - 1;
      const size = this.sitesPageSize();
      const currentFirst = this.sitesFirst();
      const safeFirst = currentFirst > 0 && currentFirst >= newTotal
        ? Math.max(0, currentFirst - size)
        : currentFirst;
      this.sitesFirst.set(safeFirst);
      await this.loadSites(safeFirst);
    } catch {
      this.deleteSiteError.set(this.translate.instant('facility.locations.deleteError', { name: site.Name }));
    } finally {
      this.deleteSiteInProgressId.set(null);
    }
  }

  // ── Delete parking ────────────────────────────────────────────────────────

  confirmDeleteParking(id: string): void {
    this.deleteParkingError.set(null);
    this.deleteParkingConfirmingId.set(id);
  }

  abortDeleteParking(): void {
    this.deleteParkingConfirmingId.set(null);
  }

  async executeDeleteParking(parking: ParkingDto): Promise<void> {
    this.deleteParkingInProgressId.set(parking.id);
    this.deleteParkingError.set(null);
    try {
      await this.service.deleteParking(parking.id);
      this.parkings.update(list => list.filter(p => p.id !== parking.id));
      this.deleteParkingConfirmingId.set(null);
    } catch {
      this.deleteParkingError.set(this.translate.instant('facility.locations.deleteError', { name: parking.Name }));
    } finally {
      this.deleteParkingInProgressId.set(null);
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
