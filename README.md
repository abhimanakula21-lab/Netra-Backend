# NETRA backend — real-time SMS/voice flood alerts

Express backend that powers the "Trigger alert" button in the NETRA dashboard.
When a water-level reading crosses a threshold, it sends **real SMS** and
**places real phone calls** to your emergency circle using Twilio.

The frontend (`FloodGuard.jsx`) already calls `POST http://localhost:5000/api/simulate`
— no frontend changes are required to get this working.

## 1. Install

```bash
cd netra-backend
npm install
cp .env.example .env
```

## 2. Get Twilio credentials

1. Create a free account at https://www.twilio.com/try-twilio
2. From the console dashboard, copy your **Account SID** and **Auth Token**
   into `.env`.
3. Buy/activate a Twilio phone number (Console → Phone Numbers) and put it
   in `TWILIO_PHONE_NUMBER` (E.164 format, e.g. `+15551234567`).
4. **Trial accounts** can only send SMS/calls to phone numbers you've
   verified in the Twilio console (Console → Verified Caller IDs). Verify
   your own number and any circle members' numbers while testing, or
   upgrade the account to message/call anyone.

## 3. Expose a public URL (only needed for voice calls)

Twilio calls back into your server to fetch what to say on a phone call, so
it needs a public URL. In development, use ngrok:

```bash
ngrok http 5000
```

Copy the `https://...ngrok-free.app` URL into `PUBLIC_BASE_URL` in `.env`.
(SMS-only alerts work fine without this — only voice calls need it.)

## 4. Add your real emergency circle

Edit `contacts.json` (or use the API below) with real E.164 phone numbers.
`notifyVoice: true` means that contact also gets a phone call on severe
alerts, not just SMS.

```bash
curl -X POST http://localhost:5000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"name":"Ananya Rao","relation":"Spouse","phone":"+919876543210","notifyVoice":true}'
```

## 5. Run it

```bash
npm start
```

You should see `NETRA backend listening on http://localhost:5000`.

If Twilio env vars aren't filled in yet, the server runs in **dry-run
mode** — it logs what it *would* send to the console instead of failing,
so you can develop the UI without burning Twilio credits.

## How alerting works

- `POST /api/simulate { waterLevel }` — same contract the frontend already
  uses. Crossing a threshold (watch 3.0m / warning 4.0m / critical 4.5m)
  builds an alert and, only on a **new or escalated** severity for that
  zone, fires SMS (warning+) and voice calls (critical only, to contacts
  with `notifyVoice: true`). Re-sending the same or a lower level won't
  spam the circle again.
- `POST /api/notify { severity, zone, msg, channels }` — manual broadcast,
  ignoring the threshold logic (e.g. for an operator-triggered warning).
- `GET/POST /api/contacts`, `DELETE /api/contacts/:id` — manage the
  emergency circle.
- `GET /api/twiml/voice-alert` — internal endpoint Twilio fetches to know
  what to say on a call; you don't call this yourself.

## Notes

- Never commit your real `.env` — it contains live Twilio credentials.
- Alert throttling is in-memory (per zone) and resets if the server
  restarts; for production, back it with a database instead.
