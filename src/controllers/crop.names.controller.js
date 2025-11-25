import { pool } from "../db/connection.js";

// Obtener todos los crop_name
export const getCropNames = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT * FROM crop_name ORDER BY name ASC`);
    res.json({ cropNames: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener crop_names" });
  }
};

// Crear un nuevo crop_name
export const createCropName = async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) return res.status(400).json({ message: "El nombre es obligatorio" });

    const [result] = await pool.query(
      `INSERT INTO crop_name (name) VALUES (?)`,
      [name]
    );

    res.json({
      message: "Cultivo creado correctamente",
      cropName: { id: result.insertId, name }
    });

  } catch (err) {
    console.error(err);

    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Ese cultivo ya existe" });
    }

    res.status(500).json({ message: "Error al crear crop_name" });
  }
};

// Editar un crop_name
export const updateCropName = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const [result] = await pool.query(
      `UPDATE crop_name SET name = ? WHERE id = ?`,
      [name, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cultivo no encontrado" });
    }

    res.json({ message: "Cultivo actualizado correctamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al actualizar crop_name" });
  }
};

// Eliminar un crop_name
export const deleteCropName = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `DELETE FROM crop_name WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cultivo no encontrado" });
    }

    res.json({ message: "Cultivo eliminado correctamente" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar crop_name" });
  }
};
