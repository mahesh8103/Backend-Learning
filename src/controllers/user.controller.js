import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError}  from "../utils/ApiError.js";
import {User} from "../models/user.model.js";
import {uploadOnCloudinary}  from "../utils/cloudinary.js";
import {ApiResponse} from "../utils/ApiResponse.js";
import jwt  from "jsonwebtoken";

const generateAccessTokenAndRefreshToken = async(userId)=>{
      try {
            const user = await User.findById(userId)
            const accessToken = await user.generateAccessToken()
            const refreshToken = await user.generateRefreshToken()

            user.refreshToken = refreshToken
            await user.save( {validateBeforeSave: false } )
            return {accessToken ,refreshToken}
            
      } catch (error) {
            throw new ApiError(500,"something went wrong while generating access and refresh token")
      }
}

const registerUser = asyncHandler(async (req,res)=>{

   const {fullName,email,username,password} = req.body
//    console.log("fullName: ",fullName,"email: ",email)

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
// const coverImageLocalPath = req.files?.coverImage[0]?.path;
let coverImageLocalPath;

if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
      coverImageLocalPath=req.files.coverImage[0].path;
}


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

const loginUser = asyncHandler(async(req,res)=>{
        const {username,email,password} = req.body
        if (!username && !email) {
            throw new ApiError(400,"username or email is required")
        }
        if (!password) {
            throw new ApiError(400,"pz enter password")
        }
        const userExist = await User.findOne({
            $or:[{ username },{ email }]
        })
        if (!userExist) {
            throw new ApiError(400,"user not exist plz sigun up first")
        }
         const isPasswordValid = await userExist.isPasswordCorrect(password)
         if (!isPasswordValid) {
            throw new ApiError(401,"Invalid user credential")
         }
         const {accessToken ,refreshToken} = await generateAccessTokenAndRefreshToken(userExist._id)
         
         const loggedInUser = await User.findById(userExist._id).select("-password -refreshToken")
         const options = {
            httpOnly:true,
            secure:true
         } 
         return res.status(200)
         .cookie("accessToken",accessToken,options)
         .cookie("refreshToken",refreshToken,options)
         .json(new ApiResponse(200,{user:loggedInUser,accessToken,refreshToken},"usser logged in successfully"))

})

const logoutUser = asyncHandler(async(req,res)=>{

      await User.findByIdAndUpdate(
            req.user._id,
            {
                  $unset:{refreshToken:1}
                 
            }, {new:true}
            
      )
      const options = {
            httpOnly:true,
            secure:true
      }
      return res.status(200)
      .clearCookie("accessToken",options)
      .clearCookie("refreshToken",options)
      .json(
            new ApiResponse(200,{},"user logout successfully")
      )
})

const refreshAccessToken = asyncHandler(async(req,res)=>{
      const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken
      if (!incomingRefreshToken) {
            throw new ApiError(401,"unauthorized request")
      }
    try {
        const decodedtoken =  jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
  
        const user = await User.findById(decodedtoken._id)
        if (!user) {
              throw new ApiError(401,"invalid refresh token")
        }
        if(incomingRefreshToken!==user?.refreshToken){
              throw new ApiError(401,"refresh token is expired or used")
        }
        const{accessToken ,refreshToken} = await generateAccessTokenAndRefreshToken(user._id)
        const options = {
              httpOnly:true,
              secure:true
        }
  
        return res.status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
              new ApiResponse(201,{accessToken,refreshToken},"accessToken refreshed")
        )
    } catch (error) {
      throw new ApiError(403,error?.message || "invalid request")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
      const {oldPassword ,newPassword} = req.body
      const user =  await User.findById(req.user._id)
      const validPassword = await user.isPasswordCorrect(oldPassword)
      if (!validPassword) {
            throw new ApiError(400,"plz enter correct password")
      }
      user.password = newPassword
      await user.save({validateBeforeSave:false})
      return res
      .status(200)
      .json(
            new ApiResponse(201,{},"password change successfully")
      )
      


})

const getCurrentUser = asyncHandler(async(req,res)=>{
       return res
       .status(200)
       .json(
            201,req.user,"current user fetch successfully"
       )
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
      const {fullName ,email} = req.body
      const user = await User.findByIdAndUpdate(
            req.user._id,
            {
                 $set: {
                          fullName,
                          email
                  }
            },
            {new:true}
      ).select("-password")

      return res
      .status(200)
      .json(new ApiResponse(201,user,"user details updated successfully"))
})


const updateUserAvatar = asyncHandler(async(req,res)=>{
     const avatarLocalPath = req.files?.avatar?.[0]?.path;

      if (!avatarLocalPath) {
            throw new ApiError(400,"plz upload avatar file")
      }

      const avatar = await uploadOnCloudinary(avatarLocalPath)
      if (!avatar.url) {
            throw new ApiError(400,"errpr while uploading avatar on cloudinary")
      }
      const user = await User.findByIdAndUpdate(
            req.user?._id,
            { 
                  $set:{
                        avatar:avatar.url
                  }
            },
            {new:true}
      ).select("-password")

      return res
      .status(200)
      .json(200,user,"avatar changed successfully")
})


const updateUserCoverImage = asyncHandler(async(req,res)=>{
     const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

      if (!coverImageLocalPath) {
            throw new ApiError(400,"plz upload coverImage file")
      }

      const coverImage = await uploadOnCloudinary(coverImageLocalPath)
      if (!coverImage.url) {
            throw new ApiError(400,"errpr while uploading coverImage on cloudinary")
      }
      const user = await User.findByIdAndUpdate(
            req.user?._id,
            { 
                  $set:{
                        coveraImage:coverImage.url
                  }
            },
            {new:true}
      ).select("-password")

      return res
      .status(200)
      .json(200,user,"coverImage changed successfully")
})



const getUserChannelProfile = asyncHandler(async(req,res)=>{
        
      const {username} = req.params
      if (!username?.trim()) {
            throw new ApiError(400,"username is missing")
      }
      const channel = await User.aggregate([
            {
                  $match:{
                        username:username?.toLowerCase()
                  }
            },
            {
                  $lookup:{
                        from:"subscriptions",
                        localField:"_id",
                        foreignField:"channel",
                        as:"subscribers"
                  }
            },
            {
                  $lookup:{
                        from:"subscriptions",
                        localField:"_id",
                        foreignField:"subscriber",
                        as:"subscribedTo"
                  }
            },
            {
                  $addFields:{
                        subscriberCount:{
                              $size:"$subscribers"
                        },
                         subscribedToCount:{
                              $size:"$subscribedTo"
                        },
                        isSubscribed:{
                              $cond:{
                                    if:{$in:[req.user?._id || null, "$subscribers.subscriber"]},
                                    then:true,
                                    else:false
                              }
                        }
                        
                  }
            },
            {
                  $project:{
                         fullName: 1,
                         username: 1,
                         subscribersCount: 1,
                         subscribedToCount: 1,
                         isSubscribed: 1,
                         avatar: 1,
                         coverImage: 1,
                         email: 1
                  }
            }
      ])

     if (!channel.length) {
             throw new ApiError(400,"channel doesnot exist")
     }
     return res
     .status(200)
     .json(
        new ApiResponse(200,channel[0],"chanel fetched successfully")
     )

})  


const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})

export {registerUser,
      loginUser,
      logoutUser,
      refreshAccessToken,
      changeCurrentPassword,
      getCurrentUser,
      updateAccountDetails,
      updateUserAvatar,
      updateUserCoverImage,
      getUserChannelProfile,
      getWatchHistory}