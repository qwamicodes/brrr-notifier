# brrr-notifier

`brrr-notifier` is a small ElysiaJS + TypeScript webhook middleware. It accepts
deployment/build workflow webhooks, normalizes each provider payload into a stable
internal shape, maps that shape into a brrr notification payload, and sends it to
brrr through `POST /v1/send`.

Supported inbound providers:

- Dokploy
- GitHub Actions
- Expo/EAS workflows, builds, and submits

## How It Works

Every webhook follows the same pipeline:

```txt
Inbound webhook
  -> provider Zod schema validation
  -> provider normalizer
  -> provider brrr mapper
  -> sendToBrrr()
  -> POST {BRRR_BASE_URL}/v1/send
```

The provider route owns HTTP ingestion. The schema owns accepted input fields.
The normalizer owns aliases, defaults, status inference, and thread IDs. The
mapper owns the final notification title, subtitle, and message text. The brrr
service owns outbound authentication, validation, lowercasing, and transport.

## Quick Start

Install dependencies:

```bash
bun install
```

Create local env:

```bash
cp .env.example .env
```

Start the API:

```bash
bun run dev
```

The server starts on `http://localhost:4888` by default.

### Environment

| Variable | Purpose | Default/example |
| --- | --- | --- |
| `PORT` | Local HTTP port. | `4888` |
| `PUBLIC_BASE_URL` | Base URL printed for copy-paste webhook links on startup. | `http://localhost:4888` |
| `BRRR_BASE_URL` | brrr API base URL. The sender appends `/v1/send`. | `https://api.brrr.now` |
| `BRRR_SECRET` | Bearer token sent to brrr. | `your_secret_here` |
| `LOG_LEVEL` | Pino log level. | `info` |

Other environment fields in `.env.example` are used for service metadata in
logs and local deployment context.

## Webhook Routes

| Route | Provider | Source schema |
| --- | --- | --- |
| `POST /webhooks/dokploy` | Dokploy | `DokployRawPayloadSchema` |
| `POST /webhooks/github-actions` | GitHub Actions | `GithubNotifierPayloadSchema` |
| `POST /webhooks/expo-workflows` | Expo/EAS | `ExpoWorkflowPayloadSchema` |

Successful ingestion returns HTTP `202` after the notification is accepted and
sent to brrr:

```json
{
  "ok": true,
  "accepted": true,
  "source": "github-actions",
  "title": "qwamicodes/resultcheckerhub - Staging - Success"
}
```

Invalid request bodies fail provider schema validation. If the outbound brrr API
returns a non-2xx response or the request fails, the route throws and the error
bubbles as a request failure.

## Payload Reference

### Dokploy

Dokploy payloads are intentionally flexible because Dokploy events vary by
source. The route accepts known Dokploy event shapes and a generic shape.

Minimum signal for a generic Dokploy payload: at least one of `title`, `message`,
`event`, `source_event`, `type`, or `status`.

Common accepted fields:

- Event/status: `event`, `source_event`, `type`, `status`, `alertType`
- App identity: `app_name`, `application_name`, `applicationName`
- Context: `environment`, `environment_name`, `project_name`, `projectName`
- Infrastructure: `application_type`, `applicationType`, `server_name`, `serverName`
- Links: `open_url`, `details_url`, `buildLink`
- brrr passthroughs: `subtitle`, `sound`, `image_url`, `expiration_date`, `filter_criteria`, `interruption_level`
- Metadata: `metadata`

Recognized event mapping:

| Event/type | Kind | Default status |
| --- | --- | --- |
| `appDeploy` | `deploy` | `success` |
| `appBuildError` | `build` | `failure` |
| `databaseBackup`, `volumeBackup`, `dokployBackup`, `dokploy-backup` | `backup` | `success` |
| `dokployRestart`, `dokploy-restart` | `restart` | `success` |
| `dockerCleanup`, `docker-cleanup` | `cleanup` | `success` |
| `serverThreshold`, `server-threshold` | `threshold` | `warning` |

Explicit status aliases override the default event status where possible:
`error`, `failed`, and `fail` become `failure`; `alert` becomes `warning`;
`running` becomes `in_progress`; `canceled` becomes `cancelled`.

Compact test payload:

