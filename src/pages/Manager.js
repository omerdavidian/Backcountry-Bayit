import React, {useState, useEffect} from "react";
import {Container, Card, Button, Table, Modal, Form, Alert, Badge, Nav} from "react-bootstrap";
import {useNavigate, useLocation} from "react-router-dom";
import {useAuth} from "../utils/AuthContext";
import {collection, getDocs, updateDoc, deleteDoc, doc} from "firebase/firestore";
import {db} from "../config/firebase";
import {FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaSignOutAlt, FaDownload, FaEnvelope} from "react-icons/fa";
import EventFormFields from "../components/EventFormFields";
import EmailRSVPsModal from "../components/EmailRSVPsModal";
import {authorizedFetch} from "../utils/apiClient";

function Manager() {
  const {currentUser, logout, isManager, userRole} = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [rsvps, setRSVPs] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEventForEmail, setSelectedEventForEmail] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [alert, setAlert] = useState({show: false, message: "", type: ""});
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
    if (!currentUser || !isManager) {
      navigate("/login");
    }
  }, [currentUser, isManager, navigate]);

  useEffect(() => {
    if (currentUser && isManager) {
      loadEvents();
    }
  }, [currentUser, isManager]);

  // Handle edit request from other pages
  useEffect(() => {
    if (location.state?.editEvent) {
      handleEditEvent(location.state.editEvent);
      // Clear state to prevent reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

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
              source: "google",
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
          source: "firestore",
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

  const getRSVPsForEvent = (eventId) => {
    return rsvps.filter((rsvp) => rsvp.eventId === eventId);
  };

  const getTotalGuestsForEvent = (eventId) => {
    const eventRSVPs = getRSVPsForEvent(eventId);
    return eventRSVPs.reduce((total, rsvp) => {
      if (Array.isArray(rsvp.attendees)) {
        const attendeesCount = rsvp.attendees.length || 0;
        const primaryPresent = rsvp.firstName || rsvp.email || rsvp.name ? 1 : 0;
        return total + attendeesCount + primaryPresent;
      }
      const guestsNum = Number(rsvp.guests);
      if (!isNaN(guestsNum) && guestsNum > 0) return total + guestsNum;
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
    if (typeof dateString === "string" && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split("-").map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString("en-US", {year: "numeric", month: "2-digit", day: "2-digit"});
    }
    return new Date(dateString).toLocaleDateString("en-US", {year: "numeric", month: "2-digit", day: "2-digit"});
  };

  const sortedEvents = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcomingEvents = sortedEvents.filter((e) => !isEventPast(e.date));
  const pastEvents = sortedEvents.filter((e) => isEventPast(e.date));

  const handleEventSubmit = async (e) => {
    e.preventDefault();
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

      let response;
      if (editingEvent) {
        if (editingEvent.source === "firestore") {
          // Legacy update: Update in Firestore
          const legacyData = {
            ...eventData,
            date: eventForm.date,
            time: `${eventForm.hour}:${eventForm.minute} ${eventForm.period}`,
          };
          await updateDoc(doc(db, "events", editingEvent.id), legacyData);
          response = {ok: true};
        } else {
          // Google Calendar update
          response = await authorizedFetch("/api/events", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({id: editingEvent.id, ...eventData}),
          });
        }
      } else {
        // Create new event - ALWAYS use Google Calendar now
        response = await authorizedFetch("/api/events", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(eventData),
        });
      }

      if (!response.ok) throw new Error("Failed to save event");

      setAlert({show: true, message: editingEvent ? "Event updated successfully!" : "Event created successfully!", type: "success"});

      setShowEventModal(false);
      setEditingEvent(null);
      resetEventForm();
      loadEvents();

      setTimeout(() => {
        setAlert({show: false, message: "", type: ""});
      }, 3000);
    } catch (error) {
      console.error("Error saving event:", error);
      setAlert({show: true, message: "Error saving event. Please try again.", type: "danger"});
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);

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

    // Map legacy requireRSVP to rsvpSources for backward compatibility
    let rsvpSources = {website: true, oneTable: false};
    if (event.rsvpSources) {
      rsvpSources = event.rsvpSources;
    } else if (event.requireRSVP !== undefined) {
      rsvpSources = {website: event.requireRSVP, oneTable: false};
    }

    setEventForm({
      title: event.title,
      date: event.date,
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

  const handleToggleCapacityLimit = (enabled) => {
    setEventForm((prev) => ({
      ...prev,
      limitCapacity: enabled,
    }));
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      try {
        const eventToDelete = events.find((e) => e.id === eventId);

        if (eventToDelete && eventToDelete.source === "firestore") {
          // Delete from Firestore
          await deleteDoc(doc(db, "events", eventId));
        } else {
          // Delete from Google Calendar API
          const response = await authorizedFetch(`/api/events?id=${eventId}`, {
            method: "DELETE",
          });
          if (!response.ok) throw new Error("Failed to delete event");
        }

        setAlert({show: true, message: "Event deleted successfully!", type: "success"});
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

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (!currentUser || !isManager) {
    return null;
  }

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold">Manager Dashboard</h1>
            <p className="text-muted mb-0">
              Welcome, {currentUser.email} | Role: <Badge bg="primary">{userRole}</Badge>
            </p>
          </div>
          <div>
            <Button variant="outline-danger" onClick={handleLogout}>
              <FaSignOutAlt className="me-2" /> Logout
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
            <Nav.Link active>
              <FaCalendarAlt className="me-2" /> Events
            </Nav.Link>
          </Nav.Item>
        </Nav>
        <div className="mb-4 d-flex gap-2">
          <Button
            variant="primary"
            onClick={() => {
              setEditingEvent(null);
              resetEventForm();
              setShowEventModal(true);
            }}>
            <FaPlus className="me-2" /> Add Event
          </Button>
        </div>

        <Card className="border-0 shadow">
          <Card.Body className="p-4">
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
                {upcomingEvents.map((event) => (
                  <tr key={event.id}>
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
                      <Button variant="outline-danger" size="sm" onClick={() => handleDeleteEvent(event.id)}>
                        <FaTrash />
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        className="ms-2"
                        onClick={() => {
                          const eventNameSlug = event.title
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, "");
                          navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`);
                        }}>
                        RSVPs
                      </Button>
                      <Button variant="outline-success" size="sm" className="ms-2" onClick={() => handleDownloadCSV(event)}>
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
                            variant="success"
                            size="sm"
                            onClick={() => {
                              const eventNameSlug = event.title
                                .toLowerCase()
                                .replace(/[^a-z0-9]+/g, "-")
                                .replace(/^-+|-+$/g, "");
                              navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`);
                            }}>
                            RSVPs
                          </Button>
                          <Button variant="outline-success" size="sm" className="ms-2" onClick={() => handleDownloadCSV(event)}>
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
      </Container>

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
                .flatMap((r) => {
                  const list = [];
                  // Primary
                  if (r.email) {
                    list.push({
                      email: r.email,
                      name: r.firstName ? `${r.firstName} ${r.lastName}` : r.name,
                    });
                  }
                  // Attendees
                  if (Array.isArray(r.attendees)) {
                    r.attendees.forEach((att) => {
                      if (att.email) {
                        list.push({
                          email: att.email,
                          name: att.firstName ? `${att.firstName} ${att.lastName}` : "Guest",
                        });
                      }
                    });
                  }
                  return list;
                })
                .filter((v, i, a) => a.findIndex((t) => t.email === v.email) === i)
            : []
        }
        onSuccess={() => {
          setAlert({show: true, message: "Emails sent successfully!", type: "success"});
        }}
      />

      {/* Event Modal */}
      <Modal show={showEventModal} onHide={() => setShowEventModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingEvent ? "Edit Event" : "Create New Event"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEventSubmit}>
            <EventFormFields eventForm={eventForm} setEventForm={setEventForm} showCapacityToggle={true} handleToggleCapacityLimit={handleToggleCapacityLimit} />

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" size="lg">
                {editingEvent ? "Update Event" : "Create Event"}
              </Button>
              <Button variant="secondary" onClick={() => setShowEventModal(false)} size="lg">
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Manager;
