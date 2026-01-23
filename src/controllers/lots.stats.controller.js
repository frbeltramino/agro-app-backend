import { pool } from "../db/connection.js";

import {
  emptyLot,
} from "../utils/lotsStats.utils.js";


const DEFAULTS = {
  PRECIO_POR_UNIDAD: 0,
  COSTO_VARIABLE: 0,
  MARGEN_BRUTO: 100,
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

    const lotStats = lots.map(lot =>
      calculateLotStats({
        lot,
        crops,
        tasks,
        supplies,
        defaults: DEFAULTS,
      })
    );

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
     WHERE campaign_id = ?`,
    [campaignId]
  );
  return rows;
};

export const getActiveCropsByLots = async (pool, lotIds, userId) => {
  const [rows] = await pool.query(
    `SELECT id, lot_id, real_yield
     FROM crops
     WHERE lot_id IN (?) AND userId = ? AND status = 'active'`,
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
    `SELECT id, crop_id, laborCost
     FROM tasks 
     WHERE id IN (?) AND status = 'active'`,
    [taskIds]
  );
  return rows;
};

export const getSupplies = async (pool, taskIds) => {
  const [rows] = await pool.query(
    `SELECT task_id, total_used, price_per_unit
     FROM task_supplies 
     WHERE task_id IN (?)`,
    [taskIds]
  );
  return rows;
};

export const calculateLotStats = ({
  lot,
  crops,
  tasks,
  supplies,
  defaults,
}) => {
  const cropsInLot = crops.filter(c => c.lot_id === lot.id);
  const tasksInLot = tasks.filter(t =>
    cropsInLot.some(c => c.id === t.crop_id)
  );
  const suppliesInLot = supplies.filter(s =>
    tasksInLot.some(t => t.id === s.task_id)
  );

  const insumos = suppliesInLot.reduce(
    (sum, s) => sum + (s.total_used || 0) * (s.price_per_unit || 0),
    0
  );

  const labores = tasksInLot.reduce(
    (sum, t) => sum + (t.laborCost || 0),
    0
  );

  const cosecha = cropsInLot.reduce(
    (sum, c) => sum + (c.real_yield || 0),
    0
  );

  return {
    id: lot.id,
    lote: lot.name,
    superficieHa: Number(lot.hectares.toFixed(2)),
    insumos: Number(insumos.toFixed(2)),
    labores: Number(labores.toFixed(2)),
    cosecha: Number(cosecha.toFixed(2)),
    costoVariable: defaults.COSTO_VARIABLE,
    margenBruto: defaults.MARGEN_BRUTO,
  };
};