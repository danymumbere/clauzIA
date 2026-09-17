const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (options) => {
  await resend.emails.send({
    from: "ClauzIA <onboarding@resend.dev>", // Ou ton propre domaine validé
    to: options.email,
    subject: options.subject,
    html: options.message,
  });
};

module.exports = sendEmail;