
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

async function sendEmail({ to, subject, text, html }) {
    try {
        const info = await transporter.sendMail({
            from: `"Health Screening Team" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            text,
            ...(html && { html }),
        });

        console.log("Email sent successfully:", info.messageId);
        return info;
    } catch (error) {
        console.error("Email sending failed:", error.message);
        throw error;
    }
}


// Prevent special characters in staff information from breaking the HTML.
function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return entities[character];
    });
}

// Reusable HTML template for all health screening emails.
function buildEmailHtml({
    fullName,
    message,
    screeningDate,
    screeningTime,
    clinic,
    instructions,
}) {
    const safeName = escapeHtml(fullName);
    const safeMessage = escapeHtml(message);
    const safeDate = escapeHtml(screeningDate);
    const safeTime = escapeHtml(screeningTime);
    const safeClinic = escapeHtml(clinic);
    const safeInstructions = escapeHtml(
        instructions || "Please contact the clinic if you need further instructions."
    );

    return `
        <div style="font-family: Arial, sans-serif; background-color: #f4f7fb; padding: 30px 15px;">
            <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; overflow: hidden;">

                <div style="background-color: #14532d; padding: 25px; text-align: center;">
                    <h2 style="color: #ffffff; margin: 0;">
                        Health Screening Team
                    </h2>
                </div>

                <div style="padding: 30px; color: #333333; line-height: 1.6;">
                    <h3>Hello ${safeName},</h3>

                    <p>${safeMessage}</p>

                    <h3 style="color: #14532d;">Your Appointment Details</h3>

                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eeeeee;"><strong>Date</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #eeeeee;">${safeDate}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eeeeee;"><strong>Time</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #eeeeee;">${safeTime}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px; border-bottom: 1px solid #eeeeee;"><strong>Clinic</strong></td>
                            <td style="padding: 10px; border-bottom: 1px solid #eeeeee;">${safeClinic}</td>
                        </tr>
                        <tr>
                            <td style="padding: 10px;"><strong>Instructions</strong></td>
                            <td style="padding: 10px;">${safeInstructions}</td>
                        </tr>
                    </table>

                    <p style="margin-top: 25px;">
                        Thank you for prioritising your health.
                    </p>

                    <p>
                        Regards,<br />
                        <strong>Health Screening Team</strong>
                    </p>
                </div>

                <div style="background-color: #f4f7fb; padding: 15px; text-align: center; color: #777777; font-size: 12px;">
                    This is an automated health screening reminder.
                </div>

            </div>
        </div>
    `;
}





module.exports = { sendEmail, buildEmailHtml };
