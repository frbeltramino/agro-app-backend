import express from "express";
import {
  getVariableExpenses,
  createOrUpdateVariableExpense,
  deleteVariableExpense,
  getLotsForVariableExpensesByCampaign
} from "../controllers/variable.expenses.controller.js";

import { validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/",
  validateJWT,
  getVariableExpenses
);

router.get(
  "/campaign/:campaignId/variable-expenses-lots",
  validateJWT,
  getLotsForVariableExpensesByCampaign
);

router.post(
  "/",
  validateJWT,
  createOrUpdateVariableExpense
);

router.delete(
  "/:id",
  validateJWT,
  deleteVariableExpense
);

export default router;