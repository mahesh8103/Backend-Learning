import bcrypt from "bcryptjs";
import User from "../models/User.js";


// sign up


export const signup = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    //  1. Check all fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    //  2. Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

   // Hash Password 
   const hashedPassword = await bcrypt.hash(password, 10);

    //  4. Create user
    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    //  5. Send response (DON'T send password)
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// login 

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Check user exists
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    // 2. Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // 3. Send success response
    res.json({
      message: "Login successful"
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};