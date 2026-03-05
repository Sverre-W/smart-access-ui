import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../../core/services/config-service';

// ─── Enums ───────────────────────────────────────────────────────────────────

export type VisitState =
  | 'SCHEDULED'
  | 'APPROVED'
  | 'REJECTED'
  | 'LOCKED'
  | 'STARTED'
  | 'FINISHED'
  | 'CANCELED';

export type VisitorRole = 'Participant' | 'Visitor' | 'Organizer';

export type VisitorConfirmation = 'UNKNOWN' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'DELEGATED';

export type VisitorCheckInStatus = 'Expected' | 'Arrived' | 'Late' | 'Left';

export type SortOrder = 'Asc' | 'Desc';

export type LocationType = 'Location' | 'Site' | 'Building' | 'Room' | 'Parking';

export type BadgeAssignmentTiming =
  | 'OnVisitorCreation'
  | 'OnVisitorConfirmation'
  | 'OnVisitorOnboarding';

export type OnboardingMode = 'SelfOnboarding' | 'GuidedOnboarding';

export type OnboardingDataType = 'Photo' | 'IDCard' | 'Image' | 'Page';

export type AdditionalDataType = 'ImageBase64' | 'BadgeId' | 'Text';

// ─── Shared DTOs ─────────────────────────────────────────────────────────────

export interface AttributeDto {
  id: string;
  name: string;
  value: string;
}

export interface AttributeInputDto {
  name: string;
  value: string;
}

export interface BadgeSpecsDto {
  badgeId: string;
  badgeKey: string | null;
  autoId: number | null;
  displayId: string | null;
  badgeType: string;
}

export interface BadgeAssignmentDto {
  assignmentId: string;
  badgeId: string;
  badgeKey: number;
}

export interface PersonIdentityDto {
  data: string;
  id: number;
  type: string;
}

export interface VisitorIdentityDto extends PersonIdentityDto { }

// ─── Location DTOs ───────────────────────────────────────────────────────────

export interface LocationDto {
  id: string;
  name: string;
  locationId: string | null;
  capacity: number | null;
  floorLabel: string | null;
  floorNumber: number | null;
  isWheelChairAccessible: boolean | null;
  type: LocationType;
  parent: LocationDto | null;
}

export interface LocationInputDto {
  id: string;
  name: string;
  locationId: string | null;
  capacity: number | null;
  floorLabel: string | null;
  floorNumber: number | null;
  isWheelChairAccessible: boolean | null;
  type: LocationType;
  parentId: string | null;
}

export interface PageOfLocationDto {
  currentPage: number;
  totalPages: number | null;
  pageSize: number;
  totalItems: number | null;
  items: LocationDto[];
  isLastPage: boolean;
}

// ─── Organizer DTOs ──────────────────────────────────────────────────────────

export interface OrganizerDto {
  id: string;
  attributes: AttributeDto[] | null;
  email: string;
  firstName: string;
  identities: VisitorIdentityDto[] | null;
  lastName: string | null;
  phone: string | null;
  company: string | null;
  tenant: string | null;
}

// ─── Visitor DTOs ─────────────────────────────────────────────────────────────

export interface VisitorDto {
  id: string;
  attributes: AttributeDto[] | null;
  visitorCredentials: BadgeSpecsDto[] | null;
  email: string;
  firstName: string;
  identities: VisitorIdentityDto[] | null;
  lastName: string | null;
  licensePlate: string | null;
  phone: string | null;
  company: string | null;
  tenant: string | null;
  blacklisted: boolean;
  blacklistingReason: string | null;
}

export interface VisitorInputDto {
  attributes: AttributeInputDto[] | null;
  company: string | null;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  licensePlate: string | null;
  visitorId: string | null;
  role: VisitorRole;
  tenantId: string | null;
}

export interface UpdateVisitorByIdRequest {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  licensePlate: string | null;
}

export interface PageOfVisitorDto {
  currentPage: number;
  totalPages: number | null;
  pageSize: number;
  totalItems: number | null;
  items: VisitorDto[];
  isLastPage: boolean;
}

