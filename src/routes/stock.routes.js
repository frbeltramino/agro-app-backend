import express from "express";
import {
  createStock,
  getStock,
  getStockById,
  updateStock,
  adjustStockQuantity
} from "../controllers/stock.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();


router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createStock);

router.get("/", getStock);

router.get("/:id", getStockById);

router.put("/:id",
  validateJWT,
  authorizeRoles("admin"),
  updateStock);

router.patch("/:id/adjust",
  validateJWT,
  authorizeRoles("admin"),
  adjustStockQuantity);

export default router;