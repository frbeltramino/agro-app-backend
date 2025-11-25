import { Router } from "express";
import { seedDatabase } from "../controllers/seed.controller.js";

export const router = Router();

router.post("/", seedDatabase);