import { pool } from "../db/connection.js";

// ===============================================
// Obtener todas las categorías de insumos
// ===============================================
export const getSupplyCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM supply_category ORDER BY name ASC"
    );

    res.json({ categories: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener categorías" });
  }
};

// ===============================================
// Obtener categoría por ID
// ===============================================
export const getSupplyCategoryById = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM supply_category WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json({ category: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener categoría" });
  }
};

// ===============================================
// Crear nueva categoría de insumo
// ===============================================
export const createSupplyCategory = async (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "El nombre es requerido" });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO supply_category (name) VALUES (?)",
      [name]
    );

    res.status(201).json({
      id: result.insertId,
      name,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear categoría" });
  }
};

// ===============================================
// Actualizar categoría
// ===============================================
export const updateSupplyCategory = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ message: "El nombre es requerido" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE supply_category SET name = ? WHERE id = ?",
      [name, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.json({ id, name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar categoría" });
  }
};

// ===============================================
// Eliminar categoría
// ===============================================
export const deleteSupplyCategory = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM supply_category WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Categoría no encontrada" });
    }

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar categoría" });
  }
};