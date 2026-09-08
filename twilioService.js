const twilio = require("twilio");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER,
  PUBLIC_BASE_URL
} = process.env;

let client = null;
let configWarningShown = false;

function isConfigured() {
  const ok = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER;
  if (!ok && !configWarningShown) {
    console.warn(
      "[twilioService] Twilio env vars are missing — running in DRY-RUN mode. " +
      "SMS/calls will be logged, not actually sent. Fill in .env to go live."
    );
    configWarningShown = true;
  }
  return ok;
}

function getClient() {
  if (!client && isConfigured()) {
    client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return client;
}

/**
 * Send a single SMS. Falls back to a dry-run log if Twilio isn't configured,
 * so the rest of the app keeps working during local development.
 */
async function sendSms(toPhone, body) {
  if (!isConfigured()) {
    console.log(`[DRY-RUN SMS] -> ${toPhone}: ${body}`);
    return { ok: true, dryRun: true, to: toPhone };
  }

  try {
    const message = await getClient().messages.create({
      to: toPhone,
      from: TWILIO_PHONE_NUMBER,
      body
    });
    return { ok: true, sid: message.sid, to: toPhone, status: message.status };
  } catch (err) {
    console.error(`[SMS ERROR] -> ${toPhone}:`, err.message);
    return { ok: false, to: toPhone, error: err.message };
  }
}

/**
 * Place a single voice call that reads the alert message aloud (TwiML <Say>).
 * Requires PUBLIC_BASE_URL to be a publicly reachable URL (e.g. via ngrok)
 * so Twilio's servers can fetch the call instructions from this backend.
 */
async function makeCall(toPhone, body) {
  if (!isConfigured()) {
    console.log(`[DRY-RUN CALL] -> ${toPhone}: ${body}`);
    return { ok: true, dryRun: true, to: toPhone };
  }

  if (!PUBLIC_BASE_URL) {
    const errMsg = "PUBLIC_BASE_URL is not set — cannot place real voice calls (Twilio needs a public TwiML URL).";
    console.error(`[CALL ERROR] -> ${toPhone}: ${errMsg}`);
    return { ok: false, to: toPhone, error: errMsg };
  }

  try {
    const url = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/api/twiml/voice-alert?msg=${encodeURIComponent(body)}`;
    const call = await getClient().calls.create({
      to: toPhone,
      from: TWILIO_PHONE_NUMBER,
      url,
      method: "GET"
    });
    return { ok: true, sid: call.sid, to: toPhone, status: call.status };
  } catch (err) {
    console.error(`[CALL ERROR] -> ${toPhone}:`, err.message);
    return { ok: false, to: toPhone, error: err.message };
  }
}

/**
 * Notify every contact in the emergency circle according to the alert's
 * channels. SMS goes to everyone; voice calls go only to contacts flagged
 * notifyVoice=true, and only when the alert includes "voice".
 */
async function notifyCircle(contacts, alert) {
  const results = { sms: [], voice: [] };
  const body = `NETRA FLOOD ALERT [${alert.severity.toUpperCase()}] ${alert.zone}: ${alert.msg}`;

  if (alert.channels.includes("sms")) {
    results.sms = await Promise.all(
      contacts.map(c => sendSms(c.phone, body))
    );
  }

  if (alert.channels.includes("voice")) {
    const voiceTargets = contacts.filter(c => c.notifyVoice);
    results.voice = await Promise.all(
      voiceTargets.map(c => makeCall(c.phone, body))
    );
  }

  return results;
}

module.exports = { sendSms, makeCall, notifyCircle, isConfigured };
