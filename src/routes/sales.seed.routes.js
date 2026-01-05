import express from "express";
import {
  getSeedSales,
  getSeedSaleById,
  createOrUpdateSeedSale,
  deleteSeedSale
} from "../controllers/sales.seed.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/",
  validateJWT,
  getSeedSales);
router.get("/:id", getSeedSaleById);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSeedSale);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSeedSale);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteSeedSale);

export default router;