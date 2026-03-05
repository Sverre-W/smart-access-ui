
# API Reference: Settings Server

**Status:** Reference  
**Created:** 2026-03-03

---

## Overview

The Settings Server is the central authority for the Smart Access platform. It manages:

- **Tenants** — creating, updating, and deleting tenant registrations including their identity provider (IDP) configuration and feature flags.
- **Roles & Permissions** — defining roles and assigning application-level permissions to them. All other services call this API at startup to register their permission sets, and at runtime to resolve user permissions.
- **Themes** — per-tenant UI color configuration for light and dark mode.
- **Service Configuration** — storing and retrieving opaque, versioned configuration blobs per tenant and service name.

Unlike other services, Settings Server resolves permissions directly from its own database rather than calling itself via the API.

---

## Base URL

All endpoints are relative to the Settings Server base URL. There is no versioned path prefix.

```
/api
```

---

## Authentication & Authorization

All endpoints use Bearer JWT authentication with multi-tenant validation. The token issuer is matched against the tenant's registered identity provider to select the correct validation parameters.

Four distinct authorization tiers are used:

| Tier | Mechanism | Used by |
|---|---|---|
| Anonymous | `[AllowAnonymous]` | `POST /api/tenants/root` |
| Authenticated | `[Authorize]` | `GET /api/permissions` |
| Internal service token | `[Permissions("internal")]` | `POST /api/permissions/register`, `GET /api/permissions/all` |
| User permission | `[Permissions(...)]` | All remaining endpoints |

### Internal Service Tokens

Requests carrying a JWT issued by the internal Axxession issuer with either the `axxession:internal` scope or an `axxession` claim containing `"internal"` are granted access to all `[Permissions("internal")]` endpoints unconditionally, regardless of tenant or role.

### User Permissions

Permissions for user-facing endpoints are resolved by looking up the roles in the user's JWT claims (`role` / `roles` / `ClaimTypes.Role`) against the `Role` documents stored in Marten for the current tenant.

Permission values defined in `SettingsPermissions`:

| Constant | Value | Tier |
|---|---|---|
| `TenantsRead` | `"tenants.read"` | Root-tenant only |
| `TenantsWrite` | `"tenants.write"` | Root-tenant only |
| `RolesRead` | `"roles.read"` | Tenant-level |
| `RolesWrite` | `"roles.write"` | Tenant-level |

Root-tenant-only endpoints additionally require `[RequireRootTenant]`. This checks that the authenticated tenant (resolved from the request) has `IsRootTenant == true`.

---

## Serialization

- All request and response bodies use **camelCase JSON** (ASP.NET Core Minimal API default).
- Enums are serialized as **integers** (Marten default; no `JsonStringEnumConverter` is registered in this service).
- `FeatureFlags` is a `[Flags]` enum and its value is the combined integer bitmask.

---

## Error Handling

Settings Server does not register a global Wolverine exception policy. Errors are returned as plain HTTP status codes using ASP.NET Core's `Results` helpers. Error responses have **no body** unless specified in the endpoint description.

### Common HTTP Status Codes

| Status | Meaning |
|---|---|
| `200 OK` | Request succeeded, body contains result |
| `201 Created` | Resource created, `Location` header and body contain the new resource |
| `204 No Content` | Request succeeded, no response body |
| `400 Bad Request` | Invalid input (no body) |
| `401 Unauthorized` | Missing or invalid authentication token |
| `403 Forbidden` | Authenticated but insufficient permissions or root-tenant requirement not met |
| `404 Not Found` | Resource not found (no body) |

---

## List Filtering & Sorting

List endpoints accept query parameters from `QueryRequest`. Results are returned as full arrays — there is no pagination.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `sortColumn` | `string?` | varies | Field name to sort by. Accepted values are documented per endpoint |
| `sortAscending` | `boolean` | `true` | Sort direction |
| `query` | `string?` | — | Case-insensitive contains filter applied to a name field |

---

## Endpoints

### Tenants

---

#### POST /api/tenants/root

Bootstrap the platform by creating the root tenant. Only succeeds if no tenants exist yet. Also seeds a default role (named by `defaultRole`) with all Settings Server permissions.

**Authorization:** Anonymous (`[AllowAnonymous]`)

**Request Body:** `CreateTenantRequest`

```json
{
  "tenantId": "string",
  "displayName": "string",
  "isRootTenant": true,
  "defaultRole": "admin",
  "features": 0,
  "idpSettings": {
    "metadataUrl": "string",
    "authority": "string",
    "clientId": "string",
    "responseTypes": "string",
    "scopes": ["string"],
    "loginRedirectUri": "string",
    "logoutRedirectUri": "string"
  }
}
```

