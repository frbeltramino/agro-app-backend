import path from "path";
import { fileURLToPath } from "url";
import { pool } from "../db/connection.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getReportByCampaign = async (req, res) => {
  const userId = req.user?.id;
  const campaignId = req.query.campaign_id;

  try {
    // 1️⃣ Obtener datos
    const lots = await getCrops(userId, campaignId);
    const deliveriesAndSales = await getSeedDeliveriesAndSalesByCampaign(userId, campaignId);
    const variableExpenses = await getVariableExpensesByCampaign(userId, campaignId);

    // 2️⃣ Obtener labors and supplies por cultivo
    const laborsAndSupplies = [];
    for (const lot of lots) {
      for (const crop of lot.crops) {
        const tasksByCropId = await getTasksByCropId(crop.crop_id, userId);
        if (tasksByCropId.length > 0) {
          tasksByCropId.forEach(task => {
            laborsAndSupplies.push({
              ...task,
              crop_id: crop.crop_id,
              supplies: task.supplies || [],
            });
          });
        }
      }
    }

    // 3️⃣ Agrupar todo por lote y cultivo
    const groupedData = lots.map(lot => {
      const lotVariableExpenses = variableExpenses.find(v => v.lotId === lot.lot_id)?.expenses || [];

      return {
        ...lot,
        crops: lot.crops.map(crop => {
          // Labores e insumos para este cultivo
          const cropLabors = laborsAndSupplies.filter(l => l.crop_id === crop.crop_id);

          // Gastos variables para este cultivo
          const cropExpenses = lotVariableExpenses.filter(e => e.crop_id === crop.crop_id);

          // Entregas y ventas usando crop_name_id
          const cropDeliveriesAndSales = deliveriesAndSales.crops.find(
            c => c.crop_name_id === crop.crop_name_id
          );

          const cropDeliveries = cropDeliveriesAndSales?.seed_deliveries || [];
          const cropSales = cropDeliveriesAndSales?.seed_sales || [];

          return {
            ...crop,
            laborsAndSupplies: cropLabors,
            variableExpenses: cropExpenses,
            deliveries: cropDeliveries,
            sales: cropSales
          };
        })
      };
    });

    // 4️⃣ Retornar la nueva estructura lista para PDF
    res.json(groupedData);

  } catch (err) {
    console.error("Error obteniendo datos de campaña:", err);
    res.status(500).json({ message: "Error obteniendo datos de campaña" });
  }
};

export const getCrops = async (userId, campaignId) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        cr.id AS crop_id,
        cr.lot_id,
        l.name AS lot_name,
        l.hectares,
        cr.crop_name_id,
        cn.name AS crop_name,
        cr.seed_type,
        cr.real_yield,
        cr.start_date,
        cr.end_date
      FROM crops cr
      JOIN lots l ON l.id = cr.lot_id
      JOIN crop_name cn ON cn.id = cr.crop_name_id
      WHERE cr.userId = ? 
        AND cr.campaign_id = ? 
        AND cr.status = 'active'
        AND l.status = 'active'   -- 🔹 solo lotes activos
      ORDER BY l.name, cr.start_date DESC
    `, [userId, campaignId]);

    // Agrupar cultivos por lote
    const lotsMap = {};
    rows.forEach(row => {
      if (!lotsMap[row.lot_id]) {
        lotsMap[row.lot_id] = {
          lot_id: row.lot_id,
          lot_name: row.lot_name,
          hectares: row.hectares,
          crops: [],
        };
      }
      lotsMap[row.lot_id].crops.push({
        crop_id: row.crop_id,
        crop_name_id: row.crop_name_id,
        crop_name: row.crop_name,
        seed_type: row.seed_type,
        real_yield: row.real_yield,
        start_date: row.start_date,
        end_date: row.end_date,
      });
    });

    // Retornar como array
    return Object.values(lotsMap);
  } catch (err) {
    console.error("Error obteniendo cultivos:", err);
    throw err;
  }
};

export const getTasksByCropId = async (cropId, userId) => {
  try {
    // =========================
    // OBTENER TAREAS
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
      WHERE t.crop_id = ? AND t.status = 'active'
      ORDER BY t.date ASC, t.created_at ASC
      `,
      [cropId]
    );

    if (tasks.length === 0) return []; // No hay tareas para este cultivo

    // =========================
    // OBTENER INSUMOS DE LAS TAREAS
    // =========================
    const taskIds = tasks.map(t => t.id);

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

    // =========================
    // AGRUPAR INSUMOS POR TAREA
    // =========================
    const suppliesByTask = {};
    for (const s of supplies) {
      if (!suppliesByTask[s.task_id]) suppliesByTask[s.task_id] = [];

      // Evitar duplicados exactos (mismo supply + stock)
      const exists = suppliesByTask[s.task_id].some(
        x => x.supply_name === s.supply_name && x.stock_id === s.stock_id
      );
      if (!exists) {
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

    // =========================
    // COMBINAR TAREAS CON SUS INSUMOS
    // =========================
    return tasks.map(task => ({
      ...task,
      supplies: suppliesByTask[task.id] || [],
    }));

  } catch (err) {
    console.error("Error getTasksByCropId:", err);
    throw err;
  }
};


