const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authenticateAdmin = require("./middleware/auth");

const { startScheduler } = require("./scheduler");
const { sendEmail } = require("./emailService");

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

    await checkReminders(null, true);

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
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        message: "Please provide a recipient email address."
      });
    }

    await sendEmail({
      to,
      subject: "Health Screening App - Email Test",
      text: "Success! Your Health Screening Reminder App can now send emails through Gmail."
    });

    res.json({
      message: "Test email sent successfully. Check the recipient's inbox."
    });
  } catch (error) {
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
