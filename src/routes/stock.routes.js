import express from "express";
import {
  createOrUpdateStock,
  getStock,
  getStockById,
  adjustStockQuantity,
  deleteStock
} from "../controllers/stock.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();


router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateStock);

router.get("/",
  validateJWT,
  getStock);

router.get("/:id", getStockById);

router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateStock);

router.patch("/:id/adjust",
  validateJWT,
  authorizeRoles("admin"),
  adjustStockQuantity);

router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteStock);

export default router;