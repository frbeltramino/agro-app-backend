import { pool } from "../db/connection.js";

// ==========================
// Obtener tipos de gasto
// ==========================
export const getExpenseTypes = async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT id, name, user_id, created_at
      FROM expense_types
      WHERE user_id IS NULL OR user_id = ?
      ORDER BY name ASC
      `,
      [userId]
    );

    res.json({ expenseTypes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener tipos de gasto" });
  }
};

// ==========================
// Crear tipo de gasto
// ==========================
export const createExpenseType = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "El nombre del tipo de gasto es obligatorio" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO expense_types (name, user_id)
      VALUES (?, ?)
      `,
      [name.trim(), userId]
    );

    const [rows] = await pool.query(
      `
      SELECT id, name, user_id, created_at
      FROM expense_types
      WHERE id = ?
      `,
      [result.insertId]
    );

    res.status(201).json({ expenseType: rows[0] });
  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        message: "Ya existe un tipo de gasto con ese nombre"
      });
    }

    res.status(500).json({ message: "Error al crear tipo de gasto" });
  }
};


// ==========================
// Borrar tipo de gasto propio
// ==========================
export const deleteExpenseType = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [result] = await pool.query(
      `
      DELETE FROM expense_types
      WHERE id = ?
        AND user_id = ?
      `,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Tipo de gasto no encontrado o no autorizado"
      });
    }

    res.json({ message: "Tipo de gasto eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar tipo de gasto" });
  }
};



