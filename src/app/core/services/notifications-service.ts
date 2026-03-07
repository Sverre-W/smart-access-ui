import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config-service';

// ─── Models ───────────────────────────────────────────────────────────────────

export interface NotificationChannel {
  name: string;
  description: string;
  canonicalName: string;
}

export interface TemplateTranslation {
  language: string;
  subject: string;
  body: string;
}

export interface NotificationTemplateDto {
  id: string;
  name: string;
  description: string;
  subject: string;
  body: string;
  translations: TemplateTranslation[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationTemplateRequest {
  name: string;
  description: string;
  subject?: string | null;
  body?: string | null;
  translations?: TemplateTranslation[] | null;
}

export interface UpdateNotificationTemplateRequest {
  name: string;
  description: string;
  subject?: string | null;
  body?: string | null;
  translations?: TemplateTranslation[] | null;
}

export interface IPagedOf<T> {
  currentPage: number;
  totalPages: number | null;
  pageSize: number;
  totalItems: number | null;
  items: T[];
  isLastPage: boolean;
}

export interface NotificationLogDto {
  id: string;
  templateId: string;
  templateName: string;
  channel: string;
  recipient: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface SendNotificationCommand {
  templateId?: string | null;
  templateName?: string | null;
  recipient: ChannelRecipient;
  modelData?: Record<string, unknown>;
  tenant?: string | null;
  language?: string | null;
}

export interface ChannelRecipient {
  $type: 'email' | 'sms';
  channel: string;
}

export interface NotificationLogsQuery {
  page?: number;
  pageSize?: number;
  channel?: string | null;
  status?: string | null;
  from?: string | null;
  to?: string | null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return this.config.getModule('Notifications')?.baseEndpoint ?? '';
  }

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  // ── Channels ─────────────────────────────────────────────────────────────────

  /** Returns all registered notification channels. */
  getChannels(): Promise<NotificationChannel[]> {
    return firstValueFrom(this.http.get<NotificationChannel[]>(this.url('/channels')));
  }

  // ── Templates ────────────────────────────────────────────────────────────────

  /** Returns a paged list of notification templates. */
  getTemplates(page = 0, pageSize = 20): Promise<IPagedOf<NotificationTemplateDto>> {
    return firstValueFrom(
      this.http.get<IPagedOf<NotificationTemplateDto>>(this.url('/templates'), {
        params: { page, pageSize },
      })
    );
  }

  /** Creates a new notification template. */
  createTemplate(request: CreateNotificationTemplateRequest): Promise<NotificationTemplateDto> {
    return firstValueFrom(
      this.http.post<NotificationTemplateDto>(this.url('/templates'), request)
    );
  }

  /** Gets a notification template by ID. */
  getTemplate(id: string): Promise<NotificationTemplateDto> {
    return firstValueFrom(
      this.http.get<NotificationTemplateDto>(this.url(`/templates/${encodeURIComponent(id)}`))
    );
  }

  /** Updates an existing notification template. */
  updateTemplate(id: string, request: UpdateNotificationTemplateRequest): Promise<NotificationTemplateDto> {
    return firstValueFrom(
      this.http.put<NotificationTemplateDto>(this.url(`/templates/${encodeURIComponent(id)}`), request)
    );
  }

  /** Deletes a notification template by ID. */
  deleteTemplate(id: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(this.url(`/templates/${encodeURIComponent(id)}`))
    );
  }

  /** Gets a notification template by its unique name. */
  getTemplateByName(name: string): Promise<NotificationTemplateDto> {
    return firstValueFrom(
      this.http.get<NotificationTemplateDto>(this.url(`/templates/by-name/${encodeURIComponent(name)}`))
    );
  }

  // ── Notifications ─────────────────────────────────────────────────────────────

  /** Sends a notification asynchronously (202 Accepted). */
  sendNotification(command: SendNotificationCommand): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(this.url('/notifications/send'), command)
    );
  }

  /** Returns a paged list of notification logs. */
  getLogs(query: NotificationLogsQuery = {}): Promise<IPagedOf<NotificationLogDto>> {
    const params: Record<string, string | number> = {};
    if (query.page != null) params['page'] = query.page;
    if (query.pageSize != null) params['pageSize'] = query.pageSize;
    if (query.channel) params['channel'] = query.channel;
    if (query.status) params['status'] = query.status;
    if (query.from) params['from'] = query.from;
    if (query.to) params['to'] = query.to;
    return firstValueFrom(
      this.http.get<IPagedOf<NotificationLogDto>>(this.url('/notifications/logs'), { params })
    );
  }
}
