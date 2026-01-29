import express from "express";
import {
  createOrUpdateSeedDelivery,
  deleteSeedDelivery
} from "../controllers/deliveries.seed.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSeedDelivery);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateSeedDelivery);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteSeedDelivery);

export default router;