```bash
curl -X POST http://localhost:4888/webhooks/dokploy \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deployment complete",
    "message": "Deployment completed successfully.",
    "timestamp": "2026-04-22T10:00:00.000Z"
  }'
```

Richer deployment payload:

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

### GitHub Actions

GitHub Actions payloads are designed for workflow summaries produced by CI/CD
jobs. Unknown additional JSON fields are accepted and included in the final
notification message under "Additional Payload".

Required fields:

- `source`: must be `github-actions`
- `workflow`
- `event`
- `run_id`
- `run_attempt`
- `repository`
- `sha`: minimum 7 characters
- `ref`
- `actor`
- `environment`
- `results`: object of job name to result

Accepted job results:

- `success`
- `failure`
- `cancelled`
- `skipped`
- `neutral`
- `timed_out`
- `action_required`

Aliases:

- Empty string becomes `skipped`
- `canceled` becomes `cancelled`
- `timed-out` becomes `timed_out`
- `action-required` becomes `action_required`

`changed_apps_count` is optional. If it is missing, the normalizer also checks
`changes.count`. For the `ci` environment, changed app count is intentionally
omitted from the final normalized payload.

The route builds the GitHub run URL as:

```txt
https://github.com/{repository}/actions/runs/{run_id}/attempts/{run_attempt}
```

Complete test payload:

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
      "detect": "success",
      "web": "success",
      "admin": "skipped"
    },
    "release_tag": "v1.2.3",
    "changes": {
      "web": "true",
      "admin": "false",
      "dealer": "false",
      "count": "1"
    }
  }'
```

### Expo/EAS Workflows

Expo/EAS payloads support custom workflow summaries plus standard-ish EAS build
and submit webhook fields. Unknown additional JSON fields are accepted and
included in the final notification message under "Additional Payload".

Minimum signal: at least one of `id`, `workflowRunId`, `workflow_run_id`,
`run_id`, `workflow`, `workflow_name`, `status`, `result`, or `conclusion`.

Supported aliases:

| Meaning | Accepted fields |
| --- | --- |
| Source | `source` as `expo-workflows`, `eas-workflows`, `expo`, or `eas` |
| Workflow/run | `workflow`, `workflow_name`, `workflowRunId`, `workflow_run_id`, `run_id`, `id` |
| Account | `accountName`, `account_name`, `owner`, `metadata.username` |
| Project/app | `projectName`, `project_name`, `appName`, `app_name`, `metadata.appName` |
| Environment | `environment`, `environment_name`, `profile`, `buildProfile`, `build_profile`, `metadata.buildProfile`, `channel`, `metadata.channel`, `metadata.releaseChannel` |
| Status | `status`, `result`, `conclusion` |
| Jobs | `jobs`, `results` |
| Open URL | `open_url`, `dashboard_url`, `details_url`, `buildDetailsPageUrl`, `submissionDetailsPageUrl` |
| Artifact URL | `artifact_url`, `build_url`, `artifacts.buildUrl`, `archiveUrl` |
| Commit/runtime | `commit_hash`, `commit_message`, `runtimeVersion`, `runtime_version`, `metadata.gitCommitHash`, `metadata.gitCommitMessage`, `metadata.runtimeVersion` |

Accepted status values:

- `success`
- `failure`
- `cancelled`
- `skipped`
- `neutral`
- `timed_out`
- `action_required`
- `in_progress`
- `queued`
- `unknown`

Status aliases:

- `finished` and `completed` become `success`
- `errored`, `error`, and `failed` become `failure`
- `canceled` becomes `cancelled`
- `timedout` becomes `timed_out`
- `actionrequired` becomes `action_required`
- `pending` and `waiting` become `queued`
- `running` becomes `in_progress`
- Hyphenated values are normalized to underscores

Complete workflow test payload:

```bash
curl -X POST http://localhost:4888/webhooks/expo-workflows \
  -H "Content-Type: application/json" \
  -d '{
    "source": "expo-workflows",
    "workflow": "production-build",
    "workflow_run_id": "wf-run-123",
    "run_attempt": "1",
    "account_name": "qwamicodes",
    "project_name": "brrr-mobile",
    "app_name": "brrr",
    "environment": "production",
    "platform": "ios",
    "profile": "production",
    "branch": "main",
    "actor": "qwamicodes",
    "status": "success",
    "jobs": {
      "install": "success",
      "test": "success",
      "build_ios": "success"
    },
    "open_url": "https://expo.dev/accounts/qwamicodes/projects/brrr-mobile/workflows/wf-run-123",
    "artifact_url": "https://expo.dev/artifacts/eas/example.ipa",
    "commit_hash": "a1b2c3d4e5f6",
    "channel": "production"
  }'
