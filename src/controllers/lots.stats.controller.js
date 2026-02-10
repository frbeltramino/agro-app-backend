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

    const variableExpensesMap = await getVariableExpenseByLots(pool, lotIds);

    const lotStats = lots.map(lot => {
      const COSTO_VARIABLE = variableExpensesMap[lot.id]?.total_expense || 0;

      const stats = calculateLotStats({
        lot,
        crops,
        tasks,
        supplies,
        defaults: { ...DEFAULTS, COSTO_VARIABLE },
        cropPricesMap,
      });

      // Formateamos solo costoVariable
      return {
        ...stats,
        costoVariable: Number(COSTO_VARIABLE.toFixed(2)), // ← aquí
      };
    });

    res.json({ lotes: lotStats });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener estadísticas de lotes" });
  }
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
    `SELECT id, lot_id, crop_name_id, real_yield
     FROM crops
     WHERE lot_id IN (?) AND userId = ? AND status = 'active'`,
    [lotIds, userId]
  );
  return rows;
}

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
    `SELECT id, crop_id, laborCost
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


export const calculateLotStats = ({
  lot,
  crops,
  tasks,
  supplies,
  defaults,
  cropPricesMap,
}) => {
  const cropsInLot = crops.filter(c => c.lot_id === lot.id);
  const tasksInLot = tasks.filter(t =>
    cropsInLot.some(c => c.id === t.crop_id)
  );
  const suppliesInLot = supplies.filter(s =>
    tasksInLot.some(t => t.id === s.task_id)
  );

  const insumosPorCategoriaMap = suppliesInLot.reduce((acc, s) => {
    const categoria = s.category_name || "Sin categoría";
    const costo = (s.total_used || 0) * (s.price_per_unit || 0);

    if (!acc[categoria]) {
      acc[categoria] = 0;
    }

    acc[categoria] += costo;

    return acc;
  }, {});

  const labores = tasksInLot.reduce(
    (sum, t) => sum + (t.laborCost || 0),
    0
  );

  const insumosPorCategoria = Object.entries(insumosPorCategoriaMap).map(
    ([categoria, total]) => ({
      categoria,
      total: Number(total.toFixed(2)),
    })
  );

  const insumosTotal = insumosPorCategoria.reduce(
    (sum, i) => sum + i.total,
    0
  );

  const cosecha = cropsInLot.reduce(
    (sum, c) => sum + (c.real_yield || 0),
    0
  );

  const ingresos = cropsInLot.reduce((sum, c) => {
    const precio = cropPricesMap[c.crop_name_id] || defaults.PRECIO_POR_UNIDAD;
    return sum + (c.real_yield || 0) * precio;
  }, 0);

  const preciosDelLote = cropsInLot
    .map(c => {
      if (!c.crop_name_id) return null;
      return cropPricesMap[c.crop_name_id];
    })
    .filter(p => typeof p === "number");

  const precioPromedio = preciosDelLote.length
    ? preciosDelLote.reduce((a, b) => a + b, 0) / preciosDelLote.length
    : defaults.PRECIO_POR_UNIDAD;

  return {
    id: lot.id,
    lote: lot.name,
    superficieHa: Number(lot.hectares.toFixed(2)),

    insumos: Number(insumosTotal.toFixed(2)),
    insumosPorCategoria, // 👈 array siempre

    labores: Number(labores.toFixed(2)),
    cosecha: Number(cosecha.toFixed(2)),
    ingresos: Number(ingresos.toFixed(2)),
    precioPromedio: Number(precioPromedio.toFixed(2)),
    costoVariable: defaults.COSTO_VARIABLE,
    margenBruto: defaults.MARGEN_BRUTO,
  };
};

// necesito que se haga lo siguiente por cada registro
// amount = USDxtn
// tons_harvested/hectares = tnxha
// amount x tnxha = USDxha

// traducido 
// es el monto por tonelada
// tonleadas cosechadas dividido hectareas me da toneladas x ha
// por último multiplico monto por tn por las tn por ha

const getVariableExpenseByLots = async (pool, lotIds) => {
  if (!lotIds.length) return {};

  // Obtenemos los gastos individuales
  const [rows] = await pool.query(
    `
    SELECT
      lot_id,
      amount,
      tons_harvested,
      hectares
    FROM variable_expenses
    WHERE deleted_at IS NULL
      AND tons_harvested > 0
      AND lot_id IN (?)
    `,
    [lotIds]
  );

  // Mapa para acumular por lote
  const map = {};

  rows.forEach(r => {
    const USDxtn = r.amount;
    const tnxha = r.tons_harvested / r.hectares;
    const USDxha = USDxtn * tnxha;

    if (!map[r.lot_id]) {
      map[r.lot_id] = {
        total_expense: 0,   // suma de todos los montos
        expense_per_ha: 0,  // suma de USDxha por lote
      };
    }

    map[r.lot_id].total_expense += USDxtn;
    map[r.lot_id].expense_per_ha += USDxha;
  });

  // Redondeamos
  Object.keys(map).forEach(lotId => {
    map[lotId].total_expense = Number(map[lotId].total_expense.toFixed(2));
    map[lotId].expense_per_ha = Number(map[lotId].expense_per_ha.toFixed(2));
  });

  return map;
};

