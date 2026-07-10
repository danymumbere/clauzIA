const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

// CORRECTION : Initialisation indispensable de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 1. On remplace CloudinaryStorage par un stockage en mémoire RAM
const storage = multer.memoryStorage();
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

// 2. La route utilise le upload en mémoire
router.post("/profile-photo", protect, upload.single("profilePhoto"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier envoyé." });
    }

    // 3. Fonction pour envoyer manuellement le buffer à Cloudinary
    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { 
            folder: "clauzia_profiles",
            allowed_formats: ["jpg", "png", "jpeg", "webp"]
          },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        stream.end(buffer);
      });
    };

    // 4. On attend que l'envoi soit terminé
    const result = await uploadToCloudinary(req.file.buffer);
    const photoUrl = result.secure_url; 

    // 5. On met à jour la base de données
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
    console.error("Erreur lors de l'upload de la photo :", error);
    res.status(500).json({ message: "Erreur serveur.", error: error.message || "Erreur inconnue" });
  }
});

module.exports = router;