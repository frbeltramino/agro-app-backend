import { Router } from "express";
import {
  getSupplyCategories,
  getSupplyCategoryById,
  createSupplyCategory,
  updateSupplyCategory,
  deleteSupplyCategory
} from "../controllers/supply.categories.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getSupplyCategories);
router.get("/:id", getSupplyCategoryById);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createSupplyCategory);
router.put("/:id",
  validateJWT,
  authorizeRoles("admin"),
  updateSupplyCategory);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteSupplyCategory);

export default router;