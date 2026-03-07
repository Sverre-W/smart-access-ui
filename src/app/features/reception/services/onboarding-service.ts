import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../../core/services/config-service';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum BadgeAssignmentTiming {
  OnVisitorCreation = 'OnVisitorCreation',
  OnVisitorConfirmation = 'OnVisitorConfirmation',
  OnVisitorOnboarding = 'OnVisitorOnboarding',
}

/** @deprecated Use `selfOnboardingEnabled` and `guidedOnboardingEnabled` instead. */
export enum OnboardingMode {
  SelfOnboarding = 'SelfOnboarding',
  GuidedOnboarding = 'GuidedOnboarding',
}

export enum OnboardingDataType {
  Photo = 'Photo',
  IDCard = 'IDCard',
  Image = 'Image',
  Page = 'Page',
}

export enum OnboardingStepType {
  SendInvitationEmail = 'SendInvitationEmail',
  SendReminderEmail = 'SendReminderEmail',
  SendCheckInConfirmationEmail = 'SendCheckInConfirmationEmail',
  ProvisionAccess = 'ProvisionAccess',
  DeprovisionAccess = 'DeprovisionAccess',
  PrintBadge = 'PrintBadge',
  CapturePhoto = 'CapturePhoto',
  CaptureIdDocument = 'CaptureIdDocument',
  Custom = 'Custom',
}

export enum StepTriggerEvent {
  SessionCreated = 'SessionCreated',
  VisitorConfirmed = 'VisitorConfirmed',
  CheckInCompleted = 'CheckInCompleted',
  CheckOutCompleted = 'CheckOutCompleted',
  SessionCancelled = 'SessionCancelled',
  Manual = 'Manual',
  Scheduled = 'Scheduled',
}

export enum StepExecutionStatus {
  Pending = 'Pending',
  Running = 'Running',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Skipped = 'Skipped',
  Compensated = 'Compensated',
}

export enum OnboardingSessionState {
  NotStarted = 'NotStarted',
  InProgress = 'InProgress',
  CheckedIn = 'CheckedIn',
  CheckedOut = 'CheckedOut',
  Completed = 'Completed',
  NoShow = 'NoShow',
  Cancelled = 'Cancelled',
  Expired = 'Expired',
}

export enum VisitorConfirmationStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  Tentative = 'Tentative',
  Declined = 'Declined',
}

export enum CheckInMethod {
  SelfService = 'SelfService',
  Assisted = 'Assisted',
  Manual = 'Manual',
}

export enum ArrivalStatus {
  Expected = 'Expected',
  OnTime = 'OnTime',
  Early = 'Early',
  Late = 'Late',
}

export enum DocumentType {
  Photo = 'Photo',
  IdScan = 'IdScan',
  PassportScan = 'PassportScan',
  DriversLicense = 'DriversLicense',
}

export enum CaptureMethod {
  SelfService = 'SelfService',
  Assisted = 'Assisted',
}

export enum CheckOutMethod {
  SelfService = 'SelfService',
  Assisted = 'Assisted',
  Automatic = 'Automatic',
}

export enum AccessGrantStatus {
  Pending = 'Pending',
  Provisioned = 'Provisioned',
  ProvisioningFailed = 'ProvisioningFailed',
  Deprovisioned = 'Deprovisioned',
  DeprovisioningFailed = 'DeprovisioningFailed',
}

export enum ProvisioningTrigger {
  VisitCreated = 'VisitCreated',
  VisitorConfirmed = 'VisitorConfirmed',
  CheckInCompleted = 'CheckInCompleted',
}

export enum DeprovisionTrigger {
  Manual = 'Manual',
  VisitCancelled = 'VisitCancelled',
  CheckOut = 'CheckOut',
  VisitEndTimePassed = 'VisitEndTimePassed',
  NoShow = 'NoShow',
}

export enum PhaseType {
  PreVisit = 'PreVisit',
  Arrival = 'Arrival',
  OnSite = 'OnSite',
  Departure = 'Departure',
  PostVisit = 'PostVisit',
}

