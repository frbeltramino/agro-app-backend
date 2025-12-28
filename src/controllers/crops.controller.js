import { pool } from "../db/connection.js";

export const getCrops = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        cr.*,
        cn.name AS crop_name,
        c.name AS campaign_name,
        l.name AS lot_name,
        l.hectares
      FROM crops cr
      JOIN crop_name cn ON cn.id = cr.crop_name_id
      JOIN campaigns c ON c.id = cr.campaign_id
      JOIN lots l ON l.id = cr.lot_id
      WHERE cr.real_yield > 0    -- 🔹 solo cultivos con cosecha
      ORDER BY cr.start_date DESC
    `);

    res.json({ crops: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener cultivos" });
  }
};

export const getCropById = async (req, res) => {
  try {
    const id = req.params.id;
    const [[crop]] = await pool.query(`SELECT cr.*, c.name AS campaign_name, l.name AS lot_name FROM crops cr JOIN campaigns c ON c.id = cr.campaign_id JOIN lots l ON l.id = cr.lot_id WHERE cr.id = ?`, [id]);
    if (!crop) return res.status(404).json({ message: "Cultivo no encontrado" });

    const [tasks] = await pool.query(`SELECT * FROM tasks WHERE crop_id = ? ORDER BY performed_at DESC`, [id]);
    const [supplies] = await pool.query(`SELECT cs.*, s.name, s.type, s.unit FROM crop_supplies cs JOIN supplies s ON s.id = cs.supply_id WHERE cs.crop_id = ?`, [id]);

    res.json({ crop, tasks, supplies });
  } catch (err) {
    console.error(err); res.status(500).json({ message: "Error al obtener cultivo" });
  }
};

export const getCropsByLotId = async (req, res) => {
  try {
    const lotId = req.params.lotId;

    const [crops] = await pool.query(
      `SELECT 
          c.*,
          cn.name AS crop_name
       FROM crops c
       JOIN crop_name cn ON cn.id = c.crop_name_id
       WHERE c.lot_id = ?
        AND c.status = 'active'
       ORDER BY c.start_date DESC`,
      [lotId]
    );

    res.json({ crops });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener cultivos" });
  }
};

export const createOrUpdateCrop = async (req, res) => {
  try {
    const { id } = req.params; // Puede ser "new" o un id numérico

    const {
      crop_name_id,
      start_date,
      end_date,
      campaign_id,
      lot_id,
      seed_type,
      expected_yield,
      total_estimated,
      real_yield
    } = req.body;

    // ---------------------------------
    // 📌 CREAR NUEVO CULTIVO
    // ---------------------------------
    if (!id || id === "new") {
      const [result] = await pool.query(
        `
        INSERT INTO crops (
          crop_name_id, start_date, end_date, campaign_id, lot_id,
          seed_type, expected_yield, total_estimated, real_yield
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          crop_name_id,
          start_date,
          end_date || null,
          campaign_id,
          lot_id,
          seed_type || null,
          expected_yield || null,
          total_estimated || null,
          real_yield || null
        ]
      );

      return res.json({
        message: "Cultivo creado correctamente",
        cropId: result.insertId
      });
    }

    // ---------------------------------
    // 📌 EDITAR CULTIVO EXISTENTE
    // ---------------------------------
    const [result] = await pool.query(
      `
      UPDATE crops SET
        crop_name_id = ?,
        start_date = ?,
        end_date = ?,
        seed_type = ?,
        expected_yield = ?,
        total_estimated = ?,
        real_yield = ?,
        lot_id = ?
      WHERE id = ?
      `,
      [
        crop_name_id,
        start_date,
        end_date || null,
        seed_type || null,
        expected_yield || null,
        total_estimated || null,
        real_yield || null,
        lot_id,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cultivo no encontrado" });
    }

    return res.json({ message: "Cultivo actualizado correctamente" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error al guardar cultivo" });
  }
};

export const deleteCrop = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `
      UPDATE crops SET status = 'inactive'
      WHERE id = ?
      `,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Cultivo no encontrado" });
    }

    res.json({ message: "Cultivo eliminado correctamente" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error al eliminar cultivo" });
  }
};

export const getCropsForSale = async (req, res) => {
  try {
    const [rows] = await pool.query(`
 SELECT
    cn.id AS crop_name_id,
    cn.name AS crop_name,
    SUM(cr.real_yield) AS total_harvested_kg,
    COALESCE(ss_totals.total_sold_kg, 0) AS total_sold_kg,
    SUM(cr.real_yield) - COALESCE(ss_totals.total_sold_kg, 0) AS available_kg
FROM crop_name cn
JOIN crops cr
    ON cr.crop_name_id = cn.id
LEFT JOIN (
    SELECT
        crop_name_id,
        SUM(kg_sold) AS total_sold_kg
    FROM seed_sales
    WHERE deleted_at IS NULL
      AND status != 'canceled'
    GROUP BY crop_name_id
) ss_totals
    ON ss_totals.crop_name_id = cn.id
GROUP BY cn.id, cn.name
HAVING available_kg > 0
ORDER BY cn.name ASC;
    `);

    res.json({ crops: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al obtener cultivos disponibles para venta",
    });
  }
};

