// Mirrors the THRESHOLDS used in the frontend (FloodGuard.jsx)
const THRESHOLDS = {
  watch: 3.0,
  warning: 4.0,
  critical: 4.5
};

/**
 * Build an alert object from a water level reading.
 * Returns null if no threshold is crossed.
 */
function buildAlert(waterLevel, zone = "Assam") {
  let severity = null;
  let channels = ["push"];
  let msg = "";

  if (waterLevel >= THRESHOLDS.critical) {
    severity = "severe";
    channels = ["push", "sms", "voice"];
    msg = `River level exceeded critical threshold (${THRESHOLDS.critical}m). Evacuate low-lying streets now.`;
  } else if (waterLevel >= THRESHOLDS.warning) {
    severity = "high";
    channels = ["push", "sms"];
    msg = `Water level crossed the warning threshold (${THRESHOLDS.warning}m). Flash flood possible soon.`;
  } else if (waterLevel >= THRESHOLDS.watch) {
    severity = "moderate";
    channels = ["push"];
    msg = `Water level rising steadily (watch threshold ${THRESHOLDS.watch}m crossed). Prepare your emergency kit.`;
  } else {
    return null;
  }

  return {
    severity,
    zone,
    msg,
    channels,
    waterLevel,
    time: "just now"
  };
}

module.exports = { THRESHOLDS, buildAlert };
