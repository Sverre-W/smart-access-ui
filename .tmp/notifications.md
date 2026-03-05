
# API Reference: Notifications Server

**Status:** Reference  
**Created:** 2026-03-03

---

## Overview

The Notifications Server manages event-driven notifications for the Smart Access platform. It provides:

- **Blueprints** — code-defined templates that describe which domain events trigger notifications, which roles can be targeted, and what data is available for templating.
- **Actions** — tenant-configured rules that bind a blueprint to a delivery channel, a set of recipient roles, and a Liquid template for the message subject and body.
- **Channels** — code-defined delivery mechanisms (currently: Email via Microsoft Graph).

When a domain event arrives via RabbitMQ, the server resolves all `NotificationAction` records for the matching blueprint within the current tenant, renders the Liquid templates against the event payload, resolves recipient contacts via the configured roles, and dispatches the message through the configured channel.

---

## Base URL

All endpoints are relative to the Notifications Server base URL. There is no versioned path prefix.

```
/
```

| Environment | URL |
|---|---|
| Local development | `http://localhost:8007` |
| Docker | `http://0.0.0.0:8080` |

---

## Authentication & Authorization

All endpoints except `GET /health` require Bearer JWT authentication. Tokens are validated by a custom `MultiTenantJwtAuthenticationHandler` that selects the correct OIDC configuration based on the `iss` claim:

- Tokens from the internal Axxession issuer are validated against the internal OIDC configuration.
- All other tokens are validated against the tenant's registered external IDP, resolved from the `X-Tenant-Id` header or a claim in the token.

Valid audiences: `axxession`, `account`, `axxession-internal`.

### Multi-Tenancy

The current tenant is resolved from the `X-Tenant-Id` HTTP header or a JWT claim. All Marten document queries are automatically scoped to the resolved tenant, so actions created in one tenant are never visible to another.

### Authorization

Endpoint authorization uses a custom `[Permissions(...)]` attribute. Permissions are resolved by matching the roles in the user's JWT claims against `Role` documents in the Settings Server database.

Permission values defined in `NotificationPermissions`:

| Constant | Value | Description |
|---|---|---|
| `ViewNotifications` | `"View Notifications"` | Read-only access to blueprints, channels, and actions |
| `EditNotifications` | `"Edit Notifications"` | Create, update, and delete notification actions |

### Endpoint Permission Matrix

| Endpoint | Method | Required Permission |
|---|---|---|
| `GET /health` | `GET` | Anonymous |
| `GET /blueprints` | `GET` | `View Notifications` |
| `GET /blueprints/{canonicalName}/properties` | `GET` | `View Notifications` |
| `GET /blueprints/{canonicalName}/actions` | `GET` | `View Notifications` |
| `POST /blueprints/{canonicalName}/actions` | `POST` | `Edit Notifications` |
| `GET /actions/{actionId}` | `GET` | `View Notifications` |
| `PUT /actions/{actionId}` | `PUT` | `Edit Notifications` |
| `DELETE /actions/{actionId}` | `DELETE` | `Edit Notifications` |
| `GET /channels` | `GET` | `View Notifications` |

---

## Serialization

- All request and response bodies use **camelCase JSON**.
- Validation errors are returned as **RFC 7807 `ValidationProblemDetails`** with `400 Bad Request`.

---

## Error Handling

### Common HTTP Status Codes

| Status | Meaning |
|---|---|
| `200 OK` | Request succeeded; body contains result |
| `204 No Content` | Request succeeded; no response body |
| `400 Bad Request` | Validation failure or invalid blueprint/channel reference — body is `ValidationProblemDetails` |
| `401 Unauthorized` | Missing or invalid authentication token |
| `403 Forbidden` | Authenticated but insufficient permissions |
| `404 Not Found` | Resource not found; no body |

### Validation Errors

Validation failures (from FluentValidation) are returned as:

```json
{
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "FieldName": ["Error message"]
  }
}
```

---

## Endpoints

### Health

---

#### GET /health

Returns the service health status. No authentication required.

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | health status object | Service is healthy |

---

### Blueprints

Blueprints are code-defined classes auto-discovered at startup. They are not stored in the database and cannot be created or modified via the API. Each blueprint declares the domain event that triggers it, the roles that can be targeted, and the data available for Liquid templates.

