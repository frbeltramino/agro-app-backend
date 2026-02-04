import express from "express";
import { getLots, getLotById, deleteLot, getLotsByCampaign, createOrUpdateLot } from "../controllers/lots.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getLots);
router.get("/campaign/:campaignId", getLotsByCampaign);

router.get("/:id", getLotById);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"), createOrUpdateLot);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"), createOrUpdateLot);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"), deleteLot);

export default router;