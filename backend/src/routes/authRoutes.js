const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail"); // Import de l'utilitaire

const router = express.Router();

// Inscription
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires." });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      passwordHash,
      isVerified: false, // Explicitement défini à false
    });

    // --- NOUVEAU : Création du token de vérification et envoi de l'email ---
    const verificationToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" } // Le lien expire dans 24 heures
    );

    // L'URL pointera vers ton frontend qui gèrera l'affichage (ex: page de succès)
    // Assure-toi que FRONTEND_URL est défini dans ton .env (ex: http://localhost:5500 ou ton lien Netlify)
    const verificationUrl = `${process.env.FRONTEND_URL}/verify.html?token=${verificationToken}`;

    const message = `
      <h1>Bienvenue sur ClauzIA, ${user.name} !</h1>
      <p>Merci de vous être inscrit. Pour finaliser la création de votre compte, veuillez cliquer sur le lien ci-dessous :</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #0284c7; color: white; text-decoration: none; border-radius: 5px;">Vérifier mon email</a>
      <p>Ce lien est valide pendant 24 heures.</p>
    `;

    try {
      await sendEmail({
        email: user.email,
        subject: "Vérifiez votre adresse email - ClauzIA",
        message,
      });

      return res.status(201).json({
        message: "Utilisateur créé avec succès. Un email de vérification vous a été envoyé.",
      });
    } catch (emailError) {
      console.error("Erreur d'envoi d'email:", emailError);
      // En cas d'échec de l'email, on supprime l'utilisateur pour qu'il puisse réessayer
      await User.findByIdAndDelete(user._id);
      return res.status(500).json({ message: "L'envoi de l'email a échoué. Veuillez réessayer." });
    }
    // ------------------------------------------------------------------------

  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
});

// Nouvelle route : Vérification de l'email
router.get("/verify/:token", async (req, res) => {
  try {
    const { token } = req.params;

    // Décoder le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(400).json({ message: "Utilisateur invalide." });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "Cet email est déjà vérifié." });
    }

    // Mettre à jour l'utilisateur
    user.isVerified = true;
    await user.save();

    return res.status(200).json({ message: "Email vérifié avec succès. Vous pouvez maintenant vous connecter." });
  } catch (error) {
    return res.status(400).json({ message: "Lien de vérification invalide ou expiré.", error: error.message });
  }
});

// Connexion
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe obligatoires." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Identifiants invalides." });
    }

    // --- NOUVEAU : Vérifier si le compte est validé ---
    if (!user.isVerified) {
      return res.status(403).json({ message: "Veuillez vérifier votre email avant de vous connecter." });
    }
    // -------------------------------------------------

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Identifiants invalides." });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      message: "Connexion réussie.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profilePhotoUrl: user.profilePhotoUrl,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Erreur serveur.", error: error.message });
  }
});

module.exports = router;