import { pool } from "../db/connection.js";


export const createOrUpdateSeedDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const {
      crop_name_id,
      campaign_id,
      waybill_number,
      delivery_date,
      destination,
      tn_delivered = 0,
      status = "pending",
    } = req.body;

    /* ============================
       VALIDACIONES
    ============================ */
    if (!crop_name_id || !campaign_id || !waybill_number || !delivery_date || !destination) {
      return res.status(400).json({
        message:
          "Campos obligatorios: crop_name_id, campaign_id, waybill_number, delivery_date, destination",
      });
    }

    if (tn_delivered < 0) {
      return res.status(400).json({
        message: "tn_delivered no puede ser negativo",
      });
    }

    /* ============================
       VALIDAR CAMPAÑA
    ============================ */
    const [[campaign]] = await pool.query(
      `SELECT id FROM campaigns WHERE id = ? AND userId = ? AND status = 'active'`,
      [campaign_id, userId]
    );

    if (!campaign) {
      return res.status(400).json({
        message: "Campaña inválida o no pertenece al usuario",
      });
    }

    let deliveryId = id;

    /* ============================
       UPDATE
    ============================ */
    if (id) {
      const [[existing]] = await pool.query(
        `SELECT id FROM seed_deliveries
         WHERE id = ? AND userId = ? AND deleted_at IS NULL`,
        [id, userId]
      );

      if (!existing) {
        return res.status(404).json({ message: "Entrega no encontrada" });
      }

      await pool.query(
        `UPDATE seed_deliveries
         SET crop_name_id = ?, campaign_id = ?, waybill_number = ?, delivery_date = ?,
             destination = ?, tn_delivered = ?, status = ?
         WHERE id = ?`,
        [
          crop_name_id,
          campaign_id,
          waybill_number,
          delivery_date,
          destination,
          tn_delivered,
          status,
          id,
        ]
      );
    }
    /* ============================
       CREATE
    ============================ */
    else {
      const [result] = await pool.query(
        `INSERT INTO seed_deliveries
         (crop_name_id, campaign_id, waybill_number, delivery_date, destination,
          tn_delivered, tn_sold, status, userId)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          crop_name_id,
          campaign_id,
          waybill_number,
          delivery_date,
          destination,
          tn_delivered,
          status,
          userId,
        ]
      );

      deliveryId = result.insertId;
    }

    /* ============================
       RESPUESTA
    ============================ */
    const [[delivery]] = await pool.query(
      `
      SELECT
        sd.id,
        sd.userId,
        sd.waybill_number,
        sd.delivery_date,
        sd.destination,
        sd.tn_delivered,
        sd.tn_sold,
        sd.status,
        sd.created_at,
        sd.updated_at,
        sd.campaign_id,
        c.name AS campaign_name,
        sd.crop_name_id,
        cn.name AS crop_name
      FROM seed_deliveries sd
      JOIN campaigns c ON c.id = sd.campaign_id
      JOIN crop_name cn ON cn.id = sd.crop_name_id
      WHERE sd.id = ?
      `,
      [deliveryId]
    );

    res.json({ seed_delivery: delivery });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al crear o actualizar entrega",
    });
  }
};


export const deleteSeedDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    // 🔹 Verificamos que el delivery exista y pertenezca al usuario
    const [[delivery]] = await pool.query(
      `SELECT id, crop_name_id, campaign_id FROM seed_deliveries WHERE id = ? AND userId = ? AND deleted_at IS NULL`,
      [id, userId]
    );

    if (!delivery) {
      return res.status(404).json({ message: "Entrega no encontrada" });
    }

    // 🔹 Soft delete del delivery
    await pool.query(
      `UPDATE seed_deliveries SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    // 🔹 Soft delete de todas las seed_sales que correspondan a la misma campaña y crop
    // Opcional: si quieres borrar solo las ventas directamente vinculadas a este delivery
    await pool.query(
      `UPDATE seed_sales 
       SET deleted_at = NOW() 
       WHERE campaign_id = ? AND crop_name_id = ? AND deleted_at IS NULL`,
      [delivery.campaign_id, delivery.crop_name_id]
    );

    res.json({
      message: "Entrega y sus ventas asociadas eliminadas correctamente (soft delete)"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar entrega" });
  }
};