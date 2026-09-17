const nodemailer = require("nodemailer");

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // ex: 'smtp.gmail.com'
    port: 465,                   // Utilisez 465 (ou 587)
    secure: true,                // true pour 465, false pour 587
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
    // Ajout utile pour éviter certains rejets de connexion
    tls: {
      rejectUnauthorized: false
    }
  });

  const mailOptions = {
    from: `"ClauzIA" <${process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;