// ─── Visit DTOs ──────────────────────────────────────────────────────────────

export interface VisitorInvitationDto {
  visitor: VisitorDto;
  visit: VisitDto | null;
  role: VisitorRole;
  confirmation: VisitorConfirmation | null;
  parkingRequired: boolean;
  badgeAssignments: BadgeAssignmentDto[] | null;
  confirmationSent: boolean | null;
  confirmationSentOn: string | null;
  onboardedOn: string | null;
  arrivedOn: string | null;
  leftOn: string | null;
  checkInStatus: VisitorCheckInStatus;
}

export interface VisitDto {
  id: string;
  state: VisitState;
  invitationId: string;
  visitorInvitations: VisitorInvitationDto[] | null;
  organizers: OrganizerDto[] | null;
  start: string | null;
  end: string | null;
  approved: boolean | null;
  approvalRequired: boolean | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalComment: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectedComment: string | null;
  lockedAt: string | null;
  profile: string | null;
  tenant: string | null;
  attributes: AttributeDto[] | null;
  location: LocationDto | null;
  canceled: boolean | null;
  reasonToCancel: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  summary: string | null;
  invitationModified: string | null;
  accessLevels: string[] | null;
  parkingAvailable: boolean;
}

export interface VisitInputDto {
  visitId: string | null;
  visitors: VisitorInputDto[];
  start: string;
  end: string;
  summary: string;
  locationId: string | null;
  invitationId: string | null;
  invitationModified: string | null;
  attributes: AttributeInputDto[] | null;
  parkingAvailable: boolean;
  tenantId: string | null;
}

export interface VisitTimesInputDto {
  start: string;
  end: string;
}

export interface VisitLocationInputDto {
  locationId: string | null;
}

export interface VisitVisitorsChangeInputDto {
  visitorsToAdd: VisitorInputDto[];
  visitorsToRemoveEmails: string[];
}

export interface ApproveVisitRequest {
  approvedBy: string;
  comment: string;
}

export interface RejectVisitRequest {
  rejectedBy: string;
  comment: string;
}

export interface VisitCancelRequest {
  reasonToCancel: string;
}

export interface MarkParkingAvailableRequest {
  parkingAvailable: boolean;
}

export interface PageOfVisitDto {
  currentPage: number;
  totalPages: number | null;
  pageSize: number;
  totalItems: number | null;
  items: VisitDto[];
  isLastPage: boolean;
}

// ─── Visitor Invitation DTOs ─────────────────────────────────────────────────

export interface PageOfVisitorInvitationDto {
  currentPage: number;
  totalPages: number | null;
  pageSize: number;
  totalItems: number | null;
  items: VisitorInvitationDto[];
  isLastPage: boolean;
}

export interface ConfirmVisitorRequest {
  visitId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  company: string | null;
  phone: string | null;
  parkingRequired: boolean | null;
  licensePlate: string | null;
  role: VisitorRole | null;
  confirmation: VisitorConfirmation;
}

// ─── Access Control DTOs ─────────────────────────────────────────────────────

export interface OnboardingData {
  label: string;
  dataType: OnboardingDataType;
  required: boolean;
}

export interface LabelPrintingConfiguration {
  enabled: boolean;
  printerId: string | null;
}

export interface TenantBadgeSettings {
  badgeType: string;
  systemId: string;
  badgeAssignmentTiming: BadgeAssignmentTiming;
  accessLevelForVisitorCreation: string | null;
  accessLevelForVisitorConfirmation: string | null;
  accessLevelForVisitorOnboarding: string | null;
  onboardingMode: OnboardingMode | null;
  selfOnboardingEnabled: boolean;
  guidedOnboardingEnabled: boolean;
  requiredOnboardingData: OnboardingData[];
  labelPrintingConfiguration: LabelPrintingConfiguration | null;
  onboardedMessages: string[];
}

export interface AcSystemDto {
  id: string;
  name: string;
}

export interface AcRuleDto {
  id: string;
  name: string;
}

export interface AcBadgeTypeDto {
  id: string;
  name: string;
}

