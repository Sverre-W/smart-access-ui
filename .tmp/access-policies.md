
# API Reference: Access Policies

**Status:** Reference  
**Created:** 2026-03-02

---

## Overview

The Access Policies API manages the bridge between Smart Access policy rules and physical access control systems (Lenel OnGuard, UniPass). It covers three concerns:

- **Systems** — registering and configuring access control systems backed by an Agent
- **Rule Sets** — defining policy rules that determine what access a subject (visitor, employee, contractor) should be granted
- **Operational Directives** — issuing and revoking one-off access grants outside the normal policy evaluation flow

---

## Base URL

All endpoints are relative to the Access Policies service base URL. There is no versioned path prefix.

```
/systems
/rule-sets
/operational-directives
```

---

## Authentication & Authorization

All endpoints require an authenticated caller. Authorization is enforced via the following permission scopes defined in `AccessPolicyPermissions`:

| Permission | Value | Required by |
|---|---|---|
| Read Systems | `"Read systems"` | GET endpoints on `/systems` |
| Write Systems | `"Write systems"` | POST, PUT, DELETE endpoints on `/systems` |
| Read Rule Sets | `"Read rule sets"` | GET endpoints on `/rule-sets` |
| Write Rule Sets | `"Write rule sets"` | POST, PUT, DELETE endpoints on `/rule-sets` |

Operational directive endpoints do not declare an explicit permission scope beyond authenticated access.

---

## Serialization

### Enums

All enum values are serialized as **strings** in the HTTP API layer (e.g. `"Lenel"`, `"Visitor"`). Integer values should not be sent or relied on.

### Polymorphic Types

Several request and response types are polymorphic interfaces. These use a `$type` string discriminator property to identify the concrete type. The discriminator must be included when sending polymorphic values in request bodies.

| Interface | Discriminator property | Variants |
|---|---|---|
| `ISystemConfigurationDto` | `$type` | `UnipassSystemConfigurationDto` |
| `ISystemMetadataConfigurationDto` | `$type` | `UnipassMetaDataDto` |
| `IAccessRequirementDto` | `$type` | `CredentialOwnershipRequirementDto`, `GroupMembershipRequirementDto`, `AccessAssignmentRequirementDto` |
| `IAccessGrantDto` | `$type` | `OwnsCredentialDto`, `MemberOfGroupDto`, `AssignedAccessDto` |

Example — sending a `UnipassSystemConfigurationDto` as `ISystemConfigurationDto`:

```json
{
  "$type": "UnipassSystemConfigurationDto",
  "badgeTypes": [],
  "accessAssignments": []
}
```

Example — sending a `CredentialOwnershipRequirementDto` as `IAccessRequirementDto`:

