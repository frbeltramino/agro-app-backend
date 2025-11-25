import fs from "fs";
import path from "path";
import { pool } from "../db/connection.js";

export const seedDatabase = async (req, res) => {
  try {
    const { reset } = req.body; // reset: true → borra y crea todo desde cero

    const schemaFile = path.resolve("000_schema.sql");
    const seedFile = path.resolve("001_seeders.sql");

    if (!fs.existsSync(schemaFile) || !fs.existsSync(seedFile)) {
      return res.status(500).json({
        message: "No se encontraron los archivos SQL."
      });
    }

    const schemaSQL = fs.readFileSync(schemaFile, "utf-8");
    const seedSQL = fs.readFileSync(seedFile, "utf-8");

    const conn = await pool.getConnection();

    if (reset) {
      console.log("🗑 Reseteando base de datos…");
      await conn.query("SET FOREIGN_KEY_CHECKS = 0");

      const [tables] = await conn.query("SHOW TABLES");
      for (const table of tables) {
        const name = Object.values(table)[0];
        await conn.query(`DROP TABLE IF EXISTS \`${name}\``);
      }

      await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    console.log("📦 Ejecutando schema...");
    await conn.query(schemaSQL);

    console.log("🌱 Insertando datos...");
    await conn.query(seedSQL);

    conn.release();

    res.json({
      message: "Base de datos inicializada correctamente",
      reset: !!reset
    });

  } catch (error) {
    console.error("Error ejecutando seed:", error);
    res.status(500).json({
      message: "Error ejecutando seed",
      error: error.message,
    });
  }
};