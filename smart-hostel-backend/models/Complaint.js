import mongoose from "mongoose";

const complaintSchema = new mongoose.Schema(
  {
    // ─── Core Fields ──────────────────────────────────────────────
    title: {
      type:      String,
      required:  [true, "Complaint title is required"],
      trim:      true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [120, "Title cannot exceed 120 characters"],
    },
    description: {
      type:      String,
      required:  [true, "Description is required"],
      trim:      true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    // ─── Category ─────────────────────────────────────────────────
    category: {
      type:     String,
      required: [true, "Category is required"],
      enum:     ["electrical", "plumbing", "carpentry", "housekeeping", "internet", "security", "other"],
    },

    // ─── Priority (auto-detected or manually set by admin) ────────
    priority: {
      type:    String,
      enum:    ["low", "medium", "high", "critical"],
      default: "low",
    },

    // ─── Status Flow: open → in_progress → resolved / rejected ───
    status: {
      type:    String,
      enum:    ["open", "in_progress", "resolved", "rejected", "closed"],
      default: "open",
    },

    // ─── Relations ────────────────────────────────────────────────
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: [true, "Student reference is required"],
    },
    assignedTo: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },
    resolvedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    // ─── Location ─────────────────────────────────────────────────
    roomNumber:  { type: String, trim: true },
    hostelBlock: { type: String, trim: true },

    // ─── Images ───────────────────────────────────────────────────
    images: [
      {
        url:      { type: String, required: true },
        publicId: { type: String, required: true },
      },
    ],

    // ─── Admin / Staff Notes ──────────────────────────────────────
    remarks: {
      type:    String,
      trim:    true,
      default: "",
    },

    // ─── Status History (audit trail) ────────────────────────────
    statusHistory: [
      {
        status:    { type: String },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        note:      { type: String, default: "" },
        changedAt: { type: Date, default: Date.now },
      },
    ],

    // ─── Escalation ───────────────────────────────────────────────
    escalated:    { type: Boolean, default: false },
    escalatedAt:  { type: Date,    default: null },

    // ─── Timestamps ───────────────────────────────────────────────
    resolvedAt:   { type: Date, default: null },
    rejectedAt:   { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─── Virtual: Resolution time in hours ───────────────────────────
complaintSchema.virtual("resolutionTimeHours").get(function () {
  if (!this.resolvedAt) return null;
  const diff = this.resolvedAt - this.createdAt;
  return Math.round(diff / (1000 * 60 * 60));
});

// ─── Indexes ──────────────────────────────────────────────────────
complaintSchema.index({ student: 1, status: 1 });
complaintSchema.index({ assignedTo: 1, status: 1 });
complaintSchema.index({ priority: 1, escalated: 1 });
complaintSchema.index({ createdAt: -1 });

const Complaint = mongoose.model("Complaint", complaintSchema);
export default Complaint;
