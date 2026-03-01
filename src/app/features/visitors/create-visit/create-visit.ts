import { Component, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import {
  VisitorService,
  LocationDto,
  buildFilter,
} from '../services/visitor-service';

@Component({
  selector: 'app-create-visit',
  standalone: true,
  imports: [ReactiveFormsModule, AutoCompleteModule, DatePickerModule, InputTextModule],
  templateUrl: './create-visit.html',
})
export class CreateVisit implements OnInit {
  private fb = inject(FormBuilder);
  private visitorService = inject(VisitorService);
  private router = inject(Router);

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly locationSuggestions = signal<LocationDto[]>([]);

  readonly today = new Date();

  form!: FormGroup;

  ngOnInit(): void {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

    this.form = this.fb.group({
      summary: ['', Validators.required],
      start: [now, Validators.required],
      end: [oneHourLater, Validators.required],
      location: [null],
    });
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

    const { summary, start, end, location } = this.form.value as {
      summary: string;
      start: Date;
      end: Date;
      location: LocationDto | null;
    };

    try {
      const visit = await this.visitorService.scheduleVisit({
        visitId: null,
        visitors: [],
        summary,
        start: start.toISOString(),
        end: end.toISOString(),
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
}
