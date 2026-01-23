import { pool } from "../db/connection.js";


export const getLotsStats = async (req, res) => {
  const precio_por_unidad__default = 100;
  const costoVariable_default = 150;
  try {
    const userId = req.user?.id;
    const campaignId = req.query.campaign_id;

    if (!campaignId) {
      return res.status(400).json({ message: "campaign_id es requerido" });
    }

    // 1️⃣ Traer todos los lotes de la campaña
    const [lots] = await pool.query(
      `SELECT id, name, hectares 
       FROM lots 
       WHERE campaign_id = ?`,
      [campaignId]
    );

    if (!lots.length) return res.json([]);

    // 2️⃣ Traer cultivos activos de esos lotes para el usuario
    const lotIds = lots.map((lot) => lot.id);
    const [crops] = await pool.query(
      `SELECT id, lot_id, real_yield, total_estimated
FROM crops
WHERE lot_id IN (?) AND userId = ? AND status = 'active'`,
      [lotIds, userId]
    );

    if (!crops.length) {
      const emptyLots = lots.map((lot) => ({
        id: lot.id,
        lote: lot.name,
        superficieHa: Number(lot.hectares),
        insumos: 0,
        labores: 0,
        cosecha: 0,
        costoVariable: 0,
        margenBruto: 0,
      }));
      return res.json({ lotes: emptyLots });
    }

    // 3️⃣ Traer relaciones crop_tasks para obtener task_id
    const cropIds = crops.map((c) => c.id);
    const [cropTaskRelations] = await pool.query(
      `SELECT id, crop_id, task_id 
       FROM crop_tasks 
       WHERE crop_id IN (?)`,
      [cropIds]
    );

    if (!cropTaskRelations.length) {
      const lotsWithZero = lots.map((lot) => ({
        id: lot.id,
        lote: lot.name,
        superficieHa: Number(lot.hectares),
        insumos: 0,
        labores: 0,
        cosecha: 0,
        costoVariable: 0,
        margenBruto: 0,
      }));
      return res.json({ lotes: lotsWithZero });
    }

    // 4️⃣ Traer datos de las tareas reales
    const taskIds = cropTaskRelations.map((ct) => ct.task_id);
    const [tasks] = await pool.query(
      `SELECT id, crop_id, laborCost, total_price 
       FROM tasks 
       WHERE id IN (?) AND status = 'active'`,
      [taskIds]
    );

    // 5️⃣ Traer insumos de todas las tareas
    const [supplies] = await pool.query(
      `SELECT task_id, total_used, price_per_unit 
       FROM task_supplies 
       WHERE task_id IN (?)`,
      [taskIds]
    );

    // 6️⃣ Mapear costos por lote
    const lotStats = lots.map((lot) => {
      const cropsInLot = crops.filter((c) => c.lot_id === lot.id);
      const tasksInLot = tasks.filter((t) => cropsInLot.some((c) => c.id === t.crop_id));
      const suppliesInLot = supplies.filter((s) => tasksInLot.some((t) => t.id === s.task_id));

      const totalInsumos = suppliesInLot.reduce(
        (sum, s) => sum + (s.total_used || 0) * (s.price_per_unit || 0),
        0
      );

      const totalLabores = tasksInLot.reduce(
        (sum, t) => sum + (t.laborCost || 0),
        0
      );

      const totalCosecha = cropsInLot.reduce((sum, crop) => sum + (crop.real_yield || 0), 0);

      const ingresos = cropsInLot.reduce((sum, crop) => {
        if (crop.real_yield !== null) {
          return sum + crop.real_yield * precio_por_unidad__default;
        }
        return sum;
      }, 0);

      // Costo variable por tonelada cosechada
      const costoVariableReal = costoVariable_default;

      const margenBruto = ingresos - (totalInsumos + totalLabores + costoVariableReal);

      return {
        id: lot.id,
        lote: lot.name,
        superficieHa: Number(lot.hectares.toFixed(2)),
        insumos: Number(totalInsumos.toFixed(2)),
        labores: Number(totalLabores.toFixed(2)),
        cosecha: Number(totalCosecha.toFixed(2)),
        costoVariable: Number(costoVariable_default.toFixed(2)),
        margenBruto: Number(margenBruto.toFixed(2)),
      };
    });

    return res.json({ lotes: lotStats });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener estadísticas de lotes" });
  }
};