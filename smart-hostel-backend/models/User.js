import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // ─── Basic Info ───────────────────────────────────────────────
    name: {
      type:     String,
      required: [true, "Name is required"],
      trim:     true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name cannot exceed 60 characters"],
    },
    email: {
      type:      String,
      required:  [true, "Email is required"],
      unique:    true,
      lowercase: true,
      trim:      true,
      match:     [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type:      String,
      required:  [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select:    false,
    },
    phone: {
      type:  String,
      match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
    },
    photo: {
      url:      { type: String, default: "" },
      publicId: { type: String, default: "" },
    },

    // ─── Role ─────────────────────────────────────────────────────
    role: {
      type:    String,
      enum:    ["student", "staff", "admin"],
      default: "student",
    },

    // ─── Student-specific ─────────────────────────────────────────
    rollNumber: {
      type:     String,
      unique:   true,
      sparse:   true,
      trim:     true,
      uppercase: true,
    },
    roomNumber: {
      type:    String,
      default: null,
    },
    course:       { type: String, trim: true },
    year:         { type: Number, min: 1, max: 5 },
    hostelBlock:  { type: String, trim: true },
    admissionDate: { type: Date },

    // ─── Staff-specific ───────────────────────────────────────────
    department: {
      type: String,
      enum: ["electrical", "plumbing", "carpentry", "housekeeping", "security", "general", null],
      default: null,
    },
    employeeId:   { type: String, unique: true, sparse: true, trim: true },
    isAvailable:  { type: Boolean, default: true },

    // ─── Account Status ───────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

// ─── Virtual: Total complaints (for students) ─────────────────────
userSchema.virtual("complaintsCount", {
  ref:          "Complaint",
  localField:   "_id",
  foreignField: "student",
  count:        true,
});

// ─── Hash password before save ────────────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Method: Compare passwords ────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ─── Method: Return safe user object (no password) ────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const User = mongoose.model("User", userSchema);
export default User;
