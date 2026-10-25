
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
  enum: ["sending", "sent", "failed"],
  default: "sending"
},
    sentAt: {
      type: Date
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReminderLog", reminderLogSchema);