export enum TriggerType {
  Event = 'Event',
  Time = 'Time',
  Manual = 'Manual',
  Conditional = 'Conditional',
}

export enum TimeAnchor {
  VisitStart = 'VisitStart',
  VisitEnd = 'VisitEnd',
  VisitCreated = 'VisitCreated',
  VisitConfirmed = 'VisitConfirmed',
  CheckInTime = 'CheckInTime',
  CheckOutTime = 'CheckOutTime',
}

export enum TimeUnit {
  Minutes = 'Minutes',
  Hours = 'Hours',
  Days = 'Days',
  Weeks = 'Weeks',
}

export enum RetryStrategy {
  None = 'None',
  FixedDelay = 'FixedDelay',
  ExponentialBackoff = 'ExponentialBackoff',
}

export enum StepDependencyType {
  MustCompleteFirst = 'MustCompleteFirst',
}

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface LabelPrintingConfiguration {
  enabled: boolean;
  printerId: string | null;
}

export interface OnboardingData {
  label: string;
  dataType: OnboardingDataType;
  required: boolean;
}

export interface OnboardingSettings {
  badgeType: string;
  systemId: string;
  badgeAssignmentTiming: BadgeAssignmentTiming;
  accessLevelForVisitorCreation: string | null;
  accessLevelForVisitorConfirmation: string | null;
  accessLevelForVisitorOnboarding: string | null;
  /** @deprecated Use `selfOnboardingEnabled` and `guidedOnboardingEnabled` instead. */
  onboardingMode: OnboardingMode | null;
  selfOnboardingEnabled: boolean;
  guidedOnboardingEnabled: boolean;
  requiredOnboardingData: OnboardingData[];
  labelPrintingConfiguration: LabelPrintingConfiguration | null;
  onboardedMessages: string[];
  wiegandPrefix: string;
  wiegandSuffix: string;
}

export interface AvailableStepDto {
  stepType: OnboardingStepType;
  displayName: string;
  description: string;
  category: string;
  version: string;
  schema: string | null;
  defaultConfiguration: string;
  supportedTriggerEvents: StepTriggerEvent[];
}

export interface StepConfigurationSchemaDto {
  stepType: OnboardingStepType;
  schema: string | null;
}

export interface StepExecutionDto {
  id: string;
  sessionId: string;
  stepConfigurationId: string;
  stepType: OnboardingStepType;
  status: StepExecutionStatus;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  resultData: string | null;
}

export interface TriggerStepRequest {
  stepType: OnboardingStepType;
}

export interface VisitorDocumentDto {
  id: string;
  visitId: string;
  visitorId: string;
  checkInId: string;
  documentType: DocumentType;
  filePath: string;
  capturedAt: string;
  capturedByUserId: string | null;
  captureMethod: CaptureMethod;
  captureDeviceId: string | null;
  watermarked: boolean;
  softDeletedAt: string | null;
  hardDeleteScheduledAt: string | null;
  flaggedForRetention: boolean;
  retentionExtensionReason: string | null;
}

export interface CheckInDto {
  id: string;
  visitId: string;
  visitorId: string;
  checkedInAt: string;
  method: CheckInMethod;
  deviceId: string | null;
  checkedInByUserId: string | null;
  arrivalStatus: ArrivalStatus;
  minutesEarlyOrLate: number;
  qrCodeScanned: boolean;
  documentsComplete: boolean;
  overrideApplied: boolean;
  overrideReason: string | null;
  manualCheckInReason: string | null;
  isUndone: boolean;
  undoneReason: string | null;
  undoneAt: string | null;
  documents: VisitorDocumentDto[];
}

export interface CheckOutDto {
  id: string;
  visitId: string;
  visitorId: string;
  checkInId: string;
  checkedOutAt: string;
  method: CheckOutMethod;
  deviceId: string | null;
  checkedOutByUserId: string | null;
  visitDurationMinutes: number;
  isOverstay: boolean;
  notes: string | null;
}

