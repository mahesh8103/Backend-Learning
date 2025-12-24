import { Router } from "express";
import { registerUser ,loginUser ,logoutUser,refreshAccessToken, getCurrentUser, changeCurrentPassword, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getUserChannelProfile} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router=Router();


router.route("/register").post(
    upload.fields([
        {
            name: 'avatar',
            maxCount:1
        },
        {
            name: 'coverImage',
            maxCount:1
        }
    ])
    ,registerUser)

router.route("/login").post(loginUser)
router.route("/logout").post(verifyJWT,logoutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/changePassword").post(verifyJWT,changeCurrentPassword)
router.route("/currentUser").post(verifyJWT,getCurrentUser)
router.route("/updateAccountDetails").post(verifyJWT,updateAccountDetails)
router.route("/updateUserAvatar").post(verifyJWT,
    upload.fields([
        {name:'avatar',
            maxCount:1
        }
    ])  ,updateUserAvatar)
router.route("/updateUserCoverImage").post(verifyJWT, upload.fields([
        {name:'coverImage',
            maxCount:1
        }
    ]) ,updateUserCoverImage)

router.route("/c/:username").get(verifyJWT, getUserChannelProfile)  
router.route("/history").get(verifyJWT, getWatchHistory)
 



export default router