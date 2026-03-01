import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import {
  VisitorService,
  LocationDto,
  OrganizerDto,
  buildFilter,
} from '../services/visitor-service';
import { toLocalIso } from '../../../shared/utils/date-utils';

@Component({
  selector: 'app-create-visit',
  standalone: true,
  imports: [ReactiveFormsModule, AutoCompleteModule, ButtonModule, DatePickerModule, InputTextModule],
  templateUrl: './create-visit.html',
})
export class CreateVisit implements OnInit {
  private fb = inject(FormBuilder);
  private visitorService = inject(VisitorService);
  private router = inject(Router);
  private oauthService = inject(OAuthService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly locationSuggestions = signal<LocationDto[]>([]);
  readonly organizerSuggestions = signal<OrganizerDto[]>([]);

  readonly today = new Date();

  form!: FormGroup;

  ngOnInit(): void {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    this.form = this.fb.group({
      summary: ['', Validators.required],
      organizer: [null, Validators.required],
      start: [now, Validators.required],
      end: [oneHourLater, Validators.required],
      location: [null],
    });

    // Pre-search with the logged-in user's email so their name appears immediately
    const email = this.oauthService.getIdentityClaims()?.['email'] as string | undefined;
    if (email) {
      this.loadOrganizers(email);
    }
  }

  async searchOrganizers(event: AutoCompleteCompleteEvent): Promise<void> {
    await this.loadOrganizers(event.query.trim());
  }

  async searchLocations(event: AutoCompleteCompleteEvent): Promise<void> {
    const query = event.query.trim();
    if (!query) {
      this.locationSuggestions.set([]);
      return;
    }

    try {
      const result = await this.visitorService.getAllLocations({
        Filter: buildFilter({ op: 'and', filters: [{ key: 'Name', op: 'contains', value: query }] }),
        PageSize: 20,
      });
      this.locationSuggestions.set(result.items);
    } catch {
      this.locationSuggestions.set([]);
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const { summary, organizer, start, end, location } = this.form.value as {
      summary: string;
      organizer: OrganizerDto;
      start: Date;
      end: Date;
      location: LocationDto | null;
    };

    try {
      const visit = await this.visitorService.scheduleVisit({
        visitId: null,
        visitors: [
          {
            visitorId: organizer.id,
            email: organizer.email,
            firstName: organizer.firstName,
            lastName: organizer.lastName ?? null,
            company: organizer.company ?? null,
            phone: organizer.phone ?? null,
            licensePlate: null,
            role: 'Organizer',
            attributes: null,
            tenantId: organizer.tenant ?? null,
          },
        ],
        summary,
        start: toLocalIso(start),
        end: toLocalIso(end),
        locationId: location?.id ?? null,
        invitationId: null,
        invitationModified: null,
        attributes: null,
        parkingAvailable: false,
        tenantId: null,
      });

      this.router.navigate(['/visitors/edit', visit.id]);
    } catch {
      this.error.set('Failed to create the visit. Please try again.');
      this.saving.set(false);
    }
  }

  cancel(): void {
    this.router.navigate(['/visitors']);
  }

  organizerLabel(o: OrganizerDto): string {
    const name = [o.firstName, o.lastName].filter(Boolean).join(' ');
    return name || o.email;
  }

  locationMeta(loc: LocationDto): string {
    const parts: string[] = [loc.type];
    if (loc.floorLabel) parts.push(loc.floorLabel);
    else if (loc.floorNumber != null) parts.push(`Floor ${loc.floorNumber}`);
    if (loc.capacity != null) parts.push(`Cap. ${loc.capacity}`);
    return parts.join(' · ');
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  private async loadOrganizers(query: string): Promise<void> {
    try {
      const results = await this.visitorService.getOrganizersByDateRange();
      const q = query.toLowerCase();
      const filtered = results.filter(o =>
        o.email.toLowerCase().includes(q) ||
        o.firstName.toLowerCase().includes(q) ||
        (o.lastName ?? '').toLowerCase().includes(q),
      );
      this.organizerSuggestions.set(filtered);
    } catch {
      this.organizerSuggestions.set([]);
    }
  }
}
