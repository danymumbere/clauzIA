// utils/sendEmail.js
const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  // 1. Configurer le transporteur (Ici avec Gmail pour l'exemple)
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER, // Ton adresse email
      pass: process.env.EMAIL_PASS, // Ton mot de passe d'application
    },
  });

  // 2. Définir les options de l'email
  const mailOptions = {
    from: `"ClauzIA Support" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // 3. Envoyer l'email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;