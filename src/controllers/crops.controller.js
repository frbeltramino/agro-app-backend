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

    // const [tasks] = await pool.query(`SELECT * FROM tasks WHERE crop_id = ? ORDER BY performed_at DESC`, [id]);
    // const [supplies] = await pool.query(`SELECT cs.*, s.name, s.type, s.unit FROM crop_supplies cs JOIN supplies s ON s.id = cs.supply_id WHERE cs.crop_id = ?`, [id]);

    res.json({ crop });
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
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Usuario no autenticado"
      });
    }

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
          userId,
          crop_name_id,
          start_date,
          end_date,
          campaign_id,
          lot_id,
          seed_type,
          expected_yield,
          total_estimated,
          real_yield
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
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

      return res.status(201).json({
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
        AND userId = ?
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
        id,
        userId
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Cultivo no encontrado o no pertenece al usuario"
      });
    }

    return res.json({
      message: "Cultivo actualizado correctamente"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al guardar cultivo"
    });
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
    const userId = req.user?.id;
    const { campaignId } = req.query;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!campaignId) {
      return res.status(400).json({ message: "campaignId es obligatorio" });
    }

    const [rows] = await pool.query(
      `
  SELECT
    cn.id AS crop_name_id,
    cn.name AS crop_name,
    cr.campaign_id,

    -- Total cosechado
    SUM(cr.real_yield) AS total_harvested_tn,

    -- Total entregado
    COALESCE(sd_totals.total_delivered_tn, 0) AS total_delivered_tn,

    -- Total vendido
    COALESCE(ss_totals.total_sold_tn, 0) AS total_sold_tn

  FROM crops cr
  JOIN crop_name cn
    ON cn.id = cr.crop_name_id

  /* ============================
     ENTREGAS
  ============================ */
  LEFT JOIN (
    SELECT
      crop_name_id,
      campaign_id,
      SUM(tn_delivered) AS total_delivered_tn
    FROM seed_deliveries
    WHERE deleted_at IS NULL
      AND status != 'canceled'
      AND userId = ?
    GROUP BY crop_name_id, campaign_id
  ) sd_totals
    ON sd_totals.crop_name_id = cr.crop_name_id
   AND sd_totals.campaign_id = cr.campaign_id

  /* ============================
     VENTAS
  ============================ */
  LEFT JOIN (
    SELECT
      crop_name_id,
      campaign_id,
      SUM(tn_sold) AS total_sold_tn
    FROM seed_sales
    WHERE deleted_at IS NULL
      AND userId = ?
    GROUP BY crop_name_id, campaign_id
  ) ss_totals
    ON ss_totals.crop_name_id = cr.crop_name_id
   AND ss_totals.campaign_id = cr.campaign_id

  WHERE cr.userId = ?
    AND cr.campaign_id = ?
    AND cr.status = 'active'

  GROUP BY cn.id, cn.name, cr.campaign_id

  HAVING SUM(cr.real_yield) > 0

  ORDER BY cn.name ASC
  `,
      [userId, userId, userId, campaignId]
    );
    res.json({ crops: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener cultivos disponibles para venta" });
  }
};

export const getCropSoldAvailability = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { campaignId, cropNameId } = req.query;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (!campaignId || !cropNameId) {
      return res.status(400).json({
        message: "campaignId y cropNameId son obligatorios",
      });
    }

    const [rows] = await pool.query(
      `
    SELECT
  cr.campaign_id,
  cr.crop_name_id,
  COALESCE(SUM(cr.real_yield), 0) AS total_harvested_tn,
  COALESCE(sd.total_delivered_tn, 0) AS total_delivered_tn,
  COALESCE(ss.total_sold_tn, 0) AS total_sold_tn,
  (
    COALESCE(SUM(cr.real_yield), 0)
    - COALESCE(ss.total_sold_tn, 0)
  ) AS available_tn
FROM crops cr
LEFT JOIN (
  SELECT campaign_id, crop_name_id, SUM(tn_delivered) AS total_delivered_tn
  FROM seed_deliveries
  WHERE deleted_at IS NULL AND userId = ?
  GROUP BY campaign_id, crop_name_id
) sd
  ON sd.campaign_id = cr.campaign_id
 AND sd.crop_name_id = cr.crop_name_id
LEFT JOIN (
  SELECT campaign_id, crop_name_id, SUM(tn_sold) AS total_sold_tn
  FROM seed_sales
  WHERE deleted_at IS NULL AND userId = ?
  GROUP BY campaign_id, crop_name_id
) ss
  ON ss.campaign_id = cr.campaign_id
 AND ss.crop_name_id = cr.crop_name_id
WHERE cr.userId = ?
  AND cr.campaign_id = ?
  AND cr.crop_name_id = ?
  AND cr.status = 'active'
GROUP BY cr.campaign_id, cr.crop_name_id;
      `,
      [userId, userId, userId, campaignId, cropNameId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "No se encontró información" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al obtener disponibilidad del cultivo",
    });
  }
};

export const canCreateCrop = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { lotId, campaignId } = req.params;
    // o req.query, según cómo armes la ruta
    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const [rows] = await pool.query(
      `
      SELECT 1
      FROM crops
      WHERE lot_id = ?
        AND campaign_id = ?
        AND status = 'active'
        AND end_date IS NULL
        AND real_yield IS NULL
      LIMIT 1
      `,
      [lotId, campaignId]
    );

    // Si existe → NO se puede crear
    const canCreate = rows.length === 0;

    res.json({ canCreate });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Error al verificar cultivo" });
  }
};





