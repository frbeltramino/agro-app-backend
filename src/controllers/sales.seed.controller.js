import { pool } from "../db/connection.js";

export const createOrUpdateSeedSale = async (req, res) => {
  try {
    const { id } = req.params; // si existe, hacemos UPDATE
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const {
      campaign_id,
      crop_name_id,
      primary_liquidation_number,
      sale_date,
      destination,
      tn_sold,
      price_per_tn,
    } = req.body;

    // ============================
    // Validaciones básicas
    // ============================
    if (
      !campaign_id ||
      !crop_name_id ||
      !primary_liquidation_number ||
      !sale_date ||
      !destination ||
      tn_sold == null ||
      price_per_tn == null
    ) {
      return res.status(400).json({ message: "Faltan campos obligatorios" });
    }

    // ============================
    // Validar que la campaña exista y sea del usuario
    // ============================
    const [[campaign]] = await pool.query(
      `SELECT id FROM campaigns WHERE id = ? AND userId = ? AND status = 'active'`,
      [campaign_id, userId]
    );

    if (!campaign) {
      return res.status(400).json({
        message: "Campaña inválida o no pertenece al usuario",
      });
    }

    let saleId = id;

    // ============================
    // CREATE / UPDATE
    // ============================
    if (id) {
      // UPDATE
      const [[existing]] = await pool.query(
        `SELECT id FROM seed_sales WHERE id = ? AND userId = ? AND deleted_at IS NULL`,
        [id, userId]
      );

      if (!existing) {
        return res.status(404).json({ message: "Venta no encontrada" });
      }

      await pool.query(
        `UPDATE seed_sales
         SET campaign_id = ?, crop_name_id = ?, primary_liquidation_number = ?,
             sale_date = ?, destination = ?, tn_sold = ?, price_per_tn = ?
         WHERE id = ?`,
        [
          campaign_id,
          crop_name_id,
          primary_liquidation_number,
          sale_date,
          destination,
          tn_sold,
          price_per_tn,
          id,
        ]
      );
    } else {
      // CREATE
      const [result] = await pool.query(
        `INSERT INTO seed_sales
         (campaign_id, crop_name_id, primary_liquidation_number,
          sale_date, destination, tn_sold, price_per_tn, userId)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          campaign_id,
          crop_name_id,
          primary_liquidation_number,
          sale_date,
          destination,
          tn_sold,
          price_per_tn,
          userId,
        ]
      );
      saleId = result.insertId;
    }

    // ============================
    // Retornar venta creada/actualizada
    // ============================
    const [[sale]] = await pool.query(
      `SELECT *
       FROM seed_sales
       WHERE id = ? AND deleted_at IS NULL`,
      [saleId]
    );

    res.json({ seed_sale: sale });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al crear o actualizar venta" });
  }
};


export const deleteSeedSale = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // usuario autenticado

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    // ============================
    // 1. Validar que la venta exista y pertenezca al usuario
    // ============================
    const [[sale]] = await pool.query(
      `SELECT id, userId FROM seed_sales WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );

    if (!sale) {
      return res.status(404).json({
        message: "La venta no existe o ya fue eliminada",
      });
    }

    if (sale.userId !== userId) {
      return res.status(403).json({
        message: "No tenés permiso para eliminar esta venta",
      });
    }

    // ============================
    // 2. Soft delete de la venta
    // ============================
    await pool.query(
      `UPDATE seed_sales SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    // ============================
    // 3. Retornar respuesta
    // ============================
    res.json({
      message: "Venta eliminada correctamente (soft delete)",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al eliminar la venta",
    });
  }
};