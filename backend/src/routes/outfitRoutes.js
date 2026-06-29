const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const protect = require("../middleware/authMiddleware");
const User = require("../models/User");
const Garment = require("../models/Garment");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";
const GENERATED_DIR = path.join(__dirname, "../../uploads/generated");

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

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
      responseType: "arraybuffer",
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: { "Content-Type": "application/json" },
    });

    const filename = `outfit-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
    const filePath = path.join(GENERATED_DIR, filename);

    fs.writeFileSync(filePath, Buffer.from(pythonResponse.data));

    return res.json({
      message: "Tenue générée avec succès.",
      generatedImageUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/uploads/generated/${filename}`,
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