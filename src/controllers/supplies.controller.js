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
    const params = [cropId];

    /* =========================
       FILTROS
    ========================= */
    if (name) {
      filters.push("(COALESCE(s.name, st.name) LIKE ?)");
      params.push(`%${name}%`);
    }

    if (category) {
      filters.push("sc.name LIKE ?");
      params.push(`%${category}%`);
    }

    const filterSql = filters.length
      ? "AND " + filters.join(" AND ")
      : "";

    /* =========================
       QUERY PRINCIPAL
    ========================= */
    const [rows] = await pool.query(
      `
      SELECT
        ct.task_id,
        ts.id AS task_supply_id,
        ts.dose_per_ha,
        ts.hectares,
        ts.total_used,
        ts.price_per_unit AS unit_price,
        ts.created_at AS used_at,

        -- supply
        s.id AS supply_id,
        s.master_supply_id,

        COALESCE(s.name, st.name) AS supply_name,
        COALESCE(s.unit, st.unit) AS supply_unit,

        -- stock
        st.id AS stock_id,
        st.name AS stock_name,
        st.unit AS stock_unit,

        -- category
        COALESCE(s.category_id, st.category_id) AS category_id,
        sc.name AS category_name,

        CASE
          WHEN ts.stock_id IS NOT NULL THEN TRUE
          ELSE FALSE
        END AS from_stock

      FROM crop_tasks ct
      INNER JOIN task_supplies ts
        ON ts.task_id = ct.task_id
      LEFT JOIN supplies s
        ON ts.supply_id = s.id
      LEFT JOIN stock st
        ON ts.stock_id = st.id
      LEFT JOIN supply_category sc
        ON sc.id = COALESCE(s.category_id, st.category_id)

      WHERE ct.crop_id = ?
      ${filterSql}

      ORDER BY COALESCE(s.name, st.name) ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    /* =========================
       COUNT
    ========================= */
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM crop_tasks ct
      INNER JOIN task_supplies ts
        ON ts.task_id = ct.task_id
      WHERE ct.crop_id = ?
      `,
      [cropId]
    );

    const total = countRows[0].total;

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      supplies: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al obtener los suministros del cultivo",
    });
  }
};