export interface AccessGrantDto {
  id: string;
  visitId: string;
  visitorId: string;
  status: AccessGrantStatus;
  provisioningTrigger: ProvisioningTrigger;
  provisionedAt: string | null;
  pacsCredentialId: string | null;
  accessStart: string;
  accessEnd: string;
  provisioningRetryCount: number;
  provisioningLastError: string | null;
  deprovisionTrigger: DeprovisionTrigger | null;
  deprovisionReason: string | null;
  deprovisionRequestedAt: string | null;
  deprovisionedAt: string | null;
  deprovisioningRetryCount: number;
  deprovisioningLastError: string | null;
  deprovisioningFailed: boolean;
}

export interface OnboardingSessionDto {
  id: string;
  visitId: string;
  visitorId: string;
  tenantId: string | null;
  visitStart: string;
  visitEnd: string;
  state: OnboardingSessionState;
  confirmationStatus: VisitorConfirmationStatus;
  confirmedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  licensePlate: string | null;
  mealPreference: string | null;
  qrCodeData: string | null;
  qrCodeValidFrom: string;
  qrCodeExpiresAt: string;
  cancellationReason: string | null;
  cancelledAt: string | null;
  checkIn: CheckInDto | null;
  checkOut: CheckOutDto | null;
  accessGrant: AccessGrantDto | null;
}

export interface RetryPolicyDto {
  maxAttempts: number;
  strategy: RetryStrategy;
  initialDelaySeconds: number;
  maxDelaySeconds: number | null;
  backoffMultiplier: number;
}

export interface OnboardingProgressStepDto {
  stepConfigurationId: string;
  stepType: OnboardingStepType;
  displayName: string | null;
  isOptional: boolean;
  isEnabled: boolean;
  order: number;
  retryPolicy: RetryPolicyDto | null;
  executions: StepExecutionDto[];
}

export interface OnboardingProgressPhaseDto {
  phaseId: string;
  name: string;
  phaseType: PhaseType;
  order: number;
  executeInParallel: boolean;
  steps: OnboardingProgressStepDto[];
}

export interface OnboardingProgressDto {
  session: OnboardingSessionDto | null;
  phases: OnboardingProgressPhaseDto[];
}

export interface OnboardingProgressParams {
  visitId?: string;
  visitorId?: string;
}

export interface RelativeTimeDto {
  anchor: TimeAnchor;
  offset: number;
  unit: TimeUnit;
}

export interface TriggerDefinitionDto {
  type: TriggerType;
  eventType: StepTriggerEvent | null;
  relativeTime: RelativeTimeDto | null;
  allowedRoles: string[] | null;
  conditionExpression: string | null;
}

export interface StepDependencyDto {
  dependsOnStepId: string;
  type: StepDependencyType;
}

export interface StepConfigurationDto {
  id: string;
  phaseId: string;
  stepType: OnboardingStepType;
  stepVersion: string;
  displayName: string | null;
  isOptional: boolean;
  isEnabled: boolean;
  trigger: TriggerDefinitionDto | null;
  order: number;
  notes: string | null;
  timeoutSeconds: number | null;
  retryPolicy: RetryPolicyDto | null;
  dependencies: StepDependencyDto[];
  parameters: string;
}

export interface OnboardingPhaseDto {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  phaseType: PhaseType;
  order: number;
  executeInParallel: boolean;
  continueOnOptionalFailure: boolean;
  trigger: TriggerDefinitionDto;
  steps: StepConfigurationDto[];
}

export interface OnboardingTemplateDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  tenantId: string | null;
  phases: OnboardingPhaseDto[];
  templateVersion: number;
  createdAt: string | null;
  modifiedAt: string | null;
}

export interface CreateTemplateRequest {
  name: string;
  description: string | null;
}

export interface UpdateTemplateRequest {
  name: string;
  description: string | null;
}

