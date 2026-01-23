import express from 'express';
import cors from "cors";
import dotenv from 'dotenv';
import cropsRoutes from "./src/routes/crops.routes.js";
import productsRoutes from './src/routes/products.routes.js';
import authRoutes from './src/routes/auth.routes.js';
import { router as seedRoutes } from "./src/routes/seed.routes.js";
import campaignsRoutes from "./src/routes/campaigns.routes.js";
import tasksRoutes from "./src/routes/tasks.routes.js";
import suppliesRoutes from "./src/routes/supplies.routes.js";
import lotsRoutes from "./src/routes/lots.routes.js";
import supplyCategoriesRoutes from "./src/routes/supply.categories.routes.js";
import lotMasterRoutes from "./src/routes/lot.master.routes.js";
import cropNamesRoutes from "./src/routes/crop.names.routes.js";
import stockRoutes from "./src/routes/stock.routes.js";
import taskTypesRoutes from "./src/routes/task.types.routes.js";
import stockStatsRoutes from "./src/routes/stock.stats.routes.js";
import seedSalesRoutes from "./src/routes/sales.seed.routes.js";
import cropStockRoutes from "./src/routes/crop.stock.routes.js";
import seedSaleDeliveries from "./src/routes/seedSaleDeliveries.routes.js";
import supplyMasterRoutes from "./src/routes/supply.master.routes.js";
import contractorsRoutes from "./src/routes/providers.routes.js";
import lotsStatsRoutes from "./src/routes/lots.stats.routes.js";


dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/products', productsRoutes);


app.use("/api/auth", authRoutes);
app.use("/api/seed", seedRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/crops', cropsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/supplies', suppliesRoutes);
app.use('/api/lots', lotsRoutes);
app.use('/api/supply/categories', supplyCategoriesRoutes);
app.use('/api/lot/master', lotMasterRoutes);
app.use('/api/crop/names', cropNamesRoutes);
app.use('/api/stock', stockRoutes);
app.use('/api/task/types', taskTypesRoutes);
app.use('/api/stats/stock', stockStatsRoutes);
app.use('/api/sales/seed', seedSalesRoutes);
app.use('/api/crop/stock', cropStockRoutes);
app.use('/api/deliveries/seed', seedSaleDeliveries);
app.use('/api/master/supplies', supplyMasterRoutes);
app.use('/api/providers', contractorsRoutes);
app.use('/api/lots-stats', lotsStatsRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Manejo de señales para cerrar el servidor correctamente
process.on('SIGINT', () => {
  console.log('SIGINT received, closing server');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server');
  process.exit(0);
});