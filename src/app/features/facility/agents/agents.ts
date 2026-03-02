import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import {
  AgentService,
  Agent,
  AgentStatus,
  AgentType,
  AgentConfiguration,
  ConfigUpdate,
} from '../services/agent-service';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import { InputNumberModule } from 'primeng/inputnumber';
import { PasswordInput } from '../../../shared/components/password-input/password-input';

const REFRESH_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-facility-agents',
  standalone: true,
  imports: [
    DatePipe,
    NgTemplateOutlet,
    ReactiveFormsModule,
    FormsModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    InputTextModule,
    SelectModule,
    CheckboxModule,
    InputNumberModule,
    PasswordInput,
  ],
  templateUrl: './agents.html',
})
export class FacilityAgents implements OnInit, OnDestroy {
  private agentService = inject(AgentService);
  private fb = inject(FormBuilder);

  // ── Agent list state ───────────────────────────────────────────────────────

  readonly agents = signal<Agent[]>([]);
  readonly loading = signal(true);
  readonly refreshing = signal(false);
  readonly stale = signal(false);
  readonly lastUpdated = signal<Date | null>(null);
  readonly error = signal<string | null>(null);

  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Derived counts ────────────────────────────────────────────────────────

  readonly operationalCount = computed(
    () => this.agents().filter(a => a.latestStatus?.status === AgentStatus.Operational).length
  );

  readonly disconnectedCount = computed(
    () => this.agents().filter(a => a.latestStatus?.status === AgentStatus.Disconnected).length
  );

  readonly configErrorCount = computed(
    () => this.agents().filter(a => a.latestStatus?.status === AgentStatus.ConfigurationError).length
  );

  readonly lastUpdatedLabel = computed(() => {
    const d = this.lastUpdated();
    if (!d) return null;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  // ── Create-agent panel ────────────────────────────────────────────────────

  readonly createOpen = signal(false);
  readonly createSaving = signal(false);
  readonly createError = signal<string | null>(null);
  createForm!: FormGroup;

  readonly agentTypeOptions: { label: string; value: AgentType }[] = [
    { label: 'Kiosk Driver',   value: AgentType.KioskDriver  },
    { label: 'UniPass',        value: AgentType.UniPass      },
    { label: 'Lenel',          value: AgentType.Lenel        },
    { label: 'Printer',        value: AgentType.Printer      },
    { label: 'Encoder',        value: AgentType.Encoder      },
    { label: 'Badge Printer',  value: AgentType.BadgePrinter },
    { label: 'None',           value: AgentType.None         },
  ];

  // ── Delete state ──────────────────────────────────────────────────────────

  readonly deleteConfirmingId = signal<string | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly deleteError = signal<string | null>(null);

  // ── Config-edit panel ─────────────────────────────────────────────────────

  readonly expandedAgentId = signal<string | null>(null);
  readonly configLoading = signal(false);
  readonly configSaving = signal(false);
  readonly configError = signal<string | null>(null);
  readonly configSaveError = signal<string | null>(null);
  readonly configSaveSuccess = signal(false);
  readonly renameError = signal<string | null>(null);
  readonly renameSaving = signal(false);

  /** Loaded AgentConfiguration for the expanded agent. */
  readonly agentConfig = signal<AgentConfiguration | null>(null);

  renameForm!: FormGroup;
  configForm!: FormGroup;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      type: [AgentType.None, Validators.required],
    });

    this.renameForm = this.fb.group({
      name: ['', Validators.required],
    });

    this.configForm = this.fb.group({});

    await this.loadAgents(true);
    this.refreshTimer = setInterval(() => this.loadAgents(false), REFRESH_INTERVAL_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
    }
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private async loadAgents(initial: boolean): Promise<void> {
    if (initial) {
      this.loading.set(true);
    } else {
      this.refreshing.set(true);
    }

    try {
      const page = await this.agentService.getAgents({ pageSize: 500, sortColumn: 'Name', sortAscending: true });
      this.agents.set(page.items);
      this.lastUpdated.set(new Date());
      this.stale.set(false);
      this.error.set(null);
    } catch {
      if (initial) {
        this.error.set('Failed to load agents.');
      } else {
        this.stale.set(true);
      }
    } finally {
      this.loading.set(false);
      this.refreshing.set(false);
    }
  }

