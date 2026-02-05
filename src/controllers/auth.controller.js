import { pool } from "../db/connection.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.SECRET_JWT_SEED;


export const registerUser = async (req, res) => {
  try {
    const { email, name, password, roles, status } = req.body;

    if (!email || !name || !password || !roles || status === undefined) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    if (!Array.isArray(roles)) {
      return res.status(400).json({ message: "roles debe ser un array" });
    }

    const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: "El usuario ya existe" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      "INSERT INTO users (email, name, password, roles, status) VALUES (?, ?, ?, ?, ?)",
      [email, name, hashedPassword, JSON.stringify(roles), status ? 'active' : 'inactive']
    );

    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [result.insertId]);
    const user = rows[0];

    const parsedRoles = user.roles;

    // 🔑 Generar token JWT inmediatamente
    const token = jwt.sign(
      { id: user.id, email: user.email, roles: parsedRoles },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    // Respuesta con token y usuario
    res.status(201).json({
      message: "Usuario creado correctamente",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: parsedRoles,
        status: user.status,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al registrar usuario" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario por email
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = rows[0];

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    // Ya no necesitamos parsear roles, MySQL devuelve un array
    const parsedRoles = user.roles;

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, roles: parsedRoles },
      JWT_SECRET,
      { expiresIn: "2h" }
    );

    // Respuesta
    res.json({
      message: "Login exitoso",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: parsedRoles,
        status: user.status,
      },
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al iniciar sesión" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    // Obtener datos del usuario
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = rows[0];

    // Validar contraseña actual
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ message: "La contraseña actual no es correcta" });
    }

    // Crear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedPassword,
      userId,
    ]);

    res.json({ message: "Contraseña actualizada correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar contraseña" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { userId, name, email } = req.body;

    if (!userId || !name || !email) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    // Verificar si el email ya está en uso por otro usuario
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      [email, userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "El email ya está en uso por otro usuario" });
    }

    // Actualizar usuario
    await pool.query(
      "UPDATE users SET name = ?, email = ? WHERE id = ?",
      [name, email, userId]
    );

    // Obtener datos actualizados
    const [rows] = await pool.query("SELECT id, name, email FROM users WHERE id = ?", [userId]);
    const user = rows[0];

    res.json({
      message: "Perfil actualizado correctamente",
      user
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar perfil" });
  }
};