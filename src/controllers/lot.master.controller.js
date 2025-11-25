import { pool } from "../db/connection.js";

// ==========================
// Obtener todos los lotes maestros
// ==========================
export const getLotMasters = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM lot_master ORDER BY name ASC`
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
    const { name, default_surface } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "El nombre del lote es obligatorio" });
    }

    const [result] = await pool.query(
      `INSERT INTO lot_master (name, default_surface) VALUES (?, ?)`,
      [name, default_surface || null]
    );

    const [rows] = await pool.query(
      `SELECT * FROM lot_master WHERE id = ?`,
      [result.insertId]
    );

    res.status(201).json({ lotMaster: rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Ya existe un lote maestro con ese nombre" });
    }
    res.status(500).json({ message: "Error al crear lote maestro" });
  }
};

// ==========================
// Borrar un lote maestro
// ==========================
export const deleteLotMaster = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `DELETE FROM lot_master WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Lote maestro no encontrado" });
    }

    res.json({ message: "Lote maestro eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar lote maestro" });
  }
};
