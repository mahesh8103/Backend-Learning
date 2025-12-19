import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError}  from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary}  from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req,res)=>{

   const {fullName,email,username,password} = req.body
   console.log("fullName: ",fullName,"email: ",email)

   if([fullName,email,username,password].some((fields)=>fields?.trim()==="")){
      throw new ApiError(400,"all fields are required")
   }

   const existedUser = await User.findOne({
      $or: [{ username },{ email }]
})
if (existedUser) {
      throw new ApiError(409,"user with username or email already existed")
}

const avatarLocalPath = req.files?.avatar[0]?.path;
const coverImageLocalPath = req.files?.coverImage[0]?.path;
if (!avatarLocalPath) {
      throw new ApiError(400,"avatar file is required")
}

const avatar = await uploadOnCloudinary(avatarLocalPath)
const coverImage = await uploadOnCloudinary(coverImageLocalPath)
if (!avatar) {
      throw new ApiError(400,"avatar file is required")
}

const user = await User.create({
      fullName,
      avatar:avatar.url,
      coverImage:coverImage?.url || "",
      username:username.toLowerCase(),
      email,
      password
})

const createdUser = await User.findById(user._id).select( "-password -refreshToken" )
if (!createdUser) {
      throw new ApiError(500,"something went wrong while ragistering user")
}

return res.status(201).json(
      new ApiResponse(201,createdUser,"user ragistered successfully")
)

});



export {registerUser}