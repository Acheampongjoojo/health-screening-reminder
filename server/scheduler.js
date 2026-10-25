

const cron = require("node-cron");
const { DateTime } = require("luxon");
const Staff = require("./models/staff");
const { sendEmail } = require("./emailService");
const ReminderLog = require("./models/reminderLog");

const TIME_ZONE = "Africa/Accra";


async function prepareReminder(reminderKey, staff, reminderType) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const existingReminder = await ReminderLog.findOne({ reminderKey });

  // Never resend a reminder that was already sent.
  if (existingReminder && existingReminder.status === "sent") {
    return false;
  }

  // Skip a recent attempt, but allow a stale attempt to be claimed.
  if (existingReminder && existingReminder.status === "sending") {
    if (existingReminder.updatedAt > tenMinutesAgo) {
      return false;
    }
  }

  // Atomically claim a failed or stale reminder.
  if (
    existingReminder &&
    (
      existingReminder.status === "failed" ||
      existingReminder.status === "sending"
    )
  ) {
    const claimedReminder = await ReminderLog.findOneAndUpdate(
      {
        reminderKey,
        $or: [
          { status: "failed" },
          {
            status: "sending",
            updatedAt: { $lte: tenMinutesAgo }
          }
        ]
      },
      {
        $set: { status: "sending" }
      },
      { new: true }
    );

    return Boolean(claimedReminder);
  }

  // Create a log for a reminder that has never been attempted.
  try {
    await ReminderLog.create({
      reminderKey,
      staffId: staff._id,
      reminderType,
      screeningDate: staff.screeningDate,
      status: "sending"
    });

    return true;
  } catch (error) {
    // Another attempt may have created this unique key first.
    if (error.code === 11000) {
      return false;
    }

    throw error;
  }
}

// Check which reminders are due today.

