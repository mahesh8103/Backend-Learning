import User from "../models/User.js";
import Complaint from "../models/Complaint.js";
import Feedback from "../models/Feedback.js";
import Notification from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendEmail, staffAssignedTemplate } from "../utils/sendEmail.js";

// ─────────────────────────────────────────────────────────────────
// @desc    Admin dashboard — aggregate stats
// @route   GET /api/admin/dashboard
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const getDashboard = asyncHandler(async (req, res) => {
  const [
    totalStudents,
    totalStaff,
    totalComplaints,
    openComplaints,
    inProgressComplaints,
    resolvedComplaints,
    criticalComplaints,
    escalatedComplaints,
    avgRatingResult,
    recentComplaints,
    categoryBreakdown,
    priorityBreakdown,
    monthlyTrend,
  ] = await Promise.all([
    User.countDocuments({ role: "student", isActive: true }),
    User.countDocuments({ role: "staff",   isActive: true }),
    Complaint.countDocuments(),
    Complaint.countDocuments({ status: "open" }),
    Complaint.countDocuments({ status: "in_progress" }),
    Complaint.countDocuments({ status: "resolved" }),
    Complaint.countDocuments({ priority: "critical", status: { $in: ["open", "in_progress"] } }),
    Complaint.countDocuments({ escalated: true, status: { $in: ["open", "in_progress"] } }),

    // Average staff rating
    Feedback.aggregate([
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]),

    // Last 5 complaints
    Complaint.find()
      .populate("student",    "name roomNumber hostelBlock")
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(5),

    // Complaints by category
    Complaint.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Complaints by priority
    Complaint.aggregate([
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]),

    // Monthly complaints (last 6 months)
    Complaint.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  res.json(
    new ApiResponse(200, {
      users:      { totalStudents, totalStaff },
      complaints: {
        total:      totalComplaints,
        open:       openComplaints,
        inProgress: inProgressComplaints,
        resolved:   resolvedComplaints,
        critical:   criticalComplaints,
        escalated:  escalatedComplaints,
      },
      avgStaffRating:  avgRatingResult[0]?.avg?.toFixed(1) || "N/A",
      recentComplaints,
      charts: { categoryBreakdown, priorityBreakdown, monthlyTrend },
    }, "Dashboard data fetched successfully")
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get all users (with filters)
// @route   GET /api/admin/users
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const getAllUsers = asyncHandler(async (req, res) => {
  const { role, isActive, search, page = 1, limit = 20 } = req.query;

  const filter = {};
  if (role)     filter.role     = role;
  if (isActive !== undefined) filter.isActive = isActive === "true";
  if (search) {
    filter.$or = [
      { name:       { $regex: search, $options: "i" } },
      { email:      { $regex: search, $options: "i" } },
      { rollNumber: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [users, total] = await Promise.all([
    User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  res.json(
    new ApiResponse(200, {
      users,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    }, "Users fetched successfully")
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get single user details
// @route   GET /api/admin/users/:id
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select("-password");
  if (!user) throw new ApiError(404, "User not found.");

  // If student, attach their complaints
  let complaints = [];
  if (user.role === "student") {
    complaints = await Complaint.find({ student: user._id })
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .limit(10);
  }

  // If staff, attach assigned complaints + rating
  let staffStats = null;
  if (user.role === "staff") {
    const [assigned, resolved, avgRating] = await Promise.all([
      Complaint.countDocuments({ assignedTo: user._id, status: "in_progress" }),
      Complaint.countDocuments({ resolvedBy: user._id, status: "resolved" }),
      Feedback.aggregate([
        { $match: { staff: user._id } },
        { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
      ]),
    ]);
    staffStats = {
      assigned,
      resolved,
      avgRating: avgRating[0]?.avg?.toFixed(1) || "N/A",
      totalFeedbacks: avgRating[0]?.count || 0,
    };
  }

  res.json(new ApiResponse(200, { user, complaints, staffStats }, "User details fetched"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Assign complaint to a staff member
// @route   PATCH /api/admin/complaints/:id/assign
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const assignComplaint = asyncHandler(async (req, res) => {
  const { staffId, note } = req.body;
  if (!staffId) throw new ApiError(400, "Staff ID is required.");

  const [complaint, staff] = await Promise.all([
    Complaint.findById(req.params.id).populate("student", "name email"),
    User.findById(staffId),
  ]);

  if (!complaint) throw new ApiError(404, "Complaint not found.");
  if (!staff)     throw new ApiError(404, "Staff member not found.");
  if (staff.role !== "staff") throw new ApiError(400, "The selected user is not a staff member.");
  if (!staff.isAvailable)     throw new ApiError(400, "This staff member is currently unavailable.");

  complaint.assignedTo = staffId;
  if (complaint.status === "open") complaint.status = "in_progress";

  complaint.statusHistory.push({
    status:    complaint.status,
    changedBy: req.user._id,
    note:      note || `Assigned to ${staff.name}`,
  });

  await complaint.save();

  // Notify student
  await Notification.create({
    recipient:     complaint.student._id,
    recipientRole: "student",
    type:          "complaint_assigned",
    title:         "👷 Staff Assigned",
    message:       `${staff.name} has been assigned to your complaint: "${complaint.title}".`,
    relatedId:     complaint._id,
    relatedModel:  "Complaint",
  });

  // Notify staff
  await Notification.create({
    recipient:     staff._id,
    recipientRole: "staff",
    type:          "complaint_assigned",
    title:         "📋 New Complaint Assigned",
    message:       `You have been assigned complaint: "${complaint.title}" [Priority: ${complaint.priority}]`,
    relatedId:     complaint._id,
    relatedModel:  "Complaint",
  });

  // Email staff
  sendEmail({
    to:      staff.email,
    subject: "New Complaint Assigned — Smart Hostel",
    html:    staffAssignedTemplate(staff.name, complaint._id, complaint.title, complaint.priority),
  });

  res.json(new ApiResponse(200, complaint, `Complaint assigned to ${staff.name}`));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Override complaint priority manually
// @route   PATCH /api/admin/complaints/:id/priority
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const updatePriority = asyncHandler(async (req, res) => {
  const { priority } = req.body;
  const VALID = ["low", "medium", "high", "critical"];
  if (!VALID.includes(priority)) throw new ApiError(400, `Priority must be: ${VALID.join(", ")}`);

  const complaint = await Complaint.findByIdAndUpdate(
    req.params.id,
    { priority },
    { new: true, runValidators: true }
  );
  if (!complaint) throw new ApiError(404, "Complaint not found.");

  res.json(new ApiResponse(200, complaint, `Priority updated to "${priority}"`));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Activate / deactivate a user account
// @route   PATCH /api/admin/users/:id/toggle-status
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, "User not found.");
  if (user._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, "You cannot deactivate your own account.");
  }

  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });

  res.json(
    new ApiResponse(200, { isActive: user.isActive },
      `Account ${user.isActive ? "activated" : "deactivated"} successfully`)
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Broadcast announcement to all / specific role
// @route   POST /api/admin/announce
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const broadcastAnnouncement = asyncHandler(async (req, res) => {
  const { title, message, recipientRole = "all" } = req.body;
  if (!title || !message) throw new ApiError(400, "Title and message are required.");

  await Notification.create({
    recipient:     null,
    recipientRole,
    type:          "announcement",
    title,
    message,
  });

  res.status(201).json(new ApiResponse(201, null, "Announcement sent successfully"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get all escalated complaints
// @route   GET /api/admin/escalated
// @access  Private (admin)
// ─────────────────────────────────────────────────────────────────
export const getEscalatedComplaints = asyncHandler(async (req, res) => {
  const complaints = await Complaint.find({
    escalated: true,
    status:    { $in: ["open", "in_progress"] },
  })
    .populate("student",    "name email roomNumber hostelBlock")
    .populate("assignedTo", "name email")
    .sort({ priority: 1, createdAt: 1 });

  res.json(new ApiResponse(200, complaints, "Escalated complaints fetched"));
});