export interface AddPhaseRequest {
  name: string;
  description: string | null;
  phaseType: PhaseType;
  order: number;
  trigger: TriggerDefinitionDto;
  executeInParallel: boolean;
  continueOnOptionalFailure: boolean;
}

export interface UpdatePhaseRequest {
  name: string;
  description: string | null;
  phaseType: PhaseType;
  executeInParallel: boolean;
  continueOnOptionalFailure: boolean;
  order: number;
  trigger: TriggerDefinitionDto;
}

export interface AddStepRequest {
  stepType: OnboardingStepType;
  trigger: TriggerDefinitionDto | null;
  order: number;
  isOptional: boolean;
  isEnabled: boolean;
  maxRetries: number;
  retryStrategy: RetryStrategy;
  initialDelaySeconds: number;
  maxDelaySeconds: number;
  backoffMultiplier: number;
  timeoutSeconds: number | null;
  displayName: string | null;
  notes: string | null;
  stepVersion: string;
  parameters: string | null;
}

export interface UpdateStepRequest {
  trigger: TriggerDefinitionDto | null;
  order: number;
  isOptional: boolean;
  isEnabled: boolean;
  maxRetries: number;
  retryStrategy: RetryStrategy;
  initialDelaySeconds: number;
  maxDelaySeconds: number;
  backoffMultiplier: number;
  timeoutSeconds: number | null;
  displayName: string | null;
  notes: string | null;
  stepVersion: string;
  parameters: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Builds HttpParams, skipping null/undefined values. */
function toParams(query?: object | null): HttpParams {
  if (!query) return new HttpParams();
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null) continue;
    params = params.set(key, String(value));
  }
  return params;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class OnboardingService {
  private baseUrl: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.baseUrl = this.config.getModule('Onboarding')?.baseEndpoint ?? '';
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Config ────────────────────────────────────────────────────────────────

  /** Retrieve the onboarding configuration for the current tenant. */
  getOnboardingSettings(): Promise<OnboardingSettings> {
    return firstValueFrom(this.http.get<OnboardingSettings>(this.url('/api/v1/config')));
  }

  /** Store or replace the onboarding configuration for the current tenant. */
  storeOnboardingSettings(body: OnboardingSettings): Promise<OnboardingSettings> {
    return firstValueFrom(this.http.post<OnboardingSettings>(this.url('/api/v1/config'), body));
  }

  // ── Steps ─────────────────────────────────────────────────────────────────

  /** List all registered step types with their metadata and default configuration. */
  getAvailableSteps(): Promise<AvailableStepDto[]> {
    return firstValueFrom(this.http.get<AvailableStepDto[]>(this.url('/api/v1/steps')));
  }

  /** Get the JSON Schema describing the configuration parameters for a specific step type. */
  getStepSchema(stepType: OnboardingStepType): Promise<StepConfigurationSchemaDto> {
    return firstValueFrom(
      this.http.get<StepConfigurationSchemaDto>(this.url(`/api/v1/steps/${stepType}/schema`))
    );
  }

  // ── Session ───────────────────────────────────────────────────────────────

  /** Get all step execution records for a given session. */
  getStepExecutions(sessionId: string): Promise<StepExecutionDto[]> {
    return firstValueFrom(
      this.http.get<StepExecutionDto[]>(this.url(`/api/v1/sessions/${sessionId}/steps`))
    );
  }

  /** Manually trigger a step for an onboarding session. Returns the execution ID. */
  triggerStep(sessionId: string, body: TriggerStepRequest): Promise<string> {
    return firstValueFrom(
      this.http.post<string>(this.url(`/api/v1/sessions/${sessionId}/steps/trigger`), body)
    );
  }

  /** Retry a specific failed step execution. Returns the new execution ID. */
  retryStep(sessionId: string, executionId: string): Promise<string> {
    return firstValueFrom(
      this.http.post<string>(
        this.url(`/api/v1/sessions/${sessionId}/steps/${executionId}/retry`),
        null
      )
    );
  }

  /** Get the full onboarding progress for a visit, including phases, steps, and execution history. */
  getOnboardingProgress(params?: OnboardingProgressParams): Promise<OnboardingProgressDto> {
    return firstValueFrom(
      this.http.get<OnboardingProgressDto>(this.url('/api/v1/sessions/progress'), {
        params: toParams(params),
      })
    );
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  /** List all onboarding templates for the current tenant. */
  getAllTemplates(): Promise<OnboardingTemplateDto[]> {
    return firstValueFrom(
      this.http.get<OnboardingTemplateDto[]>(this.url('/api/v1/templates'))
    );
  }

  /** Create a new (inactive) onboarding template. Returns the new template ID. */
  createTemplate(body: CreateTemplateRequest): Promise<string> {
    return firstValueFrom(this.http.post<string>(this.url('/api/v1/templates'), body));
  }

  /** Get a single template by ID. */
  getTemplate(templateId: string): Promise<OnboardingTemplateDto> {
    return firstValueFrom(
      this.http.get<OnboardingTemplateDto>(this.url(`/api/v1/templates/${templateId}`))
    );
  }

  /** Update the name and description of an existing template. */
  updateTemplate(templateId: string, body: UpdateTemplateRequest): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(this.url(`/api/v1/templates/${templateId}`), body)
    );
  }

  /** Permanently remove a template (only allowed when inactive). */
  deleteTemplate(templateId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/api/v1/templates/${templateId}`)));
  }

  /** Activate a template. Deactivates the previously active one. */
  activateTemplate(templateId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.url(`/api/v1/templates/${templateId}/activate`), null)
    );
  }

  /** Deactivate a template. Onboarding steps will not run until a template is active. */
  deactivateTemplate(templateId: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.url(`/api/v1/templates/${templateId}/deactivate`), null)
    );
  }

  /** Create a full deep copy of a template with ' - Copy' appended to the name. Returns the new template ID. */
  cloneTemplate(templateId: string): Promise<string> {
    return firstValueFrom(
      this.http.post<string>(this.url(`/api/v1/templates/${templateId}/clone`), null)
    );
  }

  // ── Phases ────────────────────────────────────────────────────────────────

  /** Add a new phase to an existing template. Returns the new phase ID. */
  addPhase(templateId: string, body: AddPhaseRequest): Promise<string> {
    return firstValueFrom(
      this.http.post<string>(this.url(`/api/v1/templates/${templateId}/phases`), body)
    );
  }

  /** Update the settings of an existing phase. */
  updatePhase(templateId: string, phaseId: string, body: UpdatePhaseRequest): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(this.url(`/api/v1/templates/${templateId}/phases/${phaseId}`), body)
    );
  }

  /** Remove a phase and all its steps from a template. */
  deletePhase(templateId: string, phaseId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/api/v1/templates/${templateId}/phases/${phaseId}`))
    );
  }

  // ── Phase Steps ───────────────────────────────────────────────────────────

  /** Add a step configuration to a phase within a template. Returns the new step ID. */
  addStep(templateId: string, phaseId: string, body: AddStepRequest): Promise<string> {
    return firstValueFrom(
      this.http.post<string>(
        this.url(`/api/v1/templates/${templateId}/phases/${phaseId}/steps`),
        body
      )
    );
  }

  /** Update settings for an existing step within a phase. */
  updateStep(
    templateId: string,
    phaseId: string,
    stepId: string,
    body: UpdateStepRequest
  ): Promise<void> {
    return firstValueFrom(
      this.http.put<void>(
        this.url(`/api/v1/templates/${templateId}/phases/${phaseId}/steps/${stepId}`),
        body
      )
    );
  }

  /** Remove a step configuration from a phase. */
  deleteStep(templateId: string, phaseId: string, stepId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(
        this.url(`/api/v1/templates/${templateId}/phases/${phaseId}/steps/${stepId}`)
      )
    );
  }
}
