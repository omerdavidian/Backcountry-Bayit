import React, {useState, useEffect} from "react";
import {Container, Card, Button, Table, Modal, Form, Alert, Nav} from "react-bootstrap";
import {useNavigate, useLocation} from "react-router-dom";
import {useAuth} from "../utils/AuthContext";
import {collection, getDocs, addDoc, updateDoc, deleteDoc, doc} from "firebase/firestore";
import {db} from "../config/firebase";
import {FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaSignOutAlt, FaSort, FaSortUp, FaSortDown, FaUserPlus, FaUsers, FaDownload, FaEnvelope} from "react-icons/fa";
import EventFormFields from "../components/EventFormFields";
import EmailRSVPsModal from "../components/EmailRSVPsModal";

function Admin() {
  const {currentUser, logout, isManager} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem("adminActiveTab") || "events";
  });

  useEffect(() => {
    sessionStorage.setItem("adminActiveTab", activeTab);
  }, [activeTab]);

  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [rsvps, setRSVPs] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEventForEmail, setSelectedEventForEmail] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [alert, setAlert] = useState({show: false, message: "", type: ""});
  const [eventSortConfig, setEventSortConfig] = useState({key: "date", direction: "asc"});
  const [managerForm, setManagerForm] = useState({
    email: "",
    password: "",
    displayName: "",
  });
  const [eventForm, setEventForm] = useState({
    title: "",
    date: "",
    hour: "6",
    minute: "30",
    period: "PM",
    location: "BCB Community House, Frisco",
    description: "",
    capacity: 40,
    rsvpSources: {website: true, oneTable: false},
    oneTableLink: "",
    rsvpApprovalMode: "immediate",
    limitCapacity: false,
    imageUrl: "",
    imagePosition: 50,
  });

  // Redirect if not logged in or not a manager
  useEffect(() => {
    if (!currentUser) {
      navigate("/login");
    } else if (!isManager) {
      setAlert({
        show: true,
        message: "You do not have permission to access this page.",
        type: "danger",
      });
      setTimeout(() => navigate("/"), 3000);
    }
  }, [currentUser, isManager, navigate]);

  useEffect(() => {
    if (currentUser && isManager) {
      loadUsers();
      loadEvents();
      loadRSVPs();
    }
    // If navigation provided a preferred tab, select it
    if (location?.state && location.state.fromTab) {
      setActiveTab(location.state.fromTab);
    }
  }, [currentUser, isManager]);

  const loadUsers = async () => {
    try {
      const response = await fetch("/api/list-users");
      const result = await response.json();
      if (response.ok) {
        setUsers(result.users || []);
      } else {
        console.error("Error loading users:", result.error);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const loadEvents = async () => {
    try {
      // 1. Fetch from Google Calendar (New System)
      let apiEvents = [];
      try {
        const response = await fetch("/api/events");
        if (response.ok) {
          const data = await response.json();
          apiEvents = data.events.map((event) => {
            const startDate = new Date(event.start);
            const dateStr = event.start.split("T")[0];
            const timeStr = startDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
            return {
              ...event,
              date: dateStr,
              time: timeStr,
              capacity: event.capacity || 40,
              rsvpSources: event.rsvpSources || {website: true, oneTable: false},
              source: "google", // Mark as Google Calendar event
            };
          });
        }
      } catch (err) {
        console.error("Error fetching API events:", err);
      }

      // 2. Fetch from Firestore (Legacy System)
      let firestoreEvents = [];
      try {
        const eventsCollection = collection(db, "events");
        const eventsSnapshot = await getDocs(eventsCollection);
        firestoreEvents = eventsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          source: "firestore", // Mark as Firestore event
        }));
      } catch (err) {
        console.error("Error fetching Firestore events:", err);
      }

      // 3. Fetch RSVPs for Smart Deduplication
      let rsvpsList = [];
      try {
        const rsvpsCollection = collection(db, "rsvps");
        const rsvpsSnapshot = await getDocs(rsvpsCollection);
        rsvpsList = rsvpsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setRSVPs(rsvpsList);
      } catch (err) {
        console.error("Error fetching RSVPs:", err);
      }

      // 4. Merge lists with smart deduplication
      // Strategy: If an event exists in both (matching Title and Date), check which one has RSVPs.
      // Prefer the one with RSVPs. If neither or both have RSVPs, prefer Google (API).

      const firestoreMap = new Map();
      firestoreEvents.forEach((e) => {
        const key = `${e.date}_${e.title}`.toLowerCase();
        firestoreMap.set(key, e);
      });

      const mergedEvents = [];
      const processedKeys = new Set();

      // Process API events
      apiEvents.forEach((apiEvent) => {
        const key = `${apiEvent.date}_${apiEvent.title}`.toLowerCase();
        if (firestoreMap.has(key)) {
          // Collision! Check RSVPs
          const firestoreEvent = firestoreMap.get(key);
          const apiRSVPCount = rsvpsList.filter((r) => r.eventId === apiEvent.id).length;
          const firestoreRSVPCount = rsvpsList.filter((r) => r.eventId === firestoreEvent.id).length;

          // If Firestore has RSVPs and API doesn't (or has fewer), prefer Firestore (Legacy data)
          // Otherwise prefer API (New data)
          if (firestoreRSVPCount > apiRSVPCount) {
            mergedEvents.push(firestoreEvent);
          } else {
            mergedEvents.push(apiEvent);
          }
          processedKeys.add(key);
        } else {
          mergedEvents.push(apiEvent);
        }
      });

      // Add remaining Firestore events
      firestoreEvents.forEach((fsEvent) => {
        const key = `${fsEvent.date}_${fsEvent.title}`.toLowerCase();
        if (!processedKeys.has(key)) {
          mergedEvents.push(fsEvent);
        }
      });

      setEvents(mergedEvents.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (error) {
      console.error("Error loading events:", error);
      setAlert({show: true, message: "Error loading events. Please refresh the page.", type: "danger"});
    }
  };

  const loadRSVPs = async () => {
    try {
      const rsvpsCollection = collection(db, "rsvps");
      const rsvpsSnapshot = await getDocs(rsvpsCollection);
      const rsvpsList = rsvpsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRSVPs(rsvpsList);
    } catch (error) {
      console.error("Error loading RSVPs:", error);
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    console.log("=== FORM SUBMIT STARTED ===");

    try {
      // Construct ISO DateTime
      let hour = parseInt(eventForm.hour);
      if (eventForm.period === "PM" && hour !== 12) hour += 12;
      if (eventForm.period === "AM" && hour === 12) hour = 0;

      // Create date object in local time
      const startDateTime = new Date(`${eventForm.date}T${hour.toString().padStart(2, "0")}:${eventForm.minute}:00`);
      const endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000); // Default 2 hours duration

      // Format as ISO string (YYYY-MM-DDTHH:mm:ss)
      const toLocalISO = (date) => {
        const pad = (n) => n.toString().padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
      };

      const eventData = {
        title: eventForm.title,
        start: toLocalISO(startDateTime),
        end: toLocalISO(endDateTime),
        location: eventForm.location,
        description: eventForm.description,
        capacity: eventForm.capacity,
        rsvpSources: eventForm.rsvpSources || {website: true, oneTable: false},
        oneTableLink: eventForm.oneTableLink || "",
        rsvpApprovalMode: eventForm.rsvpApprovalMode || "immediate",
        limitCapacity: eventForm.limitCapacity || false,
        imageUrl: eventForm.imageUrl || "",
        imagePosition: eventForm.imagePosition ?? 50,
      };

      // Debug logging
      console.log("FINAL eventData to save:", eventData);

      let response;
      if (editingEvent) {
        // Update existing event
        console.log("Updating event with ID:", editingEvent.id);

        if (editingEvent.source === "firestore") {
          // Legacy update: Update in Firestore
          // Note: We need to convert back to the format Firestore expects if it differs,
          // but here we are just updating fields.
          // However, the old schema used 'date' and 'time' strings, not 'start'/'end' ISO.
          // Let's try to maintain compatibility or migrate?
          // Safest is to update the fields we know about.

          const legacyData = {
            ...eventData,
            // Add back legacy fields if needed, or just rely on the new ones if the app supports it.
            // The app seems to read 'date' and 'time' from 'start' in loadEvents, so we should probably save 'start'/'end'
            // But the old app saved 'date' (YYYY-MM-DD) and 'time' (H:MM AM/PM).
            date: eventForm.date,
            time: `${eventForm.hour}:${eventForm.minute} ${eventForm.period}`,
          };

          await updateDoc(doc(db, "events", editingEvent.id), legacyData);
          // Mock response for consistency
          response = {ok: true};
        } else {
          // Google Calendar update
          response = await fetch("/api/events", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id: editingEvent.id, ...eventData}),
          });
        }
      } else {
        // Create new event - ALWAYS use Google Calendar now
        console.log("Creating new event");
        response = await fetch("/api/events", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(eventData),
        });
      }

      if (!response.ok) throw new Error("Failed to save event");

      setAlert({show: true, message: editingEvent ? "Event updated successfully!" : "Event created successfully!", type: "success"});

      setShowEventModal(false);
      resetEventForm();
      loadEvents();
    } catch (error) {
      console.error("Error saving event:", error);
      setAlert({show: true, message: "Error saving event. Please try again.", type: "danger"});
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm("Are you sure you want to delete this event? This will also delete all associated RSVPs.")) {
      try {
        // Find the event to check its source
        const eventToDelete = events.find((e) => e.id === eventId);

        if (eventToDelete && eventToDelete.source === "firestore") {
          // Delete from Firestore
          await deleteDoc(doc(db, "events", eventId));
        } else {
          // Delete from Google Calendar API
          const response = await fetch(`/api/events?id=${eventId}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete event");
        }

        // Delete all RSVPs for this event
        const eventRSVPs = rsvps.filter((rsvp) => rsvp.eventId === eventId);
        const deletePromises = eventRSVPs.map((rsvp) => deleteDoc(doc(db, "rsvps", rsvp.id)));
        await Promise.all(deletePromises);

        setAlert({show: true, message: "Event and associated RSVPs deleted successfully!", type: "success"});
        loadEvents();
        setTimeout(() => {
          setAlert({show: false, message: "", type: ""});
        }, 3000);
      } catch (error) {
        console.error("Error deleting event:", error);
        setAlert({show: true, message: "Error deleting event. Please try again.", type: "danger"});
      }
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);

    // Parse existing time if it exists
    let hour = "6",
      minute = "30",
      period = "PM";
    if (event.time) {
      const timeMatch = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        hour = timeMatch[1];
        minute = timeMatch[2];
        period = timeMatch[3].toUpperCase();
      }
    }

    // Ensure date is in YYYY-MM-DD format for the date input
    let dateStr = "";
    if (event.date) {
      if (typeof event.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
        dateStr = event.date;
      } else if (event.date.toDate && typeof event.date.toDate === "function") {
        // Firestore Timestamp
        const d = event.date.toDate();
        dateStr = d.toISOString().split("T")[0];
      } else {
        // Try to parse as date
        const d = new Date(event.date);
        if (!isNaN(d.getTime())) {
          dateStr = d.toISOString().split("T")[0];
        }
      }
    }
    console.log("Editing event - original date:", event.date, "formatted date:", dateStr);

    // Map legacy requireRSVP to rsvpSources for backward compatibility
    let rsvpSources = {website: true, oneTable: false};
    if (event.rsvpSources) {
      rsvpSources = event.rsvpSources;
    } else if (event.requireRSVP !== undefined) {
      rsvpSources = {website: event.requireRSVP, oneTable: false};
    }

    setEventForm({
      title: event.title,
      date: dateStr,
      hour: hour,
      minute: minute,
      period: period,
      location: event.location,
      description: event.description,
      capacity: event.capacity,
      rsvpSources: rsvpSources,
      oneTableLink: event.oneTableLink || "",
      rsvpApprovalMode: event.rsvpApprovalMode || "immediate",
      limitCapacity: event.limitCapacity !== undefined ? event.limitCapacity : false,
      imageUrl: event.imageUrl || "",
      imagePosition: event.imagePosition || 50,
    });
    setShowEventModal(true);
  };

  const resetEventForm = () => {
    setEditingEvent(null);
    setEventForm({
      title: "",
      date: "",
      hour: "6",
      minute: "30",
      period: "PM",
      location: "BCB Community House, Frisco",
      description: "",
      capacity: 40,
      rsvpSources: {website: true, oneTable: false},
      oneTableLink: "",
      rsvpApprovalMode: "immediate",
      limitCapacity: false,
      imageUrl: "",
      imagePosition: 50,
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleManagerSubmit = async (e) => {
    e.preventDefault();
    try {
      setAlert({show: true, message: "Creating manager account...", type: "info"});

      const response = await fetch("/api/create-manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: managerForm.email,
          password: managerForm.password,
          displayName: managerForm.displayName,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setAlert({show: true, message: "Manager account created successfully!", type: "success"});
        setShowManagerModal(false);
        setManagerForm({email: "", password: "", displayName: ""});
        loadUsers(); // Reload users list
      } else {
        setAlert({show: true, message: `Error: ${result.error}`, type: "danger"});
      }
    } catch (error) {
      console.error("Error creating manager:", error);
      setAlert({show: true, message: `Error creating manager: ${error.message}`, type: "danger"});
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (window.confirm(`Are you sure you want to delete user ${userEmail}?`)) {
      try {
        setAlert({show: true, message: "Deleting user...", type: "info"});

        const response = await fetch("/api/delete-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({userId}),
        });

        const result = await response.json();

        if (response.ok) {
          setAlert({show: true, message: "User deleted successfully!", type: "success"});
          loadUsers(); // Reload users list
        } else {
          setAlert({show: true, message: `Error: ${result.error}`, type: "danger"});
        }
      } catch (error) {
        console.error("Error deleting user:", error);
        setAlert({show: true, message: `Error deleting user: ${error.message}`, type: "danger"});
      }
    }
  };

  const getRSVPsForEvent = (eventId) => {
    return rsvps.filter((rsvp) => rsvp.eventId === eventId);
  };

  const getTotalGuestsForEvent = (eventId) => {
    const eventRSVPs = getRSVPsForEvent(eventId);
    return eventRSVPs.reduce((total, rsvp) => {
      // If RSVP includes an attendees array, treat attendees as the extra people
      // and include the primary attendee if present. This covers cases where
      // `attendees` contains only additional guests (common in the UI screenshots).
      if (Array.isArray(rsvp.attendees)) {
        const attendeesCount = rsvp.attendees.length || 0;
        const primaryPresent = rsvp.firstName || rsvp.email || rsvp.name ? 1 : 0;
        // If attendees appears to already include the primary (unlikely), this
        // will slightly overcount; prefer this logic because screenshots show
        // `attendees` listing additional people beneath the primary.
        return total + attendeesCount + primaryPresent;
      }

      // If RSVP has a numeric guests field, use it (assume it is the total)
      const guestsNum = Number(rsvp.guests);
      if (!isNaN(guestsNum) && guestsNum > 0) return total + guestsNum;

      // Fall back to 1 (the primary person)
      return total + 1;
    }, 0);
  };

  const handleDownloadCSV = (event) => {
    try {
      const rows = getRSVPsForEvent(event.id) || [];
      if (!rows.length) {
        alert("No RSVPs for this event");
        return;
      }

      const escape = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

      const headers = ["Primary First Name", "Primary Last Name", "Primary Email", "Phone", "Additional Attendees", "Dietary Restrictions", "Status", "Timestamp"];

      const lines = [headers.map(escape).join(",")];

      rows.forEach((r) => {
        const attendees = Array.isArray(r.attendees) ? r.attendees.map((a) => `${(a.firstName || "").trim()} ${(a.lastName || "").trim()}${a.email ? " <" + a.email + ">" : ""}`.trim()).join("; ") : "";
        // Normalize timestamp
        let ts = "";
        try {
          if (r.timestamp && typeof r.timestamp.toDate === "function") ts = r.timestamp.toDate().toISOString();
          else ts = r.timestamp ? new Date(r.timestamp).toISOString() : "";
        } catch (e) {
          ts = "";
        }

        const row = [escape(r.firstName), escape(r.lastName), escape(r.email), escape(r.phone), escape(attendees), escape(r.dietaryRestrictions), escape(r.status), escape(ts)];
        lines.push(row.join(","));
      });

      const csv = lines.join("\n");
      const blob = new Blob([csv], {type: "text/csv;charset=utf-8;"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeTitle = (event.title || "event")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      a.download = `${safeTitle || "event"}-rsvps.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export CSV:", error);
      alert("Failed to export CSV. See console for details.");
    }
  };

  const isEventPast = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Parse date as local time to avoid timezone shifts
    let eventD;
    if (typeof eventDate === "string" && eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = eventDate.split("-").map(Number);
      eventD = new Date(year, month - 1, day);
    } else {
      eventD = new Date(eventDate);
    }
    eventD.setHours(0, 0, 0, 0);
    return eventD < today;
  };

  const formatEventDate = (dateString) => {
    // Parse date as local time to avoid timezone shifts
    if (typeof dateString === "string" && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    }
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleEventSort = (key) => {
    let direction = "asc";
    if (eventSortConfig.key === key && eventSortConfig.direction === "asc") {
      direction = "desc";
    }
    setEventSortConfig({key, direction});
  };

  const getSortIcon = (columnKey, sortConfig) => {
    if (sortConfig.key !== columnKey) {
      return <FaSort className="ms-1" style={{opacity: 0.3}} />;
    }
    return sortConfig.direction === "asc" ? <FaSortUp className="ms-1" /> : <FaSortDown className="ms-1" />;
  };

  const sortedEvents = [...events].sort((a, b) => {
    const {key, direction} = eventSortConfig;
    let aVal = a[key];
    let bVal = b[key];

    if (key === "date") {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    } else if (key === "capacity") {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    } else if (key === "rsvpCount") {
      aVal = getRSVPsForEvent(a.id).length;
      bVal = getRSVPsForEvent(b.id).length;
    } else {
      aVal = String(aVal || "").toLowerCase();
      bVal = String(bVal || "").toLowerCase();
    }

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });

  const upcomingEvents = sortedEvents.filter((e) => !isEventPast(e.date));
  const pastEvents = sortedEvents.filter((e) => isEventPast(e.date));

  if (!currentUser || !isManager) {
    return null;
  }

  // Add RSVP button with dynamic color based on pending RSVPs
  const getRSVPButtonVariant = (eventId) => {
    const pendingRSVPs = rsvps.filter((rsvp) => rsvp.eventId === eventId && rsvp.status === "pending");
    return pendingRSVPs.length > 0 ? "warning" : "success";
  };

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold">Admin Dashboard</h1>
            <p className="text-muted mb-0">Welcome, {currentUser.email}</p>
          </div>
          <div>
            <Button variant="outline-danger" onClick={handleLogout}>
              <FaSignOutAlt className="me-2" />
              Logout
            </Button>
          </div>
        </div>

        {alert.show && (
          <Alert variant={alert.type} onClose={() => setAlert({show: false, message: "", type: ""})} dismissible className="mb-4">
            {alert.message}
          </Alert>
        )}

        <Nav variant="tabs" className="mb-4">
          <Nav.Item>
            <Nav.Link active={activeTab === "events"} onClick={() => setActiveTab("events")}>
              <FaCalendarAlt className="me-2" />
              Events
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link active={activeTab === "users"} onClick={() => setActiveTab("users")}>
              <FaUsers className="me-2" />
              Users
            </Nav.Link>
          </Nav.Item>
        </Nav>
        {/* Users Tab */}
        {activeTab === "users" && (
          <>
            <div className="mb-4">
              <Button variant="primary" onClick={() => setShowManagerModal(true)}>
                <FaUserPlus className="me-2" />
                Create Manager
              </Button>
              <Button variant="secondary" className="ms-2" onClick={() => loadUsers()} title="Refresh users list">
                Refresh Users
              </Button>
            </div>

            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <h3 className="mb-4">User Management</h3>
                <Table responsive hover>
                  <thead className="bg-light">
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.uid}>
                        <td>
                          <strong>{user.displayName || "N/A"}</strong>
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`badge ${user.customClaims?.admin ? "bg-danger" : "bg-primary"}`}>{user.customClaims?.admin ? "Admin" : "Manager"}</span>
                        </td>
                        <td>{new Date(user.metadata.creationTime).toLocaleDateString()}</td>
                        <td>
                          <Button variant="outline-danger" size="sm" onClick={() => handleDeleteUser(user.uid, user.email)} disabled={user.email === currentUser.email} title={user.email === currentUser.email ? "Cannot delete your own account" : "Delete user"}>
                            <FaTrash />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                {users.length === 0 && (
                  <div className="text-center text-muted py-5">
                    <FaUsers size={50} className="mb-3" />
                    <p>No users found.</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </>
        )}

        {/* Events Tab */}
        {activeTab === "events" && (
          <>
            <div className="mb-4 d-flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  resetEventForm();
                  setShowEventModal(true);
                }}>
                <FaPlus className="me-2" />
                Add Event
              </Button>
              {/* Test email button removed to prevent sending non-production emails */}
            </div>

            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <h3 className="mb-4">Event Management</h3>
                <Table responsive hover>
                  <thead className="bg-light">
                    <tr>
                      <th onClick={() => handleEventSort("title")} style={{cursor: "pointer", userSelect: "none", width: "20%"}}>
                        Title {getSortIcon("title", eventSortConfig)}
                      </th>
                      <th onClick={() => handleEventSort("date")} style={{cursor: "pointer", userSelect: "none"}}>
                        Date {getSortIcon("date", eventSortConfig)}
                      </th>
                      <th onClick={() => handleEventSort("time")} style={{cursor: "pointer", userSelect: "none"}}>
                        Time {getSortIcon("time", eventSortConfig)}
                      </th>
                      <th onClick={() => handleEventSort("location")} style={{cursor: "pointer", userSelect: "none", width: "15%"}}>
                        Location {getSortIcon("location", eventSortConfig)}
                      </th>
                      <th onClick={() => handleEventSort("rsvpCount")} style={{cursor: "pointer", userSelect: "none"}}>
                        RSVPs {getSortIcon("rsvpCount", eventSortConfig)}
                      </th>
                      <th onClick={() => handleEventSort("capacity")} style={{cursor: "pointer", userSelect: "none"}}>
                        Capacity {getSortIcon("capacity", eventSortConfig)}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEvents.map((event) => {
                      const isPast = isEventPast(event.date);
                      return (
                        <tr key={event.id} style={{opacity: isPast ? 0.5 : 1}}>
                          <td>
                            <strong>{event.title}</strong>
                          </td>
                          <td>{formatEventDate(event.date)}</td>
                          <td>{event.time}</td>
                          <td>{event.location}</td>
                          <td>
                            {getTotalGuestsForEvent(event.id)} guests ({getRSVPsForEvent(event.id).length} RSVPs)
                          </td>
                          <td>{event.capacity}</td>
                          <td>
                            <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEditEvent(event)}>
                              <FaEdit />
                            </Button>
                            <Button variant="outline-danger" size="sm" className="me-2" onClick={() => handleDeleteEvent(event.id)}>
                              <FaTrash />
                            </Button>
                            <Button
                              variant={getRSVPButtonVariant(event.id)}
                              size="sm"
                              onClick={() => {
                                const eventNameSlug = event.title
                                  .toLowerCase()
                                  .replace(/[^a-z0-9]+/g, "-")
                                  .replace(/^-+|-+$/g, "");
                                navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`, {state: {fromTab: activeTab}});
                              }}
                              title="Manage RSVPs">
                              RSVPs
                            </Button>
                            <Button variant="outline-success" size="sm" className="ms-2" onClick={() => handleDownloadCSV(event)} title="Download RSVPs as CSV">
                              <FaDownload />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              className="ms-2"
                              onClick={() => {
                                setSelectedEventForEmail(event);
                                setShowEmailModal(true);
                              }}
                              title="Email Guests">
                              <FaEnvelope />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>

                {events.length === 0 && (
                  <div className="text-center text-muted py-5">
                    <FaCalendarAlt size={50} className="mb-3" />
                    <p>No events yet. Click "Add Event" to create your first event.</p>
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Past Events Section */}
            <div className="mt-4">
              <Card className="border-0 shadow">
                <Card.Body className="p-4">
                  <h4 className="mb-3">Past Events</h4>
                  {pastEvents.length > 0 ? (
                    <Table responsive hover>
                      <thead className="bg-light">
                        <tr>
                          <th style={{width: "20%"}}>Title</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th style={{width: "15%"}}>Location</th>
                          <th>RSVPs</th>
                          <th>Capacity</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastEvents.map((event) => (
                          <tr key={event.id} style={{opacity: 0.6}}>
                            <td>
                              <strong>{event.title}</strong>
                            </td>
                            <td>{formatEventDate(event.date)}</td>
                            <td>{event.time}</td>
                            <td>{event.location}</td>
                            <td>
                              {getTotalGuestsForEvent(event.id)} guests ({getRSVPsForEvent(event.id).length} RSVPs)
                            </td>
                            <td>{event.capacity}</td>
                            <td>
                              <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEditEvent(event)}>
                                <FaEdit />
                              </Button>
                              <Button variant="outline-danger" size="sm" className="me-2" onClick={() => handleDeleteEvent(event.id)}>
                                <FaTrash />
                              </Button>
                              <Button
                                variant={getRSVPButtonVariant(event.id)}
                                size="sm"
                                onClick={() => {
                                  const eventNameSlug = event.title
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, "-")
                                    .replace(/^-+|-+$/g, "");
                                  navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`, {state: {fromTab: activeTab}});
                                }}
                                title="Manage RSVPs">
                                RSVPs
                              </Button>
                              <Button variant="outline-success" size="sm" className="ms-2" onClick={() => handleDownloadCSV(event)} title="Download RSVPs as CSV">
                                <FaDownload />
                              </Button>
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                className="ms-2"
                                onClick={() => {
                                  setSelectedEventForEmail(event);
                                  setShowEmailModal(true);
                                }}
                                title="Email Guests">
                                <FaEnvelope />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <div className="text-center text-muted py-3">No past events.</div>
                  )}
                </Card.Body>
              </Card>
            </div>
          </>
        )}
      </Container>

      {/* Event Modal */}
      <Modal show={showEventModal} onHide={() => setShowEventModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingEvent ? "Edit Event" : "Create New Event"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEventSubmit}>
            <EventFormFields
              eventForm={eventForm}
              setEventForm={setEventForm}
              showCapacityToggle={true}
              handleToggleCapacityLimit={() =>
                setEventForm((prevForm) => ({
                  ...prevForm,
                  limitCapacity: !prevForm.limitCapacity,
                }))
              }
            />

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" size="lg">
                {editingEvent ? "Update Event" : "Create Event"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEventModal(false);
                  resetEventForm();
                }}
                size="lg">
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Email Modal */}
      <EmailRSVPsModal
        show={showEmailModal}
        onHide={() => {
          setShowEmailModal(false);
          setSelectedEventForEmail(null);
        }}
        event={selectedEventForEmail}
        recipients={
          selectedEventForEmail
            ? getRSVPsForEvent(selectedEventForEmail.id)
                .filter((r) => r.status !== "rejected")
                .map((r) => ({
                  email: r.email,
                  name: r.firstName ? `${r.firstName} ${r.lastName}` : r.name,
                }))
                .filter((v, i, a) => a.findIndex((t) => t.email === v.email) === i)
            : []
        }
        onSuccess={() => {
          setAlert({show: true, message: "Emails sent successfully!", type: "success"});
        }}
      />

      {/* Manager Creation Modal */}
      <Modal show={showManagerModal} onHide={() => setShowManagerModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Manager Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleManagerSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Display Name *</Form.Label>
              <Form.Control type="text" required value={managerForm.displayName} onChange={(e) => setManagerForm({...managerForm, displayName: e.target.value})} placeholder="Manager's full name" />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control type="email" required value={managerForm.email} onChange={(e) => setManagerForm({...managerForm, email: e.target.value})} placeholder="manager@example.com" />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password *</Form.Label>
              <Form.Control type="password" required minLength="6" value={managerForm.password} onChange={(e) => setManagerForm({...managerForm, password: e.target.value})} placeholder="Minimum 6 characters" />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit">
                Create Manager
              </Button>
              <Button variant="secondary" onClick={() => setShowManagerModal(false)}>
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Admin;
