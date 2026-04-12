import express from "express";
import {
  register,
  login,
  getMe,
  updateProfile,
  uploadPhoto,
  changePassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { restrictTo } from "../middleware/roleMiddleware.js";

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────
router.post("/register", register);
router.post("/login",    login);

// ── Protected (any logged-in user) ───────────────────────────────
router.get   ("/me",              protect, getMe);
router.patch ("/update-profile",  protect, updateProfile);
router.patch ("/upload-photo",    protect, uploadPhoto);
router.patch ("/change-password", protect, changePassword);

// ── Admin creates staff / admin accounts ─────────────────────────
router.post("/create-staff", protect, restrictTo("admin"), register);

export default router;
