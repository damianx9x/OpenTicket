# OpenTicket Deep Dependency Check

Generated: 2026-03-01T15:36:55.900Z

## Rollup

- Direct dependencies: **27**
- Vulnerabilities: critical **0**, high **7**, moderate **3**, low **20**, total **30**
- Outdated packages: total **30**, major **23**, minor/patch **7**

## backend

- Direct dependencies: **19**
- Vulnerabilities: critical **0**, high **6**, moderate **3**, low **20**, total **29**
- Outdated: total **14**, major **10**, minor/patch **4**

High/Critical chains:
- `@nestjs/core` (high) via @nestjs/platform-express | fixAvailable={"name":"@nestjs/core","version":"7.5.5","isSemVerMajor":true}
- `@nestjs/platform-express` (high) via @nestjs/core, multer | fixAvailable={"name":"@nestjs/core","version":"7.5.5","isSemVerMajor":true}
- `@nestjs/serve-static` (high) via @nestjs/core, path-to-regexp | fixAvailable={"name":"@nestjs/serve-static","version":"5.0.4","isSemVerMajor":true}
- `@nestjs/swagger` (high) via @nestjs/core, js-yaml, lodash | fixAvailable={"name":"@nestjs/swagger","version":"11.2.6","isSemVerMajor":true}
- `multer` (high) via multer:high:#1113635, multer:high:#1113636 | fixAvailable={"name":"@nestjs/core","version":"7.5.5","isSemVerMajor":true}
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
