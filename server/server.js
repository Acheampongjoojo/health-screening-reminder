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

        const updatedStaff = await Staff.findByIdAndUpdate(
            id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedStaff) {
            return res.status(404).json({ message: "Staff record not found." });
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
