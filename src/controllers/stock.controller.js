import { pool } from "../db/connection.js";

export const createStock = async (req, res) => {
  try {
    const { name, category_id, unit, quantity_available, price_per_unit, expiration_date, status } = req.body;

    if (!name || !unit || quantity_available == null || price_per_unit == null) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    const [result] = await pool.query(`
      INSERT INTO stock (name, category_id, unit, quantity_available, price_per_unit, expiration_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      category_id || null,
      unit,
      quantity_available,
      price_per_unit,
      expiration_date || null,
      status || 'active'
    ]);

    const [rows] = await pool.query(`SELECT * FROM stock WHERE id = ?`, [result.insertId]);
    res.status(201).json({ stock: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al crear stock" });
  }
};

export const getStock = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, sc.name AS category_name
      FROM stock s
      LEFT JOIN supply_category sc ON s.category_id = sc.id
      ORDER BY s.name ASC
    `);

    res.json({ stock: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener stock" });
  }
};


export const getStockById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT * FROM stock WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ message: "Stock no encontrado" });
    res.json({ stock: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener stock" });
  }
};

export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category_id, unit, quantity_available, price_per_unit, expiration_date, status } = req.body;

    await pool.query(`
      UPDATE stock
      SET name = ?, category_id = ?, unit = ?, quantity_available = ?, price_per_unit = ?, expiration_date = ?, status = ?
      WHERE id = ?
    `, [
      name,
      category_id || null,
      unit,
      quantity_available,
      price_per_unit,
      expiration_date || null,
      status || 'active',
      id
    ]);

    const [rows] = await pool.query(`SELECT * FROM stock WHERE id = ?`, [id]);
    res.json({ stock: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al actualizar stock" });
  }
};

export const adjustStockQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_change } = req.body; // puede ser positivo o negativo

    if (quantity_change == null) return res.status(400).json({ message: "quantity_change es obligatorio" });

    const [rows] = await pool.query(`SELECT quantity_available FROM stock WHERE id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ message: "Stock no encontrado" });

    const newQuantity = rows[0].quantity_available + Number(quantity_change);
    if (newQuantity < 0) return res.status(400).json({ message: "Cantidad insuficiente en stock" });

    await pool.query(`UPDATE stock SET quantity_available = ? WHERE id = ?`, [newQuantity, id]);
    res.json({ id, quantity_available: newQuantity });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al ajustar stock" });
  }
};