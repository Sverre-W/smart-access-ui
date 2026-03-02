import { Component, inject, input, output, signal, computed, effect, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { VisitorService, LocationDto } from '../../../features/visitors/services/visitor-service';

@Component({
  selector: 'app-location-picker',
  standalone: true,
  imports: [FormsModule, SelectModule],
  templateUrl: './location-picker.html',
})
export class LocationPicker implements OnInit {
  private visitorService = inject(VisitorService);

  /** Pre-select a location on load (edit mode). */
  readonly initialLocation = input<LocationDto | null>(null);

  /** When true, all buttons and the room dropdown are non-interactive. */
  readonly disabled = input(false);

  /** Emits the most specific selected location (Room > Building > Site), or null. */
  readonly locationChange = output<LocationDto | null>();

  // ── All locations fetched once ───────────────────────────────────────────
  private readonly allLocations = signal<LocationDto[]>([]);
  readonly loading = signal(false);

  // ── Derived lists (filtered in-memory) ───────────────────────────────────
  readonly sites = computed(() =>
    this.allLocations().filter(l => l.type === 'Site')
  );

  readonly buildings = computed(() => {
    const siteId = this.selectedSite()?.id;
    if (!siteId) return [];
    return this.allLocations().filter(l => l.type === 'Building' && l.parent?.id === siteId);
  });

  readonly rooms = computed(() => {
    const buildingId = this.selectedBuilding()?.id;
    if (!buildingId) return [];
    return this.allLocations().filter(l => l.type === 'Room' && l.parent?.id === buildingId);
  });

  // ── Selection state ───────────────────────────────────────────────────────
  readonly selectedSite = signal<LocationDto | null>(null);
  readonly selectedBuilding = signal<LocationDto | null>(null);
  readonly selectedRoom = signal<LocationDto | null>(null);

  readonly selectedLocation = computed<LocationDto | null>(
    () => this.selectedRoom() ?? this.selectedBuilding() ?? this.selectedSite()
  );

  constructor() {
    // Emit whenever selection changes
    effect(() => {
      this.locationChange.emit(this.selectedLocation());
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.visitorService.getAllLocations({ PageSize: 1000 });
      this.allLocations.set(result.items);
    } catch {
      this.allLocations.set([]);
    } finally {
      this.loading.set(false);
    }

    const initial = this.initialLocation();
    if (initial) {
      this.restoreFromLocation(initial);
    }
  }

  selectSite(site: LocationDto): void {
    if (this.disabled()) return;

    if (this.selectedSite()?.id === site.id) {
      this.selectedSite.set(null);
      this.selectedBuilding.set(null);
      this.selectedRoom.set(null);
      return;
    }

    this.selectedSite.set(site);
    this.selectedBuilding.set(null);
    this.selectedRoom.set(null);
  }

  selectBuilding(building: LocationDto): void {
    if (this.disabled()) return;

    if (this.selectedBuilding()?.id === building.id) {
      this.selectedBuilding.set(null);
      this.selectedRoom.set(null);
      return;
    }

    this.selectedBuilding.set(building);
    this.selectedRoom.set(null);
  }

  /** Two-way binding bridge for the room p-select (ngModel requires a plain property). */
  get selectedRoomModel(): LocationDto | null {
    return this.selectedRoom();
  }
  set selectedRoomModel(room: LocationDto | null) {
    this.selectedRoom.set(room);
  }

  roomLabel(room: LocationDto): string {
    const parts: string[] = [room.name];
    if (room.floorLabel) parts.push(room.floorLabel);
    else if (room.floorNumber != null) parts.push(`Floor ${room.floorNumber}`);
    if (room.capacity != null) parts.push(`Cap. ${room.capacity}`);
    return parts.join(' · ');
  }

  /**
   * Reconstructs Site → Building → Room selection from a saved LocationDto.
   * Resolves the full hierarchy using parent?.id from the flat allLocations list.
   */
  private restoreFromLocation(location: LocationDto): void {
    const all = this.allLocations();
    const find = (id: string | undefined | null) => all.find(l => l.id === id) ?? null;

    if (location.type === 'Room') {
      const room = find(location.id) ?? location;
      const building = find(room.parent?.id);
      const site = building ? find(building.parent?.id) : null;
      this.selectedSite.set(site);
      this.selectedBuilding.set(building);
      this.selectedRoom.set(room);
    } else if (location.type === 'Building') {
      const building = find(location.id) ?? location;
      const site = find(building.parent?.id);
      this.selectedSite.set(site);
      this.selectedBuilding.set(building);
      this.selectedRoom.set(null);
    } else if (location.type === 'Site') {
      this.selectedSite.set(find(location.id) ?? location);
      this.selectedBuilding.set(null);
      this.selectedRoom.set(null);
    }
  }
}
