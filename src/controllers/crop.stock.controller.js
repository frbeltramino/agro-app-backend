import { pool } from "../db/connection.js";

export const registerCropStockUse = async (req, res) => {
  try {
    const {
      crop_id,
      stock_id,
      used_quantity,
      note,
      category_id,
      unit,
      price_per_unit,
      dose_per_ha,
      hectares,
      status
    } = req.body;

    if (!crop_id || !stock_id || !used_quantity) {
      return res.status(400).json({
        ok: false,
        msg: "crop_id, stock_id y used_quantity son requeridos"
      });
    }

    // ✅ SIEMPRE INSERTA — NUNCA ACTUALIZA
    const [result] = await pool.query(
      `INSERT INTO crop_stock 
        (crop_id, stock_id, used_quantity, note, category_id, unit,
         price_per_unit, dose_per_ha, hectares, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crop_id,
        stock_id,
        used_quantity,
        note || null,
        category_id || null,
        unit,
        price_per_unit || null,
        dose_per_ha || null,
        hectares || null,
        status || "active"
      ]
    );

    const [rows] = await pool.query(
      `SELECT cs.*, st.name AS stock_name, st.unit AS stock_unit
       FROM crop_stock cs
       INNER JOIN stock st ON cs.stock_id = st.id
       WHERE cs.id = ?`,
      [result.insertId]
    );

    res.json({
      ok: true,
      msg: "Uso de stock registrado",
      cropStock: rows[0]
    });

  } catch (error) {
    console.error("Error en registerCropStockUse:", error);
    res.status(500).json({ ok: false, msg: "Error interno del servidor" });
  }
};
