import { pool } from "../db/connection.js";

// ==========================
// Obtener todos los lotes maestros
// ==========================
export const getLotMasters = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const [rows] = await pool.query(
      `SELECT * 
       FROM lot_master 
       WHERE userId = ? 
       ORDER BY name ASC`,
      [userId]
    );

    res.json({ lotMasters: rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener lotes maestros" });
  }
};

// ==========================
// Crear un lote maestro
// ==========================
export const createLotMaster = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name, default_surface } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!name || name.trim() === "") {
      return res.status(400).json({
        message: "El nombre del lote es obligatorio"
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO lot_master (userId, name, default_surface)
      VALUES (?, ?, ?)
      `,
      [userId, name.trim(), default_surface || null]
    );

    const [rows] = await pool.query(
      `SELECT * FROM lot_master WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ lotMaster: rows[0] });

  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Ya existe un lote maestro con ese nombre"
      });
    }

    res.status(500).json({
      message: "Error al crear lote maestro"
    });
  }
};

// ==========================
// Borrar un lote maestro
// ==========================
export const deleteLotMaster = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const [result] = await pool.query(
      `DELETE FROM lot_master 
       WHERE id = ? AND userId = ?`,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lote maestro no encontrado o no pertenece al usuario" });
    }

    res.json({ message: "Lote maestro eliminado correctamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar lote maestro" });
  }
};
