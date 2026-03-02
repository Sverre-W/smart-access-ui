import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../../core/services/config-service';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SystemAgentType {
  Lenel   = 'Lenel',
  Unipass = 'Unipass',
}

export enum SubjectTypes {
  Visitor    = 'Visitor',
  Employee   = 'Employee',
  Contractor = 'Contractor',
}

export enum ParameterType {
  StringValue  = 'StringValue',
  IntegerValue = 'IntegerValue',
  BooleanValue = 'BooleanValue',
}

export enum ValueProviderType {
  VisitorLocation  = 'VisitorLocation',
  BadgeType        = 'BadgeType',
  AssignableAccess = 'AssignableAccess',
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface EntityLink {
  id: string;
  name: string;
}

export interface Page<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number | null;
  totalItems: number | null;
  isLastPage: boolean;
  items: T[];
}

export interface BaseListRequest {
  page?: number;
  pageSize?: number;
  sortAscending?: boolean;
  sortColumn?: string;
}

// ─── Systems ──────────────────────────────────────────────────────────────────

export interface SystemDto {
  id: string;
  name: string;
  agentId: string;
  agentType: SystemAgentType;
}

// Polymorphic system configuration — discriminated by $type

export interface UnipassSystemConfigurationDto {
  $type: 'UnipassSystemConfigurationDto';
  badgeTypes: UnipassBadgeTypeDto[];
  accessAssignments: UnipassAccessAssignmentDto[];
}

export interface LenelConfigurationDto {
  $type: 'LenelConfigurationDto';
}

export type ISystemConfigurationDto = UnipassSystemConfigurationDto | LenelConfigurationDto;

export interface UnipassBadgeTypeDto {
  id: string;
  name: string;
  startOfRange: number;
  endOfRange: number;
}

export interface UnipassAccessAssignmentDto {
  id: string;
  name: string;
  canonicalAccessRule: EntityLink;
  canonicalSite: EntityLink;
}

// Polymorphic system metadata — discriminated by $type

export interface UnipassMetaDataDto {
  $type: 'UnipassMetaDataDto';
  canonicalAccessRules: EntityLink[];
  canonicalSites: EntityLink[];
}

export type ISystemMetadataConfigurationDto = UnipassMetaDataDto;

// Identity mappings

export interface IdentityDto {
  id: string;
  firstName: string;
  lastName: string;
  externalId: string;
}

// Request DTOs

export interface CreateSystemRequest {
  agent: EntityLink;
}

// ─── Rule Sets ────────────────────────────────────────────────────────────────

export interface RuleSetSummary {
  id: string;
  system: EntityLink;
  isActive: boolean;
  name: string;
}

export interface ConfiguredRuleSet {
  id: string;
  system: EntityLink;
  isActive: boolean;
  name: string;
  rules: ConfiguredRule[];
}

export interface ConfiguredRule {
  name: string;
  subjectType: SubjectTypes;
  conditions: ConfiguredCondition[];
}

export interface ConfiguredCondition {
  canonicalName: string;
  parameters: Record<string, unknown>;
}

export interface RuleCondition {
  subjectType: SubjectTypes;
  canonicalName: string;
  name: string;
  description: string;
  parameters: ConditionParameterInfo[];
}

export interface ConditionParameterInfo {
  name: string;
  type: ParameterType;
  isList: boolean;
  fixedValueProvider: string | null;
}

export interface RuleSetsQuery extends BaseListRequest {
  name?: string;
  isActive?: boolean;
}

export interface CreateRuleSetRequest {
  name: string;
  system: EntityLink;
}

// ─── Operational Directives ───────────────────────────────────────────────────

export interface SubjectKeyDto {
  type: SubjectTypes;
  subjectEntityId: string;
  visitId?: string;
}

// Polymorphic access requirements — discriminated by $type

export interface CredentialOwnershipRequirementDto {
  $type: 'CredentialOwnershipRequirementDto';
  badgeTypeId: string;
  badgeNumber: string | null;
}

export interface GroupMembershipRequirementDto {
  $type: 'GroupMembershipRequirementDto';
  groupId: string;
}

export interface AccessAssignmentRequirementDto {
  $type: 'AccessAssignmentRequirementDto';
  resourceId: string;
  start: string;
  end: string | null;
}

export type IAccessRequirementDto =
  | CredentialOwnershipRequirementDto
  | GroupMembershipRequirementDto
  | AccessAssignmentRequirementDto;

// Polymorphic access grants — discriminated by $type

export interface OwnsCredentialDto {
  $type: 'OwnsCredentialDto';
  badgeTypeId: string;
  badgeId: string;
}

export interface MemberOfGroupDto {
  $type: 'MemberOfGroupDto';
  groupId: string;
}

export interface AssignedAccessDto {
  $type: 'AssignedAccessDto';
  accessLevelId: string;
  start: string | null;
  end: string | null;
}

export type IAccessGrantDto = OwnsCredentialDto | MemberOfGroupDto | AssignedAccessDto;

export interface GrantedDirective {
  directiveId: string;
  grant: IAccessGrantDto;
}

export interface CreateOperationalDirectiveRequest {
  subject: SubjectKeyDto;
  reason: string;
  requirement: IAccessRequirementDto;
  start?: string;
  end?: string;
}

export interface RevokeOperationalDirectiveRequest {
  directiveId: string;
  subject: SubjectKeyDto;
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
export class AccessPolicyService {
  private baseUrl: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.baseUrl = this.config.getModule('AccessPolicies')?.baseEndpoint ?? '';
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Systems ───────────────────────────────────────────────────────────────

  /** List agents available to back an access control system (Lenel or UniPass only). */
  getAvailableAgents(): Promise<EntityLink[]> {
    return firstValueFrom(this.http.get<EntityLink[]>(this.url('/systems/agents')));
  }

  /** List all configured access control systems. */
  getSystems(): Promise<SystemDto[]> {
    return firstValueFrom(this.http.get<SystemDto[]>(this.url('/systems')));
  }

  /** Get a specific access control system by ID. */
  getSystem(systemId: string): Promise<SystemDto> {
    return firstValueFrom(this.http.get<SystemDto>(this.url(`/systems/${systemId}`)));
  }

  /** Create a new access control system backed by an existing agent. */
  createSystem(body: CreateSystemRequest): Promise<SystemDto> {
    return firstValueFrom(this.http.post<SystemDto>(this.url('/systems'), body));
  }

  /** Delete an access control system. */
  deleteSystem(systemId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/systems/${systemId}`)));
  }

  /** Get the current configuration for a system. */
  getSystemConfiguration(systemId: string): Promise<ISystemConfigurationDto> {
    return firstValueFrom(
      this.http.get<ISystemConfigurationDto>(this.url(`/systems/${systemId}/configuration`))
    );
  }

  /** Update the configuration for a system. */
  updateSystemConfiguration(
    systemId: string,
    body: ISystemConfigurationDto
  ): Promise<ISystemConfigurationDto> {
    return firstValueFrom(
      this.http.put<ISystemConfigurationDto>(this.url(`/systems/${systemId}/configuration`), body)
    );
  }

  /** Fetch live metadata from the access control system (requires agent to be connected). */
  getSystemMetadata(systemId: string): Promise<ISystemMetadataConfigurationDto> {
    return firstValueFrom(
      this.http.get<ISystemMetadataConfigurationDto>(this.url(`/systems/${systemId}/metadata`))
    );
  }

  /** List the assignable access rules defined in the system's configuration. */
  getSystemAccessRules(systemId: string): Promise<EntityLink[]> {
    return firstValueFrom(
      this.http.get<EntityLink[]>(this.url(`/systems/${systemId}/access-rules`))
    );
  }

  /** List badge types configured for the system. */
  getSystemBadgeTypes(systemId: string): Promise<EntityLink[]> {
    return firstValueFrom(
      this.http.get<EntityLink[]>(this.url(`/systems/${systemId}/badge-types`))
    );
  }

  /** Get all badge numbers currently assigned under a specific badge type. */
  getAssignedBadgeNumbers(systemId: string, badgeTypeId: string): Promise<number[]> {
    return firstValueFrom(
      this.http.get<number[]>(
        this.url(`/systems/${systemId}/badge-types/${badgeTypeId}/badges`)
      )
    );
  }

  /** List external identity mappings for a system. */
  getSystemMappings(systemId: string, params?: BaseListRequest): Promise<IdentityDto[]> {
    return firstValueFrom(
      this.http.get<IdentityDto[]>(this.url(`/systems/${systemId}/mappings`), {
        params: toParams(params),
      })
    );
  }

  /** Delete a specific external identity mapping for a system. */
  deleteSystemMapping(systemId: string, body: IdentityDto): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/systems/${systemId}/mappings`), { body })
    );
  }

  // ── Rule Sets ─────────────────────────────────────────────────────────────

  /** List rule sets with optional filtering and pagination. */
  getRuleSets(params?: RuleSetsQuery): Promise<Page<RuleSetSummary>> {
    return firstValueFrom(
      this.http.get<Page<RuleSetSummary>>(this.url('/rule-sets'), { params: toParams(params) })
    );
  }

  /** Get a specific rule set by ID, including its full rule configuration. */
  getRuleSet(ruleSetId: string): Promise<ConfiguredRuleSet> {
    return firstValueFrom(
      this.http.get<ConfiguredRuleSet>(this.url(`/rule-sets/${ruleSetId}`))
    );
  }

  /** Create a new rule set (inactive, no rules). */
  createRuleSet(body: CreateRuleSetRequest): Promise<ConfiguredRuleSet> {
    return firstValueFrom(this.http.post<ConfiguredRuleSet>(this.url('/rule-sets'), body));
  }

  /** Update a rule set including name, active status, and rule configuration. */
  updateRuleSet(ruleSetId: string, body: ConfiguredRuleSet): Promise<ConfiguredRuleSet> {
    return firstValueFrom(
      this.http.put<ConfiguredRuleSet>(this.url(`/rule-sets/${ruleSetId}`), body)
    );
  }

  /** Delete a rule set. */
  deleteRuleSet(ruleSetId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/rule-sets/${ruleSetId}`)));
  }

  /** List available rule conditions for a given subject type. */
  getRuleConditions(subject: SubjectTypes): Promise<RuleCondition[]> {
    return firstValueFrom(
      this.http.get<RuleCondition[]>(this.url(`/rule-sets/conditions/${subject}`))
    );
  }

  /** Get selectable values for a value provider in the context of a rule set. */
  getRuleSetProviderValues(
    ruleSetId: string,
    providerName: ValueProviderType
  ): Promise<EntityLink[]> {
    return firstValueFrom(
      this.http.get<EntityLink[]>(this.url(`/rule-sets/${ruleSetId}/providers/${providerName}`))
    );
  }

  // ── Operational Directives ────────────────────────────────────────────────

  /** Issue an operational directive for a subject on a specific system. */
  issueDirective(
    systemId: string,
    body: CreateOperationalDirectiveRequest
  ): Promise<GrantedDirective> {
    return firstValueFrom(
      this.http.post<GrantedDirective>(this.url(`/operational-directives/${systemId}`), body)
    );
  }

  /** Revoke a previously issued operational directive. */
  revokeDirective(systemId: string, body: RevokeOperationalDirectiveRequest): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/operational-directives/${systemId}`), { body })
    );
  }
}
