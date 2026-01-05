import express from "express";
import { getStockStats } from "../controllers/stock.stats.controller.js";
import { validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/",
  validateJWT,
  getStockStats);

export default router;