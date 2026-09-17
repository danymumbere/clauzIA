const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,                   // Utilisez 465 (ou 587)
    secure: true,                // true pour 465, false pour 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Ajout utile pour éviter certains rejets de connexion
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

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;