import express from "express";
import {
  getTaskTypes,
  getTaskTypeById,
  createTaskType,
  updateTaskType,
  deleteTaskType
} from "../controllers/task.types.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", getTaskTypes);
router.get("/:id", getTaskTypeById);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createTaskType);
router.put("/:id",
  validateJWT,
  authorizeRoles("admin"),
  updateTaskType);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteTaskType);

export default router;