export interface PrinterDto {
  id: string;
  name: string;
}

export interface VisitorTokenAssociationDto {
  id: string;
  visitId: string;
  visitorId: string;
  tenantId: string | null;
  token: string;
  tokenPurpose: string;
  validFrom: string | null;
  expiresAt: string | null;
}

export interface VisitorOnboardingImageDto {
  id: string;
  visitId: string;
  visitorId: string;
  imageType: string;
  base64ImageData: string;
  onboardingDateTime: string;
  tenantId: string | null;
}

export interface LabelDataDto {
  visitId: string;
  visitorId: string;
  badgeId: string;
  faceImageBase64: string;
}

export interface TemplateDataDto {
  template: string;
  purpose: string;
}

export interface VisitorWithAccessDto {
  visitId: string;
  visitorId: string;
  tenantId: string;
  badgeId: string;
}

export interface AdditionalDataDto {
  label: string;
  type: AdditionalDataType;
  data: unknown;
}

export interface VisitorOnboardingDto {
  visitId: string;
  visitorId: string;
  additionalData: Record<string, AdditionalDataDto>;
}

// ─── Query Params ─────────────────────────────────────────────────────────────

// ─── Filter Builder ───────────────────────────────────────────────────────────

export type FilterOp =
  | 'equal'
  | 'notEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'contains'
  | 'startsWith'
  | 'endsWith';

export interface FilterClause {
  key: string;
  op: FilterOp;
  value: string;
}

export interface FilterExpression {
  op: 'and' | 'or';
  filters: FilterClause[];
}

/** Serialises a FilterExpression to the JSON string the API expects in ?Filter= */
export function buildFilter(expression: FilterExpression): string {
  return JSON.stringify(expression);
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface PagedQuery {
  Filter?: string | null;
  Sort?: string | null;
  SortDir?: SortOrder;
  Page?: number;
  PageSize?: number;
}

export interface VisitorsQuery extends PagedQuery {
  Role?: VisitorRole | null;
}

export interface VisitorInvitationsQuery extends PagedQuery {
  Host?: string | null;
}

export interface OrganizersByDateRangeQuery {
  startDate?: string | null;
  endDate?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strips null/undefined values so HttpClient never serialises them as "null"/"undefined". */
function toParams(params?: object | null): Record<string, string> {
  if (!params) return {};
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])
  );
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root',
})
export class VisitorService {

  private visitorBaseUrl: string = "";

  constructor(private http: HttpClient, private config: ConfigService) {
    this.visitorBaseUrl = this.config.getModule("Visitors")?.baseEndpoint ?? "";
  }

  private url(path: string): string {
    return `${this.visitorBaseUrl}${path}`;
  }

  // ── Visits ──────────────────────────────────────────────────────────────────

  getAllVisits(params?: PagedQuery): Promise<PageOfVisitDto> {
    return firstValueFrom(
      this.http.get<PageOfVisitDto>(this.url('/api/v1/visits'), { params: toParams(params) })
    );
  }

  scheduleVisit(body: VisitInputDto): Promise<VisitDto> {
    return firstValueFrom(this.http.post<VisitDto>(this.url('/api/v1/visits'), body));
  }

  getVisitById(visitId: string): Promise<VisitDto> {
    return firstValueFrom(this.http.get<VisitDto>(this.url(`/api/v1/visits/${visitId}`)));
  }

  getVisitByInvitationId(invitationId: string): Promise<VisitDto> {
    return firstValueFrom(
      this.http.get<VisitDto>(this.url(`/api/v1/visits/invitation/${invitationId}`))
    );
  }

