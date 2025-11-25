import express from "express";
import { getTasks, createOrUpdateTask, getTaskById, deleteTask, getTasksByCropId } from "../controllers/tasks.controller.js";
import { authorizeRoles, validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();


router.get("/", getTasks);
router.get("/:id", getTaskById);
router.get("/crop/:cropId", getTasksByCropId);
router.post("/new",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateTask);
router.patch("/:id",
  validateJWT,
  authorizeRoles("admin"),
  createOrUpdateTask);
router.delete("/:id",
  validateJWT,
  authorizeRoles("admin"),
  deleteTask);

export default router;