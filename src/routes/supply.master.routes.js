import express from "express";
import {
  getMasterSupplies,
  createMasterSupply,
  deleteMasterSupply,
} from "../controllers/supply.master.controller.js";

const router = express.Router();

router.get("/", getMasterSupplies);
router.post("/new", createMasterSupply);
router.delete("/:id", deleteMasterSupply);

export default router;