  refresh(): void {
    this.loadAgents(false);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  openCreate(): void {
    this.createForm.reset({ name: '', type: AgentType.None });
    this.createError.set(null);
    this.createOpen.set(true);
  }

  closeCreate(): void {
    this.createOpen.set(false);
    this.createError.set(null);
  }

  async saveCreate(): Promise<void> {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) return;

    this.createSaving.set(true);
    this.createError.set(null);

    const { name, type } = this.createForm.value as { name: string; type: AgentType };

    try {
      const created = await this.agentService.createAgent({ name: name.trim(), type });
      this.agents.update(list => [...list, created].sort((a, b) => a.name.localeCompare(b.name)));
      this.closeCreate();
    } catch (err: unknown) {
      const msg = this.extractApiError(err) ?? 'Failed to create agent. Please try again.';
      this.createError.set(msg);
    } finally {
      this.createSaving.set(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  confirmDelete(id: string): void {
    this.deleteError.set(null);
    this.deleteConfirmingId.set(id);
  }

  abortDelete(): void {
    this.deleteConfirmingId.set(null);
    this.deleteError.set(null);
  }

  async executeDelete(agent: Agent): Promise<void> {
    this.deletingId.set(agent.id);
    this.deleteError.set(null);

    try {
      await this.agentService.deleteAgent(agent.id);
      this.agents.update(list => list.filter(a => a.id !== agent.id));
      this.deleteConfirmingId.set(null);
      // Close config panel if this agent was expanded
      if (this.expandedAgentId() === agent.id) {
        this.expandedAgentId.set(null);
      }
    } catch {
      this.deleteError.set('Failed to delete agent. Please try again.');
    } finally {
      this.deletingId.set(null);
    }
  }

  // ── Config panel ──────────────────────────────────────────────────────────

  async toggleExpand(agent: Agent): Promise<void> {
    if (this.expandedAgentId() === agent.id) {
      this.expandedAgentId.set(null);
      return;
    }

    // Close any open delete confirmation
    this.deleteConfirmingId.set(null);
    this.deleteError.set(null);

    this.expandedAgentId.set(agent.id);
    this.configLoading.set(true);
    this.configError.set(null);
    this.configSaveError.set(null);
    this.configSaveSuccess.set(false);
    this.renameError.set(null);
    this.agentConfig.set(null);

    // Seed rename form
    this.renameForm.reset({ name: agent.name });

    try {
      const config = await this.agentService.getAgentConfiguration(agent.id);
      this.agentConfig.set(config);
      this.buildConfigForm(agent.type, config.configuration);
    } catch {
      this.configError.set('Failed to load configuration.');
    } finally {
      this.configLoading.set(false);
    }
  }

  async saveRename(agent: Agent): Promise<void> {
    this.renameForm.markAllAsTouched();
    if (this.renameForm.invalid) return;

    const name: string = this.renameForm.value.name.trim();
    if (name === agent.name) return;

    this.renameSaving.set(true);
    this.renameError.set(null);

    try {
      const updated = await this.agentService.updateAgent(agent.id, { name });
      this.agents.update(list =>
        list.map(a => a.id === agent.id ? { ...a, name: updated.name } : a)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      this.renameForm.reset({ name: updated.name });
    } catch (err: unknown) {
      this.renameError.set(this.extractApiError(err) ?? 'Failed to rename agent.');
    } finally {
      this.renameSaving.set(false);
    }
  }

  async saveConfig(agent: Agent): Promise<void> {
    if (this.configForm.invalid) return;

    this.configSaving.set(true);
    this.configSaveError.set(null);
    this.configSaveSuccess.set(false);

    const body = this.buildConfigUpdate(agent.type);

    try {
      const updated = await this.agentService.updateAgentConfiguration(agent.id, body);
      this.agentConfig.set(updated);
      this.configSaveSuccess.set(true);
      setTimeout(() => this.configSaveSuccess.set(false), 3000);
    } catch {
      this.configSaveError.set('Failed to save configuration. Please try again.');
    } finally {
      this.configSaving.set(false);
    }
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  statusSeverity(status: AgentStatus | null | undefined): 'success' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case AgentStatus.Operational:        return 'success';
      case AgentStatus.ConfigurationError: return 'warn';
      case AgentStatus.Disconnected:       return 'danger';
      default:                             return 'secondary';
    }
  }

  statusIcon(status: AgentStatus | null | undefined): string {
    switch (status) {
      case AgentStatus.Operational:        return 'pi pi-check-circle';
      case AgentStatus.ConfigurationError: return 'pi pi-exclamation-triangle';
      case AgentStatus.Disconnected:       return 'pi pi-times-circle';
      default:                             return 'pi pi-circle';
    }
  }

  statusLabel(status: AgentStatus | null | undefined): string {
    switch (status) {
      case AgentStatus.Operational:        return 'Operational';
      case AgentStatus.ConfigurationError: return 'Config Error';
      case AgentStatus.Disconnected:       return 'Disconnected';
      default:                             return 'Unknown';
    }
  }

  agentTypeLabel(type: AgentType | null | undefined): string {
    switch (type) {
      case AgentType.KioskDriver:  return 'Kiosk Driver';
      case AgentType.UniPass:      return 'UniPass';
      case AgentType.Lenel:        return 'Lenel';
      case AgentType.Printer:      return 'Printer';
      case AgentType.Encoder:      return 'Encoder';
      case AgentType.BadgePrinter: return 'Badge Printer';
      case AgentType.None:         return '—';
      default:                     return 'Unknown';
    }
  }

  agentName(id: string): string {
    return this.agents().find(a => a.id === id)?.name ?? 'this agent';
  }

  // ── Config form builder ───────────────────────────────────────────────────

  private buildConfigForm(type: AgentType, config: ConfigUpdate): void {
    const c = config;

    switch (type) {
      case AgentType.Lenel: {
        const v = c.lenel;
        this.configForm = this.fb.group({
          url:           [v?.url           ?? '', Validators.required],
          username:      [v?.username      ?? '', Validators.required],
          password:      [v?.password      ?? ''],
          validateSsl:   [v?.validateSsl   ?? true],
          directoryId:   [v?.directoryId   ?? '', Validators.required],
          applicationId: [v?.applicationId ?? '', Validators.required],
        });
        break;
      }
      case AgentType.UniPass: {
        const v = c.unipass;
        this.configForm = this.fb.group({
          url:         [v?.url         ?? '', Validators.required],
          apiKey:      [v?.apiKey      ?? ''],
          validateSsl: [v?.validateSsl ?? true],
          timeZone:    [v?.timeZone    ?? '', Validators.required],
        });
        break;
      }
      case AgentType.KioskDriver: {
        const kd = c.kioskDriver;
        this.configForm = this.fb.group({
          // DriverConfiguration
          enableRfid:       [kd?.driverSettings?.enableRfid       ?? false],
          enableQr:         [kd?.driverSettings?.enableQr         ?? false],
          enableCollector:  [kd?.driverSettings?.enableCollector  ?? false],
          enableDispenser:  [kd?.driverSettings?.enableDispenser  ?? false],
          enableEid:        [kd?.driverSettings?.enableEid        ?? false],
          enablePassport:   [kd?.driverSettings?.enablePassport   ?? false],
          // Collector
          collectorComPort: [kd?.collector?.comPort  ?? ''],
          collectorReaderId:[kd?.collector?.readerId ?? 0],
          // Dispenser
          dispenserComPort: [kd?.dispenser?.comPort  ?? ''],
          dispenserReaderId:[kd?.dispenser?.readerId ?? 0],
          // Reader
          readingTimeout:   [kd?.readers?.readingTimeout  ?? 3000],
          pollingInterval:  [kd?.readers?.pollingInterval ?? 500],
          // QR Reader
          qrComPort:        [kd?.qrReader?.comPort ?? ''],
          // eID Reader
          eidPollingInterval: [kd?.eidReader?.pollingInterval ?? 500],
          eidBypassPin:       [kd?.eidReader?.bypassPin       ?? false],
        });
        break;
      }
      case AgentType.Printer: {
        const v = c.printerConfig;
        this.configForm = this.fb.group({
          printerType:  [v?.printerType  ?? '', Validators.required],
          printOverUsb: [v?.printOverUsb ?? false],
          useSpooler:   [v?.useSpooler   ?? false],
          ipAddress:    [v?.ipAddress    ?? ''],
          port:         [v?.port         ?? 9100],
          printerName:  [v?.printerName  ?? ''],
        });
        break;
      }
      case AgentType.BadgePrinter: {
        const v = c.badgePrinterConfig;
        this.configForm = this.fb.group({
          printerType:     [v?.printerType     ?? '', Validators.required],
          readerName:      [v?.readerName      ?? ''],
          verboseLogging:  [v?.verboseLogging  ?? false],
          printerName:     [v?.printerName     ?? ''],
          encodingStation: [v?.encodingStation ?? ''],
          hopper:          [v?.hopper          ?? 1],
          comPort:         [v?.comPort         ?? ''],
        });
        break;
      }
      case AgentType.Encoder: {
        const v = c.encoderConfig;
        this.configForm = this.fb.group({
          encoderType:    [v?.encoderType    ?? '', Validators.required],
          encoderName:    [v?.encoderName    ?? ''],
          verboseLogging: [v?.verboseLogging ?? false],
          comPort:        [v?.comPort        ?? ''],
        });
        break;
      }
      default:
        this.configForm = this.fb.group({});
    }
  }

  private buildConfigUpdate(type: AgentType): ConfigUpdate {
    const f = this.configForm.value;
    const empty: ConfigUpdate = {
      lenel: null, unipass: null, kioskDriver: null,
      printerConfig: null, badgePrinterConfig: null, encoderConfig: null,
    };

    switch (type) {
      case AgentType.Lenel:
        return {
          ...empty,
          lenel: {
            url: f.url, username: f.username, password: f.password,
            validateSsl: f.validateSsl, directoryId: f.directoryId,
            applicationId: f.applicationId,
          },
        };
      case AgentType.UniPass:
        return {
          ...empty,
          unipass: {
            url: f.url, apiKey: f.apiKey,
            validateSsl: f.validateSsl, timeZone: f.timeZone,
          },
        };
      case AgentType.KioskDriver:
        return {
          ...empty,
          kioskDriver: {
            driverSettings: {
              enableRfid: f.enableRfid, enableQr: f.enableQr,
              enableCollector: f.enableCollector, enableDispenser: f.enableDispenser,
              enableEid: f.enableEid, enablePassport: f.enablePassport,
            },
            collector:  { comPort: f.collectorComPort, readerId: f.collectorReaderId },
            dispenser:  { comPort: f.dispenserComPort, readerId: f.dispenserReaderId },
            readers:    { readingTimeout: f.readingTimeout, pollingInterval: f.pollingInterval },
            qrReader:   { comPort: f.qrComPort },
            eidReader:  { pollingInterval: f.eidPollingInterval, bypassPin: f.eidBypassPin },
          },
        };
      case AgentType.Printer:
        return {
          ...empty,
          printerConfig: {
            printerType: f.printerType, printOverUsb: f.printOverUsb,
            useSpooler: f.useSpooler, ipAddress: f.ipAddress,
            port: f.port, printerName: f.printerName,
          },
        };
      case AgentType.BadgePrinter:
        return {
          ...empty,
          badgePrinterConfig: {
            printerType: f.printerType, readerName: f.readerName,
            verboseLogging: f.verboseLogging, printerName: f.printerName,
            encodingStation: f.encodingStation, hopper: f.hopper, comPort: f.comPort,
          },
        };
      case AgentType.Encoder:
        return {
          ...empty,
          encoderConfig: {
            encoderType: f.encoderType, encoderName: f.encoderName,
            verboseLogging: f.verboseLogging, comPort: f.comPort,
          },
        };
      default:
        return empty;
    }
  }

  // ── Error extraction ──────────────────────────────────────────────────────

  private extractApiError(err: unknown): string | null {
    if (err && typeof err === 'object' && 'error' in err) {
      const e = (err as { error?: { title?: string; errors?: Record<string, string[]> } }).error;
      if (e?.errors) {
        const msgs = Object.values(e.errors).flat();
        if (msgs.length) return msgs[0];
      }
      if (e?.title) return e.title;
    }
    return null;
  }

  // ── Expose enum for template ──────────────────────────────────────────────

  readonly AgentType = AgentType;
}
