import { pool } from "../db/connection.js";

// ==========================
// Obtener gastos variables
// ==========================
export const getVariableExpenses = async (req, res) => {
  try {
    const userId = req.user.id;
    const { campaignId, page = "1" } = req.query;

    const pageNumber = Math.max(1, parseInt(page, 10));
    const pageSize = 5; // cantidad de LOTES por página
    const offset = (pageNumber - 1) * pageSize;

    /* ======================================================
       1️⃣ Obtener lotes paginados con nombre
    ====================================================== */
    const lotParams = [userId];
    let lotQuery = `
      SELECT DISTINCT ve.lot_id, l.name AS lot_name
      FROM variable_expenses ve
      INNER JOIN lots l ON ve.lot_id = l.id
      WHERE ve.user_id = ?
        AND ve.deleted_at IS NULL
    `;

    if (campaignId) {
      lotQuery += ` AND ve.campaign_id = ?`;
      lotParams.push(Number(campaignId));
    }

    lotQuery += `
      ORDER BY ve.lot_id
      LIMIT ? OFFSET ?
    `;
    lotParams.push(pageSize, offset);

    const [lots] = await pool.query(lotQuery, lotParams);
    const lotIds = lots.map(l => l.lot_id);

    /* ======================================================
       2️⃣ Obtener gastos de esos lotes
    ====================================================== */
    let expenses = [];
    if (lotIds.length > 0) {
      const [rows] = await pool.query(
        `
        SELECT 
          ve.*,
          et.name AS expense_type_name
        FROM variable_expenses ve
        LEFT JOIN expense_types et ON ve.expense_type_id = et.id
        WHERE ve.user_id = ?
          AND ve.deleted_at IS NULL
          AND ve.lot_id IN (?)
        ORDER BY ve.lot_id ASC, ve.expense_date DESC
        `,
        [userId, lotIds]
      );
      expenses = rows;
    }

    /* ======================================================
       3️⃣ Agrupar gastos por lote, incluyendo nombre
    ====================================================== */
    const groupedByLot = lots.map(lot => {
      const lotExpenses = expenses
        .filter(e => e.lot_id === lot.lot_id)
        .map(e => ({ ...e, lotName: lot.lot_name })); // ✅ agregamos lotName a cada gasto

      return {
        lotId: lot.lot_id,
        lotName: lot.lot_name,
        expenses: lotExpenses
      };
    });

    /* ======================================================
       4️⃣ Contar total de lotes para paginación
    ====================================================== */
    const countParams = [userId];
    let countQuery = `
      SELECT COUNT(DISTINCT lot_id) AS total
      FROM variable_expenses
      WHERE user_id = ?
        AND deleted_at IS NULL
    `;
    if (campaignId) {
      countQuery += ` AND campaign_id = ?`;
      countParams.push(Number(campaignId));
    }
    const [countRows] = await pool.query(countQuery, countParams);
    const totalLots = countRows[0].total;

    /* ======================================================
       5️⃣ Respuesta final
    ====================================================== */
    res.status(200).json({
      data: groupedByLot,
      pagination: {
        page: pageNumber,
        pageSize,
        total: totalLots,
        totalPages: Math.ceil(totalLots / pageSize)
      }
    });

  } catch (error) {
    console.error("getVariableExpensesGroupedByLot error:", error);
    res.status(500).json({
      message: "Error al obtener gastos variables agrupados por lote"
    });
  }
};




// ==========================
// Crear o actualizar gasto variable
// ==========================
export const createOrUpdateVariableExpense = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      id,
      campaign_id,
      lot_id,
      hectares,
      tons_harvested,
      expense_type_id,
      provider,
      expense_date,
      amount
    } = req.body;

    // Validaciones mínimas
    if (!campaign_id || !lot_id || !hectares || !expense_type_id || !expense_date || !amount) {
      return res.status(400).json({
        message: "Faltan campos obligatorios"
      });
    }

    // ==========================
    // UPDATE
    // ==========================
    if (id) {
      const [result] = await pool.query(
        `
        UPDATE variable_expenses
        SET
          campaign_id = ?,
          lot_id = ?,
          hectares = ?,
          tons_harvested = ?,
          expense_type_id = ?,
          provider = ?,
          expense_date = ?,
          amount = ?
        WHERE id = ?
          AND user_id = ?
          AND deleted_at IS NULL
        `,
        [
          campaign_id,
          lot_id,
          hectares,
          tons_harvested || null,
          expense_type_id,
          provider || null,
          expense_date,
          amount,
          id,
          userId
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          message: "Gasto no encontrado o no autorizado"
        });
      }

      return res.json({ message: "Gasto variable actualizado correctamente" });
    }

    // ==========================
    // CREATE
    // ==========================
    const [result] = await pool.query(
      `
      INSERT INTO variable_expenses
      (
        user_id,
        campaign_id,
        lot_id,
        hectares,
        tons_harvested,
        expense_type_id,
        provider,
        expense_date,
        amount
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        campaign_id,
        lot_id,
        hectares,
        tons_harvested || null,
        expense_type_id,
        provider || null,
        expense_date,
        amount
      ]
    );

    const [rows] = await pool.query(
      `
      SELECT *
      FROM variable_expenses
      WHERE id = ?
      `,
      [result.insertId]
    );

    res.status(201).json({ variableExpense: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al crear/actualizar gasto variable" });
  }
};

// ==========================
// Borrado lógico de gasto variable
// ==========================
export const deleteVariableExpense = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const [result] = await pool.query(
      `
      UPDATE variable_expenses
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND user_id = ?
        AND deleted_at IS NULL
      `,
      [id, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Gasto no encontrado o ya eliminado"
      });
    }

    res.json({ message: "Gasto variable eliminado correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar gasto variable" });
  }
};


//Lotes para crear gastos variables

// ==========================
// Lotes con cultivos cosechados por campaña
// ==========================
export const getLotsForVariableExpensesByCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { campaignId } = req.params;

    if (!campaignId) {
      return res.status(400).json({
        message: "Falta el ID de la campaña"
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        l.id              AS lot_id,
        l.name            AS lot_name,
        l.hectares        AS lot_hectares,
        l.location        AS lot_location,

        c.id              AS crop_id,
        cn.name           AS crop_name,
        c.real_yield,
        c.expected_yield,
        c.start_date,
        c.end_date

      FROM crops c
      INNER JOIN lots l
        ON l.id = c.lot_id
      INNER JOIN campaigns ca
        ON ca.id = c.campaign_id
      INNER JOIN crop_name cn
        ON cn.id = c.crop_name_id

      WHERE
        c.campaign_id = ?
        AND c.userId = ?
        AND c.real_yield IS NOT NULL
        AND c.status = 'active'
        AND l.status = 'active'
        AND ca.status = 'active'

      ORDER BY l.name ASC
      `,
      [campaignId, userId]
    );

    res.json({ lots: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al obtener lotes con cultivos cosechados"
    });
  }
};