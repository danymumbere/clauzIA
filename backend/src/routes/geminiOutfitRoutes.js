const express = require("express");
const fs = require("fs");
const path = require("path");
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");
const Garment = require("../models/Garment");
const { GoogleGenAI } = require("@google/genai");

let sharp = null;
try {
  sharp = require("sharp");
} catch {
  console.warn("sharp n'est pas installé : le fallback SVG ne sera pas converti en PNG.");
}

const router = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const GENERATED_DIR = path.join(__dirname, "../../uploads/generated");
const UPLOADS_DIR = path.join(__dirname, "../../uploads");

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

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

function mimeToExt(mimeType = "") {
  const m = mimeType.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("svg")) return "svg";
  return "png";
}

function escapeXml(value) {
  return (value || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlToLocalFilePath(imageUrl) {
  const parsed = new URL(imageUrl);
  const filename = path.basename(decodeURIComponent(parsed.pathname));

  if (parsed.pathname.includes("/generated/")) {
    return path.join(GENERATED_DIR, filename);
  }

  return path.join(UPLOADS_DIR, filename);
}

async function urlToImagePart(imageUrl) {
  if (!imageUrl) return null;
  
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const mimeType = response.headers["content-type"] || "image/png";
  
  return {
    mimeType,
    data: Buffer.from(response.data).toString("base64"),
  };
}

function extractInlineImageFromContentResponse(response) {
  const candidates = response?.candidates || [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return {
          mimeType: part.inlineData.mimeType || "image/png",
          buffer: Buffer.from(part.inlineData.data, "base64"),
        };
      }

      if (part?.image?.imageBytes) {
        return {
          mimeType: part.image.mimeType || "image/png",
          buffer: Buffer.from(part.image.imageBytes, "base64"),
        };
      }
    }
  }

  return null;
}

function pickById(garments, id) {
  if (!id) return null;
  return garments.find((g) => String(g._id) === String(id)) || null;
}

