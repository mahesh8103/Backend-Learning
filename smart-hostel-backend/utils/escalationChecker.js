import cron from "node-cron";
import Complaint from "../models/Complaint.js";
import Notification from "../models/Notification.js";

/**
 * Escalation Rules:
 * - critical: escalate if unresolved after 4 hours
 * - high:     escalate if unresolved after 12 hours
 * - medium:   escalate if unresolved after 48 hours
 * - low:      escalate if unresolved after 7 days
 *
 * Runs every hour.
 */

const ESCALATION_HOURS = {
  critical: 4,
  high:     12,
  medium:   48,
  low:      168, // 7 days
};

const checkEscalations = async () => {
  try {
    const now = new Date();

    for (const [priority, hours] of Object.entries(ESCALATION_HOURS)) {
      const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);

      const complaints = await Complaint.find({
        priority,
        status:     { $in: ["open", "in_progress"] },
        createdAt:  { $lte: cutoff },
        escalated:  false,
      }).populate("student", "name email");

      for (const complaint of complaints) {
        // Mark as escalated
        complaint.escalated = true;
        complaint.escalatedAt = now;
        await complaint.save();

        // Create notification for all admins
        await Notification.create({
          recipient:      null,       // null = broadcast to all admins
          recipientRole:  "admin",
          type:           "escalation",
          title:          "⚠️ Complaint Escalated",
          message:        `Complaint #${complaint._id.toString().slice(-6).toUpperCase()} ("${complaint.title}") has been unresolved for ${hours} hours and requires immediate attention.`,
          relatedId:      complaint._id,
          relatedModel:   "Complaint",
        });

        console.log(`🔺 Escalated complaint: ${complaint._id} (${priority})`);
      }
    }
  } catch (err) {
    console.error("Escalation checker error:", err.message);
  }
};

// Run every hour
cron.schedule("0 * * * *", () => {
  console.log("🕐 Running escalation check...");
  checkEscalations();
});

export default checkEscalations;
