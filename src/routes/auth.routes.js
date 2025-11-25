import express from "express";
import { registerUser, loginUser, changePassword, updateUserProfile } from "../controllers/auth.controller.js";
import { validateJWT } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.patch("/changePassword", changePassword)
router.patch("/updateUserProfile", updateUserProfile);

router.get("/check-status", validateJWT, (req, res) => {
  res.json({
    message: "Token válido",
    token: req.newToken,
    user: req.user,
  });
});

export default router;