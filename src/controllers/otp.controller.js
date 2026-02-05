import { pool } from "../db/connection.js";

// Crear OTP
export const createOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email y OTP son obligatorios",
      });
    }

    // Verificar si ya existe un OTP para ese email
    const [existing] = await pool.query(
      `SELECT id FROM otps WHERE email = ? LIMIT 1`,
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Ya existe un OTP pendiente para este email",
      });
    }

    await pool.query(
      `INSERT INTO otps (email, otp) VALUES (?, ?)`,
      [email, otp]
    );

    res.json({
      message: "OTP creado correctamente",
    });

  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Ya existe un OTP para este email",
      });
    }

    res.status(500).json({
      message: "Error al crear OTP",
    });
  }
};

// Eliminar OTP por email
export const deleteOTPByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        message: "Email es obligatorio",
      });
    }

    const [result] = await pool.query(
      `DELETE FROM otps WHERE email = ?`,
      [email]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "No se encontró OTP para ese email",
      });
    }

    res.json({
      message: "OTP eliminado correctamente",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al eliminar OTP",
    });
  }
};

// Obtener OTP por email
export const getOTPByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        message: "Email es obligatorio",
      });
    }

    const [rows] = await pool.query(
      `SELECT * FROM otps WHERE email = ? LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "OTP no encontrado",
      });
    }

    res.json({
      otp: rows[0],
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al obtener OTP",
    });
  }
};

// Verificar OTP
export const verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: "Email y OTP son obligatorios",
      });
    }

    // Buscar OTP en la base de datos
    const [rows] = await pool.query(
      `SELECT * FROM otps WHERE email = ? AND otp = ? LIMIT 1`,
      [email, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message: "OTP inválido o no encontrado",
      });
    }

    // OTP válido → eliminarlo para que no se pueda reutilizar
    await pool.query(
      `DELETE FROM otps WHERE email = ? AND otp = ?`,
      [email, otp]
    );

    res.json({
      message: "OTP verificado correctamente",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al verificar OTP",
    });
  }
};
