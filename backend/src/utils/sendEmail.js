const nodemailer = require("nodemailer");
const dns = require("dns");

// Force globalement Node.js à privilégier l'IPv4 lors de la résolution DNS
dns.setDefaultResultOrder('ipv4first');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    // Utiliser le raccourci "service" est généralement plus stable pour Gmail
    service: "gmail", 
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

  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;