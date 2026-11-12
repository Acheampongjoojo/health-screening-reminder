const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authenticateAdmin = require("./middleware/auth");

const { startScheduler } = require("./scheduler");
const { sendEmail, buildEmailHtml } = require("./emailService");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const Staff = require("./models/staff");
const ReminderLog = require("./models/reminderLog");

const app = express();

app.use(cors());
app.use(express.json());


/* ADMIN LOGIN */
app.post("/api/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Please enter your username and password."
            });
        }

        if (username !== process.env.ADMIN_USERNAME) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        const passwordMatches = await bcrypt.compare(
            password,
            process.env.ADMIN_PASSWORD_HASH
        );

        if (!passwordMatches) {
            return res.status(401).json({
                message: "Invalid username or password."
            });
        }

        const token = jwt.sign(
            { role: "admin", username },
            process.env.JWT_SECRET,
            { expiresIn: "2h" }
        );

        res.json({
            message: "Login successful.",
            token
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            message: "An error occurred during login."
        });
    }
});


// Connect to MongoDB Atlas
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB connected successfully!");
    })
    .catch((error) => {
        console.error("MongoDB connection failed:", error.message);
    });

// Test route
app.get("/", (req, res) => {
    res.send("Health Screening Reminder API is running!");
});


app.post("/api/admin/test-reminders", authenticateAdmin, async (req, res) => {
    try {
        const { checkReminders } = require("./scheduler");

        const { testDate } = req.body;

        await checkReminders(testDate || null, true);

        res.json({
            message: "Dry run completed. Check the server terminal for results."
        });
    } catch (error) {
        console.error("Dry run failed:", error.message);

        res.status(500).json({
            message: "Dry run failed."
        });
    }
});





app.post("/api/admin/test-email", authenticateAdmin, async (req, res) => {
    try {
        const { to, reminderType } = req.body;

        // Validate recipient email.
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!to || !emailPattern.test(to)) {
            return res.status(400).json({
                message: "Please provide a valid recipient email address."
            });
        }

        // Prepare sample content for each reminder type.
        const templates = {
            yearly: {
                subject: "Your Annual Health Screening Schedule",
                message: "Your annual health screening is scheduled for November 2026. Your exact appointment date and time, along with any preparation instructions, will be communicated closer to your screening.",
                screeningDate: "Scheduled for November 2026",
                screeningTime: "To be communicated",
                clinic: "To be communicated",
                instructions: "Please look out for your upcoming appointment details."
            },

            monthly: {
                subject: "Your Health Screening Is This Month",
                message: "Your annual health screening is scheduled for this month. Please review your appointment details below.",
                screeningDate: "15 November 2026",
                screeningTime: "09:00 AM",
                clinic: "Cocoa Clinic, Kumasi",
                instructions: "Please bring your Ghana Card and relevant documents."
            },

            final: {
                subject: "Health Screening Reminder - Two Days to Go",
                message: "This is a reminder that your annual health screening is in two days. Please make the necessary preparations for your appointment.",
                screeningDate: "15 November 2026",
                screeningTime: "09:00 AM",
                clinic: "Cocoa Clinic, Kumasi",
                instructions: "Please bring your Ghana Card and relevant documents."
            },

            "screening-day": {
                subject: "Your Health Screening Is Today",
                message: "Today is your scheduled annual health screening. Please attend your appointment as scheduled.",
                screeningDate: "15 November 2026",
                screeningTime: "09:00 AM",
                clinic: "Cocoa Clinic, Kumasi",
                instructions: "Please bring your Ghana Card and relevant documents."
            }
        };

        if (!templates[reminderType]) {
            return res.status(400).json({
                message: "Invalid reminder type. Choose yearly, monthly, final, or screening-day."
            });
        }

        const template = templates[reminderType];

        const html = buildEmailHtml({
            fullName: "Test User",
            message: template.message,
            screeningDate: template.screeningDate,
            screeningTime: template.screeningTime,
            clinic: template.clinic,
            instructions: template.instructions
        });

        await sendEmail({
            to,
            subject: template.subject,
            text: `${template.message}\n\nDate: ${template.screeningDate}\nTime: ${template.screeningTime}\nClinic: ${template.clinic}\nInstructions: ${template.instructions}`,
            html
        });

        res.json({
            message: `${reminderType} test email sent successfully. Check the recipient's inbox.`
        });

    } catch (error) {
        console.error("Test email failed:", error.message);

        res.status(500).json({
            message: "Email sending failed. Check the server terminal."
        });
    }
});