> `isRootTenant` must be `true`. `authority` is derived automatically from `metadataUrl` (the `/.well-known/openid-configuration` suffix is stripped).

**Responses**

| Status | Body | Description |
|---|---|---|
| `201 Created` | `CreateTenantRequest` | Root tenant created. `Location` set to `/api/tenants/{tenantId}` |
| `400 Bad Request` | — | `isRootTenant` was `false` |
| `403 Forbidden` | — | At least one tenant already exists |

---

#### POST /api/tenants

Create a new (non-root) tenant. Also seeds a default role for the new tenant with all tenant-level Settings Server permissions.

**Authorization:** `[Permissions("tenants.write")]` + `[RequireRootTenant]`

**Request Body:** `CreateTenantRequest` (same shape as above; `isRootTenant` must be `false`)

**Responses**

| Status | Body | Description |
|---|---|---|
| `201 Created` | `CreateTenantRequest` | Tenant created. `Location` set to `/api/tenants/{tenantId}` |
| `400 Bad Request` | — | `isRootTenant` was `true` |

**Integration Events Published**

| Event | Description |
|---|---|
| `TenantCreated` | Published after the tenant is persisted |

---

#### GET /api/tenants

List all tenants.

**Authorization:** `[Permissions("tenants.read")]` + `[RequireRootTenant]`

**Query Parameters:** `QueryRequest`

Supported `sortColumn` values:

| Value | Description |
|---|---|
| `DisplayName` (default) | Sort by display name |
| `TenantId` | Sort by tenant ID |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `TenantInfo[]` | Full list of tenants matching the query |

---

#### GET /api/tenants/{id}

Get a single tenant by ID.

