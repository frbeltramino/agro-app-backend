import PDFDocument from "pdfkit";
import PDFDocumentWithTables from "pdfkit-table"; // clase extendida       // extiende PDFDocument con doc.table()
import { pool } from "../db/connection.js";


import {
  calculateCropStats,
  DEFAULTS,
  getActiveCropsByLots,
  getAverageSalePricePerCrop,
  getCropTasks,
  getLotsByCampaign,
  getSupplies,
  getTasks,
  getVariableExpenseByCrops
} from "./lots.stats.controller.js";
import { emptyLot } from "../utils/lotsStats.utils.js";


// Supongamos que ya llamaste a tu getLotsStats y tienes "lotStats"
export const getLotsStatsData = async (campaignId, userId) => {
  const lots = await getLotsByCampaign(pool, campaignId);

  if (!lots.length) return [];

  const lotIds = lots.map(l => l.id);

  const crops = await getActiveCropsByLots(pool, lotIds, userId);

  if (!crops.length) return lots.map(emptyLot);

  const cropIds = crops.map(c => c.id);
  const cropTasks = await getCropTasks(pool, cropIds);
  console.log("cropTasks", cropTasks);

  //Por cada task id me gusatría traerla y mostrar la info de la misma
  // además por cada tarea también traer la info de sus suministros usados para la misma

  if (!cropTasks.length) return lots.map(emptyLot);

  const taskIds = cropTasks.map(ct => ct.task_id);
  //traigo las tareas con los insumos completos por cada cultivo
  console.log("taskIds", taskIds);
  const tasksWithSupplies = await getTasksWithSupplies(taskIds);

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

    // Filtrar tareas que correspondan a los cultivos de este lote
    const cropIdsInLot = cropsInLot.map(c => c.id);
    const tasksInLotWithSupplies = tasksWithSupplies.filter(t =>
      cropIdsInLot.includes(t.crop_id)
    );

    return {
      id: lot.id,
      lote: lot.name,
      superficieHa: Number(lot.hectares.toFixed(2)),
      cultivos,
      tasksWithSupplies: tasksInLotWithSupplies,
    };
  });
  return lotStats;
};


export const callLotsStatsPDF = async (req, res) => {
  try {
    const userId = req.user?.id;
    const campaignId = req.query.campaign_id;
    const campaignName = await getCampaignName(campaignId) || "Campaña";

    if (!campaignId) return res.status(400).send("campaign_id es requerido");

    const lotStats = await getLotsStatsData(userId, campaignId);
    console.log("lotStats", JSON.stringify(lotStats, null, 2));
    await generateCampaignPDF(res, campaignName, lotStats);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error al generar PDF");
  }
};



