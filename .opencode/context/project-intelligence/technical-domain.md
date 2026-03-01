<!-- Context: project-intelligence/technical | Priority: critical | Version: 2.0 | Updated: 2026-03-01 -->

# Technical Domain

**Purpose**: Tech stack, architecture, and development patterns for this Angular SPA.
**Last Updated**: 2026-03-01

## Quick Reference

- **Update When**: Tech stack changes, new patterns adopted, architecture decisions made
- **Audience**: Developers, AI agents generating code for this project

---

## Primary Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Framework | Angular | ^21.1.0 | Standalone components only, no NgModules |
| Language | TypeScript | ~5.9.2 | Strict mode via tsconfig |
| UI Library | PrimeNG | ^21.1.1 | Theme: `@primeuix/themes/aura` |
| Styling | Tailwind CSS | ^4.2.1 | Via `@tailwindcss/postcss` |
| Auth | angular-oauth2-oidc | ^20.0.2 | OAuth2/OIDC, Bearer token injection via interceptor |
| HTTP | Angular HttpClient | built-in | Always convert with `firstValueFrom()` |
| Reactive | RxJS | ~7.8.0 | Only for interop; prefer Signals + Promises |
| Testing | Vitest | ^4.0.8 | |
| Formatter | Prettier | devDep | printWidth: 100, singleQuote: true |

---

## Project Structure

```
src/app/
├── app.ts / app.html         # Root component
├── app.config.ts             # App providers (router, HTTP, OAuth, PrimeNG)
├── app.routes.ts             # Root routes (lazy-load features)
├── core/
│   ├── auth-api-interceptor.ts    # Injects Bearer token on all HTTP requests
│   ├── services/                  # Singleton services
│   │   ├── config-service.ts      # Loads /api/settings on startup
│   │   ├── permissions-service.ts # Loads user permissions from settings server
│   │   └── startup-service.ts     # App initialization orchestration
│   └── components/
│       ├── layout/                # Main shell (nav, router outlet)
│       ├── splash-screen/         # Loading screen during startup
│       └── application-error/     # Global error display
└── features/
    └── {feature}/
        ├── {feature}.routes.ts    # Feature-level lazy routes
        └── services/              # Feature-scoped services
```

---

## Code Patterns

### Service Pattern

```typescript
// File: {feature}-service.ts  (kebab-case, no .service.ts suffix)
// Class: PascalCase, no suffix

@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private permissions: PermissionsSet[] | undefined;

  constructor(private configService: ConfigService, private http: HttpClient) {}

  async loadPermissions(): Promise<PermissionsSet[]> {
    this.permissions = await firstValueFrom(
      this.http.get<PermissionsSet[]>(endpoint)
    );
    return this.permissions ?? [];
  }
}

// Interfaces co-located in same file, NOT separate model files
export interface PermissionsSet {
  application: string;
  permissions: string[];
  totalPermissions: number;
}
```

### Component Pattern

```typescript
// File: {name}.ts  (kebab-case, no .component.ts suffix)
// Standalone: always use imports array, never NgModules

@Component({
  selector: 'app-layout',
  standalone: true,         // implicit in Angular 21 but explicit is fine
  imports: [RouterOutlet, ButtonModule],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  mobileMenuOpen = false;

  constructor(
    private oauthService: OAuthService,
    private permissionsService: PermissionsService,
  ) {}

  get isAuthenticated(): boolean {
    return this.oauthService.hasValidAccessToken();
  }
}
```

### Routing Pattern

```typescript
// Root: loadChildren for lazy-loaded features
export const routes: Routes = [
  {
    path: 'visitors',
    loadChildren: () =>
      import('./features/visitors/visitors.routes').then(m => m.visitorsRoutes),
  },
];
```

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Files | kebab-case, **no** Angular suffixes | `config-service.ts`, `layout.ts` |
| Classes | PascalCase, **no** suffix | `ConfigService`, `Layout` |
| Interfaces | PascalCase, co-located in service file | `AppSettings`, `PermissionsSet` |
| Feature folders | kebab-case | `features/visitors/` |
| Selectors | `app-` prefix, kebab-case | `app-layout`, `app-splash-screen` |

---

## Code Standards

- **Standalone components** — no NgModules anywhere; use `imports: []` on each component
- **HTTP → Promises** — always wrap with `firstValueFrom()`, do not expose raw Observables from services
- **Interfaces co-located** — define interfaces in the same file as their consuming service, not separate model files
- **Angular Signals** — use `signal<T>()` / `.asReadonly()` for reactive state; avoid BehaviorSubject for new code
- **Lazy routes** — all features lazy-loaded via `loadChildren` in root routes
- **Prettier enforced** — printWidth: 100, singleQuote: true, Angular HTML parser for templates

---

## Security Requirements

- **Auth interceptor** — `ApiAuthInterceptor` auto-injects Bearer token on all outbound HTTP requests; never add auth headers manually
- **OIDC login flow** — use `oauthService.initLoginFlow()` for login, `hasValidAccessToken()` to check auth state
- **Route guards** — protect routes using `hasValidAccessToken()` check; redirect to login if unauthenticated
- **Permission-based UI** — gate features/actions using `PermissionsService`; load permissions after OIDC login completes
- **Secure token storage** — let `angular-oauth2-oidc` manage token storage; do not store tokens in `localStorage` manually

---

## 📂 Codebase References

| Pattern | Location |
|---------|----------|
| App providers (HTTP, OAuth, PrimeNG) | `src/app/app.config.ts` |
| Auth interceptor | `src/app/core/auth-api-interceptor.ts` |
| Service pattern | `src/app/core/services/config-service.ts` |
| Permissions / security | `src/app/core/services/permissions-service.ts` |
| Component pattern | `src/app/core/components/layout/layout.ts` |
| Root routing | `src/app/app.routes.ts` |
| Feature routing | `src/app/features/visitors/visitors.routes.ts` |

---

## Related Files

- `business-domain.md` — why this technical foundation exists
- `business-tech-bridge.md` — business needs → technical solutions mapping
- `decisions-log.md` — full decision history with context
- `living-notes.md` — active issues and open questions
