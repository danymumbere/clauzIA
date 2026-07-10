const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const { v2: cloudinary } = require("cloudinary");

const Garment = require("../models/Garment");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 1. On utilise le stockage en mémoire (RAM) pour éviter les crashs
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 2. Fonction pour envoyer un Buffer à Cloudinary (avec les options de redimensionnement)
const uploadBufferToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { 
        folder: folder,
        allowed_formats: ["jpg", "png", "jpeg", "webp"],
        transformation: [{ width: 800, height: 800, crop: "limit" }]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
};

function normalize(text) {
  return (text || "").toString().toLowerCase().trim();
}

function inferPlacementFromCategory(category) {
  const c = normalize(category);
  if (c.includes("t-shirt") || c.includes("chemise") || c.includes("pull") || c.includes("sweat") || c.includes("veste") || c.includes("manteau")) return "top";
  if (c.includes("jean") || c.includes("pantalon") || c.includes("jupe") || c.includes("robe") || c.includes("short")) return "bottom";
  if (c.includes("chauss") || c.includes("sneaker") || c.includes("bott") || c.includes("sandale")) return "shoes";
  return "accessory";
}

function parseTags(value) {
  return value ? value.split(",").map((tag) => tag.trim()).filter(Boolean) : [];
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return undefined;
  const v = String(value).toLowerCase().trim();
  return ["true", "1", "yes", "oui", "on"].includes(v);
}

// 3. La fonction Python prend maintenant directement le Buffer (la RAM)
async function removeBackgroundWithPython(imageBuffer) {
  const form = new FormData();
  form.append("image", imageBuffer, { filename: "image.png" });

  const response = await axios.post(`${AI_SERVICE_URL}/remove-background`, form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const processedUrl = await uploadBufferToCloudinary(
    Buffer.from(response.data), 
    "clauzia_garments_processed"
  );

  return { processedUrl };
}

router.post("/", protect, upload.single("garmentImage"), async (req, res) => {
  try {
    const { placement: rawPlacement, category, season, moodTags, occasionTags } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Aucune image de vêtement envoyée." });
    }

    let placement = normalize(rawPlacement);
    if (!["top", "bottom", "shoes", "accessory"].includes(placement)) {
      placement = inferPlacementFromCategory(category);
    }

    // 4. On upload l'image originale sur Cloudinary manuellement
    const imageUrl = await uploadBufferToCloudinary(req.file.buffer, "clauzia_garments");

    let processedImageUrl = "";
    try {
      // 5. On passe le Buffer directement à l'IA, plus besoin de le retélécharger !
      const processed = await removeBackgroundWithPython(req.file.buffer);
      processedImageUrl = processed.processedUrl;
    } catch (pythonError) {
      console.error("Erreur service Python:", pythonError.message);
    }

    const garment = await Garment.create({
      userId: req.user.id,
      imageUrl: imageUrl,
      processedImageUrl,
      placement,
      category: category || "",
      season: season || "",
      moodTags: parseTags(moodTags),
      occasionTags: parseTags(occasionTags),
      available: true,
    });

    return res.status(201).json({
      message: "Vêtement ajouté avec succès.",
      garment,
    });
  } catch (error) {
    console.error("Erreur upload vêtement:", error);
    return res.status(500).json({
      message: "Erreur serveur.",
      error: error.message,
    });
  }
});

router.put("/:id", protect, upload.single("garmentImage"), async (req, res) => {
  try {
    const garment = await Garment.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!garment) {
      return res.status(404).json({ message: "Vêtement introuvable." });
    }

    const { placement: rawPlacement, category, season, moodTags, occasionTags, available } = req.body;

    let placement = normalize(rawPlacement || garment.placement);
    if (!["top", "bottom", "shoes", "accessory"].includes(placement)) {
      placement = inferPlacementFromCategory(category || garment.category);
    }

    garment.placement = placement;
    garment.category = category ?? garment.category;
    garment.season = season ?? garment.season;
    garment.moodTags = moodTags !== undefined ? parseTags(moodTags) : garment.moodTags;
    garment.occasionTags = occasionTags !== undefined ? parseTags(occasionTags) : garment.occasionTags;

    const parsedAvailable = parseBoolean(available);
    if (parsedAvailable !== undefined) {
      garment.available = parsedAvailable;
    }

    if (req.file) {
      // Même logique pour la modification
      garment.imageUrl = await uploadBufferToCloudinary(req.file.buffer, "clauzia_garments");

      try {
        const processed = await removeBackgroundWithPython(req.file.buffer);
        garment.processedImageUrl = processed.processedUrl;
      } catch (pythonError) {
        console.error("Erreur service Python (update):", pythonError.message);
      }
    }

    await garment.save();

    return res.json({
      message: "Vêtement modifié avec succès.",
      garment,
    });
  } catch (error) {
    console.error("Erreur update vêtement:", error);
    return res.status(500).json({
      message: "Erreur serveur.",
      error: error.message,
    });
  }
});

router.patch("/:id/availability", protect, async (req, res) => {
  try {
    const garment = await Garment.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!garment) {
      return res.status(404).json({ message: "Vêtement introuvable." });
    }

    const parsedAvailable = parseBoolean(req.body.available);
    garment.available = parsedAvailable === undefined ? !garment.available : parsedAvailable;

    await garment.save();

    return res.json({
      message: garment.available ? "Vêtement marqué disponible." : "Vêtement marqué indisponible.",
      garment,
    });
  } catch (error) {
    console.error("Erreur disponibilité vêtement:", error);
    return res.status(500).json({
      message: "Erreur serveur.",
      error: error.message,
    });
  }
});

const extractPublicId = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  const fileWithFolder = parts.slice(-2).join('/'); 
  return fileWithFolder.split('.')[0]; 
};

router.delete("/:id", protect, async (req, res) => {
  try {
    const garment = await Garment.findOne({ _id: req.params.id, userId: req.user.id });

    if (!garment) {
      return res.status(404).json({ message: "Vêtement introuvable." });
    }

    const originalPublicId = extractPublicId(garment.imageUrl);
    if (originalPublicId) {
      await cloudinary.uploader.destroy(originalPublicId);
    }

    if (garment.processedImageUrl) {
      const processedPublicId = extractPublicId(garment.processedImageUrl);
      if (processedPublicId) {
        await cloudinary.uploader.destroy(processedPublicId);
      }
    }

    await Garment.findByIdAndDelete(req.params.id);

    return res.json({ message: "Vêtement et images associés supprimés avec succès." });

  } catch (error) {
    console.error("Erreur lors de la suppression:", error);
    return res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const garments = await Garment.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(garments);
  } catch (error) {
    res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
});

module.exports = router;