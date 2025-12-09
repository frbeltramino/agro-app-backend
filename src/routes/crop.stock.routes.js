import { Router } from "express";
import { registerCropStockUse } from "../controllers/crop.stock.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register",
  validateJWT,
  authorizeRoles("admin"),
  registerCropStockUse);

export default router;