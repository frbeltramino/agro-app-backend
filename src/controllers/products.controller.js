import { pool } from "../db/connection.js";


export const getProducts = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM agricultural_products");
    res.json({ products: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener productos" });
  }
};

export const getProductById = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM agricultural_products WHERE id = ?", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: "Producto no encontrado" });
    res.json({ product: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener producto" });
  }
};