export const generateCampaignPDF = async (res, campaignName, lotStats) => {
  //console.log("generateCampaignPDF", JSON.stringify(lotStats, null, 2));
  const doc = new PDFDocumentWithTables({ margin: 30, size: "A4" });

  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);

  // =========================
  // TÍTULO GENERAL
  // =========================
  doc.fontSize(20)
    .text(`REPORTE DE CAMPAÑA ${campaignName}`, { align: "center" })
    .moveDown(1);

  for (let i = 0; i < lotStats.length; i++) {
    const lot = lotStats[i];

    // =========================
    // ENCABEZADO LOTE
    // =========================
    doc.fontSize(16)
      .text(`Lote: ${lot.lote}`, { underline: true });

    doc.fontSize(11)
      .text(`Superficie: ${lot.superficieHa.toFixed(2)} ha`)
      .moveDown(0.5);

    // =========================
    // RESUMEN PRODUCTIVO
    // =========================
    doc.fontSize(13)
      .text("Resumen Productivo")
      .moveDown(0.3);

    if (lot.cultivos?.length) {
      const rows = lot.cultivos.map(crop => {
        const tnXHa = (crop.cosecha || 0) / (lot.superficieHa || 1);
        const usdXHa = (crop.precioPromedioPonderado || 0) * tnXHa;

        return [
          crop.cropName || "",
          (crop.cosecha || 0).toFixed(2),
          (crop.precioPromedioPonderado || 0).toFixed(2),
          tnXHa.toFixed(2),
          usdXHa.toFixed(2),
          (crop.insumos || 0).toFixed(2),
          (crop.labores || 0).toFixed(2),
          (crop.costoVariable || 0).toFixed(2),
          (crop.margenBruto || 0).toFixed(2)
        ];
      });

      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }

      await doc.table({
        headers: [
          "Cultivo",
          "Cosecha (tn)",
          "USD/tn",
          "tn/ha",
          "USD/ha",
          "Insumos",
          "Labores",
          "Costo Variable",
          "Margen Bruto"
        ],
        rows
      }, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        prepareHeader: () => doc.fontSize(9),
        prepareRow: () => doc.fontSize(8)
      });

      doc.moveDown(0.8);
    }

    // =========================
    // DETALLE DE LABORES
    // =========================
    if (lot.tasksWithSupplies?.length) {

      doc.fontSize(13)
        .text("Detalle de Labores")
        .moveDown(0.5);

      for (const task of lot.tasksWithSupplies) {

        doc.fontSize(11)
          .text(
            `${task.task_type_name} | ${task.date} | ${task.provider_name}`,
            { continued: false }
          );

        if (task.description) {
          doc.fontSize(9).text(`Descripción: ${task.description}`);
        }

        doc.fontSize(9)
          .text(`Costo labor: USD ${task.laborCost.toFixed(2)}`)
          .text(`Costo total tarea: USD ${task.total_price.toFixed(2)}`)

        // =========================
        // AGRUPAR INSUMOS POR CATEGORÍA
        // =========================
        const grouped = {};

        const uniqueSupplies = Array.from(
          new Map(
            task.supplies.map(s => [`${s.source}-${s.id}`, s])
          ).values()
        );

        for (const s of uniqueSupplies) {
          if (!grouped[s.category_name]) {
            grouped[s.category_name] = [];
          }
          grouped[s.category_name].push(s);
        }

        for (const category in grouped) {

          if (doc.y > doc.page.height - 150) {
            doc.addPage();
          }

          doc.fontSize(10)
            .fillColor("black")
            .text(`Categoría: ${category}`)
            .moveDown(0.3);

          const supplyRows = grouped[category].map(s => [
            s.name,
            s.dose_per_ha.toFixed(2),
            s.hectares.toFixed(2),
            s.total_used.toFixed(2),
            s.unit,
            s.price_per_unit.toFixed(2),
            (s.total_used * s.price_per_unit).toFixed(2)
          ]);

          await doc.table({
            headers: [
              "Insumo",
              "Dosis/ha",
              "Has",
              "Total",
              "Unidad",
              "USD/u",
              "Subtotal"
            ],
            rows: supplyRows
          }, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
            prepareHeader: () => doc.fontSize(8),
            prepareRow: () => doc.fontSize(7)
          });

          const totalCategoria = grouped[category]
            .reduce((acc, s) => acc + (s.total_used * s.price_per_unit), 0);

          doc.fontSize(9)
            .text(`Total ${category}: USD ${totalCategoria.toFixed(2)}`, {
              align: "right"
            })
            .moveDown(1);
        }

        doc.moveDown(1);
        doc.moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor("#cccccc")
          .stroke();
        doc.moveDown(1);
      }
    }

    // =========================
    // SALTO DE PÁGINA
    // =========================
    if (i < lotStats.length - 1) {
      doc.addPage();
    }
  }

  doc.end();
};


export const getCampaignName = async (campaignId) => {
  if (!campaignId) return null;

  const [rows] = await pool.query(
    `SELECT name FROM campaigns WHERE id = ? AND status = 'active'`,
    [campaignId]
  );

  if (!rows.length) return null;

  return rows[0].name;
};

