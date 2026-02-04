import express from "express";
import {
  getExpenseTypes,
  createExpenseType,
  deleteExpenseType
} from "../controllers/expenses.types.controller.js";

import { validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

// ==========================
// Obtener tipos de gasto
// Globales + propios
// ==========================
router.get(
  "/",
  validateJWT,
  getExpenseTypes
);

// ==========================
// Crear tipo de gasto (propio)
// ==========================
router.post(
  "/new",
  validateJWT,
  createExpenseType
);

// ==========================
// Eliminar tipo de gasto (solo propio)
// ==========================
router.delete(
  "/:id",
  validateJWT,
  deleteExpenseType
);

export default router;
