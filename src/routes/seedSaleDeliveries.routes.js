import express from "express";
import {
  getSeedSaleDeliveries,
  getSeedSaleDeliveryById,
  createOrUpdateSeedSaleDelivery,
  deleteSeedSaleDelivery,
} from "../controllers/seedSaleDeliveries.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/:seed_sale_id", getSeedSaleDeliveries);
router.get("/:seed_sale_id/:seed_sale_delivery_id", getSeedSaleDeliveryById);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSeedSaleDelivery);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSeedSaleDelivery);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteSeedSaleDelivery);

export default router;