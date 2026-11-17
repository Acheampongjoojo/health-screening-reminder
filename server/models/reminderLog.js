
const mongoose = require("mongoose");

const reminderLogSchema = new mongoose.Schema(
    {
        reminderKey: {
            type: String,
            required: true,
            unique: true
        },
        staffId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Staff",
            required: true
        },
        reminderType: {
            type: String,
            required: true
        },
        screeningDate: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ["sending", "sent", "failed", "needs_review", "reviewed"],
            default: "sending"
        },
        sentAt: {
            type: Date
        },
        reviewedAt: {
            type: Date
        },
        reviewedBy: {
            type: String
        },
        reviewNote: {
            type: String,
            trim: true
        },
        reviewOutcome: {
            type: String,
            enum: ["delivered", "not_delivered", "unknown"]
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model("ReminderLog", reminderLogSchema);
