import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // ─── Target ───────────────────────────────────────────────────
    // recipient = null means it's for all users with recipientRole
    recipient: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
    recipientRole: {
      type: String,
      enum: ["student", "staff", "admin", "all", null],
      default: null,
    },

    // ─── Content ──────────────────────────────────────────────────
    type: {
      type:    String,
      enum:    ["complaint_raised", "complaint_assigned", "complaint_resolved",
                "complaint_rejected", "escalation", "feedback_received",
                "announcement", "general"],
      default: "general",
    },
    title:   { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 500 },

    // ─── Read Status ──────────────────────────────────────────────
    isRead:  { type: Boolean, default: false },
    readAt:  { type: Date,    default: null  },

    // ─── Related Object ───────────────────────────────────────────
    relatedId:    { type: mongoose.Schema.Types.ObjectId, default: null },
    relatedModel: { type: String, enum: ["Complaint", "User", "Feedback", null], default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
