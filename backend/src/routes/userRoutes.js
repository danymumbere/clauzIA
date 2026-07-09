const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// Configuration Cloudinary pour les profils
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "clauzia_profiles",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});
const upload = multer({ storage });

router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable." });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
});

router.post("/profile-photo", protect, upload.single("profilePhoto"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier envoyé." });
    }

    // req.file.path contient l'URL sécurisée Cloudinary fournie par multer-storage-cloudinary
    const photoUrl = req.file.path; 

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profilePhotoUrl: photoUrl },
      { new: true }
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