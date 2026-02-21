import { pool } from "../db/connection.js";

import {
  emptyLot,
} from "../utils/lotsStats.utils.js";


const DEFAULTS = {
  PRECIO_POR_UNIDAD: 0,
  COSTO_VARIABLE: 0,
  MARGEN_BRUTO: 0,
};

export const getLotsStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    const campaignId = req.query.campaign_id;

    if (!campaignId) {
      return res.status(400).json({ message: "campaign_id es requerido" });
    }

    const lots = await getLotsByCampaign(pool, campaignId);
    if (!lots.length) return res.json({ lotes: [] });

    const lotIds = lots.map(l => l.id);
    const crops = await getActiveCropsByLots(pool, lotIds, userId);
    if (!crops.length) {
      return res.json({ lotes: lots.map(emptyLot) });
    }

    const cropIds = crops.map(c => c.id);
    const cropTasks = await getCropTasks(pool, cropIds);
    if (!cropTasks.length) {
      return res.json({ lotes: lots.map(emptyLot) });
    }

    const taskIds = cropTasks.map(ct => ct.task_id);
    const [tasks, supplies] = await Promise.all([
      getTasks(pool, taskIds),
      getSupplies(pool, taskIds),
    ]);

    const cropPricesMap = await getAverageSalePricePerCrop(pool, campaignId, userId);

    const variableExpensesMap = await getVariableExpenseByCrops(pool, cropIds);

    const lotStats = lots.map(lot => {

      const cropsInLot = crops.filter(c => c.lot_id === lot.id);

      const cultivos = cropsInLot.map(crop =>
        calculateCropStats({
          lot,
          crop,
          tasks,
          supplies,
          defaults: DEFAULTS,
          cropPricesMap,
          variableExpensesMap,
        })
      );

      return {
        id: lot.id,
        lote: lot.name,
        superficieHa: Number(lot.hectares.toFixed(2)),
        cultivos,
      };
    });

    res.json({ lotes: lotStats });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener estadísticas de lotes" });
  }
};

export const calculateCropStats = ({
  lot,
  crop,
  tasks,
  supplies,
  defaults,
  cropPricesMap,
  variableExpensesMap,
}) => {

  const HARVEST_TASK_TYPE_ID = 5;
  const SEED_CATEGORY_ID = 5;

  const tasksOfCrop = tasks.filter(t => t.crop_id === crop.id);

  let cosechaLaboresTotal = 0;
  let otrasLaboresTotal = 0;

  tasksOfCrop.forEach(t => {
    const costo = t.laborCost || 0;
    if (Number(t.task_type_id) === HARVEST_TASK_TYPE_ID) {
      cosechaLaboresTotal += costo;
    } else {
      otrasLaboresTotal += costo;
    }
  });

  const laboresTotal = cosechaLaboresTotal + otrasLaboresTotal;

  // Supplies
  const taskIds = new Set(tasksOfCrop.map(t => t.id));
  const suppliesOfCrop = supplies.filter(s => taskIds.has(s.task_id));

  let semillasTotal = 0;
  let otrosInsumosTotal = 0;

  suppliesOfCrop.forEach(s => {
    const costo = (s.total_used || 0) * (s.price_per_unit || 0);
    if (s.category_id === SEED_CATEGORY_ID) {
      semillasTotal += costo;
    } else {
      otrosInsumosTotal += costo;
    }
  });

  const insumosTotal = semillasTotal + otrosInsumosTotal;

  // 🔹 Ingresos con precio ponderado
  const cosecha = crop.real_yield || 0;
  const precioPromedioPonderado = cropPricesMap[crop.crop_name_id] || 0;
  const ingresos = cosecha * precioPromedioPonderado;

  // 🔹 Costo variable por hectárea
  const costoVariable = variableExpensesMap[crop.id]?.expense_per_ha || 0;


  const margenBruto = ingresos - insumosTotal - laboresTotal - (costoVariable * lot.hectares);

  return {
    cropId: crop.id,
    cropName: crop.crop_name,
    lotId: lot.id,

    cosecha: Number(cosecha.toFixed(2)),
    ingresos: Number(ingresos.toFixed(2)),

    // Insumos
    semillas: Number(semillasTotal.toFixed(2)),
    insumosSinSemillas: Number(otrosInsumosTotal.toFixed(2)),
    insumos: Number(insumosTotal.toFixed(2)),

    // Labores
    cosechaLabores: Number(cosechaLaboresTotal.toFixed(2)),
    otrasLabores: Number(otrasLaboresTotal.toFixed(2)),
    labores: Number(laboresTotal.toFixed(2)),

    costoVariable: Number(costoVariable.toFixed(2)),
    margenBruto: Number(margenBruto.toFixed(2)),

    // 🔹 Precio promedio ponderado
    precioPromedioPonderado: Number(precioPromedioPonderado.toFixed(2)),
  };
};



