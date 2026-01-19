import { pool } from "../db/connection.js";

export const getSeedSales = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { waybill_number = "", destination = "", start_date = "", end_date = "" } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    // FILTROS
    let where = "WHERE ss.deleted_at IS NULL AND ss.userId = ?";
    const values = [userId];

    if (waybill_number) {
      where += " AND ss.waybill_number LIKE ?";
      values.push(`%${waybill_number}%`);
    }

    if (destination) {
      where += " AND ss.destination LIKE ?";
      values.push(`%${destination}%`);
    }

    if (start_date) {
      where += " AND ss.sale_date >= ?";
      values.push(start_date);
    }

    if (end_date) {
      where += " AND ss.sale_date <= ?";
      values.push(end_date);
    }

    where += " AND ss.status != 'canceled'";

    /* ============================
       TOTAL DE CAMPAÑAS
    ============================ */
    const [[count]] = await pool.query(
      `
      SELECT COUNT(DISTINCT c.id) AS total
      FROM seed_sales ss
      JOIN campaigns c ON c.id = ss.campaign_id
      ${where}
      `,
      values
    );

    /* ============================
       CAMPAÑAS PAGINADAS
    ============================ */
    const [campaignRows] = await pool.query(
      `
      SELECT DISTINCT c.id, c.name
      FROM seed_sales ss
      JOIN campaigns c ON c.id = ss.campaign_id
      ${where}
      ORDER BY c.name DESC
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset]
    );

    const campaignIds = campaignRows.map(c => c.id);

    if (!campaignIds.length) {
      return res.json({
        campaigns: [],
        pagination: {
          page,
          limit,
          total: count.total,
          totalPages: Math.ceil(count.total / limit),
        },
      });
    }

    /* ============================
       DATOS COMPLETOS DE ENTREGAS Y VENTAS
    ============================ */
    const [rows] = await pool.query(
      `
      SELECT
        ss.id AS seed_sale_id,
        ss.userId,
        ss.waybill_number,
        ss.sale_date,
        ss.destination,
        ss.status,
        ss.tn_sold,
        ss.tn_delivered,
        ss.deleted_at,
        ss.created_at,
        ss.updated_at,
        ss.campaign_id,
        
        c.name AS campaign_name,
        cn.id AS crop_name_id,
        cn.name AS crop_name,
        
        ssd.id AS delivery_id,
        ssd.primary_liquidation_number,
        ssd.delivery_date,
        ssd.destination AS delivery_destination,
        ssd.tn_delivered AS delivery_tn_delivered,
        ssd.price_per_tn
      FROM seed_sales ss
      JOIN campaigns c ON c.id = ss.campaign_id
      JOIN crop_name cn ON cn.id = ss.crop_name_id
      LEFT JOIN seed_sale_deliveries ssd
        ON ssd.seed_sale_id = ss.id
        AND ssd.deleted_at IS NULL
      WHERE ss.campaign_id IN (?) AND ss.deleted_at IS NULL
      ORDER BY c.name, cn.name, ss.sale_date DESC
      `,
      [campaignIds]
    );

    /* ============================
       AGRUPACIÓN POR CAMPAÑA Y SEED_SALE (ENTREGA)
    ============================ */
    const campaignsMap = {};

    for (const row of rows) {
      if (!campaignsMap[row.campaign_id]) {
        campaignsMap[row.campaign_id] = {
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          crops: {},
        };
      }

      const campaign = campaignsMap[row.campaign_id];

      // Cada seed_sale es un crop independiente
      if (!campaign.crops[row.seed_sale_id]) {
        campaign.crops[row.seed_sale_id] = {
          id: row.seed_sale_id,
          userId: row.userId,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          crop_name_id: row.crop_name_id,
          crop_name: row.crop_name,
          tn_sold: row.tn_sold,
          tn_delivered: row.tn_delivered,
          waybill_number: row.waybill_number,
          destination: row.destination,
          status: row.status,
          sale_date: row.sale_date,
          deleted_at: row.deleted_at,
          created_at: row.created_at,
          updated_at: row.updated_at,
          deliveries: [],
        };
      }

      const crop = campaign.crops[row.seed_sale_id];

      // Cada delivery es una venta
      if (row.delivery_id) {
        crop.deliveries.push({
          id: row.delivery_id,
          seed_sale_id: row.seed_sale_id,
          crop_name_id: row.crop_name_id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          delivery_date: row.delivery_date,
          destination: row.delivery_destination,
          tn_delivered: row.delivery_tn_delivered,
          price_per_tn: row.price_per_tn,
          primary_liquidation_number: row.primary_liquidation_number,
        });
      }
    }

    const campaigns = Object.values(campaignsMap).map(c => ({
      ...c,
      crops: Object.values(c.crops),
    }));

    /* ============================
       RESPUESTA FINAL
    ============================ */
    res.json({
      campaigns,
      pagination: {
        page,
        limit,
        total: count.total,
        totalPages: Math.ceil(count.total / limit),
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener ventas" });
  }
};




export const getSeedSaleById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`
      SELECT * FROM seed_sales WHERE id = ?
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    res.json({ seed_sale: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener venta" });
  }
};

export const createOrUpdateSeedSale = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    const {
      crop_name_id,
      campaign_id,           // 👈 ahora recibimos campaign_id
      waybill_number,
      sale_date,
      destination,
      tn_delivered,          // toneladas
      status,
    } = req.body;

    // ✅ Validaciones básicas
    if (!crop_name_id || !campaign_id || !waybill_number || !sale_date || !destination) {
      return res.status(400).json({
        message:
          "Faltan campos obligatorios: crop_name_id, campaign_id, waybill_number, sale_date, destination",
      });
    }

    // 🔹 Validar que la campaña exista y pertenezca al usuario
    const [[campaign]] = await pool.query(
      `SELECT id FROM campaigns WHERE id = ? AND userId = ? AND status = 'active'`,
      [campaign_id, userId]
    );

    if (!campaign) {
      return res.status(400).json({
        message: "Campaña inválida o no pertenece al usuario",
      });
    }

    const finalStatus = status || "pending";
    let seedSaleId = id;

    if (id) {
      // 🔄 UPDATE
      await pool.query(
        `UPDATE seed_sales
         SET crop_name_id = ?, campaign_id = ?, waybill_number = ?, sale_date = ?, destination = ?,
             tn_delivered = ?, status = ?
         WHERE id = ? AND deleted_at IS NULL AND userId = ?`,
        [
          crop_name_id,
          campaign_id,
          waybill_number,
          sale_date,
          destination,
          tn_delivered,
          finalStatus,
          id,
          userId,
        ]
      );
    } else {
      // 🆕 CREATE
      const [result] = await pool.query(
        `INSERT INTO seed_sales
         (crop_name_id, campaign_id, waybill_number, sale_date, destination, tn_delivered, tn_sold, status, userId)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          crop_name_id,
          campaign_id,
          waybill_number,
          sale_date,
          destination,
          tn_delivered,
          finalStatus,
          userId,
        ]
      );

      seedSaleId = result.insertId;
    }

    // 🔍 Retornar resultado actualizado
    const [rows] = await pool.query(
      `SELECT * FROM seed_sales WHERE id = ? AND deleted_at IS NULL AND userId = ?`,
      [seedSaleId, userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    res.json({ seed_sale: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Error al crear o actualizar venta",
    });
  }
};


export const deleteSeedSale = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete de la venta
    await pool.query(
      `UPDATE seed_sales SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );

    // Soft delete de los deliveries asociados
    await pool.query(
      `UPDATE seed_sale_deliveries SET deleted_at = NOW() WHERE seed_sale_id = ?`,
      [id]
    );

    res.json({ message: "Venta y sus deliveries eliminados correctamente (soft delete)" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al eliminar venta" });
  }
};