```

## Outbound brrr Payload

Before sending, `sendToBrrr()` validates the mapped payload with
`BrrrPayloadSchema` and posts it to:

```txt
{BRRR_BASE_URL}/v1/send
```

The outbound request includes:

```txt
Authorization: Bearer {BRRR_SECRET}
Content-Type: application/json
```

Validated brrr payload fields:

| Field | Required | Notes |
| --- | --- | --- |
| `title` | Yes | Non-empty string. |
| `message` | Yes | Non-empty string. |
| `subtitle` | No | Non-empty string when present. |
| `sound` | No | Must be one of the supported brrr sound names. |
| `open_url` | No | Must be a URL. |
| `image_url` | No | Must be a URL. |
| `expiration_date` | No | Must be a datetime string. |
| `filter_criteria` | No | Non-empty string when present. |
| `interruption_level` | No | `passive`, `active`, or `time-sensitive`. |
| `thread_id` | No | Non-empty string when present. |

String fields sent to brrr are lowercased by `sendToBrrr()` after validation:
`title`, `subtitle`, `message`, `sound`, `filter_criteria`,
`interruption_level`, and `thread_id`.

Representative outbound payload before lowercasing:

```json
{
  "title": "Legivent - Legivent API - Success",
  "subtitle": "Deployment completed successfully.",
  "message": "Message: Deployment completed successfully.\nDate: April 22, 2026\nType: Deploy\nStatus: Success\nProject: Legivent\nApplication: Legivent API\nApplication Type: Docker Compose\nEnvironment: production\nBuild Link: https://dokploy.example.com/projects/legivent/apps/legivent-api",
  "sound": "default",
  "open_url": "https://dokploy.example.com/projects/legivent/apps/legivent-api",
  "image_url": "https://cdn.example.com/deployments/legivent-api.png",
  "expiration_date": "2026-04-22T12:00:00.000Z",
  "filter_criteria": "production",
  "interruption_level": "active",
  "thread_id": "dokploy:legivent-api:production"
}
```

## Developer and Agent Map

Use this map when changing behavior:

```txt
src
|-- app.ts                         # Registers provider route modules.
|-- index.ts                       # Starts the server and prints webhook URLs.
|-- config/env.ts                  # Reads and validates environment variables.
`-- modules/notifications
    |-- domain
    |   |-- schemas.ts             # Shared normalized and outbound brrr schemas.
    |   `-- types.ts               # Types inferred from shared schemas.
    |-- providers
    |   |-- dokploy
    |   |-- expo-workflows
    |   `-- github-actions
    |-- services/brrr.service.ts   # Outbound brrr validation and transport.
    |-- utils                      # Status, title, and dedupe helpers.
    `-- webhooks.ts                # Public webhook path helpers.
```

Provider file responsibilities:

| File pattern | Change here when... |
| --- | --- |
| `*.routes.ts` | Adding or changing an HTTP route response or request flow. |
| `*.schemas.ts` | Adding accepted inbound fields or changing validation. |
| `*.normalizer.ts` | Changing aliases, defaults, inferred status, event kind, thread ID, or normalized shape. |
| `*.mapper.ts` | Changing notification titles, subtitles, body text, links, or brrr fields. |
| `*.types.ts` | Updating provider-specific TypeScript types. |

Cross-provider responsibilities:

- Change outbound brrr validation in `src/modules/notifications/domain/schemas.ts`.
- Change outbound brrr auth, lowercasing, endpoint, or fetch behavior in
  `src/modules/notifications/services/brrr.service.ts`.
- Change startup webhook URL generation in `src/modules/notifications/webhooks.ts`.

## Development Commands

```bash
bun run dev
bun run typecheck
bun run lint
bun run check
bun run build
```

`bun run typecheck` is the minimum verification for documentation-only changes
that should not affect runtime behavior.

## Docker

Build and run with Docker Compose:

```bash
docker compose up -d --build
```

The service is exposed at `http://localhost:4888` unless `PORT` is changed.
