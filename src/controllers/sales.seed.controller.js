import { pool } from "../db/connection.js";

export const getSeedSales = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { waybill_number = "", destination = "", start_date = "", end_date = "" } = req.query;

    let where = "WHERE ss.deleted_at IS NULL";
    const values = [];

    if (waybill_number) {
      where += " AND ss.waybill_number LIKE ?";
      values.push(`%${waybill_number}%`);
    }

    if (destination) {
      where += " AND ss.destination LIKE ?";
      values.push(`%${destination}%`);
    }

    if (start_date) {
      where += " AND ss.sale_date >= ?";
      values.push(start_date);
    }

    if (end_date) {
      where += " AND ss.sale_date <= ?";
      values.push(end_date);
    }

    where += " AND ss.status != 'canceled'";

    /* ============================
       QUERY PRINCIPAL
    ============================ */
    const [rows] = await pool.query(
      `
  SELECT
    ss.*,
    cn.name AS crop_name,
    IF(COUNT(ssd.id) = 0, JSON_ARRAY(), 
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', ssd.id,
          'crop_name_id', ssd.crop_name_id, 
          'waybill_number', ssd.waybill_number,
          'delivery_date', ssd.delivery_date,
          'destination', ssd.destination,
          'kg_delivered', ssd.kg_delivered,
          'price_per_kg', ssd.price_per_kg,
          'created_at', ssd.created_at,
          'updated_at', ssd.updated_at
        )
      )
    ) AS deliveries
  FROM seed_sales ss
  JOIN crop_name cn
    ON cn.id = ss.crop_name_id
  LEFT JOIN seed_sale_deliveries ssd
    ON ssd.seed_sale_id = ss.id AND ssd.deleted_at IS NULL
  ${where}
  GROUP BY ss.id, cn.name
  ORDER BY ss.sale_date DESC
  LIMIT ? OFFSET ?
  `,
      [...values, limit, offset]
    );

    /* ============================
       TOTAL PARA PAGINACIÓN
    ============================ */
    const [[count]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM seed_sales ss
      ${where}
      `,
      values
    );

    res.json({
      seed_sales: rows,
      pagination: {
        page,
        limit,
        total: count.total,
        totalPages: Math.ceil(count.total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener ventas" });
  }
};



export const getSeedSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT * FROM seed_sales WHERE id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    res.json({ seed_sale: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener venta" });
  }
};

export const createOrUpdateSeedSale = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      crop_name_id,
      waybill_number,
      sale_date,
      destination,
      kg_delivered = 0,
      kg_sold = 0,
      status,
    } = req.body;

    // ✅ Validaciones
    if (!crop_name_id || !waybill_number || !sale_date || !destination) {
      return res.status(400).json({
        message:
          "Faltan campos obligatorios: crop_name_id, waybill_number, sale_date, destination",
      });
    }

    const finalStatus = status || "pending";
    let seedSaleId = id;

    if (id) {
      // 🔄 UPDATE
      await pool.query(
        `UPDATE seed_sales
         SET crop_name_id = ?, waybill_number = ?, sale_date = ?, destination = ?,
             kg_delivered = ?, status = ?
         WHERE id = ? AND deleted_at IS NULL`,
        [
          crop_name_id,
          waybill_number,
          sale_date,
          destination,
          kg_delivered,
          finalStatus,
          id,
        ]
      );
    } else {
      // 🆕 CREATE
      const [result] = await pool.query(
        `INSERT INTO seed_sales
         (crop_name_id, waybill_number, sale_date, destination, kg_delivered, kg_sold, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          crop_name_id,
          waybill_number,
          sale_date,
          destination,
          kg_delivered,
          kg_sold,
          finalStatus,
        ]
      );

      seedSaleId = result.insertId;
    }

    // 🔍 Retornar resultado
    const [rows] = await pool.query(
      `SELECT * FROM seed_sales WHERE id = ? AND deleted_at IS NULL`,
      [seedSaleId]
    );

    res.json({ seed_sale: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al crear o actualizar venta",
    });
  }
};


export const deleteSeedSale = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete de la venta
    await pool.query(
      `UPDATE seed_sales SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    // Soft delete de los deliveries asociados
    await pool.query(
      `UPDATE seed_sale_deliveries SET deleted_at = NOW() WHERE seed_sale_id = ?`,
      [id]
    );

    res.json({ message: "Venta y sus deliveries eliminados correctamente (soft delete)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar venta" });
  }
};