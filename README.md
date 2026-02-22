# TalkBack × Skout — Deploy Guide
> MVP. Fully automated. No manual steps.

---

## What you're deploying

| File | Purpose |
|------|---------|
| `index.html` | Landing page at `ravemarketing.co/skout?cid=XXXX` |
| `api/talkback-complete.js` | Webhook receiver (Vercel serverless function) |

---

## Step 1 — Deploy the landing page

Host `index.html` anywhere static. Vercel is fastest:

```bash
npx vercel --prod
```

The page will live at `ravemarketing.co/skout` (configure domain in Vercel).

**In `index.html`, replace:**
```js
widget.setAttribute('agent-id', 'YOUR_AGENT_ID');
```
with the real ElevenLabs agent ID from the ElevenLabs dashboard.

---

## Step 2 — Deploy the webhook receiver

Same Vercel project. The file at `api/talkback-complete.js` auto-becomes:
```
POST https://ravemarketing.co/api/talkback-complete
```

**Set these env vars in Vercel dashboard:**
```
KLAVIYO_API_KEY      = pk_xxxxxxxxxxxxxxxx   (Klaviyo → Account → API Keys → Private)
ELEVENLABS_SECRET    = xxxxxxxxxx            (ElevenLabs → Agent → Webhooks → Signing secret)
```

---

## Step 3 — Register the webhook in ElevenLabs

In the ElevenLabs dashboard for the Skout agent:

- Webhooks → Add webhook
- URL: `https://ravemarketing.co/api/talkback-complete`
- Event: `conversation_completed`
- Copy the signing secret → paste into `ELEVENLABS_SECRET` env var

---

## Step 4 — Confirm dynamic variable name

In ElevenLabs agent settings, confirm the variable name `customer_id` is
registered as an allowed dynamic variable. This is what carries the Klaviyo
profile ID through the conversation session.

**Test first:** Make one test call with a real Klaviyo profile ID in the URL:
```
https://ravemarketing.co/skout?cid=TEST_PROFILE_ID
```
Complete the conversation. Check your webhook receiver logs. The payload
should contain `metadata.customer_id = TEST_PROFILE_ID`.

Log the full body on first run:
```js
console.log('EL payload:', JSON.stringify(body, null, 2));
```
Adjust the `customerId` extraction path if ElevenLabs puts it elsewhere.

---

## Step 5 — Set up Klaviyo

**Custom properties the webhook writes:**
| Property | Value |
|----------|-------|
| `talkback_status` | `"completed"` |
| `talkback_completed_at` | ISO timestamp |
| `talkback_conversation_id` | ElevenLabs conversation ID |
| `talkback_transcript` | Full transcript text |

**Klaviyo flow trigger:**
- Flow → Create flow → Metric trigger OR Profile property trigger
- Trigger: `talkback_status` is set to `completed`
- Action: Send reward email (Uber Eats voucher)

---

## Step 6 — Klaviyo email

The personalised URL tag in the Klaviyo email template:

```
{{ event.properties.cid }}
```
or using Klaviyo profile ID:
```
https://ravemarketing.co/skout?cid={{ person|lookup:'$id' }}
```

Confirm which ID Klaviyo exposes — test with one profile before sending 500.

---

## End-to-end test checklist

- [ ] Land on `ravemarketing.co/skout?cid=TEST123` — idle screen shows
- [ ] Click "Start talking" — ElevenLabs agent launches, active screen shows
- [ ] Complete 2-min conversation — done screen shows
- [ ] Webhook logs show `customer_id: TEST123`
- [ ] Klaviyo profile for TEST123 shows `talkback_status: completed`
- [ ] Reward email arrives in inbox

All 6 green → send the 500.

---

## Architecture in one line

```
Klaviyo email → ?cid=ID → ElevenLabs session(customer_id=ID)
  → webhook → Klaviyo PATCH → Klaviyo flow → reward email
```

No database. No queue. No manual steps.