  addRemoveVisitors(visitId: string, body: VisitVisitorsChangeInputDto): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/visitors`), body)
    );
  }

  approveVisit(visitId: string, body: ApproveVisitRequest): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/approve`), body)
    );
  }

  rejectVisit(visitId: string, body: RejectVisitRequest): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/reject`), body)
    );
  }

  cancelVisit(visitId: string, body: VisitCancelRequest): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/cancel`), body)
    );
  }

  startVisit(visitId: string, body: VisitTimesInputDto): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/start`), body)
    );
  }

  endVisit(visitId: string): Promise<VisitDto> {
    return firstValueFrom(this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/end`), {}));
  }

  rescheduleVisit(visitId: string, body: VisitTimesInputDto): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/reschedule`), body)
    );
  }

  relocateVisit(visitId: string, body: VisitLocationInputDto): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/relocate`), body)
    );
  }

  markParkingAvailable(visitId: string, body: MarkParkingAvailableRequest): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visits/${visitId}/parking`), body)
    );
  }

  getVisitOrganizers(visitId: string): Promise<string[]> {
    return firstValueFrom(this.http.get<string[]>(this.url(`/api/v1/visits/${visitId}/organizers`)));
  }

  getOrganizersByDateRange(params?: OrganizersByDateRangeQuery): Promise<OrganizerDto[]> {
    return firstValueFrom(
      this.http.get<OrganizerDto[]>(this.url('/api/v1/visits/organizers'), {
        params: toParams(params),
      })
    );
  }

  // ── Visitors ────────────────────────────────────────────────────────────────

  getAllVisitors(params?: VisitorsQuery): Promise<PageOfVisitorDto> {
    return firstValueFrom(
      this.http.get<PageOfVisitorDto>(this.url('/api/v1/visitors'), {
        params: toParams(params),
      })
    );
  }

  getVisitorById(visitorId: string): Promise<VisitorDto> {
    return firstValueFrom(this.http.get<VisitorDto>(this.url(`/api/v1/visitors/${visitorId}`)));
  }

  getVisitorByEmail(email: string): Promise<VisitorDto> {
    return firstValueFrom(this.http.get<VisitorDto>(this.url(`/api/v1/visitors/email/${email}`)));
  }

  updateVisitorById(visitorId: string, body: UpdateVisitorByIdRequest): Promise<VisitDto> {
    return firstValueFrom(this.http.put<VisitDto>(this.url(`/api/v1/visitors/${visitorId}`), body));
  }

  getAllVisitorInvitations(params?: VisitorInvitationsQuery): Promise<PageOfVisitorInvitationDto> {
    return firstValueFrom(
      this.http.get<PageOfVisitorInvitationDto>(this.url('/api/v1/invitations'), {
        params: toParams(params),
      })
    );
  }

  getAllVisitsOfVisitor(visitorId: string, params?: PagedQuery): Promise<PageOfVisitDto> {
    return firstValueFrom(
      this.http.get<PageOfVisitDto>(this.url(`/api/v1/visitors/${visitorId}/visits`), {
        params: toParams(params),
      })
    );
  }

  getOneVisitOfVisitor(visitorId: string, visitId: string): Promise<VisitDto> {
    return firstValueFrom(
      this.http.get<VisitDto>(this.url(`/api/v1/visitors/${visitorId}/visits/${visitId}`))
    );
  }

  getVisitInfoForVisitor(visitorId: string, visitId: string): Promise<VisitDto> {
    return firstValueFrom(
      this.http.get<VisitDto>(this.url(`/api/v1/visitors/${visitorId}/info/visits/${visitId}`))
    );
  }

  announceVisitor(visitorId: string, visitId: string): Promise<VisitDto> {
    return firstValueFrom(
      this.http.get<VisitDto>(this.url(`/api/v1/visitors/${visitorId}/announce/${visitId}`))
    );
  }

  confirmVisitor(
    visitorId: string,
    visitId: string,
    body: ConfirmVisitorRequest
  ): Promise<VisitDto> {
    return firstValueFrom(
      this.http.post<VisitDto>(this.url(`/api/v1/visitors/${visitorId}/confirm/${visitId}`), body)
    );
  }

  checkInVisitor(visitorId: string, visitId: string): Promise<VisitorWithAccessDto> {
    return firstValueFrom(
      this.http.get<VisitorWithAccessDto>(this.url(`/api/v1/visitors/${visitorId}/checkin/${visitId}`))
    );
  }

  // ── Locations ───────────────────────────────────────────────────────────────

  getAllLocations(params?: PagedQuery): Promise<PageOfLocationDto> {
    return firstValueFrom(
      this.http.get<PageOfLocationDto>(this.url('/api/v1/locations'), {
        params: toParams(params),
      })
    );
  }

  registerLocation(body: LocationInputDto): Promise<LocationDto> {
    return firstValueFrom(this.http.post<LocationDto>(this.url('/api/v1/locations'), body));
  }

  getLocationById(locationId: string): Promise<LocationDto> {
    return firstValueFrom(this.http.get<LocationDto>(this.url(`/api/v1/locations/${locationId}`)));
  }

  // ── QR Code ─────────────────────────────────────────────────────────────────

  getQrCode(code: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(this.url('/api/qr'), { params: { code }, responseType: 'blob' })
    );
  }

  visitorCheckedInAsync(url: string): Promise<VisitorWithAccessDto> {
    return firstValueFrom(this.http.get<VisitorWithAccessDto>(url));
  }

  // ── Access Control ───────────────────────────────────────────────────────────

  configureBadgeType(body: TenantBadgeSettings): Promise<TenantBadgeSettings> {
    return firstValueFrom(
      this.http.post<TenantBadgeSettings>(this.url('/api/v1/access/config'), body)
    );
  }

  getBadgeSettings(): Promise<TenantBadgeSettings> {
    return firstValueFrom(this.http.get<TenantBadgeSettings>(this.url('/api/v1/access/config')));
  }

  getAccessControlSystems(): Promise<AcSystemDto[]> {
    return firstValueFrom(this.http.get<AcSystemDto[]>(this.url('/api/v1/acsystems')));
  }

  getAccessControlRules(systemId: string): Promise<AcRuleDto[]> {
    return firstValueFrom(
      this.http.get<AcRuleDto[]>(this.url(`/api/v1/acsystems/${systemId}/rules`))
    );
  }

  getAccessControlBadgeTypes(systemId: string): Promise<AcBadgeTypeDto[]> {
    return firstValueFrom(
      this.http.get<AcBadgeTypeDto[]>(this.url(`/api/v1/acsystems/${systemId}/badgetypes`))
    );
  }

  getAvailablePrinters(): Promise<PrinterDto[]> {
    return firstValueFrom(this.http.get<PrinterDto[]>(this.url('/api/v1/printers')));
  }

  getTokenAssociation(token: string, purpose?: string | null): Promise<VisitorTokenAssociationDto[]> {
    const params: Record<string, string> = {};
    if (purpose) params['purpose'] = purpose;
    return firstValueFrom(
      this.http.get<VisitorTokenAssociationDto[]>(this.url(`/api/v1/token/${token}/association`), { params })
    );
  }

  getVisitorOnboardingImages(params: {
    visitId?: string | null;
    visitorId?: string | null;
  }): Promise<VisitorOnboardingImageDto[]> {
    return firstValueFrom(
      this.http.get<VisitorOnboardingImageDto[]>(this.url('/api/v1/visitors/onboarding/images'), {
        params: toParams(params),
      })
    );
  }

  printLabel(body: LabelDataDto): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.url('/api/v1/visitors/label/print'), body));
  }

  getTemplate(purpose: string): Promise<TemplateDataDto> {
    return firstValueFrom(
      this.http.get<TemplateDataDto>(this.url(`/api/v1/visitors/label/template/${purpose}`))
    );
  }

  addTemplate(body: TemplateDataDto): Promise<TemplateDataDto> {
    return firstValueFrom(
      this.http.post<TemplateDataDto>(this.url('/api/v1/visitors/label/template'), body)
    );
  }

  deleteTemplate(purpose: string): Promise<TemplateDataDto> {
    return firstValueFrom(
      this.http.delete<TemplateDataDto>(this.url(`/api/v1/visitors/label/template/${purpose}`))
    );
  }

  visitorOnboarded(body: VisitorOnboardingDto): Promise<void> {
    return firstValueFrom(this.http.post<void>(this.url('/api/v1/visitors/onboard'), body));
  }
}
