import express from "express";
import {
  getMyNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// All notification routes require authentication
router.use(protect);

router.get("/",                    getMyNotifications);
router.get("/unread-count",        getUnreadCount);
router.patch("/mark-all-read",     markAllAsRead);
router.patch("/:id/read",          markAsRead);
router.delete("/:id",              deleteNotification);

export default router;