The `canonicalName` of a blueprint is its fully-qualified C# class name (e.g. `SmartAccess.Notifications.Server.Blueprints.Visitors.VisitorConfirmedBlueprint`) and is used as its identifier in both URL path parameters and `NotificationAction.notificationBlueprintName`.

---

#### GET /blueprints

List all registered notification blueprints.

**Authorization:** `View Notifications`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `NotificationBlueprint[]` | All registered blueprints |

**Example response:**

```json
[
  {
    "name": "Visitor confirmed for Visit",
    "description": "Occurs when a visitor confirms their attendance for an event.",
    "canonicalName": "SmartAccess.Notifications.Server.Blueprints.Visitors.VisitorConfirmedBlueprint",
    "category": "Visitor Management",
    "supportedRoles": ["Organizers", "Visitors", "Participants", "ActingVisitor"]
  }
]
```

---

#### GET /blueprints/{canonicalName}/properties

Returns a flat list of dot-notation property paths available as Liquid template variables for the given blueprint. Use these paths in the `subject` and `body` fields of a `NotificationAction`.

**Authorization:** `View Notifications`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `canonicalName` | `string` | Fully-qualified class name of the blueprint |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `string[]` | Dot-notation template variable paths |
| `404 Not Found` | — | No blueprint with the given canonical name |

**Example response:**

```json
[
  "Visit.State",
  "Visit.Start",
  "Visit.End",
  "Visit.Summary",
  "Visit.InvitationId",
  "Visit.VisitorInvitations",
  "Visit.VisitorInvitations[].Visitor",
  "Visit.VisitorInvitations[].Visitor.Email",
  "Visitor.Visitor",
  "Visitor.Visitor.Email",
  "Visitor.Visitor.FirstName",
  "Visitor.Visitor.LastName"
]
```

---

#### GET /blueprints/{canonicalName}/actions

Returns all `NotificationAction` records configured for the given blueprint within the current tenant.

**Authorization:** `View Notifications`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `canonicalName` | `string` | Fully-qualified class name of the blueprint |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `NotificationAction[]` | All actions for this blueprint in the current tenant |

---

#### POST /blueprints/{canonicalName}/actions

Creates a new `NotificationAction` for the given blueprint. The server assigns a new `id` and resolves `notificationChannelFriendlyName` regardless of what is supplied in the body. The `notificationBlueprintName` is set from the URL path parameter.

**Authorization:** `Edit Notifications`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `canonicalName` | `string` | Fully-qualified class name of the blueprint |

**Request Body:** `NotificationAction`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `NotificationAction` | The created action with server-assigned `id` |
| `400 Bad Request` | `ValidationProblemDetails` | FluentValidation failure, or `notificationBlueprintName` / `notificationChannelName` does not match a registered blueprint or channel |

---

### Actions

---

#### GET /actions/{actionId}

Fetches a single `NotificationAction` by ID.

**Authorization:** `View Notifications`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `actionId` | `Guid` | The unique identifier of the action |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `NotificationAction` | The action |
| `404 Not Found` | — | No action with the given ID in the current tenant |

---

#### PUT /actions/{actionId}

Replaces an existing `NotificationAction`. The `id` in the request body is ignored — the path parameter is authoritative. The server resolves and updates `notificationChannelFriendlyName`.

**Authorization:** `Edit Notifications`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `actionId` | `Guid` | The unique identifier of the action to update |

**Request Body:** `NotificationAction`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `NotificationAction` | The updated action |
| `400 Bad Request` | `ValidationProblemDetails` | FluentValidation failure, or invalid blueprint/channel reference |
| `404 Not Found` | — | No action with the given ID in the current tenant |

---

#### DELETE /actions/{actionId}

Deletes a `NotificationAction`.

**Authorization:** `Edit Notifications`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `actionId` | `Guid` | The unique identifier of the action to delete |

**Responses**

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | Action deleted |
| `404 Not Found` | — | No action with the given ID in the current tenant |

---

### Channels

Channels are code-defined classes auto-discovered at startup. They are not stored in the database and cannot be created via the API.

---

#### GET /channels

Returns all registered notification channels.

**Authorization:** `View Notifications`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `NotificationChannel[]` | All registered channels |

**Example response:**

```json
[
  {
    "name": "Email",
    "description": "Sends notifications via email.",
    "canonicalName": "SmartAccess.Notifications.Server.Channels.EmailChannel"
  }
]
```

---

## Data Models

