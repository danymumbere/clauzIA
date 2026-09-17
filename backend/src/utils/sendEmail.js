const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: process.env.SMTP_PORT || 587,
    secure: false, // false pour le port 587 (utilise STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"ClauzIA" <${process.env.EMAIL_FROM}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // Envoie l'email. Si Brevo refuse l'envoi, une erreur sera automatiquement levée 
  // et attrapée par le catch de ton fichier authRoutes.js
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;