export const createOrUpdateSupply = async (req, res) => {
  try {
    const {
      id,
      crop_id,
      master_supply_id,
      name,
      category_id,
      unit,
      dose_per_ha,
      hectares,
      price_per_unit,
      status,
    } = req.body;

    /* =========================
       VALIDACIONES
    ========================= */
    if (!crop_id || !name || !master_supply_id) {
      return res.status(400).json({
        message: "'crop_id', 'name' y 'master_supply_id' son obligatorios",
      });
    }

    const finalUnit = unit || "kg";
    const finalDose = dose_per_ha ?? null;
    const finalHectares = hectares ?? null;
    const finalPrice = price_per_unit ?? null;
    const finalStatus = status || "active";

    let supplyId = id;

    /* =========================
       UPDATE
    ========================= */
    if (id) {
      await pool.query(
        `
        UPDATE supplies
        SET crop_id = ?,
            master_supply_id = ?,
            name = ?,
            category_id = ?,
            unit = ?,
            dose_per_ha = ?,
            hectares = ?,
            price_per_unit = ?,
            status = ?
        WHERE id = ?
        `,
        [
          crop_id,
          master_supply_id,
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
    }
    /* =========================
       CREATE
    ========================= */
    else {
      const [result] = await pool.query(
        `
        INSERT INTO supplies
          (crop_id, master_supply_id, name, category_id, unit, dose_per_ha, hectares, price_per_unit, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          crop_id,
          master_supply_id,
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

      const quantity = finalDose * finalHectares;

      // await pool.query(
      //   `
      //   INSERT INTO crop_supplies (crop_id, supply_id, quantity)
      //   VALUES (?, ?, ?)
      //   `,
      //   [crop_id, supplyId, quantity]
      // );
    }

    /* =========================
       RESPONSE FINAL
    ========================= */
    const [rows] = await pool.query(
      `
      SELECT
        s.*,
        sc.name AS category_name
      FROM supplies s
      LEFT JOIN supply_category sc ON sc.id = s.category_id
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
    const { supply_id, crop_supply_id, stock_id, crop_stock_id, from_stock } = req.body;

    // -----------------------------
    // 🔵 VALIDACIONES INICIALES
    // -----------------------------
    if (!from_stock && !supply_id) {
      return res.status(400).json({ message: "supply_id es requerido" });
    }

    if (from_stock && !stock_id && !crop_stock_id) {
      return res.status(400).json({ message: "Se requiere stock_id o crop_stock_id para eliminar desde stock" });
    }

    // =====================================================
    // 🔵 CASO A — INSUMO NORMAL (tabla supplies)
    // =====================================================
    if (!from_stock) {

      // 1️⃣ Borrado lógico del insumo
      await pool.query(
        `UPDATE supplies SET status = 'inactive' WHERE id = ?`,
        [supply_id]
      );

      // 2️⃣ Antes de eliminar, obtener los supplies usados en tareas
      const [taskSupplyRows] = await pool.query(
        `SELECT id AS task_supply_id, task_id, total_used, price_per_unit
         FROM task_supplies 
         WHERE supply_id = ?`,
        [supply_id]
      );

      // 3️⃣ Restar de cada tarea el costo eliminado
      for (const row of taskSupplyRows) {
        const costToSubtract = row.total_used * row.price_per_unit;

        await pool.query(
          `UPDATE tasks
           SET total_price = total_price - ?
           WHERE id = ?`,
          [costToSubtract, row.task_id]
        );
      }

      // 4️⃣ Eliminar las relaciones en task_supplies
      await pool.query(
        `DELETE FROM task_supplies WHERE supply_id = ?`,
        [supply_id]
      );

      // // 5️⃣ Eliminar relación en crop_supplies si existe
      // if (crop_supply_id) {
      //   await pool.query(
      //     `DELETE FROM crop_supplies WHERE id = ?`,
      //     [crop_supply_id]
      //   );
      // }

      return res.json({ message: "Insumo eliminado correctamente y costos actualizados" });
    }

    // =====================================================
    // 🔴 CASO B — INSUMO DESDE STOCK
    // =====================================================
    if (from_stock) {

      // 1️⃣ Caso: eliminar stock específico de cultivo (NO afecta tareas)
      if (crop_stock_id) {
        await pool.query(
          `UPDATE crop_stock SET status = 'inactive' WHERE id = ?`,
          [crop_stock_id]
        );

        return res.json({ message: "Stock del cultivo eliminado correctamente" });
      }

      // 2️⃣ Caso: eliminar stock asociado a tareas → debe restar costos
      if (stock_id) {

        // 2.1 🔍 Obtener antes los datos necesarios
        const [taskSupplyRows] = await pool.query(
          `SELECT id AS task_supply_id, task_id, total_used, price_per_unit
           FROM task_supplies 
           WHERE stock_id = ?`,
          [stock_id]
        );

        // 2.2 ➖ Restar costo de cada insumo eliminado
        for (const row of taskSupplyRows) {
          const costToSubtract = row.total_used * row.price_per_unit;

          await pool.query(
            `UPDATE tasks
             SET total_price = total_price - ?
             WHERE id = ?`,
            [costToSubtract, row.task_id]
          );
        }

        // 2.3 ❌ Eliminar el registro de task_supplies
        await pool.query(
          `DELETE FROM task_supplies WHERE stock_id = ?`,
          [stock_id]
        );

        return res.json({
          message: "Relaciones de stock con tareas eliminadas y total_price actualizado"
        });
      }
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar insumo" });
  }
};






export const checkSupplyUsage = async (req, res) => {
  try {
    const { crop_id, supply_id, stock_id } = req.body;

    if (!crop_id || (!supply_id && !stock_id)) {
      return res.status(400).json({
        message: "crop_id y supply_id o stock_id son requeridos"
      });
    }

    // Obtener IDs de tareas del cultivo
    const [taskRows] = await pool.query(
      `SELECT task_id FROM crop_tasks WHERE crop_id = ?`,
      [crop_id]
    );
    const taskIds = taskRows.map(t => t.task_id);

    if (taskIds.length === 0) {
      return res.json({ can_delete: true, used_in_tasks: [] });
    }

    let usageRows = [];

    if (supply_id) {
      // Supply normal → solo revisar task_supplies
      const [rows] = await pool.query(
        `SELECT ts.id, ts.task_id, t.description AS task_description, ts.total_used
         FROM task_supplies ts
         INNER JOIN tasks t ON ts.task_id = t.id
         WHERE ts.supply_id = ? AND ts.task_id IN (?)`,
        [supply_id, taskIds]
      );
      usageRows = rows;
    }

    if (stock_id) {
      // Stock → solo considerar los que están relacionados con tareas
      const [rows] = await pool.query(
        `SELECT ts.id, ts.task_id, t.description AS task_description, ts.total_used
         FROM task_supplies ts
         INNER JOIN tasks t ON ts.task_id = t.id
         WHERE ts.stock_id = ? AND ts.task_id IN (?)`,
        [stock_id, taskIds]
      );
      usageRows = rows;
    }

    return res.json({
      can_delete: usageRows.length === 0,
      used_in_tasks: usageRows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al verificar uso del insumo" });
  }
};




