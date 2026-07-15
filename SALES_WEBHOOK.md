# Sales webhook contract

The notifier accepts successful checker sales at:

```http
POST /webhooks/sales
```

Only `sale.succeeded` is supported. Refund, pending, failed, and cancelled events
are not accepted.

## Configuration

Configure the notifier with a platform display name and signing secret:

```env
SALES_WEBHOOK_PLATFORMS={"result-checker-hub":{"displayName":"Result Checker Hub","currentSecret":"replace_with_at_least_32_random_characters","previousSecret":"optional_previous_secret_of_at_least_32_chars"}}
SALES_EVENT_DB_PATH=./data/sales-events.sqlite
```

The sender uses the same platform identifier and secret:

```env
BRRR_NOTIFIER_BASE_URL=https://notifier.topsociety.agency
SALES_WEBHOOK_PLATFORM=result-checker-hub
SALES_WEBHOOK_SECRET=replace_with_the_same_secret_used_by_the_notifier
SALES_WEBHOOK_ENABLED=false
```

Keep `SALES_WEBHOOK_ENABLED=false` until the matching notifier version is
deployed and verified.

## Authentication

Serialize the payload exactly once. Use the same raw JSON bytes when generating
the signature and sending the request.

Calculate a lowercase hexadecimal HMAC-SHA256 digest over:

```text
{timestamp}.{raw_json_body}
```

Required headers:

```http
Content-Type: application/json
X-Webhook-Id: evt_01JXYZ123
X-Webhook-Platform: result-checker-hub
X-Webhook-Timestamp: 1784125800
X-Webhook-Signature: sha256=<lowercase-hex-hmac>
```

`X-Webhook-Id` must equal `event_id`. `X-Webhook-Platform` must equal
`source.platform`. The timestamp must be within five minutes of the notifier's
clock.

## Payload

```json
{
  "event": "sale.succeeded",
  "event_id": "evt_01JXYZ123",
  "occurred_at": "2026-07-15T14:30:00.000Z",
  "source": {
    "platform": "result-checker-hub",
    "environment": "production"
  },
  "sale": {
    "id": "0198a2ac-7a71-7000-8000-000000000001",
    "exam_type": "wassce",
    "quantity": 2,
    "amount": "GHS 150.00",
    "payment_provider": "hubtel",
    "channel": "web"
  },
  "dashboard_url": "https://dashboard.example.com/purchases?q=0198a2ac-7a71-7000-8000-000000000001"
}
```

The exact validation contract is:

```ts
const SalesWebhookSchema = z.object({
  event: z.literal('sale.succeeded'),
  event_id: z.string().startsWith('evt_'),
  occurred_at: z.string().datetime(),
  source: z.object({
    platform: z.string().min(1),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  sale: z.object({
    id: z.string().uuid(),
    exam_type: z.enum(['wassce', 'bece']),
    quantity: z.number().int().positive().max(100),
    amount: z.string().regex(/^GHS [0-9]+\.[0-9]{2}$/),
    payment_provider: z.enum(['hubtel', 'checkerport', 'simulation']),
    channel: z.enum(['web', 'ussd', 'api']),
  }),
  dashboard_url: z.string().url(),
})
```

Formatted amounts cannot contain commas. For example, `GHS 1500.00` is valid;
`GHS 1,500.00` is invalid.

## Notification

The route creates a passive notification without a sound:

```text
Title: Result Checker Hub • Successful sale
Subtitle: Exam: WASSCE • Quantity: 2
Message: Amount: GHS 150.00 • Provider: hubtel • Channel: web
Action link: dashboard_url
Thread: sales:result-checker-hub
```

The shared brrr transport lowercases notification strings before delivery.

## Responses and retries

- A newly delivered event returns `200` with `notified: true`.
- A completed duplicate returns `200` with `duplicate: true` and is not sent
  again.
- A concurrent duplicate returns retryable `409`.
- A brrr delivery failure returns retryable `502`.
- An unavailable event store returns retryable `503`.
- Authentication and validation errors return non-success responses.

The sender must retain the same `event_id` across retries while generating a
fresh timestamp and HMAC signature for each attempt.

The notifier retains completed event IDs in SQLite for 90 days. HMAC
verification, timestamp validation, header/platform matching, 256 KB request
limits, event-ID idempotency, and passive delivery remain enabled.