**Authorization:** `[Permissions("tenants.read")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `TenantInfo` | Tenant found and returned |
| `404 Not Found` | — | No tenant with the given ID exists |

---

#### PUT /api/tenants/{id}

Update an existing tenant. The `tenantId` in the body is ignored — the path parameter is authoritative. `authority` is derived automatically from `metadataUrl`.

**Authorization:** `[Permissions("tenants.write")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |

**Request Body:** `TenantInfo`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `TenantInfo` | Updated tenant |
| `404 Not Found` | — | No tenant with the given ID exists |

**Integration Events Published**

| Event | Description |
|---|---|
| `TenantChanged` | Published after the tenant is updated |

---

#### DELETE /api/tenants/{id}

Delete a tenant.

**Authorization:** `[Permissions("tenants.write")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |

**Responses**

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | Tenant deleted |
| `404 Not Found` | — | No tenant with the given ID exists |

**Integration Events Published**

| Event | Description |
|---|---|
| `TenantDeleted` | Published after the tenant is deleted |

---

### Themes

---

#### GET /api/tenants/{id}/theme

Get the UI theme settings for a tenant. Returns default colors if no theme has been stored.

**Authorization:** `[Permissions("tenants.read")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ThemeSettings` | Theme settings (defaults applied if not yet configured) |

---

#### PUT /api/tenants/{id}/theme

Store or replace the UI theme settings for a tenant.

**Authorization:** `[Permissions("tenants.write")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |

**Request Body:** `ThemeSettings`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ThemeSettings` | Stored theme settings |

---

### Authorization

---

#### GET /api/authorization/roles

List roles for the current tenant.

**Authorization:** `[Permissions("roles.read")]`

**Query Parameters:** `QueryRequest`

Supported `sortColumn` values:

| Value | Description |
|---|---|
| `Name` (default) | Sort by role name |
| `Description` | Sort by description |

The `query` parameter filters by case-insensitive `Name` contains.

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Role[]` | All matching roles |

---

#### POST /api/authorization/roles

Create a new role in the current tenant.

**Authorization:** `[Permissions("roles.write")]`

**Request Body:** `Role`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Role` | Created role |

**Integration Events Published**

| Event | Description |
|---|---|
| `RoleChanged` (`Created`) | Published after the role is persisted |

---

#### PUT /api/authorization/roles/{roleName}

Update an existing role. If the name changes, a `RoleRenamed` event is published. If permissions change, a `RoleChanged` event is published.

**Authorization:** `[Permissions("roles.write")]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `roleName` | `string` | The current name of the role (case-sensitive) |

**Request Body:** `Role`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Role` | Updated role |
| `404 Not Found` | — | No role with the given name exists |

**Integration Events Published**

| Event | Condition |
|---|---|
| `RoleRenamed` | Published when the role name differs from `roleName` |
| `RoleChanged` (`Updated`) | Published when the permissions count changes |

---

#### DELETE /api/authorization/roles/{roleName}

Delete a role from the current tenant.

**Authorization:** `[Permissions("roles.write")]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `roleName` | `string` | The name of the role to delete (case-sensitive) |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Role` | The deleted role |
| `404 Not Found` | — | No role with the given name exists |

**Integration Events Published**

| Event | Description |
|---|---|
| `RoleChanged` (`Deleted`) | Published after the role is deleted |

---

#### GET /api/authorization/applications

List all registered `ApplicationPermissionSet` entries, ordered by application name.

**Authorization:** `[Permissions("roles.read")]`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ApplicationPermissionSet[]` | All registered application permission sets |

---

### Permissions

---

#### POST /api/permissions/register

Register or update an application's permission set. Called by each service at startup to declare the permissions it uses.

**Authorization:** `[Permissions("internal")]` — internal service tokens only

**Request Body:** `ApplicationPermissionSet`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ApplicationPermissionSet` | The stored permission set |

---

#### GET /api/permissions

Resolve all permissions held by the currently authenticated user across all applications. Aggregates permissions from all roles the user holds (de-duplicated).

**Authorization:** `[Authorize]`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ApplicationPermissionSet[]` | Aggregated permission sets for the user's roles |

---

#### GET /api/permissions/all

Retrieve permissions for a set of named roles within a specific application. Used by other services to resolve user permissions at runtime.

**Authorization:** `[Permissions("internal")]` — internal service tokens only

**Query Parameters**

| Parameter | Type | Description |
|---|---|---|
| `application` | `string` | The application name to filter permissions by |
| `roles` | `string[]` | Role names to look up. Repeatable: `?roles=admin&roles=viewer` |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `PermissionData[]` | One entry per requested role. Roles with no matching record are included with an empty `permissions` list |

---

### Service Configuration

---

#### GET /api/tenants/{id}/configuration/{service}

Retrieve the stored configuration for a specific service and tenant.

**Authorization:** `[Permissions("tenants.read")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |
| `service` | `string` | The service name (e.g. `"aeos"`, `"lenel"`) |

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ServiceConfigurationDto` | Stored configuration blob |
| `404 Not Found` | — | No configuration stored for this tenant + service combination |

---

#### POST /api/tenants/{id}/configuration/{service}

Create or update the configuration for a specific service and tenant (upsert).

**Authorization:** `[Permissions("tenants.write")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |
| `service` | `string` | The service name |

**Request Body:** `ServiceConfigurationDto`

**Responses**

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ServiceConfigurationDto` | The stored configuration blob |

---

#### DELETE /api/tenants/{id}/configuration/{service}

Delete the stored configuration for a specific service and tenant.

**Authorization:** `[Permissions("tenants.read")]` + `[RequireRootTenant]`

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | `string` | The tenant ID |
| `service` | `string` | The service name |

**Responses**

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | Configuration deleted |
| `404 Not Found` | — | No configuration stored for this tenant + service combination |

---

## Data Models

### TenantInfo

Represents a registered tenant.

```json
{
  "tenantId": "string",
  "displayName": "string",
  "isRootTenant": false,
  "features": 0,
  "idpSettings": {
    "metadataUrl": "string",
    "authority": "string",
    "clientId": "string",
    "responseTypes": "string",
    "scopes": ["string"],
    "loginRedirectUri": "string",
    "logoutRedirectUri": "string"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `tenantId` | `string` | Unique identifier for the tenant |
| `displayName` | `string` | Human-readable name |
| `isRootTenant` | `boolean` | `true` if this tenant can manage other tenants |
| `features` | `FeatureFlags` | Integer bitmask of enabled features |
| `idpSettings` | `IdpSettings` | Identity provider configuration |

---

### IdpSettings

Identity provider configuration required for JWT authentication.

| Field | Type | Description |
|---|---|---|
| `metadataUrl` | `string` | Full URL to the OIDC discovery document (`.well-known/openid-configuration`) |
| `authority` | `string` | Base authority URL. Derived automatically from `metadataUrl` on write |
| `clientId` | `string` | OAuth client ID for end-user authentication |
| `responseTypes` | `string` | OAuth response types (e.g. `"code"`) |
| `scopes` | `string[]` | Scopes to request during authentication |
| `loginRedirectUri` | `string` | Post-login redirect URL |
| `logoutRedirectUri` | `string` | Post-logout redirect URL |

---

### FeatureFlags

Integer bitmask enum. Combine values with bitwise OR.

| Value | Name | Description |
|---|---|---|
| `0` | `None` | No features enabled |
| `1` | `DesfireEncoding` | DESFire card encoding server |
| `2` | `ReceptionDesk` | Reception desk module |
| `4` | `AutomationEngine` | Automation engine |
| `8` | `Agents` | On-premises agents |
| `16` | `Visitors` | Visitor management |
| `32` | `Kiosk` | Self-service kiosk |
| `64` | `Notifications` | Notification service |
| `128` | `AccessPolicies` | Access policies module |
| `256` | `Locations` | Locations module |

---

### CreateTenantRequest

Extends `TenantInfo` with an additional field used only at creation time.

| Field | Type | Default | Description |
|---|---|---|---|
| *(all `TenantInfo` fields)* | | | |
| `defaultRole` | `string` | `"admin"` | Name of the default role seeded for the new tenant |

---

### ThemeSettings

Per-tenant UI color theme.

```json
{
  "tenantId": "string",
  "lightTheme": { },
  "darkTheme": { }
}
```

| Field | Type | Description |
|---|---|---|
| `tenantId` | `string` | The owning tenant ID |
| `lightTheme` | `ThemeColors` | Colors for light mode |
| `darkTheme` | `ThemeColors` | Colors for dark mode |

---

### ThemeColors

A set of semantic color slots. All values are CSS hex color strings.

| Field | Default (light) | Description |
|---|---|---|
| `primary` | `"#275788"` | Primary brand color |
| `primaryContrastText` | `"#ffffff"` | Text on primary backgrounds |
| `secondary` | `"#e67e22"` | Secondary/accent color |
| `secondaryContrastText` | `"#ffffff"` | Text on secondary backgrounds |
| `info` | `"#17a2b8"` | Informational color |
| `infoContrastText` | `"#ffffff"` | Text on info backgrounds |
| `warning` | `"#f0ad4e"` | Warning color |
| `warningContrastText` | `"#000000"` | Text on warning backgrounds |
| `error` | `"#d9534f"` | Error color |
| `errorContrastText` | `"#ffffff"` | Text on error backgrounds |
| `success` | `"#5cb85c"` | Success color |
| `successContrastText` | `"#ffffff"` | Text on success backgrounds |
| `tertiary` | `"#e9ecef"` | Tertiary/neutral color |
| `tertiaryContrastText` | `"#000000"` | Text on tertiary backgrounds |

---

### Role

A named role that carries a set of per-application permissions.

```json
{
  "name": "string",
  "description": "string",
  "permissions": []
}
```

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Role name as provided by the IDP. Case-sensitive. Used as the document identity |
| `description` | `string?` | Optional human-readable description |
| `permissions` | `ApplicationPermissionSet[]` | Permissions granted by this role, grouped by application |

---

### ApplicationPermissionSet

A set of permissions belonging to a single application.

```json
{
  "application": "string",
  "permissions": ["string"],
  "rootTenantPermissions": ["string"]
}
```

| Field | Type | Description |
|---|---|---|
| `application` | `string` | The application name this set belongs to |
| `permissions` | `string[]` | Permissions available to all tenants |
| `rootTenantPermissions` | `string[]` | Additional permissions only applicable to the root tenant |

---

### PermissionData

Resolved permissions for a single role within a specific application.

```json
{
  "role": "string",
  "permissions": ["string"]
}
```

| Field | Type | Description |
|---|---|---|
| `role` | `string` | The role name |
| `permissions` | `string[]` | Permission strings held by this role for the requested application |

---

### ServiceConfigurationDto

An opaque, versioned configuration blob stored per tenant and service. Consuming services use `ServiceConfigurationDto.Of<T>(data)` to serialize their configuration into this format.

```json
{
  "dataType": "string",
  "dataVersion": "string",
  "data": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `dataType` | `string` | Assembly-qualified type name of the serialized object |
| `dataVersion` | `string` | Schema version. Current version is `"1.0"` |
| `data` | `string` | JSON-serialized configuration payload |

---

## Integration Events

The following events are published to RabbitMQ via Wolverine when tenant and role lifecycle changes occur.

| Event | Trigger | Fields |
|---|---|---|
| `TenantCreated` | `POST /api/tenants` | `tenantId: string` |
| `TenantChanged` | `PUT /api/tenants/{id}` | `tenantId: string` |
| `TenantDeleted` | `DELETE /api/tenants/{id}` | `tenantId: string` |
| `RoleChanged` | `POST`, `PUT`, `DELETE /api/authorization/roles/...` | `roleName: string`, `changeType: RoleChangeType` |
| `RoleRenamed` | `PUT /api/authorization/roles/{roleName}` (name changed) | `oldName: string`, `newName: string` |

### RoleChangeType

| Value | Description |
|---|---|
| `0` | `Created` |
| `1` | `Updated` |
| `2` | `Deleted` |
