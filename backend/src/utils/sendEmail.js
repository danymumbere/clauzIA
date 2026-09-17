const nodemailer = require("nodemailer");
const dns = require("dns");

// Maintient le forçage IPv4 qui a résolu l'erreur ENETUNREACH
dns.setDefaultResultOrder('ipv4first');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,             // Port alternatif pour Gmail
    secure: false,         // Doit être false pour le port 587 (utilise STARTTLS)
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"ClauzIA" <${process.env.EMAIL_USER}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // Ajout d'un timeout explicite pour éviter que la requête ne tourne dans le vide trop longtemps
  transporter.set('connectionTimeout', 10000); // 10 secondes

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;