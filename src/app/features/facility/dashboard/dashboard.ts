import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LocationService } from '../services/location-service';
import { AgentService, AgentStatus, Agent } from '../services/agent-service';
import { AccessPolicyService } from '../services/access-policy-service';
import { PermissionsService } from '../../../core/services/permissions-service';

@Component({
  selector: 'app-facility-dashboard',
  standalone: true,
  imports: [RouterLink, ButtonModule, TranslateModule],
  templateUrl: './dashboard.html',
})
export class FacilityDashboard implements OnInit {
  private locationService = inject(LocationService);
  private agentService    = inject(AgentService);
  private policyService   = inject(AccessPolicyService);
  private translate       = inject(TranslateService);
  private permissions     = inject(PermissionsService);

  // ── Permission guards ─────────────────────────────────────────────────────

  readonly canSeeLocations     = computed(() => this.permissions.hasAnyPermission('Locations Service', 'Locations:Read', 'Locations:Create', 'Locations:Update', 'Locations:Delete'));
  readonly canSeeAgents        = computed(() => this.permissions.hasAnyPermission('Agent Server', 'Read Agents', 'Edit and Delete Agents'));
  readonly canSeeAccessPolicies = computed(() => this.permissions.hasAnyPermission('Access Policies', 'Read systems', 'Write systems', 'Read rule sets', 'Write rule sets'));

  // ── Loading / error ───────────────────────────────────────────────────────

  readonly loading = signal(true);
  readonly error   = signal<string | null>(null);

  // ── Counts ────────────────────────────────────────────────────────────────

  readonly sitesCount     = signal(0);
  readonly buildingsCount = signal(0);
  readonly parkingsCount  = signal(0);
  readonly agentsTotal    = signal(0);
  readonly systemsCount   = signal(0);
  readonly ruleSetsCount  = signal(0);

  // ── Agent health ──────────────────────────────────────────────────────────

  readonly allAgents = signal<Agent[]>([]);

  readonly operationalCount = computed(() =>
    this.allAgents().filter(a => a.latestStatus?.status === AgentStatus.Operational).length
  );

  readonly disconnectedCount = computed(() =>
    this.allAgents().filter(a => a.latestStatus?.status === AgentStatus.Disconnected).length
  );

  readonly configErrorCount = computed(() =>
    this.allAgents().filter(a => a.latestStatus?.status === AgentStatus.ConfigurationError).length
  );

  readonly agentsWithIssues = computed(() =>
    this.disconnectedCount() + this.configErrorCount()
  );

  readonly problematicAgents = computed(() =>
    this.allAgents().filter(
      a => a.latestStatus?.status !== AgentStatus.Operational
    )
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    try {
      const [sites, buildings, parkings, agents, systems, ruleSets] = await Promise.all([
        this.canSeeLocations()     ? this.locationService.getSites({ PageSize: 1 })      : Promise.resolve(null),
        this.canSeeLocations()     ? this.locationService.getBuildings({ PageSize: 1 })  : Promise.resolve(null),
        this.canSeeLocations()     ? this.locationService.getParkings({ PageSize: 1 })   : Promise.resolve(null),
        this.canSeeAgents()        ? this.agentService.getAgents({ pageSize: 200 })      : Promise.resolve(null),
        this.canSeeAccessPolicies() ? this.policyService.getSystems()                    : Promise.resolve(null),
        this.canSeeAccessPolicies() ? this.policyService.getRuleSets({ pageSize: 1 })    : Promise.resolve(null),
      ]);

      if (sites)    this.sitesCount.set(sites.totalItems ?? sites.items.length);
      if (buildings) this.buildingsCount.set(buildings.totalItems ?? buildings.items.length);
      if (parkings)  this.parkingsCount.set(parkings.totalItems ?? parkings.items.length);
      if (agents) {
        this.agentsTotal.set(agents.totalItems ?? agents.items.length);
        this.allAgents.set(agents.items);
      }
      if (systems)  this.systemsCount.set(systems.length);
      if (ruleSets) this.ruleSetsCount.set(ruleSets.totalItems ?? ruleSets.items.length);
    } catch {
      this.error.set(this.translate.instant('facility.dashboard.loadError'));
    } finally {
      this.loading.set(false);
    }
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  agentStatusLabel(agent: Agent): string {
    switch (agent.latestStatus?.status) {
      case AgentStatus.Operational:        return this.translate.instant('facility.agents.operational');
      case AgentStatus.Disconnected:       return this.translate.instant('facility.agents.disconnected');
      case AgentStatus.ConfigurationError: return this.translate.instant('facility.agents.configError');
      default:                             return this.translate.instant('facility.agents.unknown');
    }
  }

  agentStatusClass(agent: Agent): string {
    switch (agent.latestStatus?.status) {
      case AgentStatus.Operational:        return 'bg-emerald-50 text-emerald-600 border-emerald-200';
      case AgentStatus.Disconnected:       return 'bg-zinc-50 text-zinc-500 border-zinc-200';
      case AgentStatus.ConfigurationError: return 'bg-amber-50 text-amber-600 border-amber-200';
      default:                             return 'bg-zinc-50 text-zinc-400 border-zinc-200';
    }
  }

  agentStatusIcon(agent: Agent): string {
    switch (agent.latestStatus?.status) {
      case AgentStatus.Operational:        return 'pi-check-circle';
      case AgentStatus.Disconnected:       return 'pi-times-circle';
      case AgentStatus.ConfigurationError: return 'pi-exclamation-triangle';
      default:                             return 'pi-question-circle';
    }
  }
}
