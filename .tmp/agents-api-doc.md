
# API Reference: Agents

**Status:** Reference  
**Created:** 2026-03-02

---

## Overview

The Agents API manages on-premises Smart Access agents — software processes that bridge the cloud application to physical access control hardware (kiosks, badge printers, encoders, access control systems).

Each agent registers with the server, receives configuration, and reports health status back via a persistent gRPC stream. The REST API documented here is used to provision, configure, and monitor agents.

---

## Base URL

All endpoints are relative to the Agent Server base URL. There is no versioned path prefix.

```
/agents
```

---

## Authentication & Authorization

All endpoints require an authenticated caller. Authorization is enforced via the following permission scopes defined in `AgentPermissions`:

| Permission | Value | Required by |
|---|---|---|
| View Agents | `"View Agents"` | GET endpoints |
| Manage Agents | `"Edit and Delete Agents"` | POST, PUT, DELETE endpoints |
| Generate Agent Certificates | `"Generate Agent Certificates"` | Certificate endpoint |

---

## Error Handling

This API uses the [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) format for all error responses, as provided by Wolverine's default error handling middleware.

### ProblemDetails

```json
{
  "type": "https://httpstatuses.io/404",
  "title": "Not Found",
  "status": 404,
  "detail": "string (optional)",
  "instance": "string (optional)"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `string` | URI reference identifying the problem type |
| `title` | `string` | Short, human-readable summary |
| `status` | `integer` | HTTP status code |
| `detail` | `string?` | Human-readable explanation of the specific occurrence |
| `instance` | `string?` | URI reference identifying the specific occurrence |

### ValidationProblemDetails

Validation errors extend `ProblemDetails` with an `errors` map:

```json
{
  "type": "https://httpstatuses.io/400",
  "title": "Agent name already in use",
  "status": 400,
  "errors": {
    "Name": ["Agent name already in use"]
  }
}
```

### Common HTTP Status Codes

| Status | Meaning |
|---|---|
| `200 OK` | Request succeeded, body contains result |
| `201 Created` | Resource created, `Location` header and body contain new resource |
| `204 No Content` | Request succeeded, no response body |
| `400 Bad Request` | Validation failure — returns `ValidationProblemDetails` |
| `401 Unauthorized` | Missing or invalid authentication |
| `403 Forbidden` | Authenticated but missing required permission |
| `404 Not Found` | Resource not found — returns `ProblemDetails` |
| `500 Internal Server Error` | Unhandled server error — returns `ProblemDetails` |

---

## Pagination

All list endpoints return a paginated `Page<T>` response. Query parameters for pagination and sorting are inherited from the `PagedRequest` base.

### Page\<T\>

```json
{
  "currentPage": 0,
  "pageSize": 25,
  "totalPages": 4,
  "totalItems": 100,
  "isLastPage": false,
  "items": []
}
```

| Field | Type | Description |
|---|---|---|
| `currentPage` | `integer` | Zero-based current page index |
| `pageSize` | `integer` | Number of items per page |
| `totalPages` | `integer?` | Total number of pages. `null` if `totalItems` is unknown |
| `totalItems` | `integer?` | Total number of matching items. May be `null` |
| `isLastPage` | `boolean` | `true` if there are no further pages |
| `items` | `T[]` | The items on this page |

### PagedRequest Query Parameters

Inherited by all list requests.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | `integer` | `0` | Zero-based page index |
| `pageSize` | `integer` | `25` | Number of items per page |
| `sortAscending` | `boolean` | `false` | Sort direction |
| `sortColumn` | `string` | `""` | Field name to sort by |

---

## Endpoints

### GET /agents/{agentId}

Get details of a specific agent by ID.

**Permission:** `View Agents`

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `agentId` | `uuid` | Unique identifier of the agent |

#### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Agent` | Agent found and returned |
| `404 Not Found` | `ProblemDetails` | No agent with the given ID exists |

---

### GET /agents

List agents with optional filtering and pagination.

**Permission:** `View Agents`

#### Query Parameters

Inherits all `PagedRequest` parameters, plus:

| Parameter | Type | Description |
|---|---|---|
| `name` | `string?` | Filter by partial name match (case-sensitive contains) |
| `statuses` | `AgentStatus[]` | Filter to agents with any of the given statuses. Repeatable: `?statuses=Operational&statuses=Disconnected` |
| `agentTypes` | `AgentType[]` | Filter to agents of any of the given types. Repeatable |
| `agentType` | `AgentType?` | Filter to agents of a single type. Takes effect alongside `agentTypes` |

#### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Page<Agent>` | Paginated list of matching agents |

---

### POST /agents

Create a new agent.

**Permission:** `Manage Agents`

#### Request Body

`Content-Type: application/json`

```json
{
  "name": "string",
  "type": "AgentType"
}
```

See `CreateAgentDto` below.

#### Responses

| Status | Body | Description |
|---|---|---|
| `201 Created` | `Agent` | Agent created. `Location` header set to `/agents/{id}` |
| `400 Bad Request` | `ValidationProblemDetails` | Agent name is already in use |

#### Notes

- The newly created agent is given an initial status of `Disconnected` with the message `"Agent created, not connected"`.
- A default `AgentConfiguration` is created automatically based on the agent type.

---

### PUT /agents/{agentId}

Update an agent's name.

**Permission:** `Manage Agents`

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `agentId` | `uuid` | Unique identifier of the agent |

#### Request Body

`Content-Type: application/json`

```json
{
  "name": "string"
}
```

See `EditAgentDto` below.

#### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Agent` | Agent updated and returned |
| `400 Bad Request` | `ValidationProblemDetails` | Agent name is already in use by another agent |
| `404 Not Found` | `ProblemDetails` | No agent with the given ID exists |

---

### DELETE /agents/{agentId}

Delete an agent and its associated configuration.

**Permission:** `Manage Agents`

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `agentId` | `uuid` | Unique identifier of the agent |

#### Responses

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | Agent and its configuration deleted |
| `404 Not Found` | `ProblemDetails` | No agent with the given ID exists |

#### Notes

- Deleting an agent also deletes its `AgentConfiguration` if one exists.
- An `AgentDeletedEvent` is published after successful deletion.

---

### GET /agents/{id}/configuration

Get the current configuration for an agent.

**Permission:** `Manage Agents`

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier of the agent |

#### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `AgentConfiguration` | Current configuration for the agent |
| `404 Not Found` | `ProblemDetails` | No configuration found for the given agent ID |

---

### PUT /agents/{id}/configuration

Update the configuration for an agent. The new configuration is persisted and pushed to the connected agent via the gRPC stream.

**Permission:** `Manage Agents`

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier of the agent |

#### Request Body

`Content-Type: application/json`

A `ConfigUpdate` object. Exactly one configuration variant must be set. See `ConfigUpdate` below.

#### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `AgentConfiguration` | Updated configuration |
| `404 Not Found` | `ProblemDetails` | No configuration found for the given agent ID |

#### Notes

- An `AgentConfigurationChanged` message is sent internally after the configuration is saved. The agent will receive the new configuration via its active gRPC connection.

---

### GET /agents/{id}/status

Get the status history for an agent, paginated.

**Permission:** None explicitly required (open)

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier of the agent |

#### Query Parameters

Inherits all `PagedRequest` parameters, plus:

| Parameter | Type | Description |
|---|---|---|
| `onlyBefore` | `DateTimeOffset?` | Return only reports at or before this timestamp (ISO 8601) |
| `onlyAfter` | `DateTimeOffset?` | Return only reports at or after this timestamp (ISO 8601) |
| `statuses` | `AgentStatus[]` | Filter to reports with any of the given statuses. Repeatable |

#### Sorting

The `sortColumn` parameter supports the following values:

| Value | Description |
|---|---|
| `Status` | Sort by status value |
| `ReportedAt` (default) | Sort by report timestamp |

#### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Page<AgentStatusReport>` | Paginated status history |

---

### GET /agents/{id}/certificate

Generate and retrieve an mTLS client certificate for the agent. The certificate is returned as a password-protected PFX bundle encoded in Base64.

**Permission:** `Generate Agent Certificates`

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier of the agent |

#### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `AgentCertificateDto` | Generated certificate with PFX data and password |
| `404 Not Found` | `ProblemDetails` | No agent with the given ID exists |

#### Notes

- Each call generates a new certificate. Previously issued certificates are not invalidated automatically.
- The PFX password and data must be treated as secrets. They are returned once and not stored server-side.

---

## Data Models

### Agent

Represents a registered Smart Access agent.

