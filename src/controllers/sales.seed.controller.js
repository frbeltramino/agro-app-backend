import { pool } from "../db/connection.js";

export const getSeedSales = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const {
      waybill_number = "",
      destination = "",
      start_date = "",
      end_date = "",
    } = req.query;

    let where = "WHERE deleted_at IS NULL"; // soft delete seguro
    const values = [];

    if (waybill_number) {
      where += " AND waybill_number LIKE ?";
      values.push(`%${waybill_number}%`);
    }

    if (destination) {
      where += " AND destination LIKE ?";
      values.push(`%${destination}%`);
    }

    if (start_date) {
      where += " AND sale_date >= ?";
      values.push(start_date);
    }

    if (end_date) {
      where += " AND sale_date <= ?";
      values.push(end_date);
    }

    // Excluir cancelados si no querés mostrarlos
    where += " AND status != 'canceled'";

    // 🔹 Query principal
    const [rows] = await pool.query(
      `
      SELECT *
      FROM seed_sales
      ${where}
      ORDER BY sale_date DESC
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset]
    );

    // 🔹 Query para total (sin limit/offset)
    const [[count]] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM seed_sales
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
      waybill_number,
      sale_date,
      destination,
      kg_delivered = 0,
      kg_sold = 0,
      status,
    } = req.body;

    if (!waybill_number || !sale_date || !destination) {
      return res.status(400).json({
        message: "Faltan campos obligatorios: waybill_number, sale_date, destination",
      });
    }

    const finalStatus = status || "pending";
    let seedSaleId = id;

    if (id) {
      // UPDATE
      await pool.query(
        `UPDATE seed_sales
         SET waybill_number = ?, sale_date = ?, destination = ?, 
             kg_delivered = ?, kg_sold = ?, status = ?
         WHERE id = ?`,
        [waybill_number, sale_date, destination, kg_delivered, kg_sold, finalStatus, id]
      );
    } else {
      // CREATE
      const [result] = await pool.query(
        `INSERT INTO seed_sales (waybill_number, sale_date, destination, kg_delivered, kg_sold, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [waybill_number, sale_date, destination, kg_delivered, kg_sold, finalStatus]
      );
      seedSaleId = result.insertId;
    }

    const [rows] = await pool.query(
      `SELECT * FROM seed_sales WHERE id = ? AND deleted_at IS NULL`,
      [seedSaleId]
    );

    res.json({ seed_sale: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al crear o actualizar venta" });
  }
};

export const deleteSeedSale = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete: actualizar deleted_at con timestamp actual
    await pool.query(
      `UPDATE seed_sales SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    res.json({ message: "Venta eliminada correctamente (soft delete)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar venta" });
  }
};