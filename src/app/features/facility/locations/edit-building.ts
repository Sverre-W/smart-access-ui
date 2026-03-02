import { Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LocationService,
  BuildingDto,
  RoomDto,
} from '../services/location-service';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-building',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, FormsModule, ButtonModule, InputTextModule, CheckboxModule],
  templateUrl: './edit-building.html',
})
export class EditBuilding implements OnInit {
  private service = inject(LocationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  private buildingId = '';

  // ── Data ──────────────────────────────────────────────────────────────────

  readonly building = signal<BuildingDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Details form ──────────────────────────────────────────────────────────

  readonly detailsForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    externalId: [''],
    country: [''],
    city: [''],
    street: [''],
    zipCode: [''],
    state: [''],
  });

  readonly detailsSaving = signal(false);
  readonly detailsSuccess = signal(false);
  readonly detailsError = signal<string | null>(null);

  // ── Create room ───────────────────────────────────────────────────────────

  readonly showCreateRoom = signal(false);

  readonly createRoomForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    externalId: [''],
    capacity: [null as number | null],
    floorNumber: [null as number | null],
    floorLabel: [''],
    isWheelChairAccessible: [false],
  });

  readonly createRoomSaving = signal(false);
  readonly createRoomError = signal<string | null>(null);

  // ── Delete room ───────────────────────────────────────────────────────────

  readonly deleteRoomConfirmingId = signal<string | null>(null);
  readonly deleteRoomInProgressId = signal<string | null>(null);
  readonly deleteRoomError = signal<string | null>(null);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.buildingId = this.route.snapshot.paramMap.get('buildingId') ?? '';
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const building = await this.service.getBuilding(this.buildingId);
      this.building.set(building);
      this.detailsForm.patchValue({
        name: building.Name,
        externalId: building.ExternalId ?? '',
        country: building.Address?.Country ?? '',
        city: building.Address?.City ?? '',
        street: building.Address?.Street ?? '',
        zipCode: building.Address?.ZipCode ?? '',
        state: building.Address?.State ?? '',
      });
    } catch {
      this.error.set('Failed to load building. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  goBack(): void {
    void this.router.navigate(['/facility/locations']);
  }

  // ── Save details ──────────────────────────────────────────────────────────

  async saveDetails(): Promise<void> {
    this.detailsForm.markAllAsTouched();
    if (this.detailsForm.invalid) return;
    this.detailsSaving.set(true);
    this.detailsError.set(null);
    this.detailsSuccess.set(false);
    try {
      const { name, externalId, country, city, street, zipCode, state } = this.detailsForm.controls;
      const hasAddress = country.value || city.value || street.value || zipCode.value || state.value;
      const updated = await this.service.updateBuilding(this.buildingId, {
        Name: name.value,
        ExternalId: externalId.value || null,
        Address: hasAddress
          ? {
              Country: country.value,
              City: city.value,
              Street: street.value,
              ZipCode: zipCode.value,
              State: state.value,
            }
          : null,
      });
      this.building.set(updated);
      this.detailsSuccess.set(true);
      setTimeout(() => this.detailsSuccess.set(false), 3000);
    } catch (err) {
      this.detailsError.set(this.extractApiError(err));
    } finally {
      this.detailsSaving.set(false);
    }
  }

  // ── Create room ───────────────────────────────────────────────────────────

  toggleCreateRoom(): void {
    this.showCreateRoom.update(v => !v);
    if (!this.showCreateRoom()) {
      this.createRoomForm.reset({ name: '', externalId: '', capacity: null, floorNumber: null, floorLabel: '', isWheelChairAccessible: false });
      this.createRoomError.set(null);
    }
  }

  async createRoom(): Promise<void> {
    this.createRoomForm.markAllAsTouched();
    if (this.createRoomForm.invalid) return;
    this.createRoomSaving.set(true);
    this.createRoomError.set(null);
    try {
      const { name, externalId, capacity, floorNumber, floorLabel, isWheelChairAccessible } =
        this.createRoomForm.controls;
      await this.service.registerRoom({
        Name: name.value,
        ExternalId: externalId.value || null,
        BuildingId: this.buildingId,
        Capacity: capacity.value ?? null,
        FloorNumber: floorNumber.value ?? null,
        FloorLabel: floorLabel.value || null,
        IsWheelChairAccessible: isWheelChairAccessible.value,
      });
      // Refresh the building to get updated rooms list
      const refreshed = await this.service.getBuilding(this.buildingId);
      this.building.set(refreshed);
      this.createRoomForm.reset({ name: '', externalId: '', capacity: null, floorNumber: null, floorLabel: '', isWheelChairAccessible: false });
      this.showCreateRoom.set(false);
    } catch (err) {
      this.createRoomError.set(this.extractApiError(err));
    } finally {
      this.createRoomSaving.set(false);
    }
  }

  // ── Delete room ───────────────────────────────────────────────────────────

  confirmDeleteRoom(id: string): void {
    this.deleteRoomError.set(null);
    this.deleteRoomConfirmingId.set(id);
  }

  abortDeleteRoom(): void {
    this.deleteRoomConfirmingId.set(null);
  }

  async executeDeleteRoom(room: RoomDto): Promise<void> {
    this.deleteRoomInProgressId.set(room.id);
    this.deleteRoomError.set(null);
    try {
      await this.service.deleteRoom(room.id);
      const refreshed = await this.service.getBuilding(this.buildingId);
      this.building.set(refreshed);
      this.deleteRoomConfirmingId.set(null);
    } catch {
      this.deleteRoomError.set(`Failed to delete "${room.Name}". Please try again.`);
    } finally {
      this.deleteRoomInProgressId.set(null);
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