```json
{
  "$type": "CredentialOwnershipRequirementDto",
  "badgeTypeId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "badgeNumber": null
}
```

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
  "title": "Agent not found",
  "status": 400,
  "errors": {
    "Agent": ["The specified Agent does not exist."]
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

List endpoints that support pagination return a `Page<T>` response. Query parameters for pagination and sorting are inherited from `BaseListRequest`.

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
| `totalPages` | `integer?` | Total number of pages. `null` if unknown |
| `totalItems` | `integer?` | Total number of matching items. May be `null` |
| `isLastPage` | `boolean` | `true` if there are no further pages |
| `items` | `T[]` | The items on this page |

### BaseListRequest Query Parameters

Inherited by all paginated list requests.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | `integer` | `0` | Zero-based page index |
| `pageSize` | `integer` | `25` | Number of items per page |
| `sortAscending` | `boolean` | `true` | Sort direction |
| `sortColumn` | `string` | `""` | Field name to sort by |

---

## Endpoints

### Systems

#### GET /systems/agents

List agents available to back an access control system. Returns agents that are currently connected and of a supported type (`Lenel` or `UniPass`).

**Permission:** `Read systems`

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `EntityLink[]` | List of available agents as `{ id, name }` links |

---

#### GET /systems

List all configured access control systems.

**Permission:** `Read systems`

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `SystemDto[]` | All configured systems |

---

#### GET /systems/{systemId}

Get a specific access control system by ID.

**Permission:** `Read systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `SystemDto` | System found and returned |
| `404 Not Found` | `ProblemDetails` | No system with the given ID exists |

---

#### POST /systems

Create a new access control system from an existing agent. The system type (Lenel or UniPass) is derived from the agent's type. A default empty configuration is created automatically.

**Permission:** `Write systems`

##### Request Body

`Content-Type: application/json`

```json
{
  "agent": {
    "id": "uuid-string",
    "name": "string"
  }
}
```

See `CreateSystemRequest` below.

##### Responses

| Status | Body | Description |
|---|---|---|
| `201 Created` | `SystemDto` | System created. `Location` header set to `/systems/{id}` |
| `400 Bad Request` | `ValidationProblemDetails` | Agent ID is not a valid GUID, or the referenced agent does not exist |

##### Notes

- Only agents of type `Lenel` or `UniPass` are supported. Any other agent type returns a 500 error.
- The system name is taken from the agent name.

---

#### DELETE /systems/{systemId}

Delete an access control system and clean up its associated external identity mappings and managed resources.

**Permission:** `Write systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Responses

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | System deleted |
| `404 Not Found` | `ProblemDetails` | No system with the given ID exists |

---

#### GET /systems/{systemId}/configuration

Get the current configuration for a system.

**Permission:** `Read systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ISystemConfigurationDto` | Current configuration. Includes `$type` discriminator |
| `404 Not Found` | `ProblemDetails` | No system with the given ID exists |

---

#### PUT /systems/{systemId}/configuration

Update the configuration for a system. Only `UnipassSystemConfigurationDto` is currently accepted; Lenel configuration is not yet configurable via this endpoint.

**Permission:** `Write systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Request Body

`Content-Type: application/json`

An `ISystemConfigurationDto` object. Must include the `$type` discriminator. See the [Polymorphic Types](#polymorphic-types) section.

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ISystemConfigurationDto` | Updated configuration |
| `400 Bad Request` | `ProblemDetails` | Body could not be deserialized |
| `404 Not Found` | `ProblemDetails` | No system with the given ID exists |

---

#### GET /systems/{systemId}/metadata

Fetch live metadata from the access control system (e.g. available sites and access rules from UniPass). This calls the underlying access system integration — requires the backing agent to be connected.

**Permission:** `Read systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ISystemMetadataConfigurationDto` | Live metadata. Includes `$type` discriminator |

---

#### GET /systems/{systemId}/access-rules

List the assignable access rules defined in the system's configuration.

**Permission:** `Read systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `EntityLink[]` | Access rules available for assignment |
| `404 Not Found` | `ProblemDetails` | No system with the given ID exists |

---

#### GET /systems/{systemId}/badge-types

List badge types configured for the system.

**Permission:** `Read systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `EntityLink[]` | Badge types available in this system |
| `404 Not Found` | `ProblemDetails` | No system with the given ID exists |

---

#### GET /systems/{systemId}/badge-types/{badgeTypeId}/badges

Get all badge numbers currently assigned under a specific badge type.

**Permission:** `Read systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |
| `badgeTypeId` | `uuid` | Unique identifier of the badge type |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `integer[]` | List of assigned badge numbers |

---

#### GET /systems/{systemId}/mappings

List external identity mappings for a system — the records linking Smart Access subjects to their external IDs in the access control system.

**Permission:** `Read systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Query Parameters

Inherits all `BaseListRequest` parameters.

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `IdentityDto[]` | External identity mappings for the system |

##### Notes

- `firstName` and `lastName` are not yet populated (pending integration with the user service) and will be returned as empty strings.

---

#### DELETE /systems/{systemId}/mappings

Delete a specific external identity mapping for a system.

**Permission:** `Write systems`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | Unique identifier of the system |

##### Request Body

`Content-Type: application/json`

An `IdentityDto` identifying the subject whose mapping should be removed.

##### Responses

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | Mapping deleted |

---

### Rule Sets

#### GET /rule-sets

List rule sets with optional filtering and pagination.

**Permission:** `Read rule sets`

##### Query Parameters

Inherits all `BaseListRequest` parameters, plus:

| Parameter | Type | Description |
|---|---|---|
| `name` | `string?` | Filter by partial name match (case-insensitive) |
| `isActive` | `boolean?` | Filter to active or inactive rule sets |

##### Sorting

The `sortColumn` parameter supports the following values:

| Value | Description |
|---|---|
| `Name` (default) | Sort by rule set name |
| `IsActive` | Sort by active status |
| `System` | Sort by system ID |
| `Id` | Sort by rule set ID |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `Page<RuleSetSummary>` | Paginated list of matching rule sets |

---

#### GET /rule-sets/{ruleSetId}

Get a specific rule set by ID, including its full rule configuration.

**Permission:** `Read rule sets`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `ruleSetId` | `uuid` | Unique identifier of the rule set |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ConfiguredRuleSet` | Rule set with its rules |
| `404 Not Found` | `ProblemDetails` | No rule set or its referenced system was found |

---

#### POST /rule-sets

Create a new rule set. The rule set is created inactive with no rules.

**Permission:** `Write rule sets`

##### Request Body

`Content-Type: application/json`

```json
{
  "name": "string",
  "system": {
    "id": "uuid-string",
    "name": "string"
  }
}
```

See `CreateRuleSetRequest` below.

##### Responses

| Status | Body | Description |
|---|---|---|
| `201 Created` | `ConfiguredRuleSet` | Rule set created. `Location` header set to `/rule-sets/{id}` |

---

#### PUT /rule-sets/{ruleSetId}

Update a rule set, including its name, active status, and full rule configuration.

**Permission:** `Write rule sets`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `ruleSetId` | `uuid` | Unique identifier of the rule set |

##### Request Body

`Content-Type: application/json`

A `ConfiguredRuleSet` object. The `id` field in the body is ignored — the path parameter takes precedence.

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `ConfiguredRuleSet` | Updated rule set |
| `404 Not Found` | `ProblemDetails` | No rule set with the given ID exists |

---

#### DELETE /rule-sets/{ruleSetId}

Delete a rule set.

**Permission:** `Write rule sets`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `ruleSetId` | `uuid` | Unique identifier of the rule set |

##### Responses

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | Rule set deleted |
| `404 Not Found` | `ProblemDetails` | No rule set with the given ID exists |

---

#### GET /rule-sets/conditions/{subject}

List the available rule conditions for a given subject type. Conditions are registered at startup by scanning assemblies for `[PolicyCondition]` attributes.

**Permission:** `Read rule sets`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `subject` | `SubjectTypes` | Subject type to get conditions for (e.g. `"Visitor"`) |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `RuleCondition[]` | Available conditions for the subject type |

---

#### GET /rule-sets/{ruleSetId}/providers/{providerName}

Get the list of selectable values for a specific value provider in the context of a rule set. Used to populate dropdowns when configuring rule conditions.

**Permission:** `Read rule sets`

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `ruleSetId` | `uuid` | Rule set that provides the system context |
| `providerName` | `string` | Name of the value provider. Must match a `ValueProviderType` enum value |

##### Supported Provider Names

| Value | Description |
|---|---|
| `VisitorLocation` | Location options for visitor-based conditions |
| `BadgeType` | Badge types configured in the system |
| `AssignableAccess` | Access rules available for assignment |

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `EntityLink[]` | Selectable `{ id, name }` values for the provider |
| `400 Bad Request` | `string` | `providerName` is not a recognized `ValueProviderType` |
| `404 Not Found` | `ProblemDetails` | No rule set with the given ID exists |

---

### Operational Directives

Operational directives are one-off access grants applied directly to a subject, bypassing the normal policy evaluation. They are used for exceptional or temporary access needs.

#### POST /operational-directives/{systemId}

Issue an operational directive for a subject on a specific system. This immediately reconciles access for the subject and returns the resulting access grant.

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | The access control system to issue the directive against |

##### Request Body

`Content-Type: application/json`

```json
{
  "subject": {
    "type": "Visitor",
    "subjectEntityId": "uuid",
    "visitId": "uuid"
  },
  "reason": "string",
  "requirement": {
    "$type": "CredentialOwnershipRequirementDto",
    "badgeTypeId": "uuid",
    "badgeNumber": null
  },
  "start": "2026-01-01",
  "end": "2026-01-02"
}
```

See `CreateOperationalDirectiveRequest` below.

##### Responses

| Status | Body | Description |
|---|---|---|
| `200 OK` | `GrantedDirective` | The directive was created and access was granted |
| `500 Internal Server Error` | `ProblemDetails` | Directive was created but no access grant was produced |

##### Notes

- Only `Visitor` subjects are currently supported. Other subject types return a 500 error.
- `start` and `end` are `DateOnly` values in ISO 8601 format (`YYYY-MM-DD`). They default to today and tomorrow respectively.
- `visitId` is required when `subject.type` is `"Visitor"`.

---

#### DELETE /operational-directives/{systemId}

Revoke a previously issued operational directive, removing the associated access grant.

##### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `systemId` | `uuid` | The access control system the directive was issued against |

##### Request Body

`Content-Type: application/json`

```json
{
  "directiveId": "uuid",
  "subject": {
    "type": "Visitor",
    "subjectEntityId": "uuid",
    "visitId": "uuid"
  }
}
```

See `RevokeOperationalDirectiveRequest` below.

##### Responses

| Status | Body | Description |
|---|---|---|
| `204 No Content` | — | Directive revoked |

---

## Data Models

### SystemDto

Represents a configured access control system.

```json
{
  "id": "uuid",
  "name": "string",
  "agentId": "uuid",
  "agentType": "Lenel"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier |
| `name` | `string` | Name inherited from the backing agent |
| `agentId` | `uuid` | ID of the agent driving this system |
| `agentType` | `SystemDtoAgentType` | The type of access control system |

---

### SystemDtoAgentType

| Value | Description |
|---|---|
| `Lenel` | Lenel OnGuard access control system |
| `Unipass` | UniPass access control system |

---

### ISystemConfigurationDto

Polymorphic. Include `$type` to identify the variant.

| `$type` value | Concrete type | Used by |
|---|---|---|
| `UnipassSystemConfigurationDto` | `UnipassSystemConfigurationDto` | `Unipass` systems |

#### UnipassSystemConfigurationDto

```json
{
  "$type": "UnipassSystemConfigurationDto",
  "badgeTypes": [
    {
      "id": "uuid",
      "name": "string",
      "startOfRange": 1000,
      "endOfRange": 1999
    }
  ],
  "accessAssignments": [
    {
      "id": "uuid",
      "name": "string",
      "canonicalAccessRule": { "id": "string", "name": "string" },
      "canonicalSite": { "id": "string", "name": "string" }
    }
  ]
}
```

**UnipassBadgeTypeDto**

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier for the badge type |
| `name` | `string` | Human-readable badge type name |
| `startOfRange` | `integer` | Lowest badge number in this type's range |
| `endOfRange` | `integer` | Highest badge number in this type's range |

**UnipassAccessAssignmentDto**

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier for the assignment |
| `name` | `string` | Human-readable assignment name |
| `canonicalAccessRule` | `EntityLink` | Reference to the UniPass access rule |
| `canonicalSite` | `EntityLink` | Reference to the UniPass site |

#### LenelConfigurationDto

Lenel systems have no configurable properties via this API.

```json
{
  "$type": "LenelConfigurationDto"
}
```

---

### ISystemMetadataConfigurationDto

Polymorphic. Include `$type` to identify the variant.

| `$type` value | Concrete type | Used by |
|---|---|---|
| `UnipassMetaDataDto` | `UnipassMetaDataDto` | `Unipass` systems |

#### UnipassMetaDataDto

Live metadata fetched from the UniPass system.

```json
{
  "$type": "UnipassMetaDataDto",
  "canonicalAccessRules": [
    { "id": "string", "name": "string" }
  ],
  "canonicalSites": [
    { "id": "string", "name": "string" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `canonicalAccessRules` | `EntityLink[]` | Access rules available in UniPass |
| `canonicalSites` | `EntityLink[]` | Sites available in UniPass |

---

### EntityLink

A lightweight reference to another entity.

```json
{
  "id": "string",
  "name": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Identifier of the referenced entity. May be a UUID or a system-specific integer string |
| `name` | `string` | Human-readable name of the referenced entity |

---

### RuleSetSummary

A lightweight view of a rule set, returned by the list endpoint.

```json
{
  "id": "uuid",
  "system": { "id": "string", "name": "string" },
  "isActive": false,
  "name": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier |
| `system` | `EntityLink` | The system this rule set applies to |
| `isActive` | `boolean` | Whether the rule set is currently used in policy evaluation |
| `name` | `string` | Human-readable name |

---

### ConfiguredRuleSet

Full representation of a rule set including its rules.

```json
{
  "id": "uuid",
  "system": { "id": "string", "name": "string" },
  "isActive": false,
  "name": "string",
  "rules": [
    {
      "name": "string",
      "subjectType": "Visitor",
      "conditions": [
        {
          "canonicalName": "string",
          "parameters": {
            "key": "value"
          }
        }
      ]
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Unique identifier |
| `system` | `EntityLink` | The system this rule set applies to |
| `isActive` | `boolean` | Whether the rule set is active |
| `name` | `string` | Human-readable name |
| `rules` | `ConfiguredRule[]` | The rules that make up this rule set |

**ConfiguredRule**

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Human-readable rule name |
| `subjectType` | `SubjectTypes` | The subject type this rule applies to |
| `conditions` | `ConfiguredCondition[]` | Conditions that must be satisfied |

**ConfiguredCondition**

| Field | Type | Description |
|---|---|---|
| `canonicalName` | `string` | Internal identifier for the condition type (matches `RuleCondition.canonicalName`) |
| `parameters` | `object` | Key-value map of condition parameters |

---

### RuleCondition

Describes an available condition type that can be added to a rule.

```json
{
  "subjectType": "Visitor",
  "canonicalName": "string",
  "name": "string",
  "description": "string",
  "parameters": [
    {
      "name": "string",
      "type": "StringValue",
      "isList": false,
      "fixedValueProvider": null
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `subjectType` | `SubjectTypes` | The subject type this condition applies to |
| `canonicalName` | `string` | Stable internal identifier used when configuring conditions |
| `name` | `string` | Human-readable condition name |
| `description` | `string` | Human-readable description of what the condition checks |
| `parameters` | `ConditionParameterInfo[]` | Parameters that can be configured for this condition |

**ConditionParameterInfo**

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Parameter name |
| `type` | `ParameterType` | Data type of the parameter value |
| `isList` | `boolean` | `true` if the parameter accepts multiple values |
| `fixedValueProvider` | `string?` | If set, names a `ValueProviderType` that can be queried to get selectable values |

---

### ParameterType

| Value | Description |
|---|---|
| `StringValue` | String parameter |
| `IntegerValue` | Integer parameter |
| `BooleanValue` | Boolean parameter |

---

### SubjectTypes

| Value | Description |
|---|---|
| `Visitor` | A visitor subject. Requires `visitId` in `SubjectKeyDto` |
| `Employee` | An employee subject |
| `Contractor` | A contractor subject |

---

### SubjectKeyDto

Identifies a specific subject for directive operations.

```json
{
  "type": "Visitor",
  "subjectEntityId": "uuid",
  "visitId": "uuid"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `SubjectTypes` | The subject type |
| `subjectEntityId` | `uuid` | ID of the subject entity (visitor, employee, or contractor) |
| `visitId` | `uuid?` | Required when `type` is `"Visitor"`. The associated visit ID |

---

### IAccessRequirementDto

Polymorphic. Describes what access should be granted by an operational directive. Include `$type` to identify the variant.

#### CredentialOwnershipRequirementDto

Request that a credential (badge) of a specific type be issued to the subject.

```json
{
  "$type": "CredentialOwnershipRequirementDto",
  "badgeTypeId": "uuid",
  "badgeNumber": null
}
```

| Field | Type | Description |
|---|---|---|
| `badgeTypeId` | `uuid` | The badge type to issue |
| `badgeNumber` | `string?` | Specific badge number to assign. `null` to auto-assign |

#### GroupMembershipRequirementDto

Request that the subject be added to an access group.

```json
{
  "$type": "GroupMembershipRequirementDto",
  "groupId": "uuid"
}
```

| Field | Type | Description |
|---|---|---|
| `groupId` | `uuid` | The group to add the subject to |

#### AccessAssignmentRequirementDto

Request that the subject be assigned an access level for a time window.

```json
{
  "$type": "AccessAssignmentRequirementDto",
  "resourceId": "uuid",
  "start": "2026-01-01T00:00:00Z",
  "end": "2026-01-02T00:00:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `resourceId` | `uuid` | The access level or resource to assign |
| `start` | `DateTimeOffset` | Start of the access window (ISO 8601) |
| `end` | `DateTimeOffset?` | End of the access window. `null` for open-ended |

---

### GrantedDirective

The result of a successfully issued operational directive.

```json
{
  "directiveId": "uuid",
  "grant": {
    "$type": "OwnsCredentialDto",
    "badgeTypeId": "uuid",
    "badgeId": "string"
  }
}
```

| Field | Type | Description |
|---|---|---|
| `directiveId` | `uuid` | ID of the created directive |
| `grant` | `IAccessGrantDto` | The access grant that was applied. Includes `$type` discriminator |

---

### IAccessGrantDto

Polymorphic. Describes the access that was actually applied. Returned from `POST /operational-directives/{systemId}`.

#### OwnsCredentialDto

A credential was issued to the subject.

```json
{
  "$type": "OwnsCredentialDto",
  "badgeTypeId": "uuid",
  "badgeId": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `badgeTypeId` | `uuid` | The badge type that was issued |
| `badgeId` | `string` | The badge number that was assigned |

#### MemberOfGroupDto

The subject was added to an access group.

```json
{
  "$type": "MemberOfGroupDto",
  "groupId": "uuid"
}
```

| Field | Type | Description |
|---|---|---|
| `groupId` | `uuid` | The group the subject was added to |

#### AssignedAccessDto

The subject was assigned an access level.

```json
{
  "$type": "AssignedAccessDto",
  "accessLevelId": "uuid",
  "start": "2026-01-01T00:00:00Z",
  "end": "2026-01-02T00:00:00Z"
}
```

| Field | Type | Description |
|---|---|---|
| `accessLevelId` | `uuid` | The access level that was assigned |
| `start` | `DateTimeOffset?` | Start of the granted access window |
| `end` | `DateTimeOffset?` | End of the granted access window |

---

### IdentityDto

An external identity mapping entry linking a Smart Access subject to their ID in an external access control system.

```json
{
  "id": "uuid",
  "firstName": "string",
  "lastName": "string",
  "externalId": "string"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | ID of the subject in Smart Access |
| `firstName` | `string` | First name (currently not populated) |
| `lastName` | `string` | Last name (currently not populated) |
| `externalId` | `string` | The subject's ID in the external access control system |

---

### CreateSystemRequest

```json
{
  "agent": {
    "id": "uuid-string",
    "name": "string"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `agent` | `EntityLink` | Yes | Reference to the agent to back this system. `id` must be a valid UUID |

---

### CreateRuleSetRequest

```json
{
  "name": "string",
  "system": {
    "id": "uuid-string",
    "name": "string"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | Yes | Name for the new rule set |
| `system` | `EntityLink` | Yes | Reference to the access control system this rule set applies to |

---

### CreateOperationalDirectiveRequest

```json
{
  "subject": {
    "type": "Visitor",
    "subjectEntityId": "uuid",
    "visitId": "uuid"
  },
  "reason": "string",
  "requirement": {
    "$type": "CredentialOwnershipRequirementDto",
    "badgeTypeId": "uuid",
    "badgeNumber": null
  },
  "start": "2026-01-01",
  "end": "2026-01-02"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `subject` | `SubjectKeyDto` | Yes | The subject to issue the directive for |
| `reason` | `string` | Yes | Human-readable reason for the directive |
| `requirement` | `IAccessRequirementDto` | Yes | The access requirement to fulfil. Must include `$type` |
| `start` | `DateOnly` | No | Start date (`YYYY-MM-DD`). Defaults to today |
| `end` | `DateOnly` | No | End date (`YYYY-MM-DD`). Defaults to tomorrow |

---

### RevokeOperationalDirectiveRequest

```json
{
  "directiveId": "uuid",
  "subject": {
    "type": "Visitor",
    "subjectEntityId": "uuid",
    "visitId": "uuid"
  }
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `directiveId` | `uuid` | Yes | ID of the directive to revoke |
| `subject` | `SubjectKeyDto` | Yes | The subject the directive was issued for |
