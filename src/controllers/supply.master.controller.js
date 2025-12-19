import { pool } from "../db/connection.js";

export const getMasterSupplies = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        ms.id,
        ms.name,
        ms.unit,
        ms.category_id,
        sc.name AS category_name
      FROM master_supplies ms
      INNER JOIN supply_category sc ON ms.category_id = sc.id
      ORDER BY ms.name
    `);

    res.json({ master_supplies: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener suministros maestros" });
  }
};

export const createMasterSupply = async (req, res) => {
  const { name, category_id, unit } = req.body;

  if (!name || !category_id || !unit) {
    return res.status(400).json({
      message: "Nombre, categoría y unidad son obligatorios",
    });
  }

  try {
    // Evitar duplicados por nombre
    const [existing] = await pool.query(
      "SELECT id FROM master_supplies WHERE name = ?",
      [name.trim()]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Ya existe un suministro con ese nombre",
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO master_supplies (name, category_id, unit)
      VALUES (?, ?, ?)
      `,
      [name.trim(), category_id, unit]
    );

    res.status(201).json({
      message: "Suministro maestro creado correctamente",
      master_supply: {
        id: result.insertId,
        name: name.trim(),
        category_id,
        unit,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al crear el suministro maestro",
    });
  }
};


export const deleteMasterSupply = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM master_supplies WHERE id = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Suministro maestro no encontrado",
      });
    }

    res.json({
      message: "Suministro maestro eliminado correctamente",
    });
  } catch (err) {
    console.error(err);

    // Error de FK (está en uso)
    if (err.code === "ER_ROW_IS_REFERENCED_2") {
      return res.status(409).json({
        message:
          "No se puede eliminar el suministro porque está siendo utilizado",
      });
    }

    res.status(500).json({
      message: "Error al eliminar el suministro maestro",
    });
  }
};