function buildFallbackSvg({
  userPart,
  topPart,
  bottomPart,
  shoesPart,
  accessoryPart,
  mood,
  occasion,
  season,
}) {
  const userData = `data:${userPart.mimeType};base64,${userPart.data}`;
  const topData = `data:${topPart.mimeType};base64,${topPart.data}`;
  const bottomData = `data:${bottomPart.mimeType};base64,${bottomPart.data}`;
  const shoesData = shoesPart ? `data:${shoesPart.mimeType};base64,${shoesPart.data}` : "";
  const accessoryData = accessoryPart ? `data:${accessoryPart.mimeType};base64,${accessoryPart.data}` : "";

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
    <rect width="1200" height="1500" fill="#f6f0ea"/>
    <rect x="40" y="40" width="1120" height="1420" rx="30" fill="#ffffff" stroke="#e5e5e5"/>

    <text x="70" y="100" font-size="34" font-family="Arial" fill="#111">ClauzIA — aperçu temporaire</text>
    <text x="70" y="145" font-size="18" font-family="Arial" fill="#444">
      Humeur: ${escapeXml(mood)} | Occasion: ${escapeXml(occasion)} | Saison: ${escapeXml(season)}
    </text>

    <rect x="70" y="190" width="500" height="1240" rx="24" fill="#fafafa" stroke="#e8e8e8"/>
    <text x="95" y="230" font-size="22" font-family="Arial" fill="#111">Photo utilisateur</text>
    <image href="${userData}" x="95" y="260" width="450" height="1120" preserveAspectRatio="xMidYMid meet"/>

    <rect x="620" y="190" width="510" height="260" rx="24" fill="#fafafa" stroke="#e8e8e8"/>
    <text x="645" y="230" font-size="22" font-family="Arial" fill="#111">Haut</text>
    <image href="${topData}" x="645" y="250" width="180" height="180" preserveAspectRatio="xMidYMid meet"/>
    <text x="850" y="315" font-size="18" font-family="Arial" fill="#444">${escapeXml(mood)}</text>

    <rect x="620" y="480" width="510" height="260" rx="24" fill="#fafafa" stroke="#e8e8e8"/>
    <text x="645" y="520" font-size="22" font-family="Arial" fill="#111">Bas</text>
    <image href="${bottomData}" x="645" y="540" width="180" height="180" preserveAspectRatio="xMidYMid meet"/>
    <text x="850" y="605" font-size="18" font-family="Arial" fill="#444">${escapeXml(occasion)}</text>

    <rect x="620" y="770" width="510" height="260" rx="24" fill="#fafafa" stroke="#e8e8e8"/>
    <text x="645" y="810" font-size="22" font-family="Arial" fill="#111">Chaussures</text>
    ${
      shoesData
        ? `<image href="${shoesData}" x="645" y="830" width="180" height="180" preserveAspectRatio="xMidYMid meet"/>`
        : `<text x="645" y="910" font-size="18" font-family="Arial" fill="#777">Aucune chaussure sélectionnée</text>`
    }

    <rect x="620" y="1060" width="510" height="260" rx="24" fill="#fafafa" stroke="#e8e8e8"/>
    <text x="645" y="1100" font-size="22" font-family="Arial" fill="#111">Accessoire</text>
    ${
      accessoryData
        ? `<image href="${accessoryData}" x="645" y="1120" width="180" height="180" preserveAspectRatio="xMidYMid meet"/>`
        : `<text x="645" y="1200" font-size="18" font-family="Arial" fill="#777">Aucun accessoire sélectionné</text>`
    }
  </svg>`;

  return Buffer.from(svg, "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(err) {
  const status = err?.status || err?.response?.status;
  const message = String(err?.message || "");

  return status === 503 || message.includes("UNAVAILABLE") || message.includes("high demand");
}

async function generateWithRetry(fn, { maxRetries = 3, initialDelayMs = 2000 } = {}) {
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status || err?.response?.status;

      if (!isRetryableGeminiError(err) || attempt === maxRetries) {
        throw err;
      }

      console.log(
        `Gemini indisponible (tentative ${attempt}/${maxRetries}, status ${status}). Nouvelle tentative dans ${delay} ms...`
      );

      await sleep(delay);
      delay *= 2;
    }
  }
}

async function toPngIfPossible(buffer, mimeType) {
  const lower = (mimeType || "").toLowerCase();

  if (sharp) {
    try {
      const pngBuffer = await sharp(buffer).png().toBuffer();
      return {
        buffer: pngBuffer,
        mimeType: "image/png",
        ext: "png",
      };
    } catch (err) {
      console.warn("Conversion PNG impossible, on garde le format original :", err.message);
    }
  }

  return {
    buffer,
    mimeType: lower || "application/octet-stream",
    ext: mimeToExt(lower),
  };
}

async function saveGeneratedImage(buffer, mimeType) {
  const safe = await toPngIfPossible(buffer, mimeType);

  const filename = `look-${Date.now()}-${Math.round(Math.random() * 1e9)}.${safe.ext}`;
  const filePath = path.join(GENERATED_DIR, filename);

  fs.writeFileSync(filePath, safe.buffer);

  return {
    filename,
    filePath,
    mimeType: safe.mimeType,
  };
}

router.post("/generate-image", protect, async (req, res) => {
  try {
    const {
      topId,
      bottomId,
      shoesId,
      accessoryId,
      mood = "",
      occasion = "",
      season = "",
    } = req.body;

    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    if (!user.profilePhotoUrl) {
      return res.status(400).json({
        message: "La photo de profil de l'utilisateur est obligatoire.",
      });
    }

    const selectedIds = [topId, bottomId, shoesId, accessoryId].filter(Boolean);
    if (!selectedIds.length) {
      return res.status(400).json({ message: "Aucun vêtement sélectionné." });
    }

    const garments = await Garment.find({
      userId: req.user.id,
      _id: { $in: selectedIds },
      available: { $ne: false },
    });

    const top = pickById(garments, topId);
    const bottom = pickById(garments, bottomId);
    const shoes = pickById(garments, shoesId);
    const accessory = pickById(garments, accessoryId);

    if (!top || !bottom) {
      return res.status(400).json({
        message: "Le haut et le bas sont nécessaires pour générer la tenue.",
      });
    }

    const userImagePart = await urlToImagePart(user.profilePhotoUrl);
    const topImagePart = await urlToImagePart(top.processedImageUrl || top.imageUrl);
    const bottomImagePart = await urlToImagePart(bottom.processedImageUrl || bottom.imageUrl);

    let shoesImagePart = null;
    let accessoryImagePart = null;

    if (shoes) shoesImagePart = await urlToImagePart(shoes.processedImageUrl || shoes.imageUrl);
    if (accessory) accessoryImagePart = await urlToImagePart(accessory.processedImageUrl || accessory.imageUrl);

    const analysisPrompt = `
Tu es un styliste professionnel.
Analyse les images fournies et résume le style idéal en une phrase courte.
Réponds uniquement avec une phrase simple.

Contexte :
- Humeur : ${mood}
- Occasion : ${occasion}
- Saison : ${season}
`;

    const analysisResponse = await ai.models.generateContent({
      model: process.env.GEMINI_ANALYSIS_MODEL || "models/gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: analysisPrompt },
            { inlineData: userImagePart },
            { inlineData: topImagePart },
            { inlineData: bottomImagePart },
            ...(shoesImagePart ? [{ inlineData: shoesImagePart }] : []),
            ...(accessoryImagePart ? [{ inlineData: accessoryImagePart }] : []),
          ],
        },
      ],
    });

    const styleBrief = (analysisResponse.text || "").trim();

    const finalPrompt = `
Créer une image photoréaliste d'essayage virtuel.

Règles :
- Utiliser la photo de la personne comme base principale.
- Conserver son identité, son visage, sa pose et ses proportions.
- Habiller la personne avec le haut et le bas fournis.
- Intégrer les chaussures et l'accessoire si présents.
- Produire une seule image cohérente, sans texte ni collage.
- Rendu réaliste, propre, naturel.

Style à respecter :
${styleBrief || "Look moderne, harmonieux et photoréaliste."}

Contexte :
- Humeur : ${mood}
- Occasion : ${occasion}
- Saison : ${season}
`;

    let generatedBuffer = null;
    let generatedMimeType = "image/png";

    try {
      const imageResponse = await generateWithRetry(
        () =>
          ai.models.generateContent({
            model: process.env.GEMINI_IMAGE_MODEL || "models/gemini-3.1-flash-image",
            contents: [
              {
                role: "user",
                parts: [
                  { text: finalPrompt },
                  { inlineData: userImagePart },
                  { inlineData: topImagePart },
                  { inlineData: bottomImagePart },
                  ...(shoesImagePart ? [{ inlineData: shoesImagePart }] : []),
                  ...(accessoryImagePart ? [{ inlineData: accessoryImagePart }] : []),
                ],
              },
            ],
          }),
        { maxRetries: 3, initialDelayMs: 2000 }
      );

      const generated = extractInlineImageFromContentResponse(imageResponse);

      if (generated?.buffer) {
        generatedBuffer = generated.buffer;
        generatedMimeType = generated.mimeType || "image/png";
      } else {
        console.warn("Gemini n'a pas renvoyé d'image exploitable. Passage au fallback.");
      }
    } catch (geminiImageError) {
      const status = geminiImageError?.status || geminiImageError?.response?.status;
      const message = String(geminiImageError?.message || "");

      const isQuota =
        status === 429 ||
        message.includes("quota") ||
        message.includes("RESOURCE_EXHAUSTED");

      const isUnavailable =
        status === 503 ||
        message.includes("UNAVAILABLE") ||
        message.includes("high demand");

      if (!(isQuota || isUnavailable)) {
        throw geminiImageError;
      }

      console.warn("Gemini image indisponible, utilisation du fallback SVG.");
    }

    if (!generatedBuffer) {
      const fallbackSvg = buildFallbackSvg({
        userPart: userImagePart,
        topPart: topImagePart,
        bottomPart: bottomImagePart,
        shoesPart: shoesImagePart,
        accessoryPart: accessoryImagePart,
        mood,
        occasion,
        season,
      });

      if (sharp) {
        generatedBuffer = await sharp(fallbackSvg).png().toBuffer();
        generatedMimeType = "image/png";
      } else {
        generatedBuffer = fallbackSvg;
        generatedMimeType = "image/svg+xml";
      }
    }

    // Uploader le look final directement sur Cloudinary
    const finalCloudinaryUrl = await uploadBufferToCloudinary(generatedBuffer, "clauzia_looks");

    return res.json({
      message: "Tenue générée avec succès.",
      generatedImageUrl: finalCloudinaryUrl, // C'est maintenant une URL Cloudinary stable !
      selected: { top, bottom, shoes, accessory },
      styleBrief,
    });
    
  } catch (error) {
    console.error("Erreur génération tenue Gemini:", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la génération.",
      error: error.message,
    });
  }
});

module.exports = router;