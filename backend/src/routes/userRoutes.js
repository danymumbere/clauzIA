const express = require("express");
const multer = require("multer");
const path = require("path");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const fs = require("fs");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Récupérer le profil utilisateur connecté
router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
});

// Upload photo de profil
router.post("/profile-photo", protect, upload.single("profilePhoto"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier envoyé." });
    }

    const photoUrl = `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/${req.file.filename}`;
    const photoBase64 =  fs.readFileSync(req.file.path).toString("base64");

    const user =
    await User.findByIdAndUpdate(
      req.user.id,
      {
        profilePhotoUrl: photoUrl,
        profilePhotoBase64: photoBase64
      },
      { new:true }
    ).select("-passwordHash");

    res.json({
      message: "Photo de profil mise à jour.",
      user,
    });
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
});

module.exports = router;