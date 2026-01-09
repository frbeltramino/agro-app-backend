import express from "express";
import * as ctrl from "../controllers/providers.controller.js";
import { validateJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  validateJWT,
  ctrl.getProviders
);


router.post(
  "/new",
  validateJWT,

  ctrl.createProvider
);


router.delete(
  "/:id",
  validateJWT,
  authorizeRoles("admin"),
  ctrl.deleteProvider
);

export default router;
