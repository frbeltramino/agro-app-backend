import express from "express";
import { getReportByCampaign } from "../controllers/report.pdf.controller.js";
import { validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/report/campaign",
  validateJWT,
  getReportByCampaign);

export default router;