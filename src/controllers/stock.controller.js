import { pool } from "../db/connection.js";

export const createOrUpdateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const isUpdate = id !== undefined;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: true,
        message: "Usuario no autenticado",
      });
    }

    const {
      name,
      category_id,
      unit,
      quantity_available,
      price_per_unit,
      expiration_date,
      status,
      master_supply_id,
    } = req.body;

    // -------------------------
    // Validaciones comunes
    // -------------------------
    if (isUpdate && isNaN(Number(id))) {
      return res.status(400).json({
        error: true,
        message: "El ID debe ser numérico",
      });
    }

    if (
      !isUpdate &&
      (!name || !unit || quantity_available == null || price_per_unit == null)
    ) {
      return res.status(400).json({
        error: true,
        message:
          "Faltan datos obligatorios para crear: name, unit, quantity_available, price_per_unit",
      });
    }

    if (
      (quantity_available != null && isNaN(quantity_available)) ||
      (price_per_unit != null && isNaN(price_per_unit))
    ) {
      return res.status(400).json({
        error: true,
        message: "quantity_available y price_per_unit deben ser números",
      });
    }

    if (
      master_supply_id !== undefined &&
      master_supply_id !== null &&
      isNaN(Number(master_supply_id))
    ) {
      return res.status(400).json({
        error: true,
        message: "master_supply_id debe ser numérico",
      })
    }

    if (master_supply_id) {
      const [master] = await pool.query(
        `SELECT id FROM master_supplies WHERE id = ?`,
        [master_supply_id]
      )

      if (master.length === 0) {
        return res.status(400).json({
          error: true,
          message: "El master_supply_id no existe",
        })
      }
    }

    const validStatus = ["active", "inactive"];
    const finalStatus =
      status && validStatus.includes(status) ? status : undefined;

    let finalExpirationDate;
    if (expiration_date) {
      const dateTest = new Date(expiration_date);
      if (isNaN(dateTest.getTime())) {
        return res.status(400).json({
          error: true,
          message: "La fecha de expiración no es válida",
        });
      }
      finalExpirationDate = expiration_date;
    }

    // ==================================================
    // 🔄 UPDATE
    // ==================================================
    if (isUpdate) {
      const [existing] = await pool.query(
        `SELECT * FROM stock WHERE id = ? AND userId = ?`,
        [id, userId]
      );

      if (existing.length === 0) {
        return res.status(404).json({
          error: true,
          message: "El stock no existe o no pertenece al usuario",
        });
      }

      const fields = [];
      const values = [];

      if (name !== undefined) {
        fields.push("name = ?");
        values.push(name);
      }
      if (category_id !== undefined) {
        fields.push("category_id = ?");
        values.push(category_id || null);
      }
      if (unit !== undefined) {
        fields.push("unit = ?");
        values.push(unit);
      }
      if (quantity_available !== undefined) {
        fields.push("quantity_available = ?");
        values.push(quantity_available);
      }
      if (price_per_unit !== undefined) {
        fields.push("price_per_unit = ?");
        values.push(price_per_unit);
      }
      if (finalExpirationDate !== undefined) {
        fields.push("expiration_date = ?");
        values.push(finalExpirationDate);
      }
      if (finalStatus !== undefined) {
        fields.push("status = ?");
        values.push(finalStatus);
      }

      if (master_supply_id !== undefined) {
        fields.push("master_supply_id = ?")
        values.push(master_supply_id || null)
      }

      if (fields.length === 0) {
        return res.status(400).json({
          error: true,
          message: "No hay campos para actualizar",
        });
      }

      values.push(id, userId);

      await pool.query(
        `UPDATE stock SET ${fields.join(", ")} WHERE id = ? AND userId = ?`,
        values
      );

      const [updated] = await pool.query(
        `SELECT * FROM stock WHERE id = ? AND userId = ?`,
        [id, userId]
      );

      return res.status(200).json({
        success: true,
        message: "Stock actualizado exitosamente",
        stock: updated[0],
      });
    }

    // ==================================================
    // 🆕 CREATE
    // ==================================================
    const [result] = await pool.query(
      `
      INSERT INTO stock 
        (name, category_id, unit, quantity_available, price_per_unit, expiration_date, status, userId, master_supply_id)
      VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        category_id || null,
        unit,
        quantity_available,
        price_per_unit,
        finalExpirationDate ?? null,
        finalStatus || "active",
        userId,
        master_supply_id || null,
      ]
    )

    const [created] = await pool.query(
      `SELECT * FROM stock WHERE id = ? AND userId = ?`,
      [result.insertId, userId]
    );

    return res.status(201).json({
      success: true,
      message: "Stock creado exitosamente",
      stock: created[0],
    });
  } catch (err) {
    console.error("❌ Error en createOrUpdateStock:", err);
    return res.status(500).json({
      error: true,
      message: "Error interno del servidor",
    });
  }
};



export const getStock = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: true,
        message: "Usuario no autenticado",
      });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const search = req.query.search || "";
    const categoryId = req.query.category_id || "";

    // -------------------------
    // Filtros dinámicos
    // -------------------------
    const filters = [];
    const values = [];

    // 🔐 Seguridad: solo stock del usuario
    filters.push(`s.userId = ?`);
    values.push(userId);

    // Solo stock activo
    filters.push(`s.status = ?`);
    values.push("active");

    if (search) {
      filters.push(`(s.name LIKE ? OR sc.name LIKE ?)`);
      values.push(`%${search}%`, `%${search}%`);
    }

    if (categoryId) {
      filters.push(`s.category_id = ?`);
      values.push(categoryId);
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;

    // 1️⃣ Data paginada
    const [rows] = await pool.query(
      `
      SELECT 
        s.*,
        sc.name AS category_name
      FROM stock s
      LEFT JOIN supply_category sc ON s.category_id = sc.id
      ${whereClause}
      ORDER BY s.name ASC
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset]
    );

    // 2️⃣ Total
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM stock s
      LEFT JOIN supply_category sc ON s.category_id = sc.id
      ${whereClause}
      `,
      values
    );

    const total = countRows[0].total;

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      stock: rows,
    });
  } catch (err) {
    console.error("❌ Error en getStock:", err);
    res.status(500).json({
      error: true,
      message: "Error al obtener stock",
    });
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


export const adjustStockQuantity = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity_change } = req.body; // puede ser positivo o negativo
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    if (quantity_change == null) {
      return res.status(400).json({ message: "quantity_change es obligatorio" });
    }

    // 🔹 Obtener stock solo del usuario
    const [rows] = await pool.query(
      `SELECT quantity_available FROM stock WHERE id = ? AND userId = ?`,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Stock no encontrado o no pertenece al usuario" });
    }

    const newQuantity = rows[0].quantity_available + Number(quantity_change);

    if (newQuantity < 0) {
      return res.status(400).json({ message: "Cantidad insuficiente en stock" });
    }

    // 🔹 Actualizar stock solo del usuario
    await pool.query(
      `UPDATE stock SET quantity_available = ? WHERE id = ? AND userId = ?`,
      [newQuantity, id, userId]
    );

    res.json({
      success: true,
      id,
      quantity_available: newQuantity
    });
  } catch (err) {
    console.error("❌ Error al ajustar stock:", err);
    res.status(500).json({ message: "Error al ajustar stock" });
  }
};

export const deleteStock = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: true,
        message: "Usuario no autenticado"
      });
    }

    // Validar ID
    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: true,
        message: "El ID debe ser un número válido"
      });
    }

    // Verificar que el registro exista y pertenezca al usuario
    const [existing] = await pool.query(
      "SELECT * FROM stock WHERE id = ? AND userId = ?",
      [id, userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        error: true,
        message: "El stock no existe o no pertenece al usuario"
      });
    }

    // Si ya está inactivo, no hacer nada
    if (existing[0].status === "inactive") {
      return res.status(400).json({
        error: true,
        message: "El stock ya está eliminado lógicamente"
      });
    }

    // Actualización lógica
    await pool.query(
      "UPDATE stock SET status = 'inactive' WHERE id = ? AND userId = ?",
      [id, userId]
    );

    return res.status(200).json({
      success: true,
      message: "Stock eliminado lógicamente",
      id: id
    });

  } catch (err) {
    console.error("❌ Error en deleteStock:", err);
    return res.status(500).json({
      error: true,
      message: "Error interno del servidor"
    });
  }
};