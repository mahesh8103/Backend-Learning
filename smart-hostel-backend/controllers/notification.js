import Notification from "../models/Notification.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ─────────────────────────────────────────────────────────────────
// @desc    Get notifications for logged-in user
//          Includes personal + role-broadcast notifications
// @route   GET /api/notifications
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const filter = {
    $or: [
      { recipient: req.user._id },
      { recipientRole: req.user.role, recipient: null },
      { recipientRole: "all",         recipient: null },
    ],
  };
  if (unreadOnly === "true") filter.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, isRead: false }),
  ]);

  res.json(
    new ApiResponse(200, {
      notifications,
      unreadCount,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    }, "Notifications fetched successfully")
  );
});

// ─────────────────────────────────────────────────────────────────
// @desc    Mark a single notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new ApiError(404, "Notification not found.");

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  res.json(new ApiResponse(200, null, "Notification marked as read"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Mark ALL notifications as read for logged-in user
// @route   PATCH /api/notifications/mark-all-read
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    {
      $or: [
        { recipient: req.user._id },
        { recipientRole: req.user.role, recipient: null },
        { recipientRole: "all",         recipient: null },
      ],
      isRead: false,
    },
    { $set: { isRead: true, readAt: new Date() } }
  );

  res.json(new ApiResponse(200, null, "All notifications marked as read"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Delete a notification
// @route   DELETE /api/notifications/:id
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  if (!notification) throw new ApiError(404, "Notification not found.");

  await notification.deleteOne();
  res.json(new ApiResponse(200, null, "Notification deleted"));
});

// ─────────────────────────────────────────────────────────────────
// @desc    Get unread count only (lightweight ping for UI badge)
// @route   GET /api/notifications/unread-count
// @access  Private
// ─────────────────────────────────────────────────────────────────
export const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    $or: [
      { recipient: req.user._id },
      { recipientRole: req.user.role, recipient: null },
      { recipientRole: "all",         recipient: null },
    ],
    isRead: false,
  });

  res.json(new ApiResponse(200, { count }, "Unread count fetched"));
});
