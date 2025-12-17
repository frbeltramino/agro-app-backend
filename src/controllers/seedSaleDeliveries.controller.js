import { pool } from "../db/connection.js";

/* ============================
   GET por seed_sale_id
============================ */
export const getSeedSaleDeliveries = async (req, res) => {
  try {
    const { seed_sale_id } = req.params;

    if (!seed_sale_id) {
      return res.status(400).json({
        message: "seed_sale_id es requerido",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        d.*,
        c.real_yield
      FROM seed_sale_deliveries d
      JOIN crops c ON c.id = d.crop_id
      WHERE d.seed_sale_id = ?
      ORDER BY d.delivery_date ASC
      `,
      [seed_sale_id]
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

    const {
      seed_sale_id,
      crop_id,
      delivery_date,
      destination,
      kg_delivered,
      price_per_kg,
    } = req.body;

    if (
      !seed_sale_id ||
      !crop_id ||
      !delivery_date ||
      !destination ||
      !kg_delivered ||
      !price_per_kg
    ) {
      return res.status(400).json({
        message: "Faltan campos obligatorios",
      });
    }

    /* ============================
       1. Obtener la seed_sale
    ============================ */
    const [[seedSale]] = await pool.query(
      `
      SELECT kg_delivered
      FROM seed_sales
      WHERE id = ?
        AND deleted_at IS NULL
      `,
      [seed_sale_id]
    );

    if (!seedSale) {
      return res.status(404).json({
        message: "La venta de semillas no existe o fue eliminada",
      });
    }

    /* ============================
       2. KG ya vendidos (vigentes)
    ============================ */
    let extraKg = 0;

    if (id) {
      const [[current]] = await pool.query(
        `
        SELECT kg_delivered
        FROM seed_sale_deliveries
        WHERE id = ?
          AND deleted_at IS NULL
        `,
        [id]
      );
      extraKg = current?.kg_delivered || 0;
    }

    const [[sold]] = await pool.query(
      `
      SELECT IFNULL(SUM(kg_delivered),0) AS total_sold
      FROM seed_sale_deliveries
      WHERE seed_sale_id = ?
        AND deleted_at IS NULL
      `,
      [seed_sale_id]
    );

    const kgAvailable =
      seedSale.kg_delivered - sold.total_sold + extraKg;

    if (kg_delivered > kgAvailable) {
      return res.status(400).json({
        message: `La cantidad supera los KG disponibles (${kgAvailable})`,
      });
    }

    /* ============================
       3. CREATE / UPDATE
    ============================ */
    let deliveryId = id;

    if (id) {
      // UPDATE
      await pool.query(
        `
        UPDATE seed_sale_deliveries
        SET
          crop_id = ?,
          delivery_date = ?,
          destination = ?,
          kg_delivered = ?,
          price_per_kg = ?
        WHERE id = ?
        `,
        [
          crop_id,
          delivery_date,
          destination,
          kg_delivered,
          price_per_kg,
          id,
        ]
      );
    } else {
      // CREATE
      const [result] = await pool.query(
        `
        INSERT INTO seed_sale_deliveries
        (
          seed_sale_id,
          crop_id,
          delivery_date,
          destination,
          kg_delivered,
          price_per_kg
        )
        VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          seed_sale_id,
          crop_id,
          delivery_date,
          destination,
          kg_delivered,
          price_per_kg,
        ]
      );

      deliveryId = result.insertId;
    }

    /* ============================
       4. Recalcular kg_sold
    ============================ */
    await pool.query(
      `
      UPDATE seed_sales
      SET kg_sold = (
        SELECT IFNULL(SUM(kg_delivered),0)
        FROM seed_sale_deliveries
        WHERE seed_sale_id = ?
          AND deleted_at IS NULL
      )
      WHERE id = ?
      `,
      [seed_sale_id, seed_sale_id]
    );

    /* ============================
       5. Respuesta
    ============================ */
    const [[delivery]] = await pool.query(
      `
      SELECT *
      FROM seed_sale_deliveries
      WHERE id = ?
      `,
      [deliveryId]
    );

    res.json({ delivery });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al crear o actualizar la venta",
    });
  }
};



/* ============================
   DELETE
============================ */
export const deleteSeedSaleDelivery = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `DELETE FROM seed_sale_deliveries WHERE id = ?`,
      [id]
    );

    res.json({ message: "Entrega eliminada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar entrega" });
  }
};
