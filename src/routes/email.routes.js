import express from "express";
import { sendOTPController } from "../controllers/email.controller.js";

const router = express.Router();

// Endpoint para enviar OTP desde el front
router.post("/send-otp", sendOTPController);

export default router;