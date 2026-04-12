import express from "express";
import {
  getMyAssignedComplaints,
  updateAssignedComplaint,
  getStaffDashboard,
  toggleAvailability,
  getMyFeedbacks,
} from "../controllers/staffController.js";
import { protect } from "../middleware/authMiddleware.js";
import { restrictTo } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All staff routes require auth + staff role
router.use(protect, restrictTo("staff"));

router.get("/dashboard",          getStaffDashboard);
router.get("/my-complaints",      getMyAssignedComplaints);
router.get("/feedbacks",          getMyFeedbacks);
router.patch("/availability",     toggleAvailability);
router.patch("/complaints/:id/update", updateAssignedComplaint);

export default router;
