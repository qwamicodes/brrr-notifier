# brrr-notifier

Dokploy webhook middleware built with ElysiaJS + TypeScript.

## 1. Architecture summary

This service is split into clear layers:

- Route/controller layer: receives webhooks and returns ingest responses.
- Parsing/normalization layer: converts raw Dokploy payloads into a stable internal contract.
- Formatting/mapping layer: builds brrr-ready notification payloads.
- Sender/transport layer: delivers notifications to brrr via `/v1/send`.
- Shared types/schemas: keeps contracts explicit and reusable for new providers.

Provider-specific logic is isolated under `src/modules/notifications/providers/*` so GitHub Actions, Expo, and others can be added as sibling providers.

## 2. Project folder tree

```txt
.
├── .env.example
├── README.md
├── package.json
├── tsconfig.json
└── src
    ├── app.ts
    ├── index.ts
    ├── config
    │   └── env.ts
    └── modules
        └── notifications
            ├── domain
            │   ├── schemas.ts
            │   └── types.ts
            ├── providers
            │   ├── dokploy
            │   │   ├── dokploy.mapper.ts
            │   │   ├── dokploy.normalizer.ts
            │   │   ├── dokploy.routes.ts
            │   │   ├── dokploy.schemas.ts
            │   │   └── dokploy.types.ts
            │   └── github-actions
            │       ├── github-actions.mapper.ts
            │       ├── github-actions.normalizer.ts
            │       ├── github-actions.routes.ts
            │       ├── github-actions.schemas.ts
            │       └── github-actions.types.ts
            ├── services
            │   └── brrr.service.ts
            └── utils
                ├── dedupe.ts
                ├── status.ts
                └── title.ts
```

## 3. Source files

All implementation code is included directly in the repository files listed above, including the required helpers:

- `formatNotificationStatus(status)`
- `formatNotificationTitle({ app_name, environment, status })`
- `mapDokployEventToKind(sourceEvent)`
- `mapDokployEventToStatus(sourceEvent)`
- `createDokployDedupeKey(...)`
- `normalizeDokployPayload(payload)`
- `mapDokployToBrrr(input)`
- `sendToBrrr(payload)`

## Install

```bash
bun install
```

## Run

```bash
bun run dev
```

Server starts on `http://localhost:4888` by default.

## Routes

- `POST /webhooks/dokploy`
- `POST /webhooks/github-actions`

Both routes validate request bodies with typed Elysia + Zod schemas, normalize payloads, map to brrr payloads, and forward to brrr.

## Test with curl

Simple payload:

```bash
curl -X POST http://localhost:4888/webhooks/dokploy \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deployment complete",
    "message": "Deployment completed successfully.",
    "timestamp": "2026-04-22T10:00:00.000Z"
  }'
```

Richer payload:

```bash
curl -X POST http://localhost:4888/webhooks/dokploy \
  -H "Content-Type: application/json" \
  -d '{
    "event": "appDeploy",
    "application_name": "legivent-api",
    "environment": "production",
    "project_name": "legivent",
    "application_type": "docker-compose",
    "server_name": "fra-1",
    "message": "Deployment completed successfully.",
    "details_url": "https://dokploy.example.com/projects/legivent/apps/legivent-api",
    "metadata": {
      "duration_seconds": 72,
      "initiated_by": "system"
    }
  }'
```

GitHub Actions payload:

```bash
curl -X POST http://localhost:4888/webhooks/github-actions \
  -H "Content-Type: application/json" \
  -d '{
    "source": "github-actions",
    "workflow": "deploy-apps",
    "event": "workflow_dispatch",
    "run_id": "123456789",
    "run_attempt": "1",
    "repository": "qwamicodes/resultcheckerhub",
    "sha": "a1b2c3d4e5f6",
    "ref": "refs/heads/main",
    "actor": "qwamicodes",
    "environment": "staging",
    "results": {
      "plan": "success",
      "build": "success",
      "redeploy": "success"
    },
    "changed_apps_count": 2
  }'
```

## Example normalized output

```json
{
  "source": "dokploy",
  "kind": "deploy",
  "source_event": "appDeploy",
  "status": "success",
  "occurred_at": "2026-04-22T10:00:00.000Z",
  "app_name": "legivent-api",
  "environment": "production",
  "project_name": "legivent",
  "application_type": "docker-compose",
  "server_name": "fra-1",
  "message": "Deployment completed successfully.",
  "summary": null,
  "open_url": "https://dokploy.example.com/projects/legivent/apps/legivent-api",
  "thread_id": "dokploy:legivent-api:production",
  "dedupe_key": "dokploy:deploy:legivent-api:production:appDeploy:success:2026-04-22T10:00:00.000Z",
  "metadata": {
    "duration_seconds": 72,
    "initiated_by": "system"
  },
  "raw": {
    "event": "appDeploy",
    "application_name": "legivent-api",
    "environment": "production",
    "project_name": "legivent",
    "application_type": "docker-compose",
    "server_name": "fra-1",
    "message": "Deployment completed successfully.",
    "details_url": "https://dokploy.example.com/projects/legivent/apps/legivent-api",
    "metadata": {
      "duration_seconds": 72,
      "initiated_by": "system"
    }
  }
}
```

## Example brrr payload

```json
{
  "title": "legivent-api • production • ✅ SUCCESS",
  "subtitle": "Deployment complete",
  "message": "Deployment completed successfully.",
  "sound": "default",
  "open_url": "https://dokploy.example.com/projects/legivent/apps/legivent-api",
  "image_url": "https://cdn.example.com/deployments/legivent-api.png",
  "expiration_date": "2026-04-22T12:00:00.000Z",
  "filter_criteria": "production",
  "interruption_level": "active",
  "thread_id": "dokploy:legivent-api:production"
}
```

## Docker deployment

Build and run with Docker Compose:

```bash
docker compose up -d --build
```

Service will be exposed at `http://localhost:4888`.

## Startup webhook links

On startup, the API prints copy-paste-ready webhook URLs for configured providers.

- Set `PUBLIC_BASE_URL` for deployed environments (for example `https://hooks.yourdomain.com`).
- If omitted, it falls back to `http://localhost:4888`.
