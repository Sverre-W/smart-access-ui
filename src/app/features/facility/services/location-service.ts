import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../../core/services/config-service';

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface LocationsListRequest {
  Filter?: string | null;
  Sort?: string | null;
  SortDir?: SortOrder;
  Page?: number;
  PageSize?: number;
}

export enum SortOrder {
  Asc = 0,
  Desc = 1,
}

export interface Page<T> {
  currentPage: number;
  totalPages: number | null;
  pageSize: number;
  totalItems: number | null;
  items: T[];
  isLastPage: boolean;
}

// ─── Address ──────────────────────────────────────────────────────────────────

export interface AddressDto {
  Country: string;
  City: string;
  Street: string;
  ZipCode: string;
  State: string;
}

// ─── Sites ────────────────────────────────────────────────────────────────────

export interface SiteDto {
  id: string;
  Name: string;
  ExternalId: string | null;
  Buildings: BuildingDto[];
  Parkings: ParkingDto[];
}

export interface SiteInputDto {
  Name: string;
  ExternalId?: string | null;
}

// ─── Buildings ────────────────────────────────────────────────────────────────

export interface BuildingDto {
  id: string;
  Name: string;
  ExternalId: string | null;
  Address: AddressDto | null;
  Site: SiteDto | null;
  Rooms: RoomDto[];
}

export interface BuildingInputDto {
  Name: string;
  ExternalId?: string | null;
  SiteId?: string | null;
  Address?: AddressDto | null;
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export interface RoomDto {
  id: string;
  Name: string;
  ExternalId: string | null;
  Building: BuildingDto | null;
  EmailAddress: string | null;
  Capacity: number | null;
  FloorNumber: number | null;
  FloorLabel: string | null;
  IsWheelChairAccessible: boolean | null;
}

export interface RoomInputDto {
  Name: string;
  ExternalId?: string | null;
  BuildingId?: string | null;
  Capacity?: number | null;
  FloorNumber?: number | null;
  FloorLabel?: string | null;
  IsWheelChairAccessible?: boolean | null;
}

// ─── Parkings ─────────────────────────────────────────────────────────────────

export interface ParkingDto {
  id: string;
  Name: string;
  ExternalId: string | null;
  Address: AddressDto | null;
  Site: SiteDto | null;
  Capacity: number | null;
}

export interface ParkingInputDto {
  Name: string;
  ExternalId?: string | null;
  SiteId?: string | null;
  Address?: AddressDto | null;
  Capacity?: number | null;
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
export class LocationService {
  private baseUrl: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.baseUrl = this.config.getModule('Locations')?.baseEndpoint ?? '';
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Sites ─────────────────────────────────────────────────────────────────

  /** List all sites with optional filtering and pagination. */
  getSites(params?: LocationsListRequest): Promise<Page<SiteDto>> {
    return firstValueFrom(
      this.http.get<Page<SiteDto>>(this.url('/api/v1/sites'), { params: toParams(params) })
    );
  }

  /** Get a specific site by ID, including its buildings and parkings. */
  getSite(siteId: string): Promise<SiteDto> {
    return firstValueFrom(this.http.get<SiteDto>(this.url(`/api/v1/sites/${siteId}`)));
  }

  /** Register a new site. */
  registerSite(body: SiteInputDto): Promise<SiteDto> {
    return firstValueFrom(this.http.post<SiteDto>(this.url('/api/v1/sites'), body));
  }

  /** Update an existing site. */
  updateSite(siteId: string, body: SiteInputDto): Promise<SiteDto> {
    return firstValueFrom(this.http.put<SiteDto>(this.url(`/api/v1/sites/${siteId}`), body));
  }

