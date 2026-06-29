const express = require("express");
const protect = require("../middleware/authMiddleware");
const Garment = require("../models/Garment");
const { generateOutfitDescription } = require("../services/geminiService");

const router = express.Router();

router.post("/outfit-description", protect, async (req, res) => {

    try {

        const {
            mood,
            occasion,
            season
        } = req.body;

        const garments = await Garment.find({
            userId: req.user.id
        });

        const garmentText = garments
            .map(g => `${g.category} (${g.placement})`)
            .join(", ");

        const description = await generateOutfitDescription({
            mood,
            occasion,
            season,
            garments: garmentText
        });

        res.json({
            success: true,
            description
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

});

module.exports = router;