import { pool } from "../db/connection.js";

export const getSupplies = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, sc.name AS category_name
      FROM supplies s
      LEFT JOIN supply_category sc ON s.category_id = sc.id
      ORDER BY s.name
    `);

    res.json({ supplies: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener insumos" });
  }
};

export const getSupplyById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT s.*, sc.name AS category_name
      FROM supplies s
      LEFT JOIN supply_category sc ON s.category_id = sc.id
      WHERE s.id = ?
    `, [id]);

    if (rows.length === 0) return res.status(404).json({ message: "Insumo no encontrado" });

    res.json({ supply: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener insumo" });
  }
};



export const getSuppliesByCropId = async (req, res) => {
  try {
    const { cropId } = req.params;
    const { name = "", category = "", page = 1, limit = 10 } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    const filters = [];
    const params = [cropId, cropId];

    if (name) {
      filters.push("supply_name LIKE ?");
      params.push(`%${name}%`);
    }
    if (category) {
      filters.push("category_name LIKE ?");
      params.push(`%${category}%`);
    }
    const filterSql = filters.length ? " AND " + filters.join(" AND ") : "";

    const [rows] = await pool.query(
      `
  SELECT *
FROM (
  -- Supplies específicos del cultivo
  SELECT
    cs.id AS crop_supply_id,
    s.id AS supply_id,
    NULL AS stock_id,
    s.name AS supply_name,
    sc.name AS category_name,
    s.unit AS supply_unit,
    s.price_per_unit AS unit_price,
    cs.quantity AS total_used,
    s.dose_per_ha AS dose_per_ha,    
    s.hectares AS hectares,          
    FALSE AS from_stock
  FROM crop_supplies cs
  INNER JOIN supplies s ON cs.supply_id = s.id
  LEFT JOIN supply_category sc ON s.category_id = sc.id
  WHERE cs.crop_id = ?

  UNION ALL

  -- Supplies desde stock
  SELECT
    NULL AS crop_supply_id,
    NULL AS supply_id,
    st.id AS stock_id,
    st.name AS supply_name,
    sc.name AS category_name,
    st.unit AS supply_unit,
    st.price_per_unit AS unit_price,
    ts.total_used AS total_used,
    ts.dose_per_ha AS dose_per_ha,
    ts.hectares AS hectares,
    TRUE AS from_stock
  FROM task_supplies ts
  INNER JOIN stock st ON ts.stock_id = st.id
  LEFT JOIN supply_category sc ON st.category_id = sc.id
  INNER JOIN tasks t ON ts.task_id = t.id
  WHERE t.crop_id = ?
) AS combined
${filterSql}
ORDER BY supply_name ASC
LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total FROM (
        SELECT cs.id AS crop_supply_id
        FROM crop_supplies cs
        WHERE cs.crop_id = ?
        UNION ALL
        SELECT st.id AS stock_id
        FROM task_supplies ts
        INNER JOIN stock st ON ts.stock_id = st.id
        INNER JOIN tasks t ON ts.task_id = t.id
        WHERE t.crop_id = ?
      ) AS combined_count
      `,
      [cropId, cropId]
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      supplies: rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener insumos del cultivo" });
  }
};



export const createOrUpdateSupply = async (req, res) => {
  try {
    const {
      id,
      crop_id,
      name,
      category_id,
      unit,
      dose_per_ha,
      hectares,
      price_per_unit,
      status,
    } = req.body;

    // Validaciones mínimas
    if (!crop_id || !name || !category_id) {
      return res.status(400).json({
        message: "'crop_id', 'name' y 'category_id' son obligatorios",
      });
    }

    const finalUnit = unit || "kg";
    const finalDose = dose_per_ha ? Number(dose_per_ha) : 0;
    const finalHectares = hectares ? Number(hectares) : 0;
    const finalPrice = price_per_unit ? Number(price_per_unit) : 0;
    const finalStatus = status || "active";

    let supplyId = id;

    // Si viene id → UPDATE
    if (id) {
      await pool.query(
        `
        UPDATE supplies 
        SET crop_id = ?, name = ?, category_id = ?, unit = ?, 
            dose_per_ha = ?, hectares = ?, price_per_unit = ?, status = ?
        WHERE id = ?
        `,
        [
          crop_id,
          name,
          category_id,
          finalUnit,
          finalDose,
          finalHectares,
          finalPrice,
          finalStatus,
          id,
        ]
      );
    } else {
      // Si NO viene id → CREATE
      const [result] = await pool.query(
        `
        INSERT INTO supplies (crop_id, name, category_id, unit, dose_per_ha, hectares, price_per_unit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          crop_id,
          name,
          category_id,
          finalUnit,
          finalDose,
          finalHectares,
          finalPrice,
          finalStatus,
        ]
      );

      supplyId = result.insertId;

      // 💡 Calcular cantidad real usada: dosis x hectáreas
      const quantity = finalDose * finalHectares;

      await pool.query(
        `
        INSERT INTO crop_supplies (crop_id, supply_id, quantity)
        VALUES (?, ?, ?)
        `,
        [crop_id, supplyId, quantity]
      );
    }

    // Obtener registro final
    const [rows] = await pool.query(
      `
      SELECT s.*, sc.name AS category_name
      FROM supplies s
      LEFT JOIN supply_category sc ON s.category_id = sc.id
      WHERE s.id = ?
      `,
      [supplyId]
    );

    res.status(200).json({ supply: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al crear o actualizar insumo" });
  }
};


export const deleteSupply = async (req, res) => {
  try {
    const { id } = req.params;


    await pool.query(`UPDATE supplies SET status = 'inactive' WHERE id = ?`, [id]);



    res.json({ message: "Insumo eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar insumo" });
  }
};
