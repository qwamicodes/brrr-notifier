# Sales webhook sender implementation brief

Implement a reliable webhook sender in the sales application using this exact
contract. Send an event only after a sale or refund has been committed
successfully in the sales application's source-of-truth database.

## Endpoint and events

Send requests to:

```http
POST {BRRR_NOTIFIER_BASE_URL}/webhooks/sales
```

Implement these events:

- `sale.succeeded`
- `refund.succeeded`, including full and partial refunds

Do not send pending, failed, or cancelled transactions.

## Configuration

The sales application needs:

```env
BRRR_NOTIFIER_BASE_URL=https://notifications.example.com
SALES_WEBHOOK_PLATFORM=result-checker-hub
SALES_WEBHOOK_SECRET=replace_with_the_same_random_secret_used_by_the_notifier
```

The notifier configures the receiving platform separately:

```env
SALES_WEBHOOK_PLATFORMS={"result-checker-hub":{"displayName":"Result Checker Hub","currentSecret":"replace_with_at_least_32_random_characters","previousSecret":"optional_previous_secret_of_at_least_32_chars"}}
```

## Authentication

Serialize the payload exactly once and preserve that raw JSON string for both
signing and sending. Generate a Unix timestamp in seconds, then calculate a
lowercase hexadecimal HMAC-SHA256 digest over:

```text
{timestamp}.{raw_json_body}
```

Send these headers:

```http
Content-Type: application/json
X-Webhook-Id: evt_01JXYZ123
X-Webhook-Platform: result-checker-hub
X-Webhook-Timestamp: 1784125800
X-Webhook-Signature: sha256=<lowercase-hex-hmac>
```

`X-Webhook-Id` must equal `event_id`, and `X-Webhook-Platform` must equal
`source.platform`. Each retry must keep the same event ID but use a fresh
timestamp and signature. The notifier rejects timestamps older or newer than
five minutes.

TypeScript signing example:

```ts
import { createHmac } from 'node:crypto'

const rawBody = JSON.stringify(payload)
const timestamp = Math.floor(Date.now() / 1000).toString()
const digest = createHmac('sha256', process.env.SALES_WEBHOOK_SECRET!)
  .update(`${timestamp}.${rawBody}`)
  .digest('hex')

await fetch(`${process.env.BRRR_NOTIFIER_BASE_URL}/webhooks/sales`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Id': payload.event_id,
    'X-Webhook-Platform': payload.source.platform,
    'X-Webhook-Timestamp': timestamp,
    'X-Webhook-Signature': `sha256=${digest}`,
  },
  body: rawBody,
})
```

## Successful sale payload

