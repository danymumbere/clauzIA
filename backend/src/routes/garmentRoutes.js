const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const Garment = require("../models/Garment");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, "../../uploads");
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "clauzia_garments", // Un dossier sera créé automatiquement sur ton Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp"], // Formats acceptés
    transformation: [{ width: 800, height: 800, crop: "limit" }] // Optionnel : redimensionne les images trop grandes pour économiser du stockage
  },
});

const upload = multer({ storage });

function normalize(text) {
  return (text || "").toString().toLowerCase().trim();
}

function inferPlacementFromCategory(category) {
  const c = normalize(category);

  if (
    c.includes("t-shirt") ||
    c.includes("chemise") ||
    c.includes("pull") ||
    c.includes("sweat") ||
    c.includes("veste") ||
    c.includes("manteau")
  ) {
    return "top";
  }

  if (
    c.includes("jean") ||
    c.includes("pantalon") ||
    c.includes("jupe") ||
    c.includes("robe") ||
    c.includes("short")
  ) {
    return "bottom";
  }

  if (
    c.includes("chauss") ||
    c.includes("sneaker") ||
    c.includes("bott") ||
    c.includes("sandale")
  ) {
    return "shoes";
  }

  return "accessory";
}

function parseTags(value) {
  return value
    ? value.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return undefined;
  const v = String(value).toLowerCase().trim();
  return ["true", "1", "yes", "oui", "on"].includes(v);
}



function deleteLocalFileFromUrl(fileUrl) {
  if (!fileUrl) return;
  try {
    const parsed = new URL(fileUrl);
    const filename = path.basename(decodeURIComponent(parsed.pathname));
    const localPath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch {
    // on ignore si l'URL n'est pas exploitable
  }
}

async function removeBackgroundWithPython(filePath) {
  const form = new FormData();
  form.append("image", fs.createReadStream(filePath));

  const response = await axios.post(`${AI_SERVICE_URL}/remove-background`, form, {
    headers: form.getHeaders(),
    responseType: "arraybuffer",
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  const processedFilename = `processed-${Date.now()}-${Math.round(Math.random() * 1e9)}.png`;
  const processedPath = path.join(UPLOADS_DIR, processedFilename);

  fs.writeFileSync(processedPath, Buffer.from(response.data));

  return {
    processedFilename,
    processedPath,
    processedUrl: `http://localhost:5000/uploads/${processedFilename}`,
  };
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

    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}` || req.file.path ;

    let processedImageUrl = "";
    try {
      const processed = await removeBackgroundWithPython(req.file.path);
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
      garment.imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;

      try {
        const processed = await removeBackgroundWithPython(req.file.path);
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

// Fonction pour récupérer le public_id depuis l'URL Cloudinary
const extractPublicId = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  // Récupère les deux dernières parties (dossier/fichier.ext)
  const fileWithFolder = parts.slice(-2).join('/'); 
  // Enlève l'extension (.png, .jpg)
  return fileWithFolder.split('.')[0]; 
};

router.delete("/:id", protect, async (req, res) => {
  try {
    const garment = await Garment.findOne({ _id: req.params.id, userId: req.user.id });

    if (!garment) {
      return res.status(404).json({ message: "Vêtement introuvable." });
    }

    // 1. Supprimer l'image originale de Cloudinary
    const originalPublicId = extractPublicId(garment.imageUrl);
    if (originalPublicId) {
      await cloudinary.uploader.destroy(originalPublicId);
    }

    // 2. Si tu utilises aussi une image traitée (sans fond par exemple), supprime-la aussi !
    if (garment.processedImageUrl) {
      const processedPublicId = extractPublicId(garment.processedImageUrl);
      if (processedPublicId) {
        await cloudinary.uploader.destroy(processedPublicId);
      }
    }

    // 3. Supprimer le document de la base de données MongoDB
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