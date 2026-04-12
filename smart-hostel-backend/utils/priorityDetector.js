/**
 * Automatically detects complaint priority based on title/description keywords.
 * Returns: "low" | "medium" | "high" | "critical"
 */

const CRITICAL_KEYWORDS = [
  "fire", "flood", "gas leak", "electric shock", "electrocution",
  "emergency", "bleeding", "accident", "collapse", "burst pipe",
  "short circuit", "unconscious", "injury",
];

const HIGH_KEYWORDS = [
  "no water", "no electricity", "power cut", "sewage", "overflow",
  "broken door", "lock broken", "ceiling leak", "rat", "pest",
  "heater not working", "bathroom", "toilet blocked",
];

const MEDIUM_KEYWORDS = [
  "fan", "light", "bulb", "switch", "internet", "wifi", "window",
  "mattress", "bed", "furniture", "chair", "table", "cupboard",
  "dustbin", "cleaning", "sweeping", "noise", "leaking tap",
];

const detectPriority = (title = "", description = "") => {
  const text = `${title} ${description}`.toLowerCase();

  if (CRITICAL_KEYWORDS.some((kw) => text.includes(kw))) return "critical";
  if (HIGH_KEYWORDS.some((kw) => text.includes(kw)))     return "high";
  if (MEDIUM_KEYWORDS.some((kw) => text.includes(kw)))   return "medium";

  return "low";
};

export { detectPriority };
