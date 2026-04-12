import express from "express";
import {
  getDashboard,
  getAllUsers,
  getUserById,
  assignComplaint,
  updatePriority,
  toggleUserStatus,
  broadcastAnnouncement,
  getEscalatedComplaints,
} from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { restrictTo } from "../middleware/roleMiddleware.js";

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, restrictTo("admin"));

router.get("/dashboard",  getDashboard);
router.get("/escalated",  getEscalatedComplaints);
router.post("/announce",  broadcastAnnouncement);

router.route("/users")
  .get(getAllUsers);

router.route("/users/:id")
  .get(getUserById);

router.patch("/users/:id/toggle-status", toggleUserStatus);

router.patch("/complaints/:id/assign",   assignComplaint);
router.patch("/complaints/:id/priority", updatePriority);

export default router;
