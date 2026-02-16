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

    const filters = ["t.crop_id = ?", "t.status = 'active'"];
    const params = [cropId];

    if (type) {
      filters.push("t.task_type_id = ?");
      params.push(Number(type));
    }

    if (description) {
      filters.push("t.description LIKE ?");
      params.push(`%${description}%`);
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;

    // =========================
    // TASKS
    // =========================
    const [tasks] = await pool.query(
      `
      SELECT
        t.id,
        t.crop_id,
        t.task_type_id,
        t.provider_id,
        t.description,
        t.total_price,
        t.laborCost,
        t.date,
        t.status,
        t.note,  
        t.created_at,
        t.updated_at,

        ct.performed_at,

        tt.name AS type,

        p.name AS provider_name
      FROM tasks t
      LEFT JOIN crop_tasks ct ON ct.task_id = t.id
      LEFT JOIN task_types tt ON tt.id = t.task_type_id
      LEFT JOIN providers p ON p.id = t.provider_id
      ${whereClause}
      ORDER BY t.date ASC, t.created_at ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limitNum, offset]
    );

    const taskIds = tasks.map(t => t.id);
    const suppliesByTask = {};

    // =========================
    // SUPPLIES
    // =========================
    if (taskIds.length > 0) {
      const [supplies] = await pool.query(
        `
        SELECT
          ts.task_id,
          ts.supply_id,
          ts.stock_id,
          s.master_supply_id,
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
        WHERE ts.task_id IN (${taskIds.map(() => "?").join(",")})
        `,
        taskIds
      );

      for (const s of supplies) {
        if (!suppliesByTask[s.task_id]) suppliesByTask[s.task_id] = [];
        suppliesByTask[s.task_id].push({
          supply_id: s.supply_id,
          master_supply_id: s.master_supply_id,
          stock_id: s.stock_id,
          supply_name: s.supply_name,
          category_name: s.category_name,
          unit: s.unit,
          price_per_unit: s.price_per_unit,
          dose_per_ha: s.dose_per_ha,
          hectares: s.hectares,
          total_used: s.total_used,
          from_stock: Boolean(s.from_stock),
        });
      }
    }

    const tasksWithSupplies = tasks.map(task => ({
      ...task,
      supplies: suppliesByTask[task.id] || [],
    }));

    // =========================
    // COUNT
    // =========================
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM tasks t ${whereClause}`,
      params
    );

    res.json({
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
      tasks: tasksWithSupplies,
    });
  } catch (err) {
    console.error("Error getTasksByCropId:", err);
    res.status(500).json({ message: "Error al obtener tareas del cultivo" });
  }
};






// =========================
// CREAR TAREA
// =========================
export const createOrUpdateTask = async (req, res) => {
  const connection = await pool.getConnection();

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "No autorizado" });
  }

  try {
    const { id } = req.params;
    const {
      crop_id,
      task_type_id,
      provider_id,
      description,
      performed_at,
      note,
      laborCost = 0,
      supplies = [],
    } = req.body;

    if (!crop_id || !task_type_id || !performed_at) {
      return res.status(400).json({ message: "Faltan datos obligatorios" });
    }

    if (provider_id) {
      const [[provider]] = await connection.query(
        `SELECT id FROM providers WHERE id = ? AND userId = ?`,
        [provider_id, userId]
      );

      if (!provider) {
        return res.status(400).json({
          message: "Proveedor inválido o no pertenece al usuario",
        });
      }
    }

    await connection.beginTransaction();

    // ===============================
    // 1) Calcular total_price
    // ===============================
    let total_price = 0;

    for (const s of supplies) {
      const total_used = s.dose_per_ha * s.hectares;

      let priceRow;
      if (s.supply_id) {
        [[priceRow]] = await connection.query(
          "SELECT price_per_unit FROM supplies WHERE id = ?",
          [s.supply_id]
        );
      } else if (s.stock_id) {
        [[priceRow]] = await connection.query(
          "SELECT price_per_unit FROM stock WHERE id = ?",
          [s.stock_id]
        );
      }

      if (priceRow) {
        total_price += priceRow.price_per_unit * total_used;
      }
    }

    total_price += Number(laborCost);

    let taskId;

    // ===============================
    // 2) UPDATE
    // ===============================
    if (id) {
      const [updateResult] = await connection.query(
        `UPDATE tasks 
     SET task_type_id = ?, provider_id = ?, description = ?, total_price = ?, laborCost = ?, date = ?, note = ?, user_id = ?
     WHERE id = ?`,
        [
          task_type_id,
          provider_id || null,
          description,
          total_price,
          laborCost,
          performed_at,
          note || null,
          userId,  // actualizamos el user_id
          id
        ]
      );

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          message: "Tarea no encontrada o no se pudo actualizar"
        });
      }
      taskId = id;
    } else {
      const [taskResult] = await connection.query(
        `INSERT INTO tasks 
   (user_id, crop_id, task_type_id, provider_id, description, total_price, laborCost, date, note)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          crop_id,
          task_type_id,
          provider_id || null,
          description,
          total_price,
          laborCost,
          performed_at,
          note || null,  // <-- aquí agregamos la nota
        ]
      );

      taskId = taskResult.insertId;

      await connection.query(
        `INSERT INTO crop_tasks (crop_id, task_id, performed_at, note)
         VALUES (?, ?, ?, ?)`,
        [crop_id, taskId, performed_at, note || null]
      );
    }

    // ===============================
    // 4) Insertar task_supplies
    // ===============================
    for (const s of supplies) {
      const total_used = s.dose_per_ha * s.hectares;

      await connection.query(
        `INSERT INTO task_supplies 
      (task_id, supply_id, stock_id, dose_per_ha, hectares, total_used, price_per_unit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          s.supply_id || null,
          s.stock_id || null,
          s.dose_per_ha,
          s.hectares,
          total_used,
          s.price_per_unit ?? 0,
        ]
      );
    }


    // ===============================
    // 5) COMMIT
    // ===============================
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
    res.status(500).json({
      message: err.message || "Error al crear/actualizar tarea",
    });
  } finally {
    connection.release();
  }
};


// =========================
// ELIMINAR TAREA (lógica o física)
// =========================
export const deleteTask = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { cropId, id: taskId } = req.params;

    await connection.beginTransaction();

    // 1️⃣ Validar que la tarea pertenece al cultivo (opcional pero recomendado)
    const [[task]] = await connection.query(
      `SELECT id FROM tasks WHERE id = ? AND crop_id = ? AND status = 'active'`,
      [taskId, cropId]
    );

    if (!task) {
      await connection.rollback();
      return res.status(404).json({
        message: "La tarea no existe o no pertenece a este cultivo"
      });
    }

    // 2️⃣ Eliminar suministros asociados a la tarea
    await connection.query(
      `DELETE FROM task_supplies WHERE task_id = ?`,
      [taskId]
    );

    // 3️⃣ Eliminar relación con cultivo
    await connection.query(
      `DELETE FROM crop_tasks WHERE task_id = ?`,
      [taskId]
    );

    // 4️⃣ Borrado lógico de la tarea
    await connection.query(
      `UPDATE tasks SET status = 'inactive' WHERE id = ?`,
      [taskId]
    );

    await connection.commit();

    res.json({ message: "Tarea eliminada correctamente" });

  } catch (err) {
    await connection.rollback();
    console.error("Error en deleteTask:", err);
    res.status(500).json({ message: "Error al eliminar tarea" });
  } finally {
    connection.release();
  }
};

