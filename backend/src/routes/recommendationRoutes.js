const express = require("express");
const Garment = require("../models/Garment");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

function normalize(text) {
  return (text || "").toString().toLowerCase().trim();
}

function inferPlacement(garment) {
  const placement = normalize(garment.placement);
  if (["top", "bottom", "shoes", "accessory"].includes(placement)) {
    return placement;
  }

  const category = normalize(garment.category);

  if (
    category.includes("t-shirt") ||
    category.includes("chemise") ||
    category.includes("pull") ||
    category.includes("sweat") ||
    category.includes("veste") ||
    category.includes("manteau")
  ) {
    return "top";
  }

  if (
    category.includes("jean") ||
    category.includes("pantalon") ||
    category.includes("jupe") ||
    category.includes("robe") ||
    category.includes("short")
  ) {
    return "bottom";
  }

  if (
    category.includes("chauss") ||
    category.includes("sneaker") ||
    category.includes("bott") ||
    category.includes("sandale")
  ) {
    return "shoes";
  }

  return "accessory";
}

function scoreGarment(garment, mood, occasion, season) {
  let score = 0;

  const moodText = normalize(mood);
  const occasionText = normalize(occasion);
  const seasonText = normalize(season);

  const garmentMoodTags = (garment.moodTags || []).map(normalize);
  const garmentOccasionTags = (garment.occasionTags || []).map(normalize);
  const garmentSeason = normalize(garment.season);
  const garmentCategory = normalize(garment.category);

  if (garmentMoodTags.some((tag) => moodText.includes(tag) || tag.includes(moodText))) score += 3;
  if (garmentOccasionTags.some((tag) => occasionText.includes(tag) || tag.includes(occasionText))) score += 3;
  if (garmentSeason && seasonText && garmentSeason.includes(seasonText)) score += 2;

  if (moodText.includes("audac") && ["rouge", "noir", "bleu", "vif"].some((k) => garmentCategory.includes(k))) score += 1;
  if (occasionText.includes("travail") && ["chemise", "pantalon", "pull"].some((k) => garmentCategory.includes(k))) score += 1;
  if (occasionText.includes("sortie") && ["t-shirt", "jean", "veste"].some((k) => garmentCategory.includes(k))) score += 1;

  return score;
}

function pickBest(ranked, placement, usedIds) {
  const exact = ranked.find(
    (item) => item.placement === placement && !usedIds.has(String(item.garment._id))
  );

  if (exact) {
    usedIds.add(String(exact.garment._id));
    return exact.garment;
  }

  const fallback = ranked.find((item) => !usedIds.has(String(item.garment._id)));
  if (fallback) {
    usedIds.add(String(fallback.garment._id));
    return fallback.garment;
  }

  return null;
}

router.post("/", protect, async (req, res) => {
  try {
    const { mood, occasion, season } = req.body;

    const garments = await Garment.find({
      userId: req.user.id,
      available: { $ne: false },
    });

    if (!garments.length) {
      return res.status(400).json({ message: "Aucun vêtement disponible." });
    }

    const ranked = garments
      .map((g) => ({
        garment: g,
        placement: inferPlacement(g),
        score: scoreGarment(g, mood, occasion, season),
      }))
      .sort((a, b) => b.score - a.score);

    const usedIds = new Set();

    const top = pickBest(ranked, "top", usedIds);
    const bottom = pickBest(ranked, "bottom", usedIds);
    const shoes = pickBest(ranked, "shoes", usedIds);
    const accessory = pickBest(ranked, "accessory", usedIds);

    return res.json({
      message: "Recommandation générée.",
      recommendations: {
        top,
        bottom,
        shoes,
        accessory,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Erreur serveur.",
      error: error.message,
    });
  }
});

module.exports = router;