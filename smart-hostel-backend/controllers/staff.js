import Complaint from "../models/Complaint.js";
import Feedback from "../models/Feedback.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ─────────────────────────────────────────────────────────────────
// @desc    Get all complaints assigned to logged-in staff
// @route   GET /api/staff/my-complaints
// @access  Private (staff)
// ─────────────────────────────────────────────────────────────────
export const getMyAssignedComplaints = asyncHandler(async (req, res) => {
  const { status, priority, page = 1, limit = 10 } = req.query;

  const filter = { assignedTo: req.user._id };
  if (status)   filter.status   = status;
  if (priority) filter.priority = priority;

  const skip = (Number(page) - 1) * Number(limit);

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate("student", "name email rollNumber roomNumber hostelBlock phone photo")
      .sort({ priority: 1, createdAt: 1 }) // critical first, oldest first
      .skip(skip)
      .limit(Number(limit)),
    Complaint.countDocuments(filter),
  ]);

  res.json(
    new ApiResponse(200, {
      complaints,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    }, "Assigned complaints fetched")
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Staff marks a complaint as in_progress or resolved
// @route   PATCH /api/staff/complaints/:id/update
// @access  Private (staff)
// ─────────────────────────────────────────────────────────────────
export const updateAssignedComplaint = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;
  const ALLOWED = ["in_progress", "resolved"];

  if (!status || !ALLOWED.includes(status)) {
    throw new ApiError(400, `Staff can only set status to: ${ALLOWED.join(" or ")}`);
  }

  const complaint = await Complaint.findById(req.params.id).populate("student", "name email");
  if (!complaint) throw new ApiError(404, "Complaint not found.");

  if (complaint.assignedTo?.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "This complaint is not assigned to you.");
  }

  const prevStatus     = complaint.status;
  complaint.status     = status;
  complaint.remarks    = remarks || complaint.remarks;

  if (status === "resolved") {
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = req.user._id;
  }

  complaint.statusHistory.push({
    status,
    changedBy: req.user._id,
    note:      remarks || `Status updated from ${prevStatus} to ${status} by staff`,
  });

  await complaint.save();

  // Notify student
  await Notification.create({
    recipient:     complaint.student._id,
    recipientRole: "student",
    type:          status === "resolved" ? "complaint_resolved" : "complaint_assigned",
    title:         status === "resolved" ? "✅ Complaint Resolved" : "🔧 Work in Progress",
    message:       `Your complaint "${complaint.title}" is now ${status.replace("_", " ")}.${remarks ? " — " + remarks : ""}`,
    relatedId:     complaint._id,
    relatedModel:  "Complaint",
  });

  res.json(new ApiResponse(200, complaint, `Complaint updated to "${status}"`));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Staff dashboard summary
// @route   GET /api/staff/dashboard
// @access  Private (staff)
// ─────────────────────────────────────────────────────────────────
export const getStaffDashboard = asyncHandler(async (req, res) => {
  const staffId = req.user._id;

  const [
    totalAssigned,
    openCount,
    inProgressCount,
    resolvedCount,
    avgRating,
    recentComplaints,
  ] = await Promise.all([
    Complaint.countDocuments({ assignedTo: staffId }),
    Complaint.countDocuments({ assignedTo: staffId, status: "open" }),
    Complaint.countDocuments({ assignedTo: staffId, status: "in_progress" }),
    Complaint.countDocuments({ resolvedBy:  staffId, status: "resolved" }),

    Feedback.aggregate([
      { $match: { staff: staffId } },
      { $group: { _id: null, avg: { $avg: "$rating" }, total: { $sum: 1 } } },
    ]),

    Complaint.find({ assignedTo: staffId, status: { $in: ["open", "in_progress"] } })
      .populate("student", "name roomNumber hostelBlock")
      .sort({ priority: 1, createdAt: 1 })
      .limit(5),
  ]);

  res.json(
    new ApiResponse(200, {
      stats: {
        totalAssigned,
        open:       openCount,
        inProgress: inProgressCount,
        resolved:   resolvedCount,
        avgRating:  avgRating[0]?.avg?.toFixed(1) || "N/A",
        totalRatings: avgRating[0]?.total || 0,
      },
      recentComplaints,
    }, "Staff dashboard data fetched")
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Toggle staff availability
// @route   PATCH /api/staff/availability
// @access  Private (staff)
// ─────────────────────────────────────────────────────────────────
export const toggleAvailability = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  user.isAvailable = !user.isAvailable;
  await user.save({ validateBeforeSave: false });

  res.json(
    new ApiResponse(200, { isAvailable: user.isAvailable },
      `You are now marked as ${user.isAvailable ? "available" : "unavailable"}`)
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get feedbacks received by the logged-in staff
// @route   GET /api/staff/feedbacks
// @access  Private (staff)
// ─────────────────────────────────────────────────────────────────
export const getMyFeedbacks = asyncHandler(async (req, res) => {
  const feedbacks = await Feedback.find({ staff: req.user._id })
    .populate("student",   "name photo")
    .populate("complaint", "title category createdAt")
    .sort({ createdAt: -1 });

  res.json(new ApiResponse(200, feedbacks, "Feedbacks fetched successfully"));
});
