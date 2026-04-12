import User from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateToken } from "../middleware/authMiddleware.js";
import { uploadProfilePhoto, cloudinary } from "../utils/cloudinary.js";
import { sendEmail } from "../utils/sendEmail.js";

// ─── Helper: attach token to response ────────────────────────────
const sendTokenResponse = (res, statusCode, user, message) => {
  const token = generateToken(user._id);
  res.status(statusCode).json(
    new ApiResponse(statusCode, { token, user: user.toSafeObject() }, message)
  );
};

// ─────────────────────────────────────────────────────────────────
// @desc    Register a new user (student / staff / admin)
// @route   POST /api/auth/register
// @access  Public (admin creation requires existing admin token)
// ─────────────────────────────────────────────────────────────────
export const register = asyncHandler(async (req, res) => {
  const {
    name, email, password, phone, role,
    rollNumber, course, year, hostelBlock, roomNumber, admissionDate,
    department, employeeId,
  } = req.body;

  // Only an existing admin can create staff/admin accounts
  if ((role === "admin" || role === "staff") && !req.user) {
    throw new ApiError(403, "Only admins can register staff or admin accounts.");
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ApiError(409, "An account with this email already exists.");

  if (role === "student" && rollNumber) {
    const existingRoll = await User.findOne({ rollNumber: rollNumber.toUpperCase() });
    if (existingRoll) throw new ApiError(409, "This roll number is already registered.");
  }

  const user = await User.create({
    name, email, password, phone,
    role: role || "student",
    rollNumber, course, year, hostelBlock, roomNumber, admissionDate,
    department, employeeId,
  });

  // Welcome email (fire-and-forget)
  sendEmail({
    to:      email,
    subject: "Welcome to Smart Hostel 🏨",
    html:    `<p>Hi <strong>${name}</strong>, your account has been created successfully. Role: <strong>${user.role}</strong>.</p>`,
  });

  sendTokenResponse(res, 201, user, "Account created successfully");
});

// ─────────────────────────────────────────────────────────────────
// @desc    Login
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) throw new ApiError(400, "Email and password are required.");

  const user = await User.findOne({ email }).select("+password");
  if (!user) throw new ApiError(401, "Invalid email or password.");
  if (!user.isActive) throw new ApiError(403, "Your account has been deactivated. Contact admin.");

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, "Invalid email or password.");

  sendTokenResponse(res, 200, user, "Logged in successfully");
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate("complaintsCount");
  res.json(new ApiResponse(200, user.toSafeObject(), "Profile fetched successfully"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Update profile (name, phone, course, year, etc.)
// @route   PATCH /api/auth/update-profile
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const updateProfile = asyncHandler(async (req, res) => {
  const ALLOWED_FIELDS = ["name", "phone", "course", "year", "hostelBlock", "roomNumber"];
  const updates = {};
  ALLOWED_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new:              true,
    runValidators:    true,
  });

  res.json(new ApiResponse(200, user.toSafeObject(), "Profile updated successfully"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Upload / update profile photo
// @route   PATCH /api/auth/upload-photo
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const uploadPhoto = asyncHandler(async (req, res) => {
  uploadProfilePhoto(req, res, async (err) => {
    if (err) throw new ApiError(400, err.message);
    if (!req.file) throw new ApiError(400, "Please upload an image file.");

    // Delete old photo from Cloudinary if it exists
    const user = await User.findById(req.user._id);
    if (user.photo?.publicId) {
      await cloudinary.uploader.destroy(user.photo.publicId);
    }

    user.photo = { url: req.file.path, publicId: req.file.filename };
    await user.save({ validateBeforeSave: false });

    res.json(new ApiResponse(200, { photo: user.photo }, "Profile photo updated"));
  });
});

// ─────────────────────────────────────────────────────────────────
// @desc    Change password
// @route   PATCH /api/auth/change-password
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Both current and new password are required.");
  }
  if (newPassword.length < 6) throw new ApiError(400, "New password must be at least 6 characters.");

  const user = await User.findById(req.user._id).select("+password");
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(401, "Current password is incorrect.");

  user.password = newPassword;
  await user.save();

  res.json(new ApiResponse(200, null, "Password changed successfully"));
});
