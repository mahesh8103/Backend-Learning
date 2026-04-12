import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage engine for complaint images
const complaintStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         "smart-hostel/complaints",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 900, crop: "limit", quality: "auto" }],
  },
});

// Storage engine for profile photos
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         "smart-hostel/profiles",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto" }],
  },
});

export const uploadComplaintImages = multer({
  storage: complaintStorage,
  limits:  { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
}).array("images", 5); // max 5 images

export const uploadProfilePhoto = multer({
  storage: profileStorage,
  limits:  { fileSize: 2 * 1024 * 1024 }, // 2 MB
}).single("photo");

export { cloudinary };