export const getSeedDeliveriesAndSalesByCampaign = async (userId, campaignId) => {
  if (!userId) throw new Error("Usuario no autenticado");
  if (!campaignId) throw new Error("Se requiere campaignId");

  try {
    /* ============================
       DELIVERIES
    ============================ */
    const [deliveries] = await pool.query(
      `
      SELECT
        sd.id AS seed_delivery_id,
        sd.userId,
        sd.campaign_id,
        c.name AS campaign_name,
        sd.crop_name_id,
        cn.name AS crop_name,
        sd.tn_sold,
        sd.tn_delivered,
        sd.waybill_number,
        sd.destination,
        sd.status,
        sd.delivery_date,
        sd.deleted_at,
        sd.created_at,
        sd.updated_at
      FROM seed_deliveries sd
      JOIN campaigns c ON c.id = sd.campaign_id
      JOIN crop_name cn ON cn.id = sd.crop_name_id
      WHERE sd.campaign_id = ?
        AND sd.deleted_at IS NULL
        AND sd.status != 'canceled'
        AND sd.userId = ?
        AND EXISTS (
          SELECT 1
          FROM crops cr
          WHERE cr.crop_name_id = sd.crop_name_id
            AND cr.campaign_id = sd.campaign_id
            AND cr.userId = sd.userId
            AND cr.status = 'active'
        )
      ORDER BY sd.delivery_date ASC
      `,
      [campaignId, userId]
    );

    /* ============================
       SALES
    ============================ */
    const [sales] = await pool.query(
      `
      SELECT
        ss.id AS seed_sale_id,
        ss.userId,
        ss.campaign_id,
        c.name AS campaign_name,
        ss.crop_name_id,
        cn.name AS crop_name,
        ss.primary_liquidation_number,
        ss.destination,
        ss.tn_sold,
        ss.price_per_tn,
        ss.sale_date,
        ss.deleted_at,
        ss.created_at,
        ss.updated_at
      FROM seed_sales ss
      JOIN campaigns c ON c.id = ss.campaign_id
      JOIN crop_name cn ON cn.id = ss.crop_name_id
      WHERE ss.campaign_id = ?
        AND ss.deleted_at IS NULL
        AND ss.userId = ?
      ORDER BY ss.sale_date ASC
      `,
      [campaignId, userId]
    );

    /* ============================
       AGRUPACIÓN POR CULTIVO
    ============================ */
    const cropsMap = {};

    const ensureCrop = (row) => {
      if (!cropsMap[row.crop_name_id]) {
        cropsMap[row.crop_name_id] = {
          userId: row.userId,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          crop_name_id: row.crop_name_id,
          crop_name: row.crop_name,
          seed_deliveries: [],
          seed_sales: []
        };
      }
      return cropsMap[row.crop_name_id];
    };

    deliveries.forEach(row => {
      const crop = ensureCrop(row);
      crop.seed_deliveries.push({
        id: row.seed_delivery_id,
        tn_sold: row.tn_sold,
        tn_delivered: row.tn_delivered,
        waybill_number: row.waybill_number,
        destination: row.destination,
        status: row.status,
        delivery_date: row.delivery_date,
        deleted_at: row.deleted_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    });

    sales.forEach(row => {
      const crop = ensureCrop(row);
      crop.seed_sales.push({
        id: row.seed_sale_id,
        primary_liquidation_number: row.primary_liquidation_number,
        destination: row.destination,
        tn_sold: row.tn_sold,
        price_per_tn: row.price_per_tn,
        sale_date: row.sale_date,
        deleted_at: row.deleted_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    });

    const crops = Object.values(cropsMap);

    // 🔹 Retornar datos en lugar de hacer res.json
    return { campaign_id: campaignId, crops };

  } catch (err) {
    console.error(err);
    throw new Error("Error al obtener envíos y ventas por campaña");
  }
};

export const getVariableExpensesByCampaign = async (userId, campaignId) => {
  if (!userId) throw new Error("Usuario no autenticado");
  if (!campaignId) throw new Error("Se requiere campaignId");

  /* ======================================================
     1️⃣ Obtener todos los lotes de la campaña con gastos
  ====================================================== */
  const [lots] = await pool.query(
    `
    SELECT DISTINCT ve.lot_id, l.name AS lot_name
    FROM variable_expenses ve
    INNER JOIN lots l ON ve.lot_id = l.id
    WHERE ve.user_id = ?
      AND ve.campaign_id = ?
      AND ve.deleted_at IS NULL
    ORDER BY ve.lot_id
    `,
    [userId, campaignId]
  );

  const lotIds = lots.map(l => l.lot_id);

  /* ======================================================
     2️⃣ Obtener todos los gastos de esos lotes
  ====================================================== */
  let expenses = [];
  if (lotIds.length > 0) {
    const [rows] = await pool.query(
      `
      SELECT 
        ve.*,
        et.name AS expense_type_name,
        c.id AS crop_id,
        cn.name AS crop_name
      FROM variable_expenses ve
      LEFT JOIN expense_types et ON ve.expense_type_id = et.id
      LEFT JOIN crops c ON ve.crop_id = c.id
      LEFT JOIN crop_name cn ON c.crop_name_id = cn.id
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
     3️⃣ Agrupar gastos por lote
  ====================================================== */
  const groupedByLot = lots.map(lot => {
    const lotExpenses = expenses
      .filter(e => e.lot_id === lot.lot_id)
      .map(e => ({ ...e, lotName: lot.lot_name }));

    return {
      lotId: lot.lot_id,
      lotName: lot.lot_name,
      expenses: lotExpenses
    };
  });

  return groupedByLot;
};