async function checkReminders(testDate = null) {
  const today = (
    testDate
      ? DateTime.fromISO(testDate, { zone: TIME_ZONE })
      : DateTime.now().setZone(TIME_ZONE)
  ).startOf("day");


  console.log("\nChecking health screening reminders...");
  console.log("Today's date:", today.toISODate());

  try {
    console.log("Checking database for active staff...");
    const staffMembers = await Staff.find({
      isActive: true,
    });
    console.log("Active staff found:", staffMembers.length);

    for (const staff of staffMembers) {
        console.log("Processing staff:", staff.fullName);
      const screeningDate = DateTime
        .fromJSDate(staff.screeningDate, {
          zone: TIME_ZONE,
        })
        .startOf("day");

    if (screeningDate.year < today.year) {
        console.log(
    `[SKIPPED] ${staff.fullName} has a screening date from a previous year.`
    );
        continue;
    }    
      
   
    // 1. Yearly announcement: January 1.
    if (today.month === 1 && today.day === 1) {
      const reminderKey =
        `${staff._id}-yearly-${today.year}`;

      try {
        const existingReminder = await ReminderLog.findOne({
          reminderKey
        });

        if (existingReminder && existingReminder.status === "sent") {
          console.log(
            `[YEARLY ANNOUNCEMENT SKIPPED] Already sent to ${staff.fullName}`
          );
        } else if (
          existingReminder &&
          existingReminder.status === "sending"
        ) {
          console.log(
            `[YEARLY ANNOUNCEMENT SKIPPED] A send attempt is already in progress for ${staff.fullName}`
          );
        } else {
          if (existingReminder && existingReminder.status === "failed") {
            await ReminderLog.updateOne(
              { reminderKey },
              { $set: { status: "sending" } }
            );
          } else {
            await ReminderLog.create({
              reminderKey,
              staffId: staff._id,
              reminderType: "yearly",
              screeningDate: staff.screeningDate,
              status: "sending"
            });
          }

          await sendEmail({
            to: staff.email,
            subject: `Your Annual Health Screening - ${today.year}`,
            text:
              `Hello ${staff.fullName},\n\n` +
              `Your annual health screening is scheduled for ` +
              `${screeningDate.toFormat("MMMM")} ${today.year}.\n\n` +
              `Your exact appointment date and time, along with ` +
              `any preparation instructions, will be communicated ` +
              `closer to your screening.\n\n` +
              `Regards,\nHealth Screening Team`
          });

          await ReminderLog.updateOne(
            { reminderKey },
            { $set: { status: "sent", sentAt: new Date() } }
          );

          console.log(
            `[YEARLY ANNOUNCEMENT SENT] ${staff.fullName} (${staff.email})`
          );
        }
      } catch (emailError) {
        await ReminderLog.updateOne(
          { reminderKey },
          { $set: { status: "failed" } }
        );

        console.error(
          `[YEARLY ANNOUNCEMENT FAILED] ${staff.fullName}:`,
          emailError.message
        );
      }
    }


      
   
    
    // 2. First day of the screening month.
    if (today.day === 1 && today.month === screeningDate.month) {
      const reminderKey =
        `${staff._id}-monthly-${today.toFormat("yyyy-MM")}`;

      try {
        const shouldSend = await prepareReminder(
          reminderKey,
          staff,
          "monthly"
        );

        if (!shouldSend) {
          console.log(
            `[MONTHLY REMINDER SKIPPED] Already sent, or a send attempt is recent, for ${staff.fullName}`
          );
        } else {
          await sendEmail({
            to: staff.email,
            subject: "Your Health Screening Is Scheduled for This Month",
            text:
              `Hello ${staff.fullName},\n\n` +
              `Your annual health screening is scheduled for ` +
              `${screeningDate.toFormat("dd LLLL yyyy")} ` +
              `at ${staff.screeningTime}.\n\n` +
              `Clinic: ${staff.clinic}\n` +
              `Instructions: ${staff.instructions || "Please contact the clinic if you need further instructions."}\n\n` +
              `Regards,\nHealth Screening Team`
          });

          await ReminderLog.updateOne(
            { reminderKey },
            { $set: { status: "sent", sentAt: new Date() } }
          );

          console.log(
            `[MONTHLY REMINDER SENT] ${staff.fullName} (${staff.email})`
          );
        }
      } catch (emailError) {
        await ReminderLog.updateOne(
          { reminderKey },
          { $set: { status: "failed" } }
        );

        console.error(
          `[MONTHLY REMINDER FAILED] ${staff.fullName}:`,
          emailError.message
        );
      }
    }


      
        
        
        // 3. Final reminder: exactly two calendar days before.
        if (
          screeningDate.year === today.year &&
          screeningDate.minus({ days: 2 }).hasSame(today, "day")
        ) {
          const reminderKey =
            `${staff._id}-final-${screeningDate.toISODate()}`;

          try {
            const existingReminder = await ReminderLog.findOne({
              reminderKey
            });

            if (
              existingReminder &&
              existingReminder.status === "sent"
            ) {
              console.log(
                `[FINAL REMINDER SKIPPED] Already sent to ${staff.fullName}`
              );
              continue;
            }

            if (
  existingReminder &&
  existingReminder.status === "sending"
) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  if (existingReminder.updatedAt > tenMinutesAgo) {
    console.log(
      `[FINAL REMINDER SKIPPED] A send attempt is still recent for ${staff.fullName}`
    );
    continue;
  }

  const retryResult = await ReminderLog.updateOne(
  {
    reminderKey,
    status: "sending",
    updatedAt: { $lte: tenMinutesAgo }
  },
  {
    $set: { status: "failed" }
  }
);

if (retryResult.modifiedCount === 0) {
  console.log(
    `[FINAL REMINDER SKIPPED] Could not safely claim retry for ${staff.fullName}`
  );
  continue;
}

  console.log(
    `[FINAL REMINDER RETRY] Previous attempt timed out for ${staff.fullName}`
  );
  existingReminder.status = "failed";
}

            if (
              existingReminder &&
              existingReminder.status === "failed"
            ) {
              await ReminderLog.updateOne(
                { reminderKey },
                { $set: { status: "sending" } }
              );
            } else {
              await ReminderLog.create({
                reminderKey,
                staffId: staff._id,
                reminderType: "final",
                screeningDate: staff.screeningDate,
                status: "sending"
              });
            }

            await sendEmail({
              to: staff.email,
              subject: "Reminder: Your Health Screening Is in Two Days",
              text:
                `Hello ${staff.fullName},\n\n` +
                `This is a reminder that your annual health screening ` +
                `is scheduled for ${screeningDate.toFormat("dd LLLL yyyy")} ` +
                `at ${staff.screeningTime}.\n\n` +
                `Clinic: ${staff.clinic}\n` +
                `Instructions: ${staff.instructions || "Please contact the clinic if you need further instructions."}\n\n` +
                `Please make the necessary preparations for your appointment.\n\n` +
                `Regards,\nHealth Screening Team`
            });

            await ReminderLog.updateOne(
              { reminderKey },
              {
                $set: {
                  status: "sent",
                  sentAt: new Date()
                }
              }
            );

            console.log(
              `[FINAL REMINDER SENT] ${staff.fullName} (${staff.email})`
            );
          } catch (emailError) {
            await ReminderLog.updateOne(
              { reminderKey },
              { $set: { status: "failed" } }
            );

            console.error(
              `[FINAL REMINDER FAILED] ${staff.fullName}:`,
              emailError.message
            );
          }
        }



      
        // 4. Screening-day reminder.
        if (screeningDate.hasSame(today, "day")) {
          const reminderKey =
            `${staff._id}-screening-day-${screeningDate.toISODate()}`;

          try {
            const existingReminder = await ReminderLog.findOne({
              reminderKey
            });

            if (
              existingReminder &&
              existingReminder.status === "sent"
            ) {
              console.log(
                `[SCREENING DAY SKIPPED] Already sent to ${staff.fullName}`
              );
              continue;
            }

            if (
              existingReminder &&
              existingReminder.status === "sending"
            ) {
              console.log(
                `[SCREENING DAY SKIPPED] A send attempt is already in progress for ${staff.fullName}`
              );
              continue;
            }

            if (
              existingReminder &&
              existingReminder.status === "failed"
            ) {
              await ReminderLog.updateOne(
                { reminderKey },
                { $set: { status: "sending" } }
              );
            } else {
              await ReminderLog.create({
                reminderKey,
                staffId: staff._id,
                reminderType: "screening-day",
                screeningDate: staff.screeningDate,
                status: "sending"
              });
            }

            await sendEmail({
              to: staff.email,
              subject: "Your Health Screening Is Today",
              text:
                `Hello ${staff.fullName},\n\n` +
                `This is a reminder that your health screening is scheduled for today, ` +
                `${screeningDate.toFormat("dd LLLL yyyy")} at ${staff.screeningTime}.\n\n` +
                `Clinic: ${staff.clinic}\n` +
                `Instructions: ${staff.instructions || "Please contact the clinic if you need further instructions."}\n\n` +
                `Please attend your appointment as scheduled.\n\n` +
                `Regards,\nHealth Screening Team`
            });

            await ReminderLog.updateOne(
              { reminderKey },
              {
                $set: {
                  status: "sent",
                  sentAt: new Date()
                }
              }
            );

            console.log(
              `[SCREENING DAY SENT] ${staff.fullName} (${staff.email})`
            );
          } catch (emailError) {
            await ReminderLog.updateOne(
              { reminderKey },
              { $set: { status: "failed" } }
            );

            console.error(
              `[SCREENING DAY FAILED] ${staff.fullName}:`,
              emailError.message
            );
          }
        }

        console.log(`Finished checking reminders for ${staff.fullName}.`);
    }
  } catch (error) {
    console.error(
      "Error checking reminders:",
      error.message
    );
  }
        
}

// Run automatically every day at 8:00 AM Ghana time.
function startScheduler() {
  cron.schedule(
    "0 8 * * *",
    () => {
      checkReminders();
    },
    {
      timezone: TIME_ZONE,
    }
  );

  console.log(
    "Health screening scheduler started."
  );
}

module.exports = {
  checkReminders,
  startScheduler,
};
