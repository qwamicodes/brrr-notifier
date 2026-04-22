import { env } from '../../../config/env';
import { BrrrPayloadSchema } from '../domain/schemas';
import type { BrrrPayload } from '../domain/types';

export type SendToBrrrResult = {
  ok: boolean;
  status: number;
};

export async function sendToBrrr(payload: BrrrPayload): Promise<SendToBrrrResult> {
  const parsedPayload = BrrrPayloadSchema.parse(payload);
  const url = `${env.BRRR_BASE_URL.replace(/\/$/, '')}/v1/send`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.BRRR_SECRET}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(parsedPayload)
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(
      `brrr send failed with status ${response.status}: ${bodyText || 'empty response body'}`
    );
  }

  return {
    ok: true,
    status: response.status
  };
}
