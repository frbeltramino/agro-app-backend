import { pool } from "../db/connection.js";

export const createProvider = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;


    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!name) {
      return res.status(400).json({ message: "El nombre del proveedor es requerido" });
    }

    // Insertar contratista
    const [result] = await pool.query(
      "INSERT INTO providers (userId, name) VALUES (?, ?)",
      [userId, name]
    );

    const [provider] = await pool.query(
      "SELECT * FROM providers WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: "proveedor creado exitosamente",
      provider: provider[0],
    });

  } catch (err) {
    console.error("Error creando proveedor:", err);
    res.status(500).json({ message: "Error al crear proveedor" });
  }
};

export const getProviders = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const [providers] = await pool.query(
      "SELECT * FROM providers WHERE userId = ? ORDER BY name ASC",
      [userId]
    );

    res.json({ providers });

  } catch (err) {
    console.error("Error obteniendo proveedores:", err);
    res.status(500).json({ message: "Error al obtener proveedores" });
  }
};

export const deleteProvider = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!id) {
      return res.status(400).json({ message: "ID del contratista es requerido" });
    }

    const [existing] = await pool.query(
      "SELECT * FROM providers WHERE id = ? AND userId = ?",
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Proveedor no encontrado o no pertenece al usuario" });
    }

    await pool.query("DELETE FROM providers WHERE id = ? AND userId = ?", [id, userId]);

    res.json({ success: true, message: "proveedor eliminado correctamente" });

  } catch (err) {
    console.error("Error eliminando proveedor:", err);
    res.status(500).json({ message: "Error al eliminar proveedor" });
  }
};
