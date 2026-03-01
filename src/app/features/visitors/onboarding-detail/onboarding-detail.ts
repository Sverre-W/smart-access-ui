import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import {
  VisitorService,
  VisitDto,
  VisitorInvitationDto,
  VisitorOnboardingImageDto,
} from '../services/visitor-service';
import { VisitStateBadge } from '../../../shared/components/visit-state-badge/visit-state-badge';
import { VisitorTimeline } from '../../../shared/components/visitor-timeline/visitor-timeline';
import { formatLocalDateTime } from '../../../shared/utils/date-utils';

@Component({
  selector: 'app-onboarding-detail',
  standalone: true,
  imports: [RouterLink, ButtonModule, VisitStateBadge, VisitorTimeline],
  templateUrl: './onboarding-detail.html',
})
export class OnboardingDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private visitorService = inject(VisitorService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly visit = signal<VisitDto | null>(null);
  readonly invitation = signal<VisitorInvitationDto | null>(null);
  readonly onboardingImages = signal<VisitorOnboardingImageDto[]>([]);
  readonly imagesLoading = signal(false);

  // The selected image for lightbox-style preview
  readonly previewImage = signal<VisitorOnboardingImageDto | null>(null);

  readonly visitorFullName = computed(() => {
    const inv = this.invitation();
    if (!inv) return '';
    const v = inv.visitor;
    return [v.firstName, v.lastName].filter(Boolean).join(' ');
  });

  readonly visitDateRange = computed(() => {
    const v = this.visit();
    if (!v) return '';
    const start = formatLocalDateTime(v.start);
    const end = formatLocalDateTime(v.end);
    if (!v.start && !v.end) return '—';
    if (!v.end) return start;
    return `${start} – ${end}`;
  });

  async ngOnInit(): Promise<void> {
    const visitId = this.route.snapshot.paramMap.get('visitId');
    const visitorId = this.route.snapshot.paramMap.get('visitorId');

    if (!visitId || !visitorId) {
      this.error.set('Invalid route parameters.');
      this.loading.set(false);
      return;
    }

    try {
      // Load the visit (which contains all visitorInvitations)
      const visit = await this.visitorService.getVisitById(visitId);
      this.visit.set(visit);

      // Extract the specific invitation for this visitor
      const inv = (visit.visitorInvitations ?? []).find(
        i => i.visitor.id === visitorId
      ) ?? null;

      if (!inv) {
        this.error.set('Visitor not found on this visit.');
        this.loading.set(false);
        return;
      }

      this.invitation.set(inv);
    } catch {
      this.error.set('Failed to load onboarding details.');
    } finally {
      this.loading.set(false);
    }

    // Load onboarding images in parallel (non-critical)
    this.loadOnboardingImages(visitId, visitorId);
  }

  private async loadOnboardingImages(visitId: string, visitorId: string): Promise<void> {
    this.imagesLoading.set(true);
    try {
      const images = await this.visitorService.getVisitorOnboardingImages({ visitId, visitorId });
      this.onboardingImages.set(images);
    } catch {
      // Non-critical — leave empty
    } finally {
      this.imagesLoading.set(false);
    }
  }

  openPreview(img: VisitorOnboardingImageDto): void {
    this.previewImage.set(img);
  }

  closePreview(): void {
    this.previewImage.set(null);
  }

  goBack(): void {
    const visitId = this.visit()?.id;
    if (visitId) {
      this.router.navigate(['/visitors/edit', visitId]);
    } else {
      this.router.navigate(['/visitors']);
    }
  }

  formatDate(iso: string | null): string {
    return formatLocalDateTime(iso);
  }

  imageLabel(img: VisitorOnboardingImageDto): string {
    return img.imageType
      ? img.imageType.charAt(0).toUpperCase() + img.imageType.slice(1).toLowerCase()
      : 'Document';
  }
}