```json
{
  "id": "uuid",
  "name": "string",
  "type": "AgentType",
  "latestStatus": "AgentStatusReport"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier |
| `name` | `string` | Human-readable name. Must be unique across all agents |
| `type` | `AgentType` | The type of hardware or integration this agent drives |
| `latestStatus` | `AgentStatusReport` | The most recently reported status |

---

### CreateAgentDto

Request body for creating a new agent.

```json
{
  "name": "string",
  "type": "AgentType"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Unique name for the agent |
| `type` | `AgentType` | Yes | Type of agent |

---

### EditAgentDto

Request body for updating an existing agent.

```json
{
  "name": "string"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | New unique name for the agent |

---

### AgentType

Enum representing the category of hardware or integration an agent manages.

| Value | Description |
|---|---|
| `None` | No specific type assigned |
| `KioskDriver` | Physical kiosk hardware driver (RFID, QR, card dispenser/collector) |
| `UniPass` | UniPass access control integration |
| `Lenel` | Lenel OnGuard access control integration |
| `Printer` | Label/card printer |
| `Encoder` | Card encoder |
| `BadgePrinter` | Badge printer with integrated encoding station |

---

### AgentStatus

Enum representing the operational status of an agent.

| Value | Description |
|---|---|
| `Operational` | Agent is connected and functioning normally |
| `ConfigurationError` | Agent is connected but has an invalid or unsupported configuration |
| `Disconnected` | Agent is not currently connected to the server |

---

### AgentStatusReport

A single status event reported by an agent.

```json
{
  "id": "uuid",
  "agentId": "uuid",
  "status": "AgentStatus",
  "details": "string | null",
  "reportedAt": "2026-01-01T00:00:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier for this status report |
| `agentId` | `uuid` | The agent this report belongs to |
| `status` | `AgentStatus` | The reported status |
| `details` | `string?` | Optional human-readable message with additional context |
| `reportedAt` | `DateTimeOffset` | ISO 8601 timestamp of when the status was reported |

---

### AgentConfiguration

Stores the current configuration persisted for an agent.

```json
{
  "agentId": "uuid",
  "configuration": "ConfigUpdate"
}
```

| Field | Type | Description |
|---|---|---|
| `agentId` | `uuid` | The agent this configuration belongs to |
| `configuration` | `ConfigUpdate` | The active configuration. Only one variant is set at a time |

---

### ConfigUpdate

A discriminated union of agent-type-specific configuration objects. Exactly one field should be set, matching the agent's `AgentType`.

```json
{
  "lenel": null,
  "unipass": null,
  "kioskDriver": null,
  "printerConfig": null,
  "badgePrinterConfig": null,
  "encoderConfig": null
}
```

| Field | Type | Used by `AgentType` |
|---|---|---|
| `lenel` | `LenelConfiguration?` | `Lenel` |
| `unipass` | `UnipassConfiguration?` | `UniPass` |
| `kioskDriver` | `KioskDriverConfiguration?` | `KioskDriver` |
| `printerConfig` | `PrinterConfiguration?` | `Printer` |
| `badgePrinterConfig` | `BadgePrinterConfiguration?` | `BadgePrinter` |
| `encoderConfig` | `EncoderConfiguration?` | `Encoder` |

---

#### LenelConfiguration

```json
{
  "url": "string",
  "username": "string",
  "password": "string",
  "validateSsl": true,
  "directoryId": "string",
  "applicationId": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `url` | `string` | Base URL of the Lenel OnGuard API |
| `username` | `string` | Service account username |
| `password` | `string` | Service account password |
| `validateSsl` | `boolean` | Whether to validate the server's TLS certificate |
| `directoryId` | `string` | Lenel directory ID |
| `applicationId` | `string` | Lenel application ID |

---

#### UnipassConfiguration

```json
{
  "url": "string",
  "apiKey": "string",
  "validateSsl": true,
  "timeZone": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `url` | `string` | Base URL of the UniPass API |
| `apiKey` | `string` | API key for authentication |
| `validateSsl` | `boolean` | Whether to validate the server's TLS certificate |
| `timeZone` | `string` | IANA time zone identifier used for scheduling logic |

---

#### KioskDriverConfiguration

```json
{
  "collector": "CollectorConfiguration",
  "dispenser": "DispenserConfiguration",
  "readers": "ReaderConfiguration",
  "qrReader": "QrReaderConfiguration",
  "eidReader": "EidReaderConfiguration",
  "driverSettings": "DriverConfiguration"
}
```

| Field | Type | Description |
|---|---|---|
| `collector` | `CollectorConfiguration` | Card collector hardware settings |
| `dispenser` | `DispenserConfiguration` | Card dispenser hardware settings |
| `readers` | `ReaderConfiguration` | RFID/smart card reader polling settings |
| `qrReader` | `QrReaderConfiguration` | QR code reader settings |
| `eidReader` | `EidReaderConfiguration` | Electronic ID reader settings |
| `driverSettings` | `DriverConfiguration` | Feature flags enabling individual hardware modules |

**DriverConfiguration**

| Field | Type | Description |
|---|---|---|
| `enableRfid` | `boolean` | Enable RFID card reading |
| `enableQr` | `boolean` | Enable QR code scanning |
| `enableCollector` | `boolean` | Enable card collector module |
| `enableDispenser` | `boolean` | Enable card dispenser module |
| `enableEid` | `boolean` | Enable electronic ID reading |
| `enablePassport` | `boolean` | Enable passport scanning |

**CollectorConfiguration**

| Field | Type | Description |
|---|---|---|
| `comPort` | `string` | Serial COM port for the collector |
| `readerId` | `integer` | Reader hardware ID |

**DispenserConfiguration**

| Field | Type | Description |
|---|---|---|
| `comPort` | `string` | Serial COM port for the dispenser |
| `readerId` | `integer` | Reader hardware ID |

**ReaderConfiguration**

| Field | Type | Description |
|---|---|---|
| `readingTimeout` | `integer` | Timeout in milliseconds for a single read attempt |
| `pollingInterval` | `integer` | Interval in milliseconds between polling attempts |

**QrReaderConfiguration**

| Field | Type | Description |
|---|---|---|
| `comPort` | `string` | Serial COM port for the QR reader |

**EidReaderConfiguration**

| Field | Type | Description |
|---|---|---|
| `pollingInterval` | `integer` | Interval in milliseconds between polling attempts |
| `bypassPin` | `boolean` | Skip PIN verification when reading the eID |

---

#### PrinterConfiguration

```json
{
  "printerType": "string",
  "printOverUsb": false,
  "useSpooler": false,
  "ipAddress": "string",
  "port": 9100,
  "printerName": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `printerType` | `string` | Printer model or driver identifier |
| `printOverUsb` | `boolean` | Use USB connection instead of network |
| `useSpooler` | `boolean` | Route print jobs through the OS print spooler |
| `ipAddress` | `string` | Network IP address of the printer (when not USB) |
| `port` | `integer` | TCP port of the printer (when not USB) |
| `printerName` | `string` | OS-registered printer name |

---

#### BadgePrinterConfiguration

```json
{
  "printerType": "string",
  "readerName": "string",
  "verboseLogging": false,
  "printerName": "string",
  "encodingStation": "string",
  "hopper": 1,
  "comPort": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `printerType` | `string` | Badge printer model or driver identifier |
| `readerName` | `string` | Name of the integrated card reader |
| `verboseLogging` | `boolean` | Enable detailed diagnostic logging |
| `printerName` | `string` | OS-registered printer name |
| `encodingStation` | `string` | Identifier for the encoding station module |
| `hopper` | `integer` | Card hopper slot index |
| `comPort` | `string` | Serial COM port for the printer |

---

#### EncoderConfiguration

```json
{
  "encoderType": "string",
  "encoderName": "string",
  "verboseLogging": false,
  "comPort": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `encoderType` | `string` | Encoder model or driver identifier |
| `encoderName` | `string` | Human-readable name for the encoder |
| `verboseLogging` | `boolean` | Enable detailed diagnostic logging |
| `comPort` | `string` | Serial COM port for the encoder |

---

### AgentCertificateDto

Contains the generated mTLS client certificate for an agent.

```json
{
  "agent": "Agent",
  "pfxPassword": "string",
  "pfxDataBase64": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `agent` | `Agent` | The agent the certificate was generated for |
| `pfxPassword` | `string` | Password protecting the PFX bundle. Treat as a secret |
| `pfxDataBase64` | `string` | Base64-encoded PKCS#12 (PFX) certificate bundle |

---

## Domain Events

The following events are published when agent lifecycle changes occur. They are consumed internally by other services via the Wolverine message bus.

| Event | Trigger |
|---|---|
| `AgentCreatedEvent` | A new agent is created via `POST /agents` |
| `AgentDeletedEvent` | An agent is deleted via `DELETE /agents/{agentId}` |
| `AgentChangedEvent` | An agent's details are modified |
| `AgentStatusChangedEvent` | An agent reports a new status via the gRPC stream |
| `AgentConfigurationChanged` | An agent's configuration is updated via `PUT /agents/{id}/configuration` |
