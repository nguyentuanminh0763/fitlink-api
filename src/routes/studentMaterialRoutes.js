import express from "express";
import { authMiddleware } from "~/middlewares/authMiddleware";
import PTMaterial from "~/models/PTMaterial";

const router = express.Router();

// GET /api/student/materials/:packageId
router.get(
  "/materials/:packageId",
  authMiddleware.authenTokenCookie,
  authMiddleware.isStudent,
  async (req, res) => {
    try {
      const mats = await PTMaterial.find({
        sharedWithPackages: req.params.packageId,
      });

      return res.json({ data: mats });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: "Failed to load materials" });
    }
  }
);

export default router;