### NotificationAction

The core persistable document. Represents a configured notification rule: when the named blueprint's event fires, send a rendered Liquid template through the named channel to the resolved set of recipient roles.

```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "description": "Notify organizers when a visitor confirms",
  "notificationBlueprintName": "SmartAccess.Notifications.Server.Blueprints.Visitors.VisitorConfirmedBlueprint",
  "notificationChannelName": "SmartAccess.Notifications.Server.Channels.EmailChannel",
  "notificationChannelFriendlyName": "Email",
  "includedRoles": ["Organizers"],
  "excludedRoles": [],
  "subject": "{{Visit.Summary}} - Visitor confirmed",
  "body": "<p>Hello, a visitor has confirmed for <strong>{{Visit.Summary}}</strong> on {{Visit.Start}}.</p>"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `Guid` | Unique identifier. Assigned by the server on `POST`; ignored on `PUT` |
| `description` | `string` | Human-readable description of this action. Max 250 characters |
| `notificationBlueprintName` | `string` | Canonical name (fully-qualified class name) of the blueprint. Set from the URL on `POST` |
| `notificationChannelName` | `string` | Canonical name of the channel |
| `notificationChannelFriendlyName` | `string` | Display name of the channel. Resolved and set by the server; not accepted from the client |
| `includedRoles` | `string[]` | Roles whose contacts will receive the notification. Must contain at least one entry |
| `excludedRoles` | `string[]` | Roles whose contacts will be subtracted from the included set |
| `subject` | `string` | Liquid template string for the notification subject. Max 200 characters |
| `body` | `string` | Liquid template string for the notification body (HTML) |

**Validation rules** (applied on `POST` and `PUT`):

| Field | Rules |
|---|---|
| `description` | Required; max 250 characters |
| `notificationBlueprintName` | Required |
| `notificationChannelName` | Required |
| `includedRoles` | Required; at least one entry |
| `excludedRoles` | Required (may be empty) |
| `subject` | Required; max 200 characters |
| `body` | Required |

In addition to field-level validation, the server also returns `400 Bad Request` if `notificationBlueprintName` does not match a registered blueprint, or if `notificationChannelName` does not match a registered channel.

---

### NotificationBlueprint

A read-only description of a registered blueprint. Not stored in the database; derived from code-defined implementations discovered at startup.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Display name |
| `description` | `string` | When/why this blueprint fires |
| `canonicalName` | `string` | Fully-qualified class name. Used as the identifier in `NotificationAction.notificationBlueprintName` and URL path parameters |
| `category` | `string` | Grouping category (e.g. `"Visitor Management"`) |
| `supportedRoles` | `string[]` | Role names that can be used in `includedRoles` / `excludedRoles` for actions on this blueprint |

---

### NotificationChannel

A read-only description of a registered delivery channel. Not stored in the database; derived from code-defined implementations discovered at startup.

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Display name (e.g. `"Email"`) |
| `description` | `string` | Human-readable description |
| `canonicalName` | `string` | Fully-qualified class name. Used as the identifier in `NotificationAction.notificationChannelName` |

---

## Blueprints Reference

All currently registered blueprints belong to the `Visitor Management` category.

| Blueprint Class | `name` | Triggering Event | Supported Roles |
|---|---|---|---|
| `VisitorConfirmedBlueprint` | Visitor confirmed for Visit | `VisitorConfirmedIntegrationEvent` | Organizers, Visitors, Participants, ActingVisitor |
| `VisitCancelledNotificationBlueprint` | Visit cancelled | `VisitCanceledIntegrationEvent` | Organizers, Visitors, Participants |
| `VisitorAddedBlueprint` | Visitor added to visit | `VisitorAddedEvent` | Organizers, Visitors, Participants, ActingVisitor |
| `ParticipantAddedBlueprint` | Participant added to visit | `ParticipantAddedEvent` | Organizers, Visitors, Participants, ActingParticipant |
| `OrganizerAddedBlueprint` | Organizer added to visit | `OrganizerAddedEvent` | Organizers, Visitors, Participants, ActingParticipant |
| `VisitorOnboardingCompletedBlueprint` | Visit completed the onboarding process | `VisitorOnboardedIntegrationEvent` | Organizers, Visitors, Participants, ActingVisitor |
| `VisitorOnboardingTokenGeneratedBlueprint` | Visitor received onboarding token | `VisitorTokenAssignedIntegrationEvent` | Organizers, Visitors, Participants, ActingVisitor |
| `VisitRescheduledBlueprint` | Visit has been rescheduled | `VisitRescheduledIntegrationEvent` | Organizers, Visitors, Participants, ActingOrganizer |

### Role Semantics

| Role | Description |
|---|---|
| `Organizers` | All users with the Organizer role on the visit |
| `Visitors` | All users with the Visitor role on the visit |
| `Participants` | All users with the Participant role on the visit |
| `ActingVisitor` | The specific visitor who triggered the event |
| `ActingOrganizer` | The specific organizer who triggered the event |
| `ActingParticipant` | The specific participant who triggered the event |

---

## Channels Reference

| Channel Class | `name` | Delivery Mechanism |
|---|---|---|
| `EmailChannel` | Email | Microsoft Graph API (`POST /users/{from}/sendMail`) using Azure AD client credentials |

---

## Templating

The `subject` and `body` fields in `NotificationAction` are **Liquid templates** rendered by the [Fluid](https://github.com/sebastienros/fluid) library. The model exposed to the template is the integration event payload that triggered the blueprint.

Use `GET /blueprints/{canonicalName}/properties` to discover the available template variable paths for a given blueprint.

**Example:**

```liquid
Subject: {{Visit.Summary}} - Visitor has confirmed

