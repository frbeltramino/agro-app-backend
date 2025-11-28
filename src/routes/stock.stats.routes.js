import express from "express";
import { getStockStats } from "../controllers/stock.stats.controller.js";

const router = express.Router();

router.get("/", getStockStats);

export default router;