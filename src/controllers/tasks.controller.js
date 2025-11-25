import { pool } from "../db/connection.js";

// =========================
// OBTENER TODAS LAS TAREAS
// =========================
export const getTasks = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM tasks ORDER BY created_at DESC`
    );
    res.json({ tasks: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener tareas" });
  }
};

// =========================
// OBTENER TAREA POR ID
// =========================
export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`SELECT * FROM tasks WHERE id = ?`, [id]);
    if (rows.length === 0) return res.status(404).json({ message: "Tarea no encontrada" });
    res.json({ task: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener tarea" });
  }
};

// =========================
// OBTENER TAREAS POR CROP
// =========================

export const getTasksByCropId = async (req, res) => {
  try {
    const { cropId } = req.params;
    const { type = "", description = "", page = 1, limit = 10 } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    // --- FILTROS DINÁMICOS ---
    const filters = ["t.crop_id = ?"];
    const params = [cropId];

    // FILTRAR POR ID DEL TIPO DE TAREA
    if (type) {
      filters.push("t.task_type_id = ?");
      params.push(Number(type));
    }

    if (description) {
      filters.push("t.description LIKE ?");
      params.push(`%${description}%`);
    }

    const whereClause = "WHERE " + filters.join(" AND ");

    // --- QUERY PRINCIPAL (PAGINADA) ---
    const [tasks] = await pool.query(
      `
      SELECT 
        t.*, 
        ct.performed_at, 
        ct.note,
        tt.name AS type
      FROM tasks t
      LEFT JOIN crop_tasks ct ON ct.task_id = t.id
      LEFT JOIN task_types tt ON tt.id = t.task_type_id
      ${whereClause}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    const taskIds = tasks.map(t => t.id);
    let suppliesByTask = {};

    // --- SUPPLIES ---
    if (taskIds.length > 0) {
      const [supplies] = await pool.query(
        `
        SELECT 
          ts.task_id,
          ts.supply_id,
          ts.stock_id,
          COALESCE(s.name, st.name) AS supply_name,
          COALESCE(sc.name, sct.name) AS category_name,
          COALESCE(s.unit, st.unit) AS unit,
          COALESCE(s.price_per_unit, st.price_per_unit) AS price_per_unit,
          ts.dose_per_ha,
          ts.hectares,
          ts.total_used,
          CASE WHEN ts.stock_id IS NOT NULL THEN 1 ELSE 0 END AS from_stock
        FROM task_supplies ts
        LEFT JOIN supplies s ON s.id = ts.supply_id
        LEFT JOIN supply_category sc ON sc.id = s.category_id
        LEFT JOIN stock st ON st.id = ts.stock_id
        LEFT JOIN supply_category sct ON sct.id = st.category_id
        WHERE ts.task_id IN (${taskIds.map(() => '?').join(',')})
        `,
        taskIds
      );

      supplies.forEach(s => {
        if (!suppliesByTask[s.task_id]) suppliesByTask[s.task_id] = [];
        suppliesByTask[s.task_id].push({
          supply_id: s.supply_id,
          stock_id: s.stock_id,
          supply_name: s.supply_name,
          category_name: s.category_name,
          unit: s.unit,
          price_per_unit: s.price_per_unit,
          dose_per_ha: s.dose_per_ha,
          hectares: s.hectares,
          total_used: s.total_used,
          from_stock: Boolean(s.from_stock)
        });
      });
    }

    const tasksWithSupplies = tasks.map(task => ({
      ...task,
      supplies: suppliesByTask[task.id] || []
    }));

    // --- CONTADOR ---
    const [countRows] = await pool.query(
      `
      SELECT COUNT(*) AS total 
      FROM tasks t 
      LEFT JOIN task_types tt ON tt.id = t.task_type_id
      ${whereClause}
      `,
      params
    );

    const total = countRows[0].total;
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages,
      tasks: tasksWithSupplies
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener tareas del cultivo" });
  }
};



// =========================
// CREAR TAREA
// =========================
export const createOrUpdateTask = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;
    const {
      crop_id,
      task_type_id,
      description,
      provider,
      performed_at,
      note,
      laborCost = 0,
      supplies = [],
    } = req.body;

    if (!crop_id || !task_type_id || !description || !performed_at) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    await connection.beginTransaction();

    // Calcular total_price
    let total_price = 0;
    for (const s of supplies) {
      const total_used = s.dose_per_ha * s.hectares;

      if (s.supply_id) {
        const [rows] = await connection.query(
          "SELECT price_per_unit FROM supplies WHERE id = ?",
          [s.supply_id]
        );
        total_price += rows[0]?.price_per_unit * total_used || 0;
      }

      if (s.stock_id) {
        const [rows] = await connection.query(
          "SELECT price_per_unit FROM stock WHERE id = ?",
          [s.stock_id]
        );
        total_price += rows[0]?.price_per_unit * total_used || 0;
      }
    }

    total_price += Number(laborCost);

    let taskId;

    if (id) {
      // === UPDATE ===
      await connection.query(
        `UPDATE tasks 
         SET task_type_id = ?, description = ?, provider = ?, total_price = ?, laborCost = ?, date = ?
         WHERE id = ?`,
        [
          task_type_id,
          description,
          provider || null,
          total_price,
          laborCost,
          performed_at,
          id,
        ]
      );

      taskId = id;

      // Limpiar los supplies previos
      await connection.query(`DELETE FROM task_supplies WHERE task_id = ?`, [
        taskId,
      ]);

      // Actualizar crop_tasks
      await connection.query(
        `UPDATE crop_tasks 
         SET performed_at = ?, note = ? 
         WHERE task_id = ?`,
        [performed_at, note || null, taskId]
      );
    } else {
      // === CREATE ===
      const [taskResult] = await connection.query(
        `INSERT INTO tasks (crop_id, task_type_id, description, provider, total_price, laborCost, date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          crop_id,
          task_type_id,
          description,
          provider || null,
          total_price,
          laborCost,
          performed_at,
        ]
      );

      taskId = taskResult.insertId;

      await connection.query(
        `INSERT INTO crop_tasks (crop_id, task_id, performed_at, note)
         VALUES (?, ?, ?, ?)`,
        [crop_id, taskId, performed_at, note || null]
      );
    }

    // Insertar task_supplies
    for (const s of supplies) {
      const total_used = s.dose_per_ha * s.hectares;

      await connection.query(
        `INSERT INTO task_supplies (task_id, supply_id, stock_id, dose_per_ha, hectares, total_used)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          s.supply_id || null,
          s.stock_id || null,
          s.dose_per_ha,
          s.hectares,
          total_used,
        ]
      );
    }

    await connection.commit();

    res.json({
      message: id
        ? "Tarea actualizada correctamente"
        : "Tarea creada correctamente",
      task_id: taskId,
      total_price,
      laborCost,
    });
  } catch (err) {
    await connection.rollback();
    console.error("Error en createOrUpdateTask:", err);
    res
      .status(500)
      .json({ message: err.message || "Error al crear/actualizar tarea" });
  } finally {
    connection.release();
  }
};

// =========================
// ELIMINAR TAREA (lógica o física)
// =========================
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminación lógica: cambiar status a 'inactive'
    await pool.query(`UPDATE tasks SET status = 'inactive' WHERE id = ?`, [id]);

    // Si prefieres eliminación física, usa:
    // await pool.query(`DELETE FROM tasks WHERE id = ?`, [id]);

    res.json({ message: "Tarea eliminada correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar tarea" });
  }
};
