import express, { Router } from "express";
import { getLots, getLotById, deleteLot, getLotsByCampaign, createOrUpdateLot } from "../controllers/lots.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";
import { getLotsStats } from "../controllers/lots.stats.controller.js";


export const router = Router();

router.get("/",
  validateJWT,
  getLotsStats);


export default router;