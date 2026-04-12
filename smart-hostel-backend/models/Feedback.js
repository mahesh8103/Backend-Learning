import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    complaint: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "Complaint",
      required: true,
      unique:   true, // one feedback per complaint
    },
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    staff: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     "User",
      default: null,
    },

    // ─── Rating ───────────────────────────────────────────────────
    rating: {
      type:     Number,
      required: [true, "Rating is required"],
      min:      [1, "Rating must be at least 1"],
      max:      [5, "Rating cannot exceed 5"],
    },

    // ─── Optional Comment ─────────────────────────────────────────
    comment: {
      type:      String,
      trim:      true,
      maxlength: [500, "Comment cannot exceed 500 characters"],
      default:   "",
    },

    // ─── Was the resolution satisfactory? ────────────────────────
    isSatisfied: { type: Boolean, default: true },
  },
  { timestamps: true }
);

feedbackSchema.index({ staff: 1 });
feedbackSchema.index({ complaint: 1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
