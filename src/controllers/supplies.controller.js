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
    const params = [cropId, cropId, cropId];

    if (name) {
      filters.push("supply_name LIKE ?");
      params.push(`%${name}%`);
    }
    if (category) {
      filters.push("category_name LIKE ?");
      params.push(`%${category}%`);
    }

    const filterSql = filters.length ? " WHERE " + filters.join(" AND ") : "";

    // Consulta principal con record_id unificado
    const [rows] = await pool.query(
      `
      SELECT *
      FROM (
        -- 1) Insumos propios del cultivo
        SELECT
            NULL AS crop_stock_id,
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
            FALSE AS from_stock,
            cs.created_at AS used_at
        FROM crop_supplies cs
        INNER JOIN supplies s ON cs.supply_id = s.id
        LEFT JOIN supply_category sc ON s.category_id = sc.id
        WHERE cs.crop_id = ? AND s.status = 'active'

        UNION ALL

        -- 2) Insumos desde stock usados en tareas
        SELECT
            NULL AS crop_stock_id,
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
            TRUE AS from_stock,
            ts.created_at AS used_at
        FROM task_supplies ts
        INNER JOIN stock st ON ts.stock_id = st.id
        LEFT JOIN supply_category sc ON st.category_id = sc.id
        INNER JOIN tasks t ON ts.task_id = t.id
        WHERE t.crop_id = ? AND st.status = 'active'

        UNION ALL

        -- 3) Stock usado directamente por el cultivo
        SELECT
            csu.id AS crop_stock_id,
            NULL AS crop_supply_id,
            NULL AS supply_id,
            csu.stock_id AS stock_id,
            st.name AS supply_name,
            sc.name AS category_name,
            csu.unit AS supply_unit,
            csu.price_per_unit AS unit_price,
            csu.used_quantity AS total_used,
            csu.dose_per_ha AS dose_per_ha,
            csu.hectares AS hectares,
            TRUE AS from_stock,
            csu.used_at AS used_at
        FROM crop_stock csu
        INNER JOIN stock st ON csu.stock_id = st.id
        LEFT JOIN supply_category sc ON csu.category_id = sc.id
        WHERE csu.crop_id = ? AND csu.status = 'active'

      ) AS combined
      ${filterSql}
      ORDER BY used_at DESC, supply_name ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    // Conteo total para paginación
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total
      FROM (
          SELECT cs.id AS record_id
          FROM crop_supplies cs
          INNER JOIN supplies s ON cs.supply_id = s.id
          WHERE cs.crop_id = ? AND s.status = 'active'

          UNION ALL

          SELECT ts.id AS record_id
          FROM task_supplies ts
          INNER JOIN tasks t ON ts.task_id = t.id
          INNER JOIN stock st ON ts.stock_id = st.id
          WHERE t.crop_id = ? AND st.status = 'active'

          UNION ALL

          SELECT csu.id AS record_id
          FROM crop_stock csu
          WHERE csu.crop_id = ? AND csu.status = 'active'
      ) AS combined_count
      `,
      [cropId, cropId, cropId]
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

      // 5️⃣ Eliminar relación en crop_supplies si existe
      if (crop_supply_id) {
        await pool.query(
          `DELETE FROM crop_supplies WHERE id = ?`,
          [crop_supply_id]
        );
      }

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




