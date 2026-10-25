
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendEmail({ to, subject, text }) {
  try {
    const info = await transporter.sendMail({
      from: `"Health Screening Team" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text,
    });

    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Email sending failed:", error.message);
    throw error;
  }
}

module.exports = { sendEmail };
