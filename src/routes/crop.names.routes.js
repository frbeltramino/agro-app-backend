import { Router } from "express";
import {
  getCropNames,
  createCropName,
  updateCropName,
  deleteCropName
} from "../controllers/crop.names.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getCropNames);
router.post("/",
  validateJWT,
  authorizeRoles("admin"),
  createCropName);
router.put("/:id",
  validateJWT,
  authorizeRoles("admin"), updateCropName);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteCropName);

export default router;