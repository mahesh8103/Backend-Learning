import express from "express";
import {
  raiseComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  deleteComplaint,
  submitFeedback,
} from "../controllers/complaintController.js";
import { protect } from "../middleware/authMiddleware.js";
import { restrictTo } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All complaint routes require authentication
router.use(protect);

router.route("/")
  .get(getComplaints)                                      // all roles (filtered by role internally)
  .post(restrictTo("student"), raiseComplaint);            // students raise complaints

router.route("/:id")
  .get(getComplaintById)                                   // all roles
  .delete(deleteComplaint);                                // student (own open) or admin

router.patch("/:id/status",
  restrictTo("admin", "staff"),
  updateComplaintStatus
);

router.post("/:id/feedback",
  restrictTo("student"),
  submitFeedback
);

export default router;
