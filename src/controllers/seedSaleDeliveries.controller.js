import { pool } from "../db/connection.js";

/* ============================
   GET por seed_sale_id
============================ */
export const getSeedSaleDeliveries = async (req, res) => {
  try {
    const { seed_sale_id } = req.params;
    const userId = req.user?.id; // asumimos que el middleware de auth pone el usuario

    if (!seed_sale_id) {
      return res.status(400).json({ message: "seed_sale_id es requerido" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const [rows] = await pool.query(
      `
  SELECT 
    d.id,
    d.primary_liquidation_number,
    d.seed_sale_id,
    d.crop_name_id,
    d.delivery_date,
    d.destination,
    d.tn_delivered,
    d.price_per_tn,
    d.created_at,
    d.updated_at
  FROM seed_sale_deliveries d
  JOIN seed_sales ss ON ss.id = d.seed_sale_id
  WHERE d.seed_sale_id = ?
    AND ss.userId = ?
    AND d.deleted_at IS NULL
  ORDER BY d.delivery_date ASC
  `,
      [seed_sale_id, userId]
    );

    res.json({ deliveries: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener entregas" });
  }
};



/* ============================
   GET por ID
============================ */
export const getSeedSaleDeliveryById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM seed_sale_deliveries WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Entrega no encontrada" });
    }

    res.json({ delivery: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener entrega" });
  }
};

/* ============================
   CREATE / UPDATE
============================ */
export const createOrUpdateSeedSaleDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // usuario autenticado

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const {
      seed_sale_id,
      crop_name_id,
      primary_liquidation_number,
      delivery_date,
      destination,
      tn_delivered,  // toneladas
      price_per_tn,  // precio por tonelada
    } = req.body;

    // ============================
    // 0. Validaciones básicas
    // ============================
    if (
      !seed_sale_id ||
      !crop_name_id ||
      !primary_liquidation_number ||
      !delivery_date ||
      !destination ||
      tn_delivered == null ||
      price_per_tn == null
    ) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    // ============================
    // 1. Obtener la seed_sale y validar userId
    // ============================
    const [[seedSale]] = await pool.query(
      `SELECT * 
       FROM seed_sales 
       WHERE id = ? 
         AND deleted_at IS NULL 
         AND userId = ?`,
      [seed_sale_id, userId]
    );

    if (!seedSale) {
      return res.status(404).json({
        message:
          "La venta de semillas no existe, fue eliminada, o no pertenece al usuario",
      });
    }

    // ============================
    // 2. TN ya entregadas (vigentes)
    // ============================
    let extraTn = 0;

    if (id) {
      const [[current]] = await pool.query(
        `SELECT tn_delivered 
         FROM seed_sale_deliveries 
         WHERE id = ? 
           AND deleted_at IS NULL`,
        [id]
      );
      extraTn = current?.tn_delivered || 0;
    }

    const [[delivered]] = await pool.query(
      `SELECT IFNULL(SUM(tn_delivered), 0) AS total_delivered
       FROM seed_sale_deliveries
       WHERE seed_sale_id = ?
         AND deleted_at IS NULL`,
      [seed_sale_id]
    );

    const tnAvailable =
      seedSale.tn_delivered - delivered.total_delivered + extraTn;

    if (tn_delivered > tnAvailable) {
      return res.status(400).json({
        message: `La cantidad supera las toneladas disponibles (${tnAvailable})`,
      });
    }

    // ============================
    // 3. CREATE / UPDATE con userId
    // ============================
    let deliveryId = id;

    if (id) {
      // UPDATE
      await pool.query(
        `UPDATE seed_sale_deliveries
         SET
           primary_liquidation_number = ?,
           crop_name_id = ?,
           delivery_date = ?,
           destination = ?,
           tn_delivered = ?,
           price_per_tn = ?
         WHERE id = ?
           AND deleted_at IS NULL`,
        [
          primary_liquidation_number,
          crop_name_id,
          delivery_date,
          destination,
          tn_delivered,
          price_per_tn,
          id,
        ]
      );
    } else {
      // CREATE
      const [result] = await pool.query(
        `INSERT INTO seed_sale_deliveries
         (
           seed_sale_id,
           primary_liquidation_number,
           crop_name_id,
           delivery_date,
           destination,
           tn_delivered,
           price_per_tn,
           userId
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          seed_sale_id,
          primary_liquidation_number,
          crop_name_id,
          delivery_date,
          destination,
          tn_delivered,
          price_per_tn,
          userId,
        ]
      );

      deliveryId = result.insertId;
    }

    // ============================
    // 4. Recalcular tn_sold en seed_sales
    // ============================
    const [updateResult] = await pool.query(
      `
  UPDATE seed_sales
  SET
    tn_sold = (
      SELECT IFNULL(SUM(tn_delivered), 0)
      FROM seed_sale_deliveries
      WHERE seed_sale_id = ?
        AND deleted_at IS NULL
    ),
    status = CASE
      WHEN (
        SELECT IFNULL(SUM(tn_delivered), 0)
        FROM seed_sale_deliveries
        WHERE seed_sale_id = ?
          AND deleted_at IS NULL
      ) = tn_delivered THEN 'completed'
      WHEN (
        SELECT IFNULL(SUM(tn_delivered), 0)
        FROM seed_sale_deliveries
        WHERE seed_sale_id = ?
          AND deleted_at IS NULL
      ) > 0 THEN 'partial'
      ELSE 'pending'
    END
  WHERE id = ?
    AND userId = ?
  `,
      [
        seed_sale_id,
        seed_sale_id,
        seed_sale_id,
        seed_sale_id,
        userId,
      ]
    );

    // ============================
    // 5. Modificar estado si seed_sales[id] tiene igual cantidad en tn entregadas que en  tn vendiidas
    // ============================
    await pool.query(
      `
  UPDATE seed_sales
  SET status = 'completed'
  WHERE id = ?
    AND userId = ?
    AND tn_sold = tn_delivered
    AND deleted_at IS NULL
  `,
      [seed_sale_id, userId]
    );
    // ============================
    // 6. Retornar entrega creada/actualizada
    // ============================
    const [[delivery]] = await pool.query(
      `SELECT *
       FROM seed_sale_deliveries
       WHERE id = ?
         AND deleted_at IS NULL`,
      [deliveryId]
    );

    res.json({ delivery });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Error al crear o actualizar la entrega" });
  }
};

/* ============================
   DELETE
============================ */
export const deleteSeedSaleDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // usuario autenticado

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    /* ============================
       1. Obtener seed_sale_id y userId
    ============================ */
    const [[delivery]] = await pool.query(
      `
      SELECT seed_sale_id, userId
      FROM seed_sale_deliveries
      WHERE id = ? AND deleted_at IS NULL
      `,
      [id]
    );

    if (!delivery) {
      return res.status(404).json({
        message: "La entrega no existe o ya fue eliminada",
      });
    }

    // Validar que la entrega pertenezca al usuario
    if (delivery.userId !== userId) {
      return res.status(403).json({
        message: "No tenés permiso para eliminar esta entrega",
      });
    }

    const seedSaleId = delivery.seed_sale_id;

    /* ============================
       2. Soft delete del delivery
    ============================ */
    await pool.query(
      `UPDATE seed_sale_deliveries
       SET deleted_at = NOW()
       WHERE id = ?`,
      [id]
    );

    /* ============================
       3. Recalcular kg_sold en seed_sales
    ============================ */
    await pool.query(
      `
      UPDATE seed_sales
      SET tn_sold = (
        SELECT IFNULL(SUM(tn_delivered), 0)
        FROM seed_sale_deliveries
        WHERE seed_sale_id = ?
          AND deleted_at IS NULL
      )
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [seedSaleId, seedSaleId]
    );

    res.json({
      message: "Venta eliminada correctamente y toneladas vendidas actualizadas",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al eliminar la venta",
    });
  }
};

