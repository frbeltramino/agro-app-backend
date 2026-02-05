import express from "express";
import { deleteOTPByEmail, verifyOTP } from "../controllers/otp.controller.js";

const router = express.Router();

// Endpoint para enviar OTP desde el front
router.post("/delete-otp", deleteOTPByEmail);
router.post("/verify-otp", verifyOTP);


export default router;