Body:
<p>
  Dear team, {{Visitor.Visitor.FirstName}} {{Visitor.Visitor.LastName}}
  has confirmed attendance for <strong>{{Visit.Summary}}</strong>
  scheduled on {{Visit.Start}}.
</p>
```

---

## Configuration

### Key Configuration Sections

| Section | Description |
|---|---|
| `ConnectionStrings:Database` | PostgreSQL connection string for the Marten document store |
| `ConnectionStrings:RabbitMQ` | AMQP connection string for the Wolverine/RabbitMQ message bus |
| `Application:ApplicationName` | Must be `"Notifications Server"` to match permission registration |
| `Application:SettingsBaseUrl` | Base URL of the Settings Server (used for permission and tenant resolution) |
| `Application:OltpExporter` | OTLP HTTP endpoint for OpenTelemetry export. Omit to disable |
| `Application:ClientCredentialsConfigs` | OAuth2 client credentials for service-to-service calls |
| `Cors:Origins` | Allowed CORS origins |
| `EmailSettings:FromEmail` | Sender email address (must be a licensed Microsoft 365 mailbox) |
| `EmailSettings:FromName` | Sender display name |
| `EmailSettings:TenantId` | Azure AD tenant ID owning the app registration |
| `EmailSettings:ApplicationId` | Azure AD app registration client ID |
| `EmailSettings:Secret` | Azure AD app registration client secret |
| `EmailSettings:SaveSentItems` | Whether Microsoft Graph saves sent emails to the Sent Items folder |

### Default Ports

| Environment | Port |
|---|---|
| Local development | `8007` |
| Docker | `8080` |

---

## Refit Client

The `SmartAccess.Notifications.Api` project provides a typed `INotificationApi` Refit client for use by other services:

```csharp
public interface INotificationApi
{
    [Get("/blueprints")]
    Task<List<NotificationBlueprint>> GetBluepints(CancellationToken cancellationToken = default);

    [Get("/blueprints/{blueprint}/properties")]
    Task<List<string>> GetBlueprintProperties(string blueprint, CancellationToken cancellationToken = default);

    [Get("/blueprints/{blueprint}/actions")]
    Task<List<NotificationAction>> GetActions(string blueprint, CancellationToken cancellationToken = default);

    [Get("/actions/{id}")]
    Task<NotificationAction> GetAction(Guid id, CancellationToken cancellationToken = default);

    [Post("/blueprints/{blueprint}/actions")]
    Task<NotificationAction> CreateAction(string blueprint, [Body] NotificationAction action, CancellationToken cancellationToken = default);

    [Put("/actions/{actionId}")]
    Task<NotificationAction> UpdateAction(Guid actionId, [Body] NotificationAction action, CancellationToken cancellationToken = default);

    [Delete("/actions/{actionId}")]
    Task DeleteAction(Guid actionId, CancellationToken cancellationToken = default);

    [Get("/channels")]
    Task<List<NotificationChannel>> GetNotificationChannels(CancellationToken cancellationToken = default);
}
```