// Get all staff members
app.get("/api/staff", authenticateAdmin, async (req, res) => {
    try {
        const staff = await Staff.find().sort({ createdAt: -1 });
        res.status(200).json(staff);
    } catch (error) {
        res.status(500).json({ message: "Failed to retrieve staff." });
    }
});

// Add a staff member
app.post("/api/staff", authenticateAdmin, async (req, res) => {
    try {
        const newStaff = new Staff(req.body);
        const savedStaff = await newStaff.save();

        res.status(201).json(savedStaff);
    } catch (error) {
        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: "Please provide all required staff details.",
                error: error.message,
            });
        }

        res.status(500).json({ message: "Failed to add staff member." });
    }
});

const PORT = process.env.PORT || 5000;

// two routes


/* UPDATE a staff record */

app.put("/api/staff/:id", authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid staff ID." });
        }

        const existingStaff = await Staff.findById(id);

        if (!existingStaff) {
            return res.status(404).json({ message: "Staff record not found." });
        }

        const oldScreeningDate = existingStaff.screeningDate;
        const newScreeningDate = req.body.screeningDate;

        const screeningDateChanged =
            newScreeningDate &&
            new Date(oldScreeningDate).toISOString().split("T")[0] !==
            new Date(newScreeningDate).toISOString().split("T")[0];

        if (screeningDateChanged) {
            console.log(
                `Screening date changed for ${existingStaff.fullName}`
            );
        }

        const updatedStaff = await Staff.findByIdAndUpdate(
            id,
            req.body,
            {
                returnDocument: "after",
                runValidators: true
            }
        );

        if (!updatedStaff) {
            return res.status(404).json({ message: "Staff record not found." });
        }

        if (screeningDateChanged) {
            try {

                if (!updatedStaff.email || !updatedStaff.email.trim()) {
                    console.warn(
                        `[DATE CHANGE NOTIFICATION SKIPPED] No email address for ${updatedStaff.fullName}`
                    );
                } else {

                    const oldDateKey = new Date(oldScreeningDate)
                        .toISOString()
                        .split("T")[0];

                    const newDateKey = new Date(updatedStaff.screeningDate)
                        .toISOString()
                        .split("T")[0];

                    const reminderKey =
                        `${updatedStaff._id}-date-change-${oldDateKey}-${newDateKey}`;

                    const existingLog = await ReminderLog.findOne({ reminderKey });

                    let shouldSend = false;

                    if (existingLog) {
                        if (
                            existingLog.status === "sent" ||
                            existingLog.status === "sending" ||
                            existingLog.status === "needs_review"
                        ) {
                            console.log(
                                `[DATE CHANGE NOTIFICATION SKIPPED] Status: ${existingLog.status} for ${updatedStaff.fullName}`
                            );
                        } else if (existingLog.status === "failed") {
                            const claimedLog = await ReminderLog.findOneAndUpdate(
                                {
                                    reminderKey,
                                    status: "failed"
                                },
                                {
                                    $set: { status: "sending" }
                                },
                                {
                                    returnDocument: "after"
                                }
                            );

                            if (claimedLog) {
                                shouldSend = true;
                            }
                        }
                    } else {
                        try {
                            await ReminderLog.create({
                                reminderKey,
                                staffId: updatedStaff._id,
                                reminderType: "date-change",
                                screeningDate: updatedStaff.screeningDate,
                                status: "sending"
                            });

                            shouldSend = true;
                        } catch (error) {
                            if (error.code === 11000) {
                                console.log(
                                    `[DATE CHANGE NOTIFICATION SKIPPED] Duplicate log for ${updatedStaff.fullName}`
                                );
                            } else {
                                throw error;
                            }
                        }
                    }

                    if (shouldSend) {
                        let emailSent = false;

                        try {
                            await sendEmail({
                                to: updatedStaff.email,
                                subject: "Your Health Screening Appointment Date Has Changed",
                                text:
                                    `Hello ${updatedStaff.fullName},\n\n` +
                                    `Please be informed that your health screening appointment date has been changed.\n\n` +
                                    `Previous date: ${oldDateKey}\n` +
                                    `New date: ${newDateKey}\n\n` +
                                    `Please take note of your new appointment date.\n\n` +
                                    `Regards,\nHealth Screening Team`,

                                html: buildEmailHtml({
                                    fullName: updatedStaff.fullName,
                                    message:
                                        `Your health screening appointment date has been changed. Your previous appointment date was ${oldDateKey}, and your new appointment date is ${newDateKey}. Please take note of this change.`,
                                    screeningDate: newDateKey,
                                    screeningTime: updatedStaff.screeningTime,
                                    clinic: updatedStaff.clinic,
                                    instructions: updatedStaff.instructions
                                })
                            });

                            emailSent = true;

                        } catch (emailError) {
                            try {
                                await ReminderLog.updateOne(
                                    { reminderKey, status: "sending" },
                                    { $set: { status: "needs_review" } }
                                );
                            } catch (logError) {
                                console.error(
                                    "[DATE CHANGE] Could not update failure status:",
                                    logError.message
                                );
                            }

                            console.error(
                                `[DATE CHANGE EMAIL ERROR] ${updatedStaff.fullName}:`,
                                emailError.message
                            );

                            console.warn(
                                `[NEEDS REVIEW] Check whether the date-change email for ${updatedStaff.fullName} was delivered before attempting another send.`
                            );
                        }

                        if (emailSent) {
                            try {
                                const result = await ReminderLog.updateOne(
                                    { reminderKey, status: "sending" },
                                    {
                                        $set: {
                                            status: "sent",
                                            sentAt: new Date()
                                        }
                                    }
                                );

                                if (result.modifiedCount === 1) {
                                    console.log(
                                        `[DATE CHANGE NOTIFICATION SENT] ${updatedStaff.fullName}`
                                    );
                                } else {
                                    console.error(
                                        `[DATE CHANGE] Email operation succeeded, but the reminder log was not updated for ${updatedStaff.fullName}. Check the log before retrying.`
                                    );
                                }

                            } catch (logError) {
                                console.error(
                                    `[DATE CHANGE] Email was sent, but the reminder log could not be updated for ${updatedStaff.fullName}:`,
                                    logError.message
                                );
                            }
                        }
                    }
                }

            } catch (notificationError) {
                console.error(
                    `[DATE CHANGE NOTIFICATION ERROR] Staff record was updated, but notification processing failed for ${updatedStaff.fullName}:`,
                    notificationError.message
                );
            }
        }

        res.json(updatedStaff);

    } catch (error) {
        res.status(400).json({
            message: "Could not update staff record.",
            error: error.message
        });
    }
});


/* DELETE a staff record */
app.delete("/api/staff/:id", authenticateAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid staff ID." });
        }

        const deletedStaff = await Staff.findByIdAndDelete(id);

        if (!deletedStaff) {
            return res.status(404).json({ message: "Staff record not found." });
        }

        res.json({ message: "Staff record deleted successfully." });
    } catch (error) {
        res.status(500).json({
            message: "Could not delete staff record."
        });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startScheduler();
});
