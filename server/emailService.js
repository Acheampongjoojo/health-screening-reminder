
const nodemailer = require("nodemailer");
require("dotenv").config();

if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    throw new Error(
        "Missing Gmail configuration. Check GMAIL_USER and GMAIL_APP_PASSWORD in your .env file."
    );
}

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

async function sendEmail({ to, subject, text, html }) {
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        throw new Error("A valid recipient email address is required.");
    }

    if (!subject || !text) {
        throw new Error("Email subject and message are required.");
    }

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
    const safeName = escapeHtml(fullName || "Staff Member");
    const safeMessage = escapeHtml(message || "This is a reminder about your health screening appointment.");

    const safeDate = escapeHtml(screeningDate || "To be confirmed");
    const safeTime = escapeHtml(screeningTime || "To be confirmed");
    const safeClinic = escapeHtml(clinic || "To be confirmed");

    const safeInstructions = escapeHtml(
        instructions || "Please contact the clinic if you need further instructions."
    );

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">

            <style>
                @media only screen and (max-width: 600px) {
                    .email-container {
                        width: 100% !important;
                    }

                    .email-content {
                        padding: 20px !important;
                    }

                    .detail-cell {
                        padding: 10px !important;
                    }
                }
            </style>
        </head>

        <body style="
            margin: 0;
            padding: 0;
            background-color: #f4f7fb;
            font-family: Arial, Helvetica, sans-serif;
        ">

            <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="background-color: #f4f7fb; padding: 25px 10px;"
            >
                <tr>
                    <td align="center">

                        <table
                            role="presentation"
                            class="email-container"
                            width="600"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="
                                width: 100%;
                                max-width: 600px;
                                background-color: #ffffff;
                                border-radius: 10px;
                                overflow: hidden;
                            "
                        >

                            <!-- Header -->
                            <tr>
                                <td style="
                                    background-color: #14532d;
                                    padding: 30px 20px;
                                    text-align: center;
                                ">
                                    <h2 style="
                                        margin: 0;
                                        color: #ffffff;
                                        font-size: 23px;
                                    ">
                                        Health Screening Team
                                    </h2>

                                    <p style="
                                        color: #dcfce7;
                                        margin: 8px 0 0;
                                        font-size: 13px;
                                    ">
                                        Staff Health Screening Notifications
                                    </p>
                                </td>
                            </tr>

                            <!-- Main content -->
                            <tr>
                                <td class="email-content" style="
                                    padding: 30px;
                                    color: #333333;
                                    line-height: 1.7;
                                ">

                                    <h3 style="
                                        margin-top: 0;
                                        color: #14532d;
                                    ">
                                        Hello ${safeName},
                                    </h3>

                                    <p style="font-size: 15px;">
                                        ${safeMessage}
                                    </p>

                                    <h3 style="
                                        color: #14532d;
                                        margin-top: 28px;
                                        margin-bottom: 12px;
                                    ">
                                        Your Appointment Details
                                    </h3>

                                    <!-- Appointment details -->
                                    <table
                                        role="presentation"
                                        width="100%"
                                        cellpadding="0"
                                        cellspacing="0"
                                        border="0"
                                        style="
                                            border: 1px solid #e5e7eb;
                                            border-collapse: collapse;
                                            font-size: 14px;
                                        "
                                    >
                                        <tr>
                                            <td class="detail-cell" style="
                                                padding: 13px;
                                                background-color: #f0fdf4;
                                                border-bottom: 1px solid #e5e7eb;
                                                font-weight: bold;
                                                width: 35%;
                                            ">
                                                Date
                                            </td>

                                            <td class="detail-cell" style="
                                                padding: 13px;
                                                border-bottom: 1px solid #e5e7eb;
                                            ">
                                                ${safeDate}
                                            </td>
                                        </tr>

                                        <tr>
                                            <td class="detail-cell" style="
                                                padding: 13px;
                                                background-color: #f0fdf4;
                                                border-bottom: 1px solid #e5e7eb;
                                                font-weight: bold;
                                            ">
                                                Time
                                            </td>

                                            <td class="detail-cell" style="
                                                padding: 13px;
                                                border-bottom: 1px solid #e5e7eb;
                                            ">
                                                ${safeTime}
                                            </td>
                                        </tr>

                                        <tr>
                                            <td class="detail-cell" style="
                                                padding: 13px;
                                                background-color: #f0fdf4;
                                                border-bottom: 1px solid #e5e7eb;
                                                font-weight: bold;
                                            ">
                                                Clinic
                                            </td>

                                            <td class="detail-cell" style="
                                                padding: 13px;
                                                border-bottom: 1px solid #e5e7eb;
                                            ">
                                                ${safeClinic}
                                            </td>
                                        </tr>

                                        <tr>
                                            <td class="detail-cell" style="
                                                padding: 13px;
                                                background-color: #f0fdf4;
                                                font-weight: bold;
                                            ">
                                                Instructions
                                            </td>

                                            <td class="detail-cell" style="padding: 13px;">
                                                ${safeInstructions}
                                            </td>
                                        </tr>
                                    </table>

                                    <p style="
                                        margin-top: 28px;
                                        font-size: 14px;
                                    ">
                                        Thank you for prioritising your health.
                                    </p>

                                    <p style="font-size: 14px;">
                                        Regards,<br>
                                        <strong style="color: #14532d;">
                                            Health Screening Team
                                        </strong>
                                    </p>

                                </td>
                            </tr>

                            <!-- Footer -->
                            <tr>
                                <td style="
                                    background-color: #f4f7fb;
                                    padding: 20px;
                                    text-align: center;
                                    color: #777777;
                                    font-size: 12px;
                                    line-height: 1.6;
                                ">
                                    This is an automated health screening reminder.

                                    <br>

                                    Please do not reply directly to this email.
                                </td>
                            </tr>

                        </table>

                    </td>
                </tr>
            </table>

        </body>
        </html>
    `;
}






module.exports = { sendEmail, buildEmailHtml };
