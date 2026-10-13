# SPFM

Internal project financial management app for Shield Security Doors.
Next.js frontend for the SPFM Alpha.

Alpha workflow: sign in → create or open a project → enter data →
calculate → save → reopen → edit → recalculate → save.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # SPFM calculation, validation and history tests
npm run test:e2e     # full Alpha loop in a browser (first time: npx playwright install chromium)
npm run build        # production build
```

Out of the box it runs in **preview mode**: simulated sign-in, sample projects
saved in the browser. **Reset sample data** in the sidebar restores them.

## Modes

Set in `.env.local` (copy `.env.example`). Rebuild or restart after changes.

| Variable | Values | Effect |
|---|---|---|
| `NEXT_PUBLIC_AUTH_MODE` | `preview` (default), `entra` | Simulated sign-in, or Microsoft Entra via MSAL |
| `NEXT_PUBLIC_DATA_MODE` | `local` (default), `api` | Projects in the browser, or the ASP.NET Core Project API |

To run against the API before the backend endpoints exist:

```bash
npm run mock-api     # http://localhost:5199, implements docs/API-CONTRACT.md
# .env.local: NEXT_PUBLIC_DATA_MODE=api, NEXT_PUBLIC_API_BASE_URL=http://localhost:5199
npm run dev
```

## Still to be supplied by Shield

| Needed | Where it goes |
|---|---|
| SPFM field list and calculation rules | `src/lib/types.ts`, `src/lib/spfm.ts` (current fields and formulas are placeholders) |
| 2–3 real projects with expected results | `src/lib/testCases.ts` |
| Entra IDs and admin consent | `.env.local`, see `docs/ENTRA-SETUP.md` |
| Azure subscription access | `docs/DEPLOYMENT.md` |

## Documents

| File | Contents |
|---|---|
| `docs/API-CONTRACT.md` | Endpoints and JSON the backend must provide |
| `docs/ENTRA-SETUP.md` | App registrations, scope, consent, environment settings |
| `docs/DEPLOYMENT.md` | Azure deployment and rollback plan |
| `docs/ACCEPTANCE-CHECKLIST.md` | Alpha acceptance checks and current status |
| `docs/QUICKBOOKS-MAPPING.md` | QuickBooks-ready fields and Phase 2 mapping |
| `docs/AFTER-ALPHA.md` | Features and issues to handle after the Alpha |

## Structure

```
src/
  app/
    login/                 sign-in screen
    (app)/page.tsx         overview: totals, margin by project, needs calculating
    (app)/projects/        project list with search and status filter
    (app)/projects/new     new project
    (app)/projects/[id]    main project screen
  components/
    ProjectEditor.tsx      inputs, validation, Calculate / Save, results, change history
    CostBar.tsx            where the contract value goes
    AppShell.tsx           sidebar, session guard, API connection status
  lib/
    spfm.ts                calculation engine + validation (no UI code)
    testCases.ts           named test cases with expected results
    history.ts             change history (what changed between saves)
    projectStore.ts        repository: browser storage or API
    api.ts                 API client, attaches the Entra access token
    auth.tsx               preview or MSAL sign-in
    config.ts              environment settings
    quickbooks.ts          QuickBooks mapping for Phase 2
mock-api/server.mjs        mock backend for development
e2e/alpha-loop.spec.ts     end-to-end Alpha loop test
```

The calculation engine has no UI dependencies, so the backend can port it
(or call the same rules) and reuse `testCases.ts`.
