import express from "express";
import {
  getSupplies,
  getSupplyById,
  createOrUpdateSupply,
  deleteSupply,
  getSuppliesByCropId
} from "../controllers/supplies.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getSupplies);
router.get("/:id", getSupplyById);
router.get("/crop/:cropId", getSuppliesByCropId);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSupply);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSupply);
router.delete("/:id", validateJWT,
  authorizeRoles("admin"),
  deleteSupply);


export default router;