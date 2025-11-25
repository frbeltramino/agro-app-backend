import express from "express";
import * as ctrl from "../controllers/campaigns.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";
const router = express.Router();

router.get("/", ctrl.getCampaigns);
router.get("/:id", ctrl.getCampaignById);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  ctrl.createOrUpdateCampaign);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"),
  ctrl.createOrUpdateCampaign);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  ctrl.deleteCampaign);

export default router;