export const getLotsByCampaign = async (pool, campaignId) => {
  const [rows] = await pool.query(
    `SELECT id, name, hectares 
     FROM lots 
     WHERE campaign_id = ? AND status = 'active'`,
    [campaignId]
  );
  return rows;
};

export const getActiveCropsByLots = async (pool, lotIds, userId) => {
  const [rows] = await pool.query(
    `
    SELECT 
      c.id,
      c.lot_id,
      c.crop_name_id,
      cn.name AS crop_name,
      c.real_yield
    FROM crops c
    INNER JOIN crop_name cn 
      ON cn.id = c.crop_name_id
    WHERE c.lot_id IN (?) 
      AND c.userId = ?
      AND c.status = 'active'
    `,
    [lotIds, userId]
  );

  return rows;
};

export const getCropTasks = async (pool, cropIds) => {
  const [rows] = await pool.query(
    `SELECT crop_id, task_id 
     FROM crop_tasks 
     WHERE crop_id IN (?)`,
    [cropIds]
  );
  return rows;
};

export const getTasks = async (pool, taskIds) => {
  const [rows] = await pool.query(
    `SELECT id, crop_id, laborCost, task_type_id
     FROM tasks
     WHERE id IN (?) AND status = 'active'`,
    [taskIds]
  );
  return rows;
};

export const getSupplies = async (pool, taskIds) => {
  const [rows] = await pool.query(
    `
    SELECT 
      ts.task_id,
      ts.total_used,
      ts.price_per_unit,

      COALESCE(sc_supply.id, sc_stock.id)   AS category_id,
      COALESCE(sc_supply.name, sc_stock.name, 'Sin categoría') AS category_name

    FROM task_supplies ts

    LEFT JOIN supplies s 
      ON s.id = ts.supply_id

    LEFT JOIN stock st 
      ON st.id = ts.stock_id

    LEFT JOIN supply_category sc_supply 
      ON sc_supply.id = s.category_id

    LEFT JOIN supply_category sc_stock 
      ON sc_stock.id = st.category_id

    WHERE ts.task_id IN (?)
    `,
    [taskIds]
  );

  return rows;
};

export const getAverageSalePricePerCrop = async (pool, campaignId, userId) => {
  const [rows] = await pool.query(
    `SELECT 
        crop_name_id,
        SUM(tn_sold * price_per_tn) / SUM(tn_sold) AS avg_price_per_tn
     FROM seed_sales
     WHERE campaign_id = ? 
       AND userId = ?
       AND deleted_at IS NULL
     GROUP BY crop_name_id`,
    [campaignId, userId]
  );

  // Devuelve un objeto { [crop_name_id]: avg_price }
  const pricesMap = {};
  for (const row of rows) {
    pricesMap[row.crop_name_id] = row.avg_price_per_tn;
  }
  return pricesMap;
};


// necesito que se haga lo siguiente por cada registro
// amount = USDxtn
// amount x tnxha = USDxha
// USDxha | hectares
// traducido 
// es el monto por tonelada X las toneladas cosechadas dividido las hectareas del lote
// 

const getVariableExpenseByCrops = async (pool, cropIds) => {
  if (!cropIds.length) return {};

  const [rows] = await pool.query(
    `
    SELECT
      crop_id,
      SUM(amount) AS total_expense,
      (SUM(amount) * SUM(tons_harvested)) / SUM(hectares) AS expense_per_ha
    FROM variable_expenses
    WHERE deleted_at IS NULL
      AND tons_harvested > 0
      AND hectares > 0
      AND crop_id IN (?)
    GROUP BY crop_id
    `,
    [cropIds]
  );

  const map = {};
  rows.forEach(r => {
    map[r.crop_id] = {
      total_expense: Number((r.total_expense || 0).toFixed(2)),
      expense_per_ha: Number((r.expense_per_ha || 0).toFixed(2)),
    };
  });

  return map;
};

