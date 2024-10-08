const User = require("../models/User");
const bcrypt = require("bcrypt");
const OTP = require("../models/OTP");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const otpGenerator = require("otp-generator");

exports.signup = async (req, res) => {
  try {
    const { username, phone, email, password, confirmpassword, otp, role } =
      req.body;

    if (
      !username ||
      !phone ||
      !email ||
      !password ||
      !confirmpassword ||
      !otp
    ) {
      return res.status(403).json({
        success: false,
        message: "All Fields are required",
      });
    }

    if (password != confirmpassword) {
      return res.status(400).json({
        success: false,
        message:
          "Password and Confirm Password do not match. Please try again.",
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists. Please sign in to continue.",
      });
    }

    const response = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1);
    console.log(response);
    if (response.length === 0) {
      // OTP not found for the email
      return res.status(400).json({
        success: false,
        message: "The OTP is not valid",
      });
    } else if (otp !== response[0].otp) {
      // Invalid OTP
      return res.status(400).json({
        success: false,
        message: "The OTP is not valid",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      username: username,
      phone: phone,
      email: email,
      password: hashedPassword,
      image: `https://api.dicebear.com/5.x/initials/svg?seed=${username}`,
      role: role,
    });

    return res.status(200).json({
      success: true,
      user,
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("SignUp error --> ", error);
    return res.status(500).json({
      success: false,
      message: "User cannot be registered. Please try again.",
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(403).json({
        success: false,
        message: `Please Fill up All the Required Fields`,
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: `User is not Registered with Us Please SignUp to Continue`,
      });
    }

    if (await bcrypt.compare(password, user.password)) {
      const token = jwt.sign(
        { email: user.email, id: user._id, role: user.role },
        process.env.JWT_SECRET,
        {
          expiresIn: "72h",
        }
      );

      // Save token to user document in database
      user.token = token;
      user.password = undefined;
      // Set cookie for token and return success response
      const options = {
        expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        httpOnly: true,
      };
      res.cookie("token", token, options).status(200).json({
        success: true,
        token,
        user,
        message: `User Login Success`,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: `Password is incorrect`,
      });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: `Login Failure Please Try Again`,
    });
  }
};

// controller for logout

exports.logout = (req, res) => {
  try {
    res.clearCookie("token", {
      expires: new Date(0),
      httpOnly: true,
    });

    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Logout error --> ", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed. Please try again.",
    });
  }
};

exports.sendotp = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if user is already registered
    const checkUserPresent = await User.findOne({ email });

    if (checkUserPresent) {
      return res.status(401).json({
        success: false,
        message: "User is already registered",
      });
    }

    // Generate a unique OTP
    let otp = otpGenerator.generate(4, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });

    // Ensure the OTP is unique by checking against the DB
    let result = await OTP.findOne({ otp });
    while (result) {
      otp = otpGenerator.generate(4, {
        upperCaseAlphabets: false,
        lowerCaseAlphabets: false,
        specialChars: false,
      });
      result = await OTP.findOne({ otp });
    }

    // Create and save OTP with email
    const otpPayload = { email, otp, context: "signUp" };
    const otpBody = await OTP.create(otpPayload);

    console.log("OTP Body", otpBody);

    // You don't need to manually send the email here, the pre-save middleware handles it

    res.status(200).json({
      success: true,
      message: "OTP Sent Successfully",
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

