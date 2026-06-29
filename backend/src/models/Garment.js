const mongoose = require("mongoose");

const garmentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    imageUrl: {
      type: String,
      required: true,
    },

    processedImageUrl: {
      type: String,
      default: "",
    },

    placement: {
      type: String,
      required: true,
      enum: ["top", "bottom", "shoes", "accessory"],
    },

    category: {
      type: String,
      default: "",
      trim: true,
    },

    season: {
      type: String,
      default: "",
      trim: true,
    },

    moodTags: {
      type: [String],
      default: [],
    },

    occasionTags: {
      type: [String],
      default: [],
    },

    garmentBase64: {
      type: String,
      default: "",
    },

    available: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Garment", garmentSchema);