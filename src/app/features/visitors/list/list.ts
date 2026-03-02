import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { PaginatorModule } from 'primeng/paginator';
import type { PaginatorState } from 'primeng/paginator';
import { VisitorService, VisitorDto, buildFilter } from '../services/visitor-service';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

@Component({
  selector: 'app-visitors-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InputTextModule, IconField, InputIcon, PaginatorModule, TranslateModule],
  templateUrl: './list.html',
})
export class VisitorsList implements OnInit {
  private visitorService = inject(VisitorService);
  private translate = inject(TranslateService);

  readonly visitors = signal<VisitorDto[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Paginator state — p-paginator uses 0-based `first` offset
  readonly first = signal(0);
  readonly totalRecords = signal(0);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  readonly searchControl = new FormControl('');

  // Debounce handle for search input
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly hasVisitors = computed(() => this.visitors().length > 0);

  async ngOnInit(): Promise<void> {
    await this.load(0);

    this.searchControl.valueChanges.subscribe(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.first.set(0);
        this.load(0);
      }, 350);
    });
  }

  async onPageChange(event: PaginatorState): Promise<void> {
    const newFirst = event.first ?? 0;
    const newRows = event.rows ?? this.pageSize();
    // When page size changes reset to first page
    if (newRows !== this.pageSize()) {
      this.pageSize.set(newRows);
      this.first.set(0);
      await this.load(0);
    } else {
      this.first.set(newFirst);
      await this.load(newFirst);
    }
  }

  fullName(v: VisitorDto): string {
    return [v.firstName, v.lastName].filter(Boolean).join(' ');
  }

  initials(v: VisitorDto): string {
    const f = v.firstName?.[0] ?? '';
    const l = v.lastName?.[0] ?? '';
    return (f + l).toUpperCase() || '?';
  }

  avatarColor(v: VisitorDto): string {
    const hue = [...v.id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `hsl(${hue} 55% 88%)`;
  }

  avatarTextColor(v: VisitorDto): string {
    const hue = [...v.id].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
    return `hsl(${hue} 45% 35%)`;
  }

  private async load(firstOffset: number): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const query = this.searchControl.value?.trim() ?? '';
    const size = this.pageSize();
    const page = Math.floor(firstOffset / size);

    const filter = query
      ? buildFilter({
          op: 'or',
          filters: [
            { key: 'FirstName', op: 'contains', value: query },
            { key: 'LastName', op: 'contains', value: query },
            { key: 'Email', op: 'contains', value: query },
            { key: 'Company', op: 'contains', value: query },
          ],
        })
      : undefined;

    try {
      const result = await this.visitorService.getAllVisitors({
        Filter: filter,
        Page: page,
        PageSize: size,
        Sort: 'LastName',
        SortDir: 'Asc',
      });

      this.visitors.set(result.items);
      this.totalRecords.set(result.totalItems ?? result.items.length);
    } catch {
      this.error.set(this.translate.instant('visitors.list.loadError'));
    } finally {
      this.loading.set(false);
    }
  }
}
