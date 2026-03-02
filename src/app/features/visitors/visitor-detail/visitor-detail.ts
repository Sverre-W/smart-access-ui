import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule } from 'primeng/paginator';
import type { PaginatorState } from 'primeng/paginator';
import {
  VisitorService,
  VisitorDto,
  VisitDto,
} from '../services/visitor-service';
import { VisitStateBadge } from '../../../shared/components/visit-state-badge/visit-state-badge';
import { formatLocalDateTime } from '../../../shared/utils/date-utils';

const VISITS_PAGE_SIZE = 10;

@Component({
  selector: 'app-visitor-detail',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslateModule, InputTextModule, ButtonModule, PaginatorModule, VisitStateBadge],
  templateUrl: './visitor-detail.html',
})
export class VisitorDetail implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private visitorService = inject(VisitorService);
  private translate = inject(TranslateService);

  // ── Visitor ──────────────────────────────────────────────────────────────
  readonly visitor = signal<VisitorDto | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // ── Edit form ─────────────────────────────────────────────────────────────
  form!: FormGroup;
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  // ── Visit history ─────────────────────────────────────────────────────────
  readonly visits = signal<VisitDto[]>([]);
  readonly visitsLoading = signal(false);
  readonly visitsFirst = signal(0);
  readonly visitsTotalRecords = signal(0);
  readonly visitsPageSize = VISITS_PAGE_SIZE;

  readonly hasVisits = computed(() => this.visits().length > 0);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set(this.translate.instant('visitors.visitorDetail.idNotFound'));
      this.loading.set(false);
      return;
    }

    this.form = this.fb.group({
      firstName: [''],
      lastName: [''],
      email: [''],
      company: [''],
      phone: [''],
      licensePlate: [''],
    });

    try {
      const v = await this.visitorService.getVisitorById(id);
      this.visitor.set(v);
      this.patchForm(v);
    } catch {
      this.error.set(this.translate.instant('visitors.visitorDetail.loadError'));
    } finally {
      this.loading.set(false);
    }

    await this.loadVisits(0);
  }

  async save(): Promise<void> {
    const v = this.visitor();
    if (!v) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const { firstName, lastName, email, company, phone, licensePlate } =
      this.form.value as Record<string, string>;

    try {
      const updated = await this.visitorService.updateVisitorById(v.id, {
        firstName: firstName || null,
        lastName: lastName || null,
        email: email || null,
        company: company || null,
        phone: phone || null,
        licensePlate: licensePlate || null,
      });
      // updateVisitorById returns VisitDto but we need to re-fetch the visitor
      // to keep local state in sync — fall back to patching what we sent
      this.visitor.update(prev => prev
        ? { ...prev, firstName, lastName, email, company, phone, licensePlate }
        : prev
      );
      this.saveSuccess.set(true);
      setTimeout(() => this.saveSuccess.set(false), 3000);
    } catch {
      this.saveError.set(this.translate.instant('visitors.visitorDetail.saveError'));
    } finally {
      this.saving.set(false);
    }
  }

  async onVisitsPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    this.visitsFirst.set(newFirst);
    await this.loadVisits(newFirst);
  }

  goBack(): void {
    this.router.navigate(['/visitors/list']);
  }

  fullName(v: VisitorDto): string {
    return [v.firstName, v.lastName].filter(Boolean).join(' ');
  }

  formatDate(iso: string | null): string {
    return formatLocalDateTime(iso);
  }

  private patchForm(v: VisitorDto): void {
    this.form.patchValue({
      firstName: v.firstName ?? '',
      lastName: v.lastName ?? '',
      email: v.email ?? '',
      company: v.company ?? '',
      phone: v.phone ?? '',
      licensePlate: v.licensePlate ?? '',
    });
  }

  private async loadVisits(firstOffset: number): Promise<void> {
    const v = this.visitor();
    if (!v) return;

    this.visitsLoading.set(true);
    const page = Math.floor(firstOffset / VISITS_PAGE_SIZE);

    try {
      const result = await this.visitorService.getAllVisitsOfVisitor(v.id, {
        Page: page,
        PageSize: VISITS_PAGE_SIZE,
        Sort: 'Start',
        SortDir: 'Desc',
      });
      this.visits.set(result.items);
      this.visitsTotalRecords.set(result.totalItems ?? result.items.length);
    } catch {
      // Non-critical — leave visits empty
    } finally {
      this.visitsLoading.set(false);
    }
  }
}
