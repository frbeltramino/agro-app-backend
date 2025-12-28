import express from "express";
import { getCrops, getCropById, getCropsByLotId, createOrUpdateCrop, deleteCrop, getCropsForSale } from "../controllers/crops.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getCropsForSale);
router.get("/:id", getCropById);
router.get("/lot/:lotId", getCropsByLotId);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateCrop);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"), createOrUpdateCrop);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteCrop);


export default router; // export default