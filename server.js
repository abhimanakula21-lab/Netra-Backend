require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { buildAlert } = require("./alertEngine");
const { notifyCircle } = require("./twilioService");
const contactsStore = require("./contactsStore");

const app = express();
app.use(express.json());

const corsOriginEnv = (process.env.CORS_ORIGIN || "*").trim();
const corsOptions = corsOriginEnv === "*"
  ? { origin: "*" }
  : { origin: corsOriginEnv.split(",").map(s => s.trim()) };
app.use(cors(corsOptions));

// Track the highest severity already alerted per zone, so re-simulating the
// same or a lower level doesn't spam the circle with duplicate messages.
const lastSeverityByZone = new Map();
const SEVERITY_RANK = { moderate: 1, high: 2, severe: 3 };

// ---------------------------------------------------------------------------
// POST /api/simulate  { waterLevel, zone? }
// Matches exactly what FloodGuard.jsx already calls. Builds an alert from the
// water level, and — if it's new/escalated — fires real SMS/voice through
// Twilio to the emergency circle. Always returns { alert } or { message }.
// ---------------------------------------------------------------------------
app.post("/api/simulate", async (req, res) => {
  const { waterLevel, zone = "Assam" } = req.body || {};

  if (typeof waterLevel !== "number" || Number.isNaN(waterLevel)) {
    return res.status(400).json({ message: "waterLevel (number) is required." });
  }

  const alert = buildAlert(waterLevel, zone);

  if (!alert) {
    lastSeverityByZone.delete(zone);
    return res.json({ message: "No threshold crossed." });
  }

  const prevRank = SEVERITY_RANK[lastSeverityByZone.get(zone)] || 0;
  const currRank = SEVERITY_RANK[alert.severity] || 0;
  const isNewOrEscalated = currRank > prevRank;

  let notifyResults = null;
  if (isNewOrEscalated) {
    const contacts = contactsStore.readAll();
    notifyResults = await notifyCircle(contacts, alert);
    lastSeverityByZone.set(zone, alert.severity);
  }

  res.json({ alert, notified: isNewOrEscalated, notifyResults });
});

// ---------------------------------------------------------------------------
// POST /api/notify  { severity, zone, msg, channels }
// Fire-and-forget manual broadcast to the whole circle, independent of the
// water-level threshold logic (e.g. for the "Trigger alert" button, or an
// operator-issued warning).
// ---------------------------------------------------------------------------
app.post("/api/notify", async (req, res) => {
  const { severity = "severe", zone = "Assam", msg, channels } = req.body || {};

  if (!msg) {
    return res.status(400).json({ message: "msg is required." });
  }

  const alert = {
    severity,
    zone,
    msg,
    channels: Array.isArray(channels) && channels.length ? channels : ["push", "sms", "voice"]
  };

  const contacts = contactsStore.readAll();
  const notifyResults = await notifyCircle(contacts, alert);

  res.json({ alert, notifyResults });
});

// ---------------------------------------------------------------------------
// Emergency circle CRUD
// ---------------------------------------------------------------------------
app.get("/api/contacts", (req, res) => {
  res.json(contactsStore.readAll());
});

app.post("/api/contacts", (req, res) => {
  try {
    const contact = contactsStore.addContact(req.body || {});
    res.status(201).json(contact);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.delete("/api/contacts/:id", (req, res) => {
  const next = contactsStore.removeContact(req.params.id);
  res.json(next);
});

// ---------------------------------------------------------------------------
// TwiML endpoint Twilio calls back into when placing a voice call, so it
// knows what to say. GET because twilioService.makeCall uses method: "GET".
// ---------------------------------------------------------------------------
app.get("/api/twiml/voice-alert", (req, res) => {
  const msg = (req.query.msg || "This is a flood alert from NETRA. Please check the app for details.").toString();
  const escaped = msg
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi" language="en-IN">${escaped}</Say>
  <Pause length="1"/>
  <Say voice="Polly.Aditi" language="en-IN">I repeat. ${escaped}</Say>
</Response>`);
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`NETRA backend listening on http://localhost:${PORT}`);
});
