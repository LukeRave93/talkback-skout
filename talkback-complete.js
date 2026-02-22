/**
 * TalkBack × Skout — Webhook Receiver
 * ─────────────────────────────────────────────────────────────────────
 * Deploy this as a serverless function (Vercel, Render, Railway, etc.)
 * Endpoint: POST /api/talkback-complete
 *
 * ElevenLabs calls this when a conversation ends.
 * We extract the customer_id + transcript and write back to Klaviyo.
 * Klaviyo's own flow then fires the reward email — no manual steps.
 * ─────────────────────────────────────────────────────────────────────
 *
 * ENV VARS REQUIRED:
 *   KLAVIYO_API_KEY      — your Klaviyo private API key
 *   ELEVENLABS_SECRET    — webhook signing secret from ElevenLabs dashboard
 *                          (leave blank to skip verification during dev)
 * ─────────────────────────────────────────────────────────────────────
 */

const KLAVIYO_API_KEY   = process.env.KLAVIYO_API_KEY;
const ELEVENLABS_SECRET = process.env.ELEVENLABS_SECRET;

// ── Entry point ───────────────────────────────────────────────────────
export default async function handler(req, res) {

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : req.body;

    // ── 1. Verify the request is genuinely from ElevenLabs ─────────────
    if (ELEVENLABS_SECRET) {
      const signature = req.headers['x-elevenlabs-signature'] || '';
      const isValid   = await verifySignature(signature, JSON.stringify(body), ELEVENLABS_SECRET);
      if (!isValid) {
        console.error('Signature verification failed');
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // ── 2. Extract what we need from ElevenLabs payload ────────────────
    //
    // ElevenLabs webhook payload structure (approximate — verify against docs):
    // {
    //   type: "conversation_completed",
    //   conversation_id: "conv_xxx",
    //   agent_id: "agent_xxx",
    //   metadata: { customer_id: "klaviyo_profile_id" },
    //   transcript: [{ role: "agent"|"user", content: "..." }],
    //   duration_seconds: 142,
    //   ...
    // }
    //
    // ENGINEER: if ElevenLabs puts dynamic variables under a different key,
    // adjust the path below. Log `body` on first test to confirm.

    const {
      type,
      conversation_id,
      metadata = {},
      transcript = [],
    } = body;

    // Only process completed conversations
    if (type && type !== 'conversation_completed') {
      return res.status(200).json({ skipped: true, type });
    }

    const customerId = metadata?.customer_id
                    || metadata?.dynamic_variables?.customer_id
                    || null;

    if (!customerId) {
      console.error('No customer_id in webhook payload', JSON.stringify(body, null, 2));
      return res.status(400).json({ error: 'Missing customer_id in metadata' });
    }

    // Flatten transcript to a readable string
    const transcriptText = transcript
      .map(t => `${t.role === 'agent' ? 'Agent' : 'Customer'}: ${t.content}`)
      .join('\n');

    // ── 3. Write to Klaviyo ────────────────────────────────────────────
    const klaviyoResult = await updateKlaviyoProfile(customerId, {
      talkback_status:         'completed',
      talkback_completed_at:   new Date().toISOString(),
      talkback_conversation_id: conversation_id || null,
      talkback_transcript:     transcriptText || null,
    });

    console.log(`✓ Klaviyo updated for ${customerId}`, klaviyoResult);

    // 200 → ElevenLabs won't retry
    return res.status(200).json({ success: true, customer_id: customerId });

  } catch (err) {
    console.error('Webhook handler error', err);
    // Return 200 so ElevenLabs doesn't flood retries during debugging
    // Switch to 500 in production once stable
    return res.status(200).json({ error: err.message });
  }
}

// ── Klaviyo Profile Update ─────────────────────────────────────────────
//
// Uses Klaviyo API v2 PATCH /profiles/{id}
// Sets custom properties that trigger the reward flow.
//
async function updateKlaviyoProfile(profileId, properties) {

  const url = `https://a.klaviyo.com/api/profiles/${profileId}/`;

  const payload = {
    data: {
      type: 'profile',
      id:   profileId,
      attributes: {
        properties: {
          ...properties
        }
      }
    }
  };

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization':  `Klaviyo-API-Key ${KLAVIYO_API_KEY}`,
      'Content-Type':   'application/vnd.api+json',
      'Accept':         'application/vnd.api+json',
      'revision':       '2024-02-15', // update to latest Klaviyo API revision
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Klaviyo API error ${response.status}: ${errorText}`);
  }

  // 204 No Content is success for PATCH
  if (response.status === 204) return { updated: true };

  return response.json();
}

// ── Webhook Signature Verification ────────────────────────────────────
//
// ElevenLabs signs webhooks using HMAC-SHA256.
// The signature header value is: sha256=<hex_digest>
//
async function verifySignature(signatureHeader, body, secret) {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const expected = `sha256=${hex}`;
    return signatureHeader === expected;
  } catch {
    return false;
  }
}
