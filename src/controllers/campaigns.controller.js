import { pool } from "../db/connection.js";

export const getCampaigns = async (req, res) => {
  try {
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const search =
      typeof req.query.search === "string" && req.query.search.trim() !== ""
        ? req.query.search.trim()
        : null;

    const limit = 10;
    const offset = (page - 1) * limit;

    // --- WHERE DINÁMICO ---
    let whereClause = "WHERE c.status = 'active'"; // 👈 SIEMPRE ACTIVAS
    const params = [];

    if (search) {
      whereClause += " AND c.name LIKE ?";
      params.push(`%${search}%`);
    }

    // Total filtrado
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM campaigns c ${whereClause}`,
      params
    );

    // Consulta principal
    const [campaigns] = await pool.query(
      `
      SELECT
        c.*,
        (SELECT COUNT(*) FROM crops WHERE campaign_id = c.id) AS crops_count,
        (SELECT SUM(total_estimated) FROM crops WHERE campaign_id = c.id) AS total_estimated_tn
      FROM campaigns c
      ${whereClause}
      ORDER BY c.name ASC
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    // Lotes + cultivos
    for (const campaign of campaigns) {
      const [lots] = await pool.query(
        `
        SELECT 
          l.*,
          (SELECT COUNT(*) FROM crops cr WHERE cr.lot_id = l.id) AS crops_count
        FROM lots l
        WHERE l.campaign_id = ?
        ORDER BY l.name
        `,
        [campaign.id]
      );

      const [crops] = await pool.query(
        `
        SELECT cr.*, l.name AS lot_name
        FROM crops cr
        LEFT JOIN lots l ON cr.lot_id = l.id
        WHERE cr.campaign_id = ?
        `,
        [campaign.id]
      );

      campaign.lots = lots;
      campaign.crops = crops;
    }

    res.json({
      campaigns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener campañas" });
  }
};


export const getCampaignById = async (req, res) => {
  try {
    const campaignId = req.params.id;

    const [[campaign]] = await pool.query(
      `SELECT * FROM campaigns WHERE id = ?`,
      [campaignId]
    );

    if (!campaign) return res.status(404).json({ message: "Campaña no encontrada" });

    const [crops] = await pool.query(
      `
      SELECT cr.*, l.name AS lot_name
      FROM crops cr
      LEFT JOIN lots l ON cr.lot_id = l.id
      WHERE cr.campaign_id = ?
      `,
      [campaignId]
    );

    const [lots] = await pool.query(
      `
      SELECT DISTINCT l.*
      FROM lots l
      JOIN crops cr ON cr.lot_id = l.id
      WHERE cr.campaign_id = ?
      `,
      [campaignId]
    );

    campaign.crops = crops;
    campaign.lots = lots;

    res.json({ campaign });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al obtener campaña" });
  }
};

export const createOrUpdateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, start_date, end_date, notes } = req.body;

    if (!name) {
      return res.status(400).json({ message: "El nombre es obligatorio" });
    }

    let campaignId;

    if (!id) {
      const [result] = await pool.query(
        `INSERT INTO campaigns (name, start_date, end_date, notes)
         VALUES (?, ?, ?, ?)`,
        [name, start_date || null, end_date || null, notes || null]
      );

      campaignId = result.insertId;
      const [created] = await pool.query(`SELECT * FROM campaigns WHERE id = ?`, [campaignId]);
      return res.status(201).json(created[0]);
    }

    await pool.query(
      `UPDATE campaigns 
       SET name = ?, start_date = ?, end_date = ?, notes = ?
       WHERE id = ?`,
      [name, start_date || null, end_date || null, notes || null, id]
    );

    const [updated] = await pool.query(`SELECT * FROM campaigns WHERE id = ?`, [id]);
    return res.status(200).json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al crear o actualizar campaña" });
  }
};

export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      `UPDATE campaigns SET status = 'inactive' WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Campaña no encontrada" });
    }

    res.json({ message: "Campaña dada de baja correctamente" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error al dar de baja la campaña" });
  }
};