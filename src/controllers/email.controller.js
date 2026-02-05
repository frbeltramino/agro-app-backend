import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { getOTPEmailTemplate } from "../emailTemplates/template.OTP.js";
import { pool } from "../db/connection.js";
dotenv.config();


const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 10_000,
});

export const sendOTPEmail = async (to, otp) => {
  const { subject, html } = getOTPEmailTemplate(otp);

  await transporter.sendMail({
    from: `"AgroHuracán" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

export const sendOTPController = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      message: "Email requerido",
    });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // 1️⃣ Verificar si ya existe OTP para ese email
    const [existing] = await pool.query(
      `SELECT id FROM otps WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Ya existe un OTP pendiente para este email",
      });
    }

    // 2️⃣ Crear OTP
    await pool.query(
      `INSERT INTO otps (email, otp) VALUES (?, ?)`,
      [email, otp]
    );

    // 3️⃣ Enviar email
    await sendOTPEmail(email, otp);

    return res.json({
      message: "OTP enviado correctamente",
    });

  } catch (error) {
    console.error(error);

    // 4️⃣ Rollback: borrar OTP si algo falló
    await pool.query(
      `DELETE FROM otps WHERE email = ?`,
      [email]
    );

    return res.status(500).json({
      message: "Error enviando OTP",
    });
  }
};