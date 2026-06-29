const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
});

const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const garmentRoutes = require("./routes/garmentRoutes");
const recommendationRoutes = require("./routes/recommendationRoutes");
const geminiOutfitRoutes = require("./routes/geminiOutfitRoutes");
const aiRoutes = require("./routes/aiRoutes");

const app = express();
app.use(express.static(path.join(__dirname, "../../frontend")));

// ===============================
// Connexion MongoDB
// ===============================
connectDB();

// ===============================
// Middlewares
// ===============================
app.use(cors());

app.use(express.json({
  limit: "20mb",
}));

app.use(express.urlencoded({
  extended: true,
  limit: "20mb",
}));

// ===============================
// Fichiers statiques
// ===============================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
);

// ===============================
// Route d'accueil
// ===============================
app.get("/", (req, res) => {
  res.json({
    application: "ClauzIA Backend",
    status: "OK",
    version: "1.0",
    ai: "Gemini",
  });
});

// ===============================
// API
// ===============================
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/garments", garmentRoutes);
app.use("/api/recommendations", recommendationRoutes);

// Génération d'image Gemini
app.use("/api/outfit", geminiOutfitRoutes);

// IA conversationnelle / description
app.use("/api/ai", aiRoutes);

// ===============================
// Vérifications
// ===============================
if (!process.env.MONGODB_URI) {
  console.warn("⚠ MONGODB_URI est absent du fichier .env");
}

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠ GEMINI_API_KEY est absent du fichier .env");
}

// ===============================
// Démarrage
// ===============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("====================================");
  console.log("ClauzIA Backend démarré");
  console.log(`Port : ${PORT}`);
  console.log(`MongoDB : ${process.env.MONGODB_URI ? "OK" : "NON CONFIGURÉ"}`);
  console.log(`Gemini : ${process.env.GEMINI_API_KEY ? "OK" : "NON CONFIGURÉ"}`);
  console.log("====================================");
});