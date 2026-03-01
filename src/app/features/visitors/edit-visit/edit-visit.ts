import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AutoCompleteModule } from 'primeng/autocomplete';
import type { AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { SelectButtonModule } from 'primeng/selectbutton';
import {
  VisitorService,
  VisitDto,
  VisitorDto,
  VisitorInvitationDto,
  VisitorInputDto,
  VisitorRole,
  OrganizerDto,
  LocationDto,
  buildFilter,
} from '../services/visitor-service';
import { toLocalIso, fromServerDate } from '../../../shared/utils/date-utils';
import { VisitStateBadge } from '../../../shared/components/visit-state-badge/visit-state-badge';
import { CheckinStatusBadge } from '../../../shared/components/checkin-status-badge/checkin-status-badge';
import { VisitorTimeline } from '../../../shared/components/visitor-timeline/visitor-timeline';

@Component({
  selector: 'app-edit-visit',
  standalone: true,
  imports: [ReactiveFormsModule, AutoCompleteModule, ButtonModule, DatePickerModule, InputTextModule, SelectButtonModule, VisitStateBadge, CheckinStatusBadge, VisitorTimeline],
  templateUrl: './edit-visit.html',
})
export class EditVisit implements OnInit {
  private fb = inject(FormBuilder);
  private visitorService = inject(VisitorService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly visit = signal<VisitDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  readonly locationSuggestions = signal<LocationDto[]>([]);

  form!: FormGroup;

  // ── Add-person panel state ────────────────────────────────────────────────

  readonly addPersonOpen = signal(false);
  readonly addPersonSaving = signal(false);
  readonly addPersonError = signal<string | null>(null);
  readonly addPersonKnown = signal(false);
  readonly addPersonSuggestions = signal<VisitorDto[]>([]);

  addPersonForm!: FormGroup;

  readonly roleOptions: { label: string; value: VisitorRole }[] = [
    { label: 'Organizer',    value: 'Organizer' },
    { label: 'Visitor',      value: 'Visitor' },
    { label: 'Participant',  value: 'Participant' },
  ];

  // ── Derived state ────────────────────────────────────────────────────────

  /** True when the visit's end time (or start if no end) is in the past. */
  readonly isPast = computed(() => {
    const v = this.visit();
    if (!v) return false;
    const ref = v.end ?? v.start;
    return ref ? new Date(ref) < new Date() : false;
  });

  readonly organizers = computed<OrganizerDto[]>(() =>
    this.visit()?.organizers ?? []
  );

  readonly invitedOrganizers = computed<VisitorInvitationDto[]>(() =>
    (this.visit()?.visitorInvitations ?? []).filter(i => i.role === 'Organizer')
  );

  readonly invitedVisitors = computed<VisitorInvitationDto[]>(() =>
    (this.visit()?.visitorInvitations ?? []).filter(i => i.role === 'Visitor')
  );

  readonly invitedParticipants = computed<VisitorInvitationDto[]>(() =>
    (this.visit()?.visitorInvitations ?? []).filter(i => i.role === 'Participant')
  );

  readonly totalInvitations = computed(() =>
    this.visit()?.visitorInvitations?.length ?? 0
  );

  // ── Lifecycle ────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.form = this.fb.group({
      summary: ['', Validators.required],
      start: [null as Date | null, Validators.required],
      end: [null as Date | null, Validators.required],
      location: [null],
    });

    this.addPersonForm = this.fb.group({
      email:        ['', [Validators.required, Validators.email]],
      firstName:    ['', Validators.required],
      lastName:     [''],
      company:      [''],
      licensePlate: [''],
      role:         ['Visitor' as VisitorRole],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('No visit ID provided.');
      this.loading.set(false);
      return;
    }

    try {
      const v = await this.visitorService.getVisitById(id);
      this.visit.set(v);
      this.patchForm(v);
    } catch {
      this.error.set('Failed to load visit.');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async save(): Promise<void> {
    if (this.isPast() || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.visit();
    if (!v) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const { summary, start, end, location } = this.form.value as {
      summary: string;
      start: Date;
      end: Date;
      location: LocationDto | null;
    };

    const startIso = toLocalIso(start);
    const endIso = toLocalIso(end);
    const locationId = location?.id ?? null;

    try {
      const timesChanged = startIso !== v.start || endIso !== v.end;
      const locationChanged = locationId !== (v.location?.id ?? null);
      const summaryChanged = summary !== v.summary;

      const updates: Promise<VisitDto>[] = [];

      if (timesChanged || summaryChanged) {
        updates.push(this.visitorService.rescheduleVisit(v.id, { start: startIso, end: endIso }));
      }

      if (locationChanged) {
        updates.push(this.visitorService.relocateVisit(v.id, { locationId }));
      }

      if (updates.length === 0) {
        this.saveSuccess.set(true);
        this.saving.set(false);
        return;
      }

      const results = await Promise.all(updates);
      const updated = results[results.length - 1];
      this.visit.set(updated);
      this.patchForm(updated);
      this.saveSuccess.set(true);

      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch {
      this.saveError.set('Failed to save changes. Please try again.');
    } finally {
      this.saving.set(false);
    }
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

  goBack(): void {
    this.router.navigate(['/visitors']);
  }

  navigateToOnboarding(inv: VisitorInvitationDto): void {
    const visitId = this.visit()?.id;
    if (!visitId) return;
    this.router.navigate(['/visitors/onboarding', visitId, inv.visitor.id]);
  }

  // ── Add-person actions ───────────────────────────────────────────────────

  openAddPerson(): void {
    this.addPersonForm.reset({ role: 'Visitor' });
    this.addPersonError.set(null);
    this.addPersonKnown.set(false);
    this.addPersonSuggestions.set([]);
    this.addPersonOpen.set(true);
  }

  closeAddPerson(): void {
    this.addPersonOpen.set(false);
    this.addPersonError.set(null);
    this.addPersonKnown.set(false);
    this.addPersonSuggestions.set([]);
    this.addPersonForm.reset({ role: 'Visitor' });
  }

  async searchVisitors(event: AutoCompleteCompleteEvent): Promise<void> {
    const query = event.query.trim();
    if (query.length < 2) {
      this.addPersonSuggestions.set([]);
      return;
    }

    try {
      const result = await this.visitorService.getAllVisitors({
        Filter: buildFilter({ op: 'or', filters: [
          { key: 'Email',     op: 'contains', value: query },
          { key: 'FirstName', op: 'contains', value: query },
          { key: 'LastName',  op: 'contains', value: query },
        ]}),
        PageSize: 10,
      });
      this.addPersonSuggestions.set(result.items);
    } catch {
      this.addPersonSuggestions.set([]);
    }
  }

  selectVisitor(visitor: VisitorDto): void {
    this.addPersonKnown.set(true);
    this.addPersonForm.patchValue({
      email:        visitor.email,
      firstName:    visitor.firstName ?? '',
      lastName:     visitor.lastName ?? '',
      company:      visitor.company ?? '',
      licensePlate: visitor.licensePlate ?? '',
    });
  }

  visitorSuggestionLabel(v: VisitorDto): string {
    const name = [v.firstName, v.lastName].filter(Boolean).join(' ');
    return name ? `${name} (${v.email})` : v.email;
  }

  isAddPersonInvalid(field: string): boolean {
    const ctrl = this.addPersonForm.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  async addPerson(): Promise<void> {
    this.addPersonForm.markAllAsTouched();
    if (this.addPersonForm.invalid) return;

    const v = this.visit();
    if (!v) return;

    this.addPersonSaving.set(true);
    this.addPersonError.set(null);

    const { email, firstName, lastName, company, licensePlate, role } =
      this.addPersonForm.value as {
        email: string; firstName: string; lastName: string;
        company: string; licensePlate: string; role: VisitorRole;
      };

    const payload: VisitorInputDto = {
      email:        email.trim(),
      firstName:    firstName.trim(),
      lastName:     lastName?.trim() || null,
      company:      company?.trim() || null,
      licensePlate: licensePlate?.trim() || null,
      phone:        null,
      visitorId:    null,
      tenantId:     null,
      attributes:   null,
      role,
    };

    try {
      const updated = await this.visitorService.addRemoveVisitors(v.id, {
        visitorsToAdd: [payload],
        visitorsToRemoveEmails: [],
      });
      this.visit.set(updated);
      this.closeAddPerson();
    } catch {
      this.addPersonError.set('Failed to add person. Please try again.');
    } finally {
      this.addPersonSaving.set(false);
    }
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

  organizerFullName(o: OrganizerDto): string {
    return [o.firstName, o.lastName].filter(Boolean).join(' ');
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private patchForm(v: VisitDto): void {
    this.form.patchValue({
      summary: v.summary ?? '',
      start: v.start ? fromServerDate(v.start) : null,
      end: v.end ? fromServerDate(v.end) : null,
      location: v.location ?? null,
    });

    // Lock the form for past visits
    if (this.isPast()) {
      this.form.disable();
    }
  }
}

