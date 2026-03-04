import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config-service';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface NotificationBlueprint {
  name: string;
  description: string;
  canonicalName: string;
  category: string;
  supportedRoles: string[];
}

export interface NotificationChannel {
  name: string;
  description: string;
  canonicalName: string;
}

export interface NotificationAction {
  id?: string;
  description: string;
  notificationBlueprintName: string;
  notificationChannelName: string;
  notificationChannelFriendlyName: string;
  includedRoles: string[];
  excludedRoles: string[];
  subject: string;
  body: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private baseUrl: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.baseUrl = this.config.getModule('Notifications')?.baseEndpoint ?? '';
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Blueprints ───────────────────────────────────────────────────────────────

  /** List all registered notification blueprints. */
  getBlueprints(): Promise<NotificationBlueprint[]> {
    return firstValueFrom(this.http.get<NotificationBlueprint[]>(this.url('/blueprints')));
  }

  /** Returns dot-notation template variable paths available for the given blueprint. */
  getBlueprintProperties(canonicalName: string): Promise<string[]> {
    return firstValueFrom(
      this.http.get<string[]>(this.url(`/blueprints/${encodeURIComponent(canonicalName)}/properties`))
    );
  }

  /** Returns all actions configured for the given blueprint in the current tenant. */
  getBlueprintActions(canonicalName: string): Promise<NotificationAction[]> {
    return firstValueFrom(
      this.http.get<NotificationAction[]>(
        this.url(`/blueprints/${encodeURIComponent(canonicalName)}/actions`)
      )
    );
  }

  /** Creates a new action for the given blueprint. */
  createAction(canonicalName: string, action: NotificationAction): Promise<NotificationAction> {
    return firstValueFrom(
      this.http.post<NotificationAction>(
        this.url(`/blueprints/${encodeURIComponent(canonicalName)}/actions`),
        action
      )
    );
  }

  // ── Actions ──────────────────────────────────────────────────────────────────

  /** Fetches a single action by ID. */
  getAction(actionId: string): Promise<NotificationAction> {
    return firstValueFrom(
      this.http.get<NotificationAction>(this.url(`/actions/${actionId}`))
    );
  }

  /** Replaces an existing action. The path parameter is authoritative; id in the body is ignored. */
  updateAction(actionId: string, action: NotificationAction): Promise<NotificationAction> {
    return firstValueFrom(
      this.http.put<NotificationAction>(this.url(`/actions/${actionId}`), action)
    );
  }

  /** Deletes an action by ID. */
  deleteAction(actionId: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.url(`/actions/${actionId}`)));
  }

  // ── Channels ─────────────────────────────────────────────────────────────────

  /** Returns all registered notification channels. */
  getChannels(): Promise<NotificationChannel[]> {
    return firstValueFrom(this.http.get<NotificationChannel[]>(this.url('/channels')));
  }
}
