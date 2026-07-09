const express = require("express");
const axios = require("axios");
const { v2: cloudinary } = require("cloudinary"); // Ajout de Cloudinary
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");
const Garment = require("../models/Garment");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

// Ajout de la fonction d'upload Cloudinary (identique aux autres fichiers)
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

function pickById(garments, id) {
  if (!id) return null;
  return garments.find((g) => String(g._id) === String(id)) || null;
}

router.post("/generate", protect, async (req, res) => {
  try {
    const { topId, bottomId, shoesId, accessoryId, mood = "", occasion = "", season = "" } = req.body;

    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    if (!user.profilePhotoUrl) {
      return res.status(400).json({ message: "La photo de profil est obligatoire pour générer une tenue." });
    }

    const selectedIds = [topId, bottomId, shoesId, accessoryId].filter(Boolean);

    if (!selectedIds.length) {
      return res.status(400).json({ message: "Aucun vêtement sélectionné." });
    }

    const garments = await Garment.find({
      userId: req.user.id,
      _id: { $in: selectedIds },
    });

    const top = pickById(garments, topId);
    const bottom = pickById(garments, bottomId);
    const shoes = pickById(garments, shoesId);
    const accessory = pickById(garments, accessoryId);

    const payload = {
      user: {
        name: user.name,
        email: user.email,
        photoUrl: user.profilePhotoUrl,
      },
      context: {
        mood,
        occasion,
        season,
      },
      garments: [
        top ? { placement: "top", imageUrl: top.processedImageUrl || top.imageUrl, category: top.category || "" } : null,
        bottom ? { placement: "bottom", imageUrl: bottom.processedImageUrl || bottom.imageUrl, category: bottom.category || "" } : null,
        shoes ? { placement: "shoes", imageUrl: shoes.processedImageUrl || shoes.imageUrl, category: shoes.category || "" } : null,
        accessory ? { placement: "accessory", imageUrl: accessory.processedImageUrl || accessory.imageUrl, category: accessory.category || "" } : null,
      ].filter(Boolean),
    };

    const pythonResponse = await axios.post(`${AI_SERVICE_URL}/generate-outfit-intelligent`, payload, {
      responseType: "arraybuffer", // On récupère bien un buffer
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: { "Content-Type": "application/json" },
    });

    // CORRECTION ICI : On envoie le Buffer directement sur Cloudinary au lieu de fs.writeFileSync
    const finalCloudinaryUrl = await uploadBufferToCloudinary(
      Buffer.from(pythonResponse.data), 
      "clauzia_looks"
    );

    return res.json({
      message: "Tenue générée avec succès.",
      generatedImageUrl: finalCloudinaryUrl, // URL Cloudinary stable !
      selected: {
        top,
        bottom,
        shoes,
        accessory,
      },
    });
  } catch (error) {
    console.error("Erreur génération tenue:", error.message);
    return res.status(500).json({
      message: "Erreur serveur lors de la génération.",
      error: error.message,
    });
  }
});

module.exports = router;