/**
 * Trae información detallada de las tareas y sus insumos
 * @param {number[]} taskIds
 * @returns {Promise<Object[]>} Array de tareas con insumos
 */
export const getTasksWithSupplies = async (taskIds) => {
  if (!taskIds?.length) return [];

  // 1️⃣ Traer tareas con info de proveedor y tipo de tarea
  const [tasks] = await pool.query(
    `SELECT 
      t.id,
      t.crop_id,
      t.task_type_id,
      t.provider_id,
      t.description,
      t.total_price,
      t.laborCost,
      t.date,
      t.note,
      t.status,
      tt.name AS task_type_name,
      p.name AS provider_name
   FROM tasks t
   LEFT JOIN task_types tt ON t.task_type_id = tt.id
   LEFT JOIN providers p ON t.provider_id = p.id
   WHERE t.id IN (?)`,
    [taskIds]
  );

  if (!tasks.length) return [];

  // 2️⃣ Traer insumos de esas tareas con info completa de supplies
  // 2️⃣ Traer insumos de las tareas con info de stock / supply y master_supply
  const [taskSupplies] = await pool.query(
    `SELECT 
      ts.id,
      ts.task_id,
      ts.supply_id,
      ts.stock_id,
      ts.dose_per_ha,
      ts.hectares,
      ts.total_used,
      ts.price_per_unit,

      -- Info desde stock
      st.name AS stock_name,
      st.unit AS stock_unit,
      st.master_supply_id AS stock_master_id,

      -- Info desde supply
      s.name AS supply_name,
      s.unit AS supply_unit,
      s.master_supply_id AS supply_master_id,

      -- Master supply
      ms.id AS master_id,
      ms.name AS master_name,
      ms.unit AS master_unit,

      -- Categoría
      sc.id AS category_id,
      sc.name AS category_name

   FROM task_supplies ts

   LEFT JOIN stock st 
      ON ts.stock_id = st.id

   LEFT JOIN supplies s 
      ON ts.supply_id = s.id

   LEFT JOIN master_supplies ms 
      ON ms.id = COALESCE(st.master_supply_id, s.master_supply_id)

   LEFT JOIN supply_category sc
      ON ms.category_id = sc.id

   WHERE ts.task_id IN (?)`,
    [taskIds]
  );

  // 3️⃣ Mapear insumos por tarea
  const taskSuppliesMap = {};
  for (const ts of taskSupplies) {
    if (!taskSuppliesMap[ts.task_id]) taskSuppliesMap[ts.task_id] = [];

    // Elegir datos de stock si existe, sino usar supply
    const supplyInfo = ts.stock_id
      ? {
        id: ts.stock_id,
        source: "stock",
        name: ts.stock_name || ts.master_name,
        unit: ts.stock_unit || ts.master_unit,
        master_supply_id: ts.stock_master_id,
        dose_per_ha: ts.dose_per_ha,
        hectares: ts.hectares,
        total_used: ts.total_used,
        price_per_unit: ts.price_per_unit,
        category_id: ts.category_id,
        category_name: ts.category_name
      }
      : {
        id: ts.supply_id,
        source: "supply",
        name: ts.supply_name || ts.master_name,
        unit: ts.supply_unit || ts.master_unit,
        master_supply_id: ts.supply_master_id,
        dose_per_ha: ts.dose_per_ha,
        hectares: ts.hectares,
        total_used: ts.total_used,
        price_per_unit: ts.price_per_unit,
        category_id: ts.category_id,
        category_name: ts.category_name
      };

    taskSuppliesMap[ts.task_id].push(supplyInfo);
  }

  // 4️⃣ Enriquecer tareas con sus insumos
  const tasksWithSupplies = tasks.map(task => ({
    ...task,
    supplies: taskSuppliesMap[task.id] || []
  }));

  return tasksWithSupplies;
};