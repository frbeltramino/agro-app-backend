import { pool } from "../db/connection.js";

export const getStockStats = async (req, res) => {
  try {
    const [[stats]] = await pool.query(`
      SELECT
        COUNT(*) AS total_items,
        SUM(quantity_available) AS total_quantity,
        SUM(quantity_available * price_per_unit) AS total_value,
        SUM(status = 'active') AS active_count,
        SUM(status = 'inactive') AS inactive_count,
        SUM(expiration_date < NOW()) AS expired_count,
        SUM(expiration_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)) AS expiring_soon
      FROM stock
    `);

    const [categories] = await pool.query(`
      SELECT category_id, COUNT(*) AS items
      FROM stock
      GROUP BY category_id
    `);

    res.json({
      ...stats,
      categories,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error obteniendo estadísticas de stock" });
  }
};
