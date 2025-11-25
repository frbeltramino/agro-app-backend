import jwt from "jsonwebtoken";
const JWT_SECRET = process.env.SECRET_JWT_SEED;
import { pool } from "../db/connection.js";

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      roles: user.roles,
    },
    JWT_SECRET,
    { expiresIn: "2h" } //2 horas por cada refresh
  );
};

export const validateJWT = async (req, res, next) => {
  const bearer = req.header("Authorization");

  if (!bearer) {
    return res.status(401).json({ message: "Token no proporcionado" });
  }

  const token = bearer.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Buscar usuario
    const [rows] = await pool.query(
      "SELECT id, name, email, roles, status FROM users WHERE id = ?",
      [decoded.id]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    const user = rows[0];

    if (user.status !== "active") {
      return res.status(403).json({ message: "Usuario inactivo" });
    }

    // Adjuntar usuario a req
    req.user = user;

    //Generar nuevo token automáticamente
    const newToken = generateToken(user);
    req.newToken = newToken;

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido" });
  }
};

export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.roles) return res.status(403).json({ message: "No autorizado" });
    const userRoles = Array.isArray(req.user.roles) ? req.user.roles : [req.user.roles];
    const hasRole = userRoles.some(role => allowedRoles.includes(role));
    if (!hasRole) return res.status(403).json({ message: "No tienes permisos para esta acción" });
    next();
  };
};