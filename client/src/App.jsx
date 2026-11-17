
import { useEffect, useState } from "react";
import "./App.css";
import Login from "./components/Login";

const API_URL = "http://localhost:5000/api/staff";
const TOKEN_KEY = "healthScreeningAdminToken";

const emptyForm = {
  fullName: "",
  department: "",
  email: "",
  phone: "",
  screeningDate: "",
  screeningTime: "",
  clinic: "",
  instructions: "",
};

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) || ""
  );
  const [checkingSession, setCheckingSession] = useState(true);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const [reminderLogs, setReminderLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [logStatus, setLogStatus] = useState("all");

  const [reviewingLogId, setReviewingLogId] = useState(null);
  const [reviewOutcome, setReviewOutcome] = useState("delivered");
  const [reviewNote, setReviewNote] = useState("");

  function handleLogin(newToken) {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setStaff([]);
    setEditingId(null);
    setFormData({ ...emptyForm });
    setError("");
  }

  async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      handleLogout();
      throw new Error("Your session has expired. Please log in again.");
    }

    return response;
  }

  async function fetchStaff() {
    setLoading(true);

    try {
      setError("");

      const response = await apiRequest(API_URL);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not retrieve staff records."
        );
      }

      setStaff(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReminderLogs(status = logStatus) {
    setLogsLoading(true);
    setLogsError("");

    try {
      const query =
        status !== "all"
          ? `?status=${encodeURIComponent(status)}`
          : "";

      const response = await apiRequest(
        `http://localhost:5000/api/admin/reminder-logs${query}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not retrieve reminder logs."
        );
      }

      setReminderLogs(data);

    } catch (error) {
      console.error("Failed to fetch reminder logs:", error.message);
      setLogsError(error.message);

    } finally {
      setLogsLoading(false);
    }
  }


  async function handleReviewReminder(logId) {
    try {
      const response = await apiRequest(
        `http://localhost:5000/api/admin/reminder-logs/${logId}/review`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reviewOutcome,
            reviewNote,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Could not review reminder."
        );
      }

      setReviewingLogId(null);
      setReviewOutcome("delivered");
      setReviewNote("");

      await fetchReminderLogs(logStatus);

    } catch (error) {
      console.error("Failed to review reminder:", error.message);
      setLogsError(error.message);
    }
  }



  async function handleTestReminders() {
    try {
      setError("");

      const response = await apiRequest(
        "http://localhost:5000/api/admin/test-reminders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            testDate: null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not test reminders."
        );
      }

      alert(result.message);
    } catch (err) {
      setError(err.message);
    }
  }


  useEffect(() => {
    setCheckingSession(false);
  }, []);

  useEffect(() => {
    if (token) {
      fetchStaff();

    } else {
      setStaff([]);
      setReminderLogs([]);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchReminderLogs(logStatus);
    }
  }, [token, logStatus]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleEdit(person) {
    setEditingId(person._id);

    setFormData({
      fullName: person.fullName,
      department: person.department,
      email: person.email,
      phone: person.phone,
      screeningDate: person.screeningDate
        ? person.screeningDate.slice(0, 10)
        : "",
      screeningTime: person.screeningTime,
      clinic: person.clinic,
      instructions: person.instructions || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setError("");
  }

  async function handleDelete(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this staff record?"
    );

    if (!confirmed) return;

    try {
      setError("");

      const response = await apiRequest(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Could not delete staff record."
        );
      }

      if (editingId === id) {
        handleCancelEdit();
      }

      await fetchStaff();
      alert("Staff record deleted successfully.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const isEditing = Boolean(editingId);

    try {
      const response = await apiRequest(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
          `Could not ${isEditing ? "update" : "add"} staff member.`
        );
      }

      setFormData({ ...emptyForm });
      setEditingId(null);

      await fetchStaff();

      alert(
        isEditing
          ? "Staff record updated successfully!"
          : "Staff member added successfully!"
      );
    } catch (err) {
      setError(err.message);
    }
  }

  if (checkingSession) {
    return <p>Checking administrator session...</p>;
  }

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div>
          
          <h1>Health Screening Reminder</h1>
          <p>Manage staff details and upcoming health screenings.</p>
        </div>

        <div className="staff-count">
          <span>Total staff</span>
          <strong>{staff.length}</strong>
          <button
            type="button"
            onClick={handleLogout}
            className="cancel-button"
          >
            Log out
          </button>


          <button
            type="button"
            onClick={handleTestReminders}
            className="submit-button"
          >
            Test Reminders
          </button>


        </div>
      </header>

      <section className="panel">
        <h2>{editingId ? "Edit staff member" : "Add a staff member"}</h2>

        <form onSubmit={handleSubmit} className="staff-form">
          <label>
            Full name
            <input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
              placeholder="Enter full name"
            />
          </label>

          <label>
            Department
            <input
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              placeholder="e.g. Human Resources"
            />
          </label>

          <label>
            Email address
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="staff@example.com"
            />
          </label>

          <label>
            Phone number
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="+233..."
            />
          </label>

          <label>
            Screening date
            <input
              type="date"
              name="screeningDate"
              value={formData.screeningDate}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Screening time
            <input
              type="time"
              name="screeningTime"
              value={formData.screeningTime}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Clinic
            <input
              name="clinic"
              value={formData.clinic}
              onChange={handleChange}
              required
              placeholder="Enter clinic location"
            />
          </label>

          <label className="full-width">
            Instructions and precautions
            <textarea
              name="instructions"
              value={formData.instructions}
              onChange={handleChange}
              placeholder="What should staff bring or do before screening?"
              rows="3"
            />
          </label>

          {error && <p className="error full-width">{error}</p>}

          <button type="submit" className="submit-button">
            {editingId ? "Save changes" : "Add staff member"}
          </button>

          {editingId && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="cancel-button"
            >
              Cancel editing
            </button>
          )}
        </form>
      </section>

      <section className="panel">
        <h2>Staff records</h2>

        {loading ? (
          <p>Loading staff records...</p>
        ) : staff.length === 0 ? (
          <p>No staff records found. Add your first staff member above.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Screening date</th>
                  <th>Time</th>
                  <th>Clinic</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {staff.map((person) => (
                  <tr key={person._id}>
                    <td>{person.fullName}</td>
                    <td>{person.department}</td>
                    <td>
                      {new Date(
                        person.screeningDate
                      ).toLocaleDateString()}
                    </td>
                    <td>{person.screeningTime}</td>
                    <td>{person.clinic}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          type="button"
                          onClick={() => handleEdit(person)}
                          className="edit-button"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(person._id)}
                          className="delete-button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="logs-header">
          <div>
            <h2>Reminder Logs</h2>
            <p>Track health screening reminder emails sent to staff.</p>
          </div>

          <div className="logs-controls">
            <select
              value={logStatus}
              onChange={(event) => setLogStatus(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="sent">Sent</option>
              <option value="sending">Sending</option>
              <option value="failed">Failed</option>
              <option value="needs_review">Needs review</option>
              <option value="reviewed">Reviewed</option>
            </select>

            <button
              type="button"
              onClick={() => fetchReminderLogs(logStatus)}
              className="submit-button"
              disabled={logsLoading}
            >
              {logsLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {logsError && (
          <p className="error">{logsError}</p>
        )}

        {logsLoading ? (
          <p>Loading reminder logs...</p>
        ) : reminderLogs.length === 0 ? (
          <p>No reminder logs found for this status.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>Department</th>
                  <th>Reminder type</th>
                  <th>Screening date</th>
                  <th>Status</th>
                  <th>Sent at</th>
                  <th>Review details</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {reminderLogs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      {log.staffId?.fullName || "Staff record unavailable"}
                    </td>

                    <td>
                      {log.staffId?.department || "—"}
                    </td>

                    <td>
                      {log.reminderType.replace(/-/g, " ")}
                    </td>

                    <td>
                      {log.screeningDate
                        ? new Date(log.screeningDate).toLocaleDateString()
                        : "—"}
                    </td>



                    <td>
                      <span className={`status-badge status-${log.status}`}>
                        {log.status.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td>
                      {log.sentAt
                        ? new Date(log.sentAt).toLocaleString()
                        : "—"}
                    </td>

                    <td>
                      {log.status === "reviewed" ? (
                        <div className="review-details">
                          <p>
                            <strong>Outcome:</strong>{" "}
                            {log.reviewOutcome?.replace(/_/g, " ") || "—"}
                          </p>

                          <p>
                            <strong>Reviewed by:</strong>{" "}
                            {log.reviewedBy || "—"}
                          </p>

                          <p>
                            <strong>Reviewed at:</strong>{" "}
                            {log.reviewedAt
                              ? new Date(log.reviewedAt).toLocaleString()
                              : "—"}
                          </p>

                          <p>
                            <strong>Note:</strong>{" "}
                            {log.reviewNote || "No note provided"}
                          </p>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td>
                      {log.status === "needs_review" ? (
                        <button
                          type="button"
                          className="submit-button"
                          onClick={() => {
                            setReviewingLogId(log._id);
                            setReviewOutcome("delivered");
                            setReviewNote("");
                          }}
                        >
                          Review
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>


      {reviewingLogId && (
        <div className="review-form">
          <h3>Review Reminder</h3>

          <label htmlFor="reviewOutcome">
            Delivery outcome
          </label>

          <select
            id="reviewOutcome"
            value={reviewOutcome}
            onChange={(event) => setReviewOutcome(event.target.value)}
          >
            <option value="delivered">Delivered</option>
            <option value="not_delivered">Not delivered</option>
            <option value="unknown">Unable to confirm</option>
          </select>

          <label htmlFor="reviewNote">
            Review note
          </label>

          <textarea
            id="reviewNote"
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Enter details about the delivery check..."
            rows="3"
          />

          <div className="review-actions">
            <button
              type="button"
              className="submit-button"
              onClick={() => handleReviewReminder(reviewingLogId)}
            >
              Submit Review
            </button>

            <button
              type="button"
              className="cancel-button"
              onClick={() => {
                setReviewingLogId(null);
                setReviewNote("");
                setReviewOutcome("delivered");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}


    </main>
  );
}

export default App;
