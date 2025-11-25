import { pool } from "../db/connection.js";

export const getLots = async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT l.*, (SELECT COUNT(*) FROM crops WHERE lot_id = l.id) AS crops_count FROM lots l ORDER BY l.name`);
    res.json({ lots: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener lotes" });
  }
};

export const getLotsByCampaign = async (req, res) => {
  try {
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({ message: "Falta el ID de la campaña" });
    }

    const [rows] = await pool.query(
      `SELECT 
         l.*, 
         (SELECT COUNT(*) FROM crops WHERE lot_id = l.id) AS crops_count 
       FROM lots l
       WHERE l.campaign_id = ? AND status = 'active'
       ORDER BY l.name`,
      [campaignId]
    );

    res.json({ lots: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener lotes" });
  }
};

export const createOrUpdateLot = async (req, res) => {
  try {
    const { id } = req.params; // Puede ser "new" o un id numérico
    const { name, hectares, location, campaign_id, status } = req.body;
    // Validaciones mínimas
    if (!name || !hectares || !campaign_id) {
      return res.status(400).json({
        message: "name, hectares y campaign_id son obligatorios"
      });
    }

    let lotId;

    if (!id || id === "new") {
      // CREAR LOTE
      const [result] = await pool.query(
        `INSERT INTO lots (name, hectares, location, campaign_id, status)
         VALUES (?, ?, ?, ?, ?)`,
        [
          name,
          hectares,
          location || null,
          campaign_id,
          status || "active"
        ]
      );

      lotId = result.insertId;

    } else {
      // UPDATE LOTE EXISTENTE
      await pool.query(
        `UPDATE lots
         SET name = ?, hectares = ?, location = ?, campaign_id = ?, status = ?
         WHERE id = ?`,
        [
          name,
          hectares,
          location || null,
          campaign_id,
          status || "active",
          id
        ]
      );

      lotId = id;
    }

    // --> devolver lote actualizado / creado
    const [rows] = await pool.query(
      `SELECT * FROM lots WHERE id = ?`,
      [lotId]
    );

    return res.status(id === "new" ? 201 : 200).json({ lot: rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al crear o actualizar lote"
    });
  }
};



export const getLotById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT l.*, (SELECT COUNT(*) FROM crops WHERE lot_id = l.id) AS crops_count FROM lots l WHERE l.id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ message: "Lote no encontrado" });
    res.json({ lot: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener lote" });
  }
};

export const deleteLot = async (req, res) => {
  try {
    const { id } = req.params;
    const [exist] = await pool.query(
      `SELECT id FROM lots WHERE id = ?`,
      [id]
    );
    if (exist.length === 0) {
      return res.status(404).json({ message: "El lote no existe" });
    }
    await pool.query(
      `UPDATE lots SET status = 'inactive' WHERE id = ?`,
      [id]
    );
    res.json({ message: "Lote eliminado correctamente (delete lógico)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar lote" });
  }
};
