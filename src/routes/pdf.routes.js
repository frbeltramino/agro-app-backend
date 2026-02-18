import express from "express";
import { callLotsStatsPDF } from "../controllers/pdf.controller.js";
import { validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/report/campaign",
  validateJWT,
  callLotsStatsPDF);

export default router;
