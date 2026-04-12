import Complaint from "../models/Complaint.js";
import Feedback from "../models/Feedback.js";
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { detectPriority } from "../utils/priorityDetector.js";
import { uploadComplaintImages } from "../utils/cloudinary.js";
import {
  sendEmail,
  complaintRaisedTemplate,
  complaintResolvedTemplate,
} from "../utils/sendEmail.js";

// ─────────────────────────────────────────────────────────────────
// @desc    Raise a new complaint (with optional images)
// @route   POST /api/complaints
// @access  Private (student)
// ─────────────────────────────────────────────────────────────────
export const raiseComplaint = asyncHandler(async (req, res) => {
  uploadComplaintImages(req, res, async (err) => {
    if (err) throw new ApiError(400, err.message);

    const { title, description, category, roomNumber, hostelBlock } = req.body;
    if (!title || !description || !category) {
      throw new ApiError(400, "Title, description, and category are required.");
    }

    const autoPriority = detectPriority(title, description);

    const images = (req.files || []).map((f) => ({
      url:      f.path,
      publicId: f.filename,
    }));

    const complaint = await Complaint.create({
      title,
      description,
      category,
      priority:    autoPriority,
      student:     req.user._id,
      roomNumber:  roomNumber  || req.user.roomNumber,
      hostelBlock: hostelBlock || req.user.hostelBlock,
      images,
      statusHistory: [{ status: "open", changedBy: req.user._id, note: "Complaint raised" }],
    });

    await complaint.populate("student", "name email roomNumber hostelBlock");

    // Notify all admins
    await Notification.create({
      recipient:     null,
      recipientRole: "admin",
      type:          "complaint_raised",
      title:         "📋 New Complaint",
      message:       `${req.user.name} raised a "${category}" complaint: "${title}" [Priority: ${autoPriority}]`,
      relatedId:     complaint._id,
      relatedModel:  "Complaint",
    });

    // Email confirmation to student
    sendEmail({
      to:      req.user.email,
      subject: "Complaint Received — Smart Hostel",
      html:    complaintRaisedTemplate(req.user.name, complaint._id, title),
    });

    res.status(201).json(new ApiResponse(201, complaint, "Complaint raised successfully"));
  });
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get complaints (student sees own; admin/staff see all)
// @route   GET /api/complaints
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const getComplaints = asyncHandler(async (req, res) => {
  const {
    status, priority, category, page = 1, limit = 10,
    sortBy = "createdAt", order = "desc",
  } = req.query;

  const filter = {};
  if (req.user.role === "student") filter.student = req.user._id;
  if (req.user.role === "staff")   filter.assignedTo = req.user._id;
  if (status)   filter.status   = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;

  const skip      = (Number(page) - 1) * Number(limit);
  const sortOrder = order === "asc" ? 1 : -1;

  const [complaints, total] = await Promise.all([
    Complaint.find(filter)
      .populate("student",    "name email rollNumber roomNumber hostelBlock")
      .populate("assignedTo", "name email department phone")
      .populate("resolvedBy", "name email")
      .sort({ [sortBy]: sortOrder })
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
    }, "Complaints fetched successfully")
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get single complaint by ID
// @route   GET /api/complaints/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const getComplaintById = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id)
    .populate("student",              "name email rollNumber roomNumber hostelBlock photo")
    .populate("assignedTo",           "name email department phone photo")
    .populate("resolvedBy",           "name email")
    .populate("statusHistory.changedBy", "name role");

  if (!complaint) throw new ApiError(404, "Complaint not found.");

  // Students can only view their own complaints
  if (
    req.user.role === "student" &&
    complaint.student._id.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "You are not authorized to view this complaint.");
  }

  // Fetch feedback if resolved
  const feedback = await Feedback.findOne({ complaint: complaint._id })
    .populate("student", "name");

  res.json(new ApiResponse(200, { complaint, feedback }, "Complaint fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Update complaint status (staff/admin)
// @route   PATCH /api/complaints/:id/status
// @access  Private (staff, admin)
// ─────────────────────────────────────────────────────────────────
export const updateComplaintStatus = asyncHandler(async (req, res) => {
  const { status, remarks } = req.body;
  const VALID_STATUSES = ["open", "in_progress", "resolved", "rejected", "closed"];

  if (!status || !VALID_STATUSES.includes(status)) {
    throw new ApiError(400, `Status must be one of: ${VALID_STATUSES.join(", ")}`);
  }

  const complaint = await Complaint.findById(req.params.id).populate("student", "name email");
  if (!complaint) throw new ApiError(404, "Complaint not found.");

  // Staff can only update their assigned complaints
  if (
    req.user.role === "staff" &&
    complaint.assignedTo?.toString() !== req.user._id.toString()
  ) {
    throw new ApiError(403, "You can only update complaints assigned to you.");
  }

  const previousStatus = complaint.status;
  complaint.status  = status;
  complaint.remarks = remarks || complaint.remarks;

  if (status === "resolved") {
    complaint.resolvedAt = new Date();
    complaint.resolvedBy = req.user._id;
  }
  if (status === "rejected") {
    complaint.rejectedAt = new Date();
  }

  complaint.statusHistory.push({
    status,
    changedBy: req.user._id,
    note:      remarks || `Status changed from ${previousStatus} to ${status}`,
  });

  await complaint.save();

  // Notify student
  await Notification.create({
    recipient:     complaint.student._id,
    recipientRole: "student",
    type:          status === "resolved" ? "complaint_resolved" : "complaint_assigned",
    title:         status === "resolved" ? "✅ Complaint Resolved" : `📌 Complaint ${status.replace("_", " ")}`,
    message:       `Your complaint "${complaint.title}" is now ${status.replace("_", " ")}.${remarks ? " Note: " + remarks : ""}`,
    relatedId:     complaint._id,
    relatedModel:  "Complaint",
  });

  // Email on resolution
  if (status === "resolved") {
    sendEmail({
      to:      complaint.student.email,
      subject: "Your Complaint Has Been Resolved — Smart Hostel",
      html:    complaintResolvedTemplate(complaint.student.name, complaint._id, complaint.title),
    });
  }

  res.json(new ApiResponse(200, complaint, `Complaint status updated to "${status}"`));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Delete complaint (student can delete own open complaint)
// @route   DELETE /api/complaints/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const deleteComplaint = asyncHandler(async (req, res) => {
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new ApiError(404, "Complaint not found.");

  if (req.user.role === "student") {
    if (complaint.student.toString() !== req.user._id.toString()) {
      throw new ApiError(403, "You can only delete your own complaints.");
    }
    if (complaint.status !== "open") {
      throw new ApiError(400, "You can only delete complaints that are still open.");
    }
  }

  await complaint.deleteOne();
  res.json(new ApiResponse(200, null, "Complaint deleted successfully"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Submit feedback after resolution
// @route   POST /api/complaints/:id/feedback
// @access  Private (student)
// ─────────────────────────────────────────────────────────────────
export const submitFeedback = asyncHandler(async (req, res) => {
  const { rating, comment, isSatisfied } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, "Rating must be between 1 and 5.");
  }

  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw new ApiError(404, "Complaint not found.");

  if (complaint.student.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You can only submit feedback for your own complaints.");
  }
  if (complaint.status !== "resolved") {
    throw new ApiError(400, "Feedback can only be submitted for resolved complaints.");
  }

  const existingFeedback = await Feedback.findOne({ complaint: complaint._id });
  if (existingFeedback) throw new ApiError(409, "You have already submitted feedback for this complaint.");

  const feedback = await Feedback.create({
    complaint:   complaint._id,
    student:     req.user._id,
    staff:       complaint.resolvedBy,
    rating,
    comment,
    isSatisfied: isSatisfied ?? true,
  });

  // Notify admin
  await Notification.create({
    recipient:     null,
    recipientRole: "admin",
    type:          "feedback_received",
    title:         "⭐ Feedback Received",
    message:       `${req.user.name} rated complaint #${complaint._id.toString().slice(-6).toUpperCase()} — ${rating}/5 stars.`,
    relatedId:     complaint._id,
    relatedModel:  "Complaint",
  });

  res.status(201).json(new ApiResponse(201, feedback, "Feedback submitted successfully"));
});
