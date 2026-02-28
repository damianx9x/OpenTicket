# OpenTicket Deep Dependency Check

Generated: 2026-02-28T19:48:34.995Z

## Rollup

- Direct dependencies: **27**
- Vulnerabilities: critical **0**, high **3**, moderate **4**, low **20**, total **27**
- Outdated packages: total **30**, major **23**, minor/patch **7**

## backend

- Direct dependencies: **19**
- Vulnerabilities: critical **0**, high **2**, moderate **4**, low **20**, total **26**
- Outdated: total **14**, major **10**, minor/patch **4**

High/Critical chains:
- `@nestjs/serve-static` (high) via path-to-regexp | fixAvailable={"name":"@nestjs/serve-static","version":"5.0.4","isSemVerMajor":true}
- `path-to-regexp` (high) via path-to-regexp:high:#1101849 | fixAvailable={"name":"@nestjs/serve-static","version":"5.0.4","isSemVerMajor":true}

## frontend

- Direct dependencies: **6**
- Vulnerabilities: critical **0**, high **1**, moderate **0**, low **0**, total **1**
- Outdated: total **10**, major **7**, minor/patch **3**

High/Critical chains:
- `next` (high) via next:moderate:#1112593, next:high:#1112653 | fixAvailable={"name":"next","version":"16.1.6","isSemVerMajor":true}

## desktop

- Direct dependencies: **2**
- Vulnerabilities: critical **0**, high **0**, moderate **0**, low **0**, total **0**
- Outdated: total **6**, major **6**, minor/patch **0**

## Recommended Actions

- Resolve direct high advisories first when fix does not require major breaking upgrade.
- For major upgrades (e.g., framework jumps), isolate to a dedicated branch with smoke and E2E gates.
- Keep release policy: no critical vulnerabilities in runtime dependencies.
- Re-run this check before each installer build.