  /** Delete a site. */
  deleteSite(siteId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/api/v1/sites/${siteId}`)));
  }

  /** Assign buildings to a site. */
  assignBuildingsToSite(siteId: string, buildingIds: string[]): Promise<SiteDto> {
    return firstValueFrom(
      this.http.post<SiteDto>(this.url(`/api/v1/sites/${siteId}/assign-buildings`), null, {
        params: toParams({ buildingIds }),
      })
    );
  }

  /** Remove buildings from a site. */
  removeBuildingsFromSite(siteId: string, buildingIds: string[]): Promise<SiteDto> {
    return firstValueFrom(
      this.http.post<SiteDto>(this.url(`/api/v1/sites/${siteId}/remove-buildings`), null, {
        params: toParams({ buildingIds }),
      })
    );
  }

  // ── Buildings ─────────────────────────────────────────────────────────────

  /** List all buildings with optional filtering and pagination. */
  getBuildings(params?: LocationsListRequest): Promise<Page<BuildingDto>> {
    return firstValueFrom(
      this.http.get<Page<BuildingDto>>(this.url('/api/v1/buildings'), { params: toParams(params) })
    );
  }

  /** Get a specific building by ID, including its rooms and parent site. */
  getBuilding(buildingId: string): Promise<BuildingDto> {
    return firstValueFrom(
      this.http.get<BuildingDto>(this.url(`/api/v1/buildings/${buildingId}`))
    );
  }

  /** Register a new building. */
  registerBuilding(body: BuildingInputDto): Promise<BuildingDto> {
    return firstValueFrom(this.http.post<BuildingDto>(this.url('/api/v1/buildings'), body));
  }

  /** Update an existing building. */
  updateBuilding(buildingId: string, body: BuildingInputDto): Promise<BuildingDto> {
    return firstValueFrom(
      this.http.put<BuildingDto>(this.url(`/api/v1/buildings/${buildingId}`), body)
    );
  }

  /** Delete a building. */
  deleteBuilding(buildingId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/api/v1/buildings/${buildingId}`)));
  }

  /** Assign rooms to a building. */
  assignRoomsToBuilding(buildingId: string, roomIds: string[]): Promise<BuildingDto> {
    return firstValueFrom(
      this.http.post<BuildingDto>(
        this.url(`/api/v1/buildings/${buildingId}/assign-rooms`),
        null,
        { params: toParams({ roomIds }) }
      )
    );
  }

  /** Remove rooms from a building. */
  removeRoomsFromBuilding(buildingId: string, roomIds: string[]): Promise<BuildingDto> {
    return firstValueFrom(
      this.http.post<BuildingDto>(
        this.url(`/api/v1/buildings/${buildingId}/remove-rooms`),
        null,
        { params: toParams({ roomIds }) }
      )
    );
  }

  // ── Rooms ─────────────────────────────────────────────────────────────────

  /** List all rooms with optional filtering and pagination. */
  getRooms(params?: LocationsListRequest): Promise<Page<RoomDto>> {
    return firstValueFrom(
      this.http.get<Page<RoomDto>>(this.url('/api/v1/rooms'), { params: toParams(params) })
    );
  }

  /** Get a specific room by ID, including its parent building. */
  getRoom(roomId: string): Promise<RoomDto> {
    return firstValueFrom(this.http.get<RoomDto>(this.url(`/api/v1/rooms/${roomId}`)));
  }

  /** Search rooms from the remote provider (e.g. for initial import). */
  getRoomsRemote(params?: LocationsListRequest): Promise<Page<RoomDto>> {
    return firstValueFrom(
      this.http.get<Page<RoomDto>>(this.url('/api/v1/rooms-remote'), { params: toParams(params) })
    );
  }

  /** Register a new room. */
  registerRoom(body: RoomInputDto): Promise<RoomDto> {
    return firstValueFrom(this.http.post<RoomDto>(this.url('/api/v1/rooms'), body));
  }

  /** Update an existing room. */
  updateRoom(roomId: string, body: RoomInputDto): Promise<RoomDto> {
    return firstValueFrom(this.http.put<RoomDto>(this.url(`/api/v1/rooms/${roomId}`), body));
  }

  /** Delete a room. */
  deleteRoom(roomId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/api/v1/rooms/${roomId}`)));
  }

  // ── Parkings ──────────────────────────────────────────────────────────────

  /** List all parkings with optional filtering and pagination. */
  getParkings(params?: LocationsListRequest): Promise<Page<ParkingDto>> {
    return firstValueFrom(
      this.http.get<Page<ParkingDto>>(this.url('/api/v1/parkings'), { params: toParams(params) })
    );
  }

  /** Get a specific parking by ID. */
  getParking(parkingId: string): Promise<ParkingDto> {
    return firstValueFrom(this.http.get<ParkingDto>(this.url(`/api/v1/parkings/${parkingId}`)));
  }

  /** Register a new parking. */
  registerParking(body: ParkingInputDto): Promise<ParkingDto> {
    return firstValueFrom(this.http.post<ParkingDto>(this.url('/api/v1/parkings'), body));
  }

  /** Update an existing parking. */
  updateParking(parkingId: string, body: ParkingInputDto): Promise<ParkingDto> {
    return firstValueFrom(
      this.http.put<ParkingDto>(this.url(`/api/v1/parkings/${parkingId}`), body)
    );
  }

  /** Delete a parking. */
  deleteParking(parkingId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/api/v1/parkings/${parkingId}`)));
  }
}
