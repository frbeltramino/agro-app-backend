import { pool } from "../db/connection.js";


export const getSeedDeliveriesAndSales = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const {
      waybill_number = "",
      destination = "",
      start_date = "",
      end_date = ""
    } = req.query;

    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Usuario no autenticado" });
    }

    /* ============================
       FILTROS PARA DELIVERIES
    ============================ */
    let where = `WHERE sd.deleted_at IS NULL
                 AND sd.userId = ?
                 AND sd.status != 'canceled'`;
    const values = [userId];

    if (waybill_number) {
      where += " AND sd.waybill_number LIKE ?";
      values.push(`%${waybill_number}%`);
    }

    if (destination) {
      where += " AND sd.destination LIKE ?";
      values.push(`%${destination}%`);
    }

    if (start_date) {
      where += " AND sd.delivery_date >= ?";
      values.push(start_date);
    }

    if (end_date) {
      where += " AND sd.delivery_date <= ?";
      values.push(end_date);
    }

    /* ============================
       TOTAL DE CAMPAÑAS
    ============================ */
    const [[count]] = await pool.query(
      `
      SELECT COUNT(DISTINCT c.id) AS total
      FROM seed_deliveries sd
      JOIN campaigns c ON c.id = sd.campaign_id
      ${where}
      `,
      values
    );

    /* ============================
       CAMPAÑAS PAGINADAS
    ============================ */
    const [campaignRows] = await pool.query(
      `
      SELECT DISTINCT c.id, c.name
      FROM seed_deliveries sd
      JOIN campaigns c ON c.id = sd.campaign_id
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
          totalPages: Math.ceil(count.total / limit)
        }
      });
    }

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
  JOIN crops cr
    ON cr.crop_name_id = sd.crop_name_id
   AND cr.campaign_id = sd.campaign_id
   AND cr.userId = sd.userId
   AND cr.status = 'active'
  WHERE sd.campaign_id IN (?)
    AND sd.deleted_at IS NULL
    AND sd.status != 'canceled'
    AND sd.userId = ?
  `,
      [campaignIds, userId]
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
  WHERE ss.campaign_id IN (?)
    AND ss.deleted_at IS NULL
    AND ss.userId = ?
  `,
      [campaignIds, userId]
    );

    /* ============================
       AGRUPACIÓN
    ============================ */
    const campaignsMap = {};

    const ensureCrop = (row) => {
      if (!campaignsMap[row.campaign_id]) {
        campaignsMap[row.campaign_id] = {
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          crops: {}
        };
      }

      const campaign = campaignsMap[row.campaign_id];

      if (!campaign.crops[row.crop_name_id]) {
        campaign.crops[row.crop_name_id] = {
          userId: row.userId,
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          crop_name_id: row.crop_name_id,
          crop_name: row.crop_name,
          seed_deliveries: [],
          seed_sales: []
        };
      }

      return campaign.crops[row.crop_name_id];
    };
    deliveries.forEach(row => {
      const crop = ensureCrop(row);

      crop.seed_deliveries.push({
        id: row.seed_delivery_id, // 👈 ACÁ
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
        delivery_date: row.delivery_date,
        deleted_at: row.deleted_at,
        created_at: row.created_at,
        updated_at: row.updated_at
      });
    });

    sales.forEach(row => {
      const crop = ensureCrop(row);

      crop.seed_sales.push({
        id: row.seed_sale_id, // 👈 ACÁ
        userId: row.userId,
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        crop_name_id: row.crop_name_id,
        crop_name: row.crop_name,
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

    /* ============================
       RESPUESTA FINAL
    ============================ */
    const campaigns = Object.values(campaignsMap).map(c => ({
      ...c,
      crops: Object.values(c.crops)
    }));

    res.json({
      campaigns,
      pagination: {
        page,
        limit,
        total: count.total,
        totalPages: Math.ceil(count.total / limit)
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener datos" });
  }
};