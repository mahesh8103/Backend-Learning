import { ApiError } from "../utils/ApiError.js";

/**
 * Restrict access to specific roles.
 * Usage: router.get("/admin-only", protect, restrictTo("admin"), handler)
 * Usage: router.get("/staff-admin", protect, restrictTo("admin", "staff"), handler)
 */
export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(
      new ApiError(403, `Access denied. This action requires role: ${roles.join(" or ")}`)
    );
  }
  next();
};
