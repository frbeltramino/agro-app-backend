import express from "express";
import { createLotMaster, getLotMasters, deleteLotMaster } from "../controllers/lot.master.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getLotMasters);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createLotMaster);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteLotMaster);

export default router;