All money values are integer minor units. For example, `15000` means
`GHS 150.00`.

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
    "id": "sale_12345",
    "reference": "CHK-2026-000123",
    "status": "succeeded",
    "items": [
      {
        "product_id": "wassce-checker",
        "product_name": "WASSCE Result Checker",
        "category": "result-checker",
        "variant": "2026",
        "quantity": 2,
        "unit_amount": 7500,
        "total_amount": 15000
      }
    ],
    "amount": {
      "value": 15000,
      "currency": "GHS",
      "unit": "minor"
    },
    "payment": {
      "provider": "paystack",
      "method": "mobile_money",
      "transaction_id": "txn_98765"
    },
    "channel": "web"
  },
  "revenue": {
    "currency": "GHS",
    "timezone": "Africa/Accra",
    "business_date": "2026-07-15",
    "calculated_at": "2026-07-15T14:30:00.000Z",
    "platform": {
      "today": { "gross": 425000, "refunded": 0, "net": 425000 },
      "month": { "gross": 6250000, "refunded": 0, "net": 6250000 },
      "all_time": { "gross": 28450000, "refunded": 0, "net": 28450000 }
    },
    "business": {
      "today": { "gross": 810000, "refunded": 0, "net": 810000 },
      "month": { "gross": 12400000, "refunded": 0, "net": 12400000 },
      "all_time": { "gross": 59750000, "refunded": 0, "net": 59750000 }
    }
  },
  "links": {
    "dashboard": "https://checkers.example.com/admin/sales/sale_12345"
  },
  "metadata": {
    "academic_year": "2026"
  }
}
```

## Refund payload

A refund event uses the same common `event_id`, `occurred_at`, `source`,
`revenue`, `links`, and optional `metadata` fields as the sale event. Replace
`sale` with `refund`:

```json
{
  "event": "refund.succeeded",
  "event_id": "evt_refund_456",
  "occurred_at": "2026-07-15T15:00:00.000Z",
  "source": {
    "platform": "result-checker-hub",
    "environment": "production"
  },
  "refund": {
    "id": "refund_456",
    "status": "succeeded",
    "amount": {
      "value": 7500,
      "currency": "GHS",
      "unit": "minor"
    },
    "original_sale": {
      "id": "sale_12345",
      "reference": "CHK-2026-000123"
    },
    "items": [
      {
        "product_id": "wassce-checker",
        "product_name": "WASSCE Result Checker",
        "category": "result-checker",
        "variant": "2026",
        "quantity": 1,
        "unit_amount": 7500,
        "total_amount": 7500
      }
    ]
  },
  "revenue": {
    "currency": "GHS",
    "timezone": "Africa/Accra",
    "business_date": "2026-07-15",
    "calculated_at": "2026-07-15T15:00:00.000Z",
    "platform": {
      "today": { "gross": 425000, "refunded": 7500, "net": 417500 },
      "month": { "gross": 6250000, "refunded": 7500, "net": 6242500 },
      "all_time": { "gross": 28450000, "refunded": 7500, "net": 28442500 }
    },
    "business": {
      "today": { "gross": 810000, "refunded": 7500, "net": 802500 },
      "month": { "gross": 12400000, "refunded": 7500, "net": 12392500 },
      "all_time": { "gross": 59750000, "refunded": 7500, "net": 59742500 }
    }
  },
  "links": {
    "dashboard": "https://checkers.example.com/admin/sales/sale_12345"
  }
}
```

## Field requirements

- Currency must always be `GHS` and money unit must be `minor`.
- Revenue timezone must be `Africa/Accra`.
- `business_date` must be the Accra calendar date in `YYYY-MM-DD` format.
- Include platform and combined business revenue for today, month, and all time.
- The displayed “Today” amount comes from `revenue.platform.today.net`.
- A sale or refund must contain between 1 and 100 product lines.
- Quantities must be positive integers; monetary values must be integers.
- Sale and refund amounts must be greater than zero.
- Do not include customer names, phone numbers, or email addresses.
- Keep the complete request below 256 KB.

## Reliability and retry behavior

Persist outgoing webhook jobs in the sales application's database. Do not rely
on an in-memory queue. The transaction that records a successful sale/refund
should also create its webhook job atomically, using an outbox pattern where
possible.

Interpret responses as follows:

- `200`: delivered successfully or already delivered; stop retrying.
- `409`: the same event is currently processing; retry later.
- `502` or `503`: temporary notifier failure; retry later.
- Other `4xx`: payload, identity, or signature error; log for investigation and
  do not retry indefinitely without correcting the request.

Use exponential backoff, for example after 1, 5, 15, and 60 minutes. Keep the
same `event_id` across every attempt. Generate a fresh timestamp and signature
for every attempt. Mark the outbox job delivered only after receiving `200`.

## Acceptance criteria

- A committed successful sale creates exactly one durable webhook event.
- A committed full or partial refund creates exactly one durable webhook event.
- Failed and pending payments do not create webhook events.
- Revenue is calculated by the sales database, not by the notifier.
- The payload includes the originating platform and every sold/refunded product.
- The raw JSON body sent is byte-for-byte identical to the body used for HMAC.
- Retries reuse the event ID and regenerate the timestamp and signature.
- Customer information is absent from payloads and logs.
- Automated tests cover signing, payload construction, retries, duplicate `200`
  responses, and full and partial refunds.
