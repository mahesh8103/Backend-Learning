import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  phone: String,

  role: {
    type: String,
    enum: ["student", "admin", "staff"],
    default: "student"
  },

  roomNumber: String,
  hostelBlock: String,

  resetPasswordToken: String,
  resetPasswordExpire: Date

}, {
  timestamps: true
});
const User = mongoose.model("User", userSchema);
export default mongoose.model("User", userSchema);