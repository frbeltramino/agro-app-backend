import express from "express";
import { getSeedDeliveriesAndSales } from "../controllers/seed.deliveries.sales.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/",
  validateJWT,
  getSeedDeliveriesAndSales);

export default router;