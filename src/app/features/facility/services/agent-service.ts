import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../../core/services/config-service';

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum AgentType {
  None         = 0,
  KioskDriver  = 1,
  UniPass      = 2,
  Lenel        = 3,
  Printer      = 4,
  Encoder      = 5,
  BadgePrinter = 6,
}

export enum AgentStatus {
  Operational       = 0,
  ConfigurationError = 1,
  Disconnected      = 2,
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface Page<T> {
  currentPage: number;
  pageSize: number;
  totalPages: number | null;
  totalItems: number | null;
  isLastPage: boolean;
  items: T[];
}

export interface PagedRequest {
  page?: number;
  pageSize?: number;
  sortAscending?: boolean;
  sortColumn?: string;
}

// ─── Agent Models ─────────────────────────────────────────────────────────────

export interface AgentStatusReport {
  id: string;
  agentId: string;
  status: AgentStatus;
  details: string | null;
  reportedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  latestStatus: AgentStatusReport | null;
}

// ─── Configuration Models ─────────────────────────────────────────────────────

export interface LenelConfiguration {
  url: string;
  username: string;
  password: string;
  validateSsl: boolean;
  directoryId: string;
  applicationId: string;
}

export interface UnipassConfiguration {
  url: string;
  apiKey: string;
  validateSsl: boolean;
  timeZone: string;
}

export interface DriverConfiguration {
  enableRfid: boolean;
  enableQr: boolean;
  enableCollector: boolean;
  enableDispenser: boolean;
  enableEid: boolean;
  enablePassport: boolean;
}

export interface CollectorConfiguration {
  comPort: string;
  readerId: number;
}

export interface DispenserConfiguration {
  comPort: string;
  readerId: number;
}

export interface ReaderConfiguration {
  readingTimeout: number;
  pollingInterval: number;
}

export interface QrReaderConfiguration {
  comPort: string;
}

export interface EidReaderConfiguration {
  pollingInterval: number;
  bypassPin: boolean;
}

export interface KioskDriverConfiguration {
  collector: CollectorConfiguration;
  dispenser: DispenserConfiguration;
  readers: ReaderConfiguration;
  qrReader: QrReaderConfiguration;
  eidReader: EidReaderConfiguration;
  driverSettings: DriverConfiguration;
}

export interface PrinterConfiguration {
  printerType: string;
  printOverUsb: boolean;
  useSpooler: boolean;
  ipAddress: string;
  port: number;
  printerName: string;
}

export interface BadgePrinterConfiguration {
  printerType: string;
  readerName: string;
  verboseLogging: boolean;
  printerName: string;
  encodingStation: string;
  hopper: number;
  comPort: string;
}

export interface EncoderConfiguration {
  encoderType: string;
  encoderName: string;
  verboseLogging: boolean;
  comPort: string;
}

export interface ConfigUpdate {
  lenel: LenelConfiguration | null;
  unipass: UnipassConfiguration | null;
  kioskDriver: KioskDriverConfiguration | null;
  printerConfig: PrinterConfiguration | null;
  badgePrinterConfig: BadgePrinterConfiguration | null;
  encoderConfig: EncoderConfiguration | null;
}

export interface AgentConfiguration {
  agentId: string;
  configuration: ConfigUpdate;
}

// ─── Certificate ──────────────────────────────────────────────────────────────

export interface AgentCertificateDto {
  agent: Agent;
  pfxPassword: string;
  pfxDataBase64: string;
}

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export interface CreateAgentDto {
  name: string;
  type: AgentType;
}

export interface EditAgentDto {
  name: string;
}

// ─── Query Params ─────────────────────────────────────────────────────────────

export interface AgentsQuery extends PagedRequest {
  name?: string;
  statuses?: AgentStatus[];
  agentTypes?: AgentType[];
  agentType?: AgentType;
}

export interface AgentStatusHistoryQuery extends PagedRequest {
  onlyBefore?: string;
  onlyAfter?: string;
  statuses?: AgentStatus[];
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
export class AgentService {
  private baseUrl: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.baseUrl = this.config.getModule('Agents')?.baseEndpoint ?? '';
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Agents ───────────────────────────────────────────────────────────────────

  getAgent(agentId: string): Promise<Agent> {
    return firstValueFrom(this.http.get<Agent>(this.url(`/agents/${agentId}`)));
  }

  getAgents(params?: AgentsQuery): Promise<Page<Agent>> {
    return firstValueFrom(
      this.http.get<Page<Agent>>(this.url('/agents'), { params: toParams(params) })
    );
  }

  createAgent(body: CreateAgentDto): Promise<Agent> {
    return firstValueFrom(this.http.post<Agent>(this.url('/agents'), body));
  }

  updateAgent(agentId: string, body: EditAgentDto): Promise<Agent> {
    return firstValueFrom(this.http.put<Agent>(this.url(`/agents/${agentId}`), body));
  }

  deleteAgent(agentId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/agents/${agentId}`)));
  }

  // ── Configuration ─────────────────────────────────────────────────────────────

  getAgentConfiguration(id: string): Promise<AgentConfiguration> {
    return firstValueFrom(
      this.http.get<AgentConfiguration>(this.url(`/agents/${id}/configuration`))
    );
  }

  updateAgentConfiguration(id: string, body: ConfigUpdate): Promise<AgentConfiguration> {
    return firstValueFrom(
      this.http.put<AgentConfiguration>(this.url(`/agents/${id}/configuration`), body)
    );
  }

  // ── Status History ────────────────────────────────────────────────────────────

  getAgentStatusHistory(id: string, params?: AgentStatusHistoryQuery): Promise<Page<AgentStatusReport>> {
    return firstValueFrom(
      this.http.get<Page<AgentStatusReport>>(this.url(`/agents/${id}/status`), {
        params: toParams(params),
      })
    );
  }

  // ── Certificate ───────────────────────────────────────────────────────────────

  getAgentCertificate(id: string): Promise<AgentCertificateDto> {
    return firstValueFrom(this.http.get<AgentCertificateDto>(this.url(`/agents/${id}/certificate`)));
  }
}
