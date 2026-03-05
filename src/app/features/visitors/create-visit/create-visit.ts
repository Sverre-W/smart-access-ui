import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import {
  VisitorService,
  LocationDto,
  OrganizerDto,
} from '../services/visitor-service';
import { toLocalIso } from '../../../shared/utils/date-utils';
import { LocationPicker } from '../../../shared/components/location-picker/location-picker';

@Component({
  selector: 'app-create-visit',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, AutoCompleteModule, ButtonModule, DatePickerModule, InputTextModule, LocationPicker, TranslateModule],
  templateUrl: './create-visit.html',
})
export class CreateVisit implements OnInit {
  private fb = inject(FormBuilder);
  private visitorService = inject(VisitorService);
  private router = inject(Router);
  private oauthService = inject(OAuthService);
  private translate = inject(TranslateService);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly organizerSuggestions = signal<OrganizerDto[]>([]);

  private selectedLocation = signal<LocationDto | null>(null);

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
    });

    // When start changes, push end to start + 1h if end would be before start
    this.form.get('start')!.valueChanges.subscribe((start: Date | null) => {
      if (!start) return;
      const end: Date | null = this.form.get('end')!.value;
      if (!end || end <= start) {
        this.form.get('end')!.setValue(new Date(start.getTime() + 60 * 60 * 1000));
      }
    });

    // Pre-search with the logged-in user's email and auto-select if found
    const email = this.oauthService.getIdentityClaims()?.['email'] as string | undefined;
    if (email) {
      this.loadOrganizers(email, /* autoSelect */ true);
    }
  }

  async searchOrganizers(event: AutoCompleteCompleteEvent): Promise<void> {
    await this.loadOrganizers(event.query.trim());
  }

  onLocationChange(location: LocationDto | null): void {
    this.selectedLocation.set(location);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const { summary, organizer, start, end } = this.form.value as {
      summary: string;
      organizer: OrganizerDto;
      start: Date;
      end: Date;
    };

    const locationId = this.selectedLocation()?.id ?? null;

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
        locationId: locationId,
        invitationId: null,
        invitationModified: null,
        attributes: null,
        parkingAvailable: false,
        tenantId: null,
      });

      this.router.navigate(['/visitors/edit', visit.id]);
    } catch {
      this.error.set(this.translate.instant('visitors.createVisit.createError'));
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

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  private async loadOrganizers(query: string, autoSelect = false): Promise<void> {
    try {
      const results = await this.visitorService.getOrganizersByDateRange();
      const q = query.toLowerCase();
      const filtered = results.filter(o =>
        o.email.toLowerCase().includes(q) ||
        o.firstName.toLowerCase().includes(q) ||
        (o.lastName ?? '').toLowerCase().includes(q),
      );
      this.organizerSuggestions.set(filtered);

      if (autoSelect) {
        const exact = filtered.find(o => o.email.toLowerCase() === q);
        if (exact) {
          this.form.get('organizer')!.setValue(exact);
        }
      }
    } catch {
      this.organizerSuggestions.set([]);
    }
  }
}
