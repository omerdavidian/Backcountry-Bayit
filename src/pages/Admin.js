import {calendarTimes, eventFormTimes, editTimes} from "../utils/calendar";
import React, {useState, useEffect, useCallback, useRef} from "react";
import {Container, Card, Button, Table, Modal, Form, Alert} from "react-bootstrap";
import {useNavigate, useLocation} from "react-router-dom";
import {useAuth} from "../utils/AuthContext";
import {collection, getDocs, deleteDoc, doc} from "firebase/firestore";
import {db} from "../config/firebase";
import {FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaSignOutAlt, FaSort, FaSortUp, FaSortDown, FaUserPlus, FaUsers, FaDownload, FaEnvelope, FaLock, FaRedoAlt, FaUserSlash} from "react-icons/fa";
import "./AdminDashboard.css";
import DashboardPassword from "../components/DashboardPassword";
import EventFormFields from "../components/EventFormFields";
import EmailRSVPsModal from "../components/EmailRSVPsModal";
import {authorizedFetch} from "../utils/apiClient";

const eventDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit",
});

function isEventPast(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value < eventDayFormat.format(new Date());
  }
  const date = new Date(value?.toDate?.() ?? value);
  return Number.isFinite(date.getTime()) && eventDayFormat.format(date) < eventDayFormat.format(new Date());
}

function Admin({managerView = false}) {
  const createKey = useRef(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [limit, setLimit] = useState(10);
  const [userSearch, setUserSearch] = useState("");
  const [inviteFilter, setInviteFilter] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [sending, setSending] = useState({});
  const {currentUser, logout, isManager, isAdmin} = useAuth();
  const canManageUsers = isAdmin && !managerView;
  const dashboardPath = managerView || !isAdmin ? "/manager" : "/admin";
  const fullName = currentUser?.displayName?.trim();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return canManageUsers ? sessionStorage.getItem("adminActiveTab") || "events" : "events";
  });

  useEffect(() => {
    if (canManageUsers) sessionStorage.setItem("adminActiveTab", activeTab);
  }, [activeTab, canManageUsers]);

  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [rsvps, setRSVPs] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedEventForEmail, setSelectedEventForEmail] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [alert, setAlert] = useState({show: false, message: "", type: ""});
  const [eventSortConfig, setEventSortConfig] = useState({key: "date", direction: "asc"});
  const [managerEmail, setManagerEmail] = useState("");
  const [creatingManager, setCreatingManager] = useState(false);
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
      if (canManageUsers) loadUsers();
      loadEvents();
      loadRSVPs();
    }
    // If navigation provided a preferred tab, select it
    if (canManageUsers && location.state?.fromTab) {
      setActiveTab(location.state.fromTab);
    }
  }, [currentUser, isManager, canManageUsers, location.state]);

  const loadUsers = async () => {
    try {
      const response = await authorizedFetch("/api/list-users");
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
            return {
              ...calendarTimes(event),
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
      const eventData = {
        title: eventForm.title,
        ...eventFormTimes(eventForm, editingEvent),
        version: editingEvent?.version,
        location: eventForm.location,
        description: eventForm.description,
        capacity: eventForm.capacity,
        rsvpSources: {...eventForm.rsvpSources, website: eventForm.websiteRSVP ?? eventForm.rsvpSources?.website ?? true},
        oneTableLink: eventForm.oneTableLink || "",
        rsvpApprovalMode: eventForm.rsvpApprovalMode || "immediate",
        limitCapacity: eventForm.limitCapacity || false,
        imageUrl: eventForm.imageUrl || "",
        imagePosition: eventForm.imagePosition ?? 50,
      };

      // Debug logging
      console.log("FINAL eventData to save:", eventData);

      if (!editingEvent) {
        createKey.current ||= window.crypto.randomUUID();
        eventData.createKey = createKey.current;
      }
      let response;
      if (editingEvent) {
        // Update existing event
        console.log("Updating event with ID:", editingEvent.id);

        if (editingEvent.source === "firestore") {
          response = await authorizedFetch("/api/events?source=firestore", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
              id: editingEvent.id, ...eventData, date: eventForm.date,
              time: `${eventForm.hour}:${eventForm.minute} ${eventForm.period}`,
            }),
          });
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
        console.log("Creating new event");
        response = await authorizedFetch("/api/events", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(eventData),
        });
      }

      if (!response.ok) throw new Error((await response.json()).error || "Failed to save event");

      setAlert({show: true, message: editingEvent ? "Event updated successfully!" : "Event created successfully!", type: "success"});

      setShowEventModal(false);
      resetEventForm();
      loadEvents();
    } catch (error) {
      console.error("Error saving event:", error);
      setAlert({show: true, message: error.message || "Error saving event. Please try again.", type: "danger"});
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm("Are you sure you want to delete this event? This will also delete all associated RSVPs.")) {
      try {
        // Find the event to check its source
        const eventToDelete = events.find((e) => e.id === eventId);

        const source = eventToDelete?.source === "firestore" ? "&source=firestore" : "";
        const version = eventToDelete?.version ? "&version=" + encodeURIComponent(eventToDelete.version) : "";
        const response = await authorizedFetch(`/api/events?id=${encodeURIComponent(eventId)}${source}${version}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error("Failed to delete event");

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

  const handleEditEvent = useCallback((event) => {
    if (!isAdmin && isEventPast(event.start || event.date)) {
      setAlert({show: true, message: "Only admins can edit past events.", type: "warning"});
      return;
    }
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
      ...editTimes(event),
    });
    setShowEventModal(true);
  }, [isAdmin]);

  useEffect(() => {
    if (currentUser && isManager && location.state?.editEvent) {
      setActiveTab("events");
      handleEditEvent(location.state.editEvent);
    }
  }, [currentUser, isManager, location.state, handleEditEvent]);

  const resetEventForm = () => {
    createKey.current = null;
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

  const resendInvitation = async (user) => {
    const {uid, email, role} = user;
    if (role === "manager" && !window.confirm(`Send a new sign-in link to ${email}? Their manager access and password will stay active.`)) return;
    setSending(previous => ({...previous, [uid]: true}));
    try {
      const response = await authorizedFetch("/api/manager-invitation", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({uid, reset: true})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setAlert({show: true, type: "success", message: "Invitation sent."});
    } catch (error) {
      setAlert({show: true, type: "danger", message: error.message});
    } finally {
      await loadUsers();
      setSending(previous => ({...previous, [uid]: false}));
    }
  };

  const handleManagerSubmit = async (e) => {
    e.preventDefault();
    if (creatingManager) return;
    setCreatingManager(true);
    try {
      setAlert({show: true, message: "Sending manager invitation…", type: "info"});

      const response = await authorizedFetch("/api/create-manager", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({email: managerEmail.trim()}),
      });

      const result = await response.json();

      if (response.ok) {
        setAlert({show: true, message: "Manager invitation sent.", type: "success"});
        setManagerEmail("");
      } else {
        setAlert({show: true, message: `Error: ${result.error}`, type: "danger"});
      }
    } catch (error) {
      console.error("Error creating manager:", error);
      setAlert({show: true, message: `Could not send the invitation: ${error.message}`, type: "danger"});
    } finally {
      setCreatingManager(false);
      loadUsers();
    }
  };

  const handleRemoveManager = async (userId, userEmail) => {
    if (window.confirm(`Remove manager access for ${userEmail}? Their account and profile will be kept.`)) {
      setSending(previous => ({...previous, [userId]: true}));
      try {
        setAlert({show: true, message: "Removing manager access…", type: "info"});

        const response = await authorizedFetch("/api/delete-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({userId}),
        });

        const result = await response.json();

        if (response.ok) {
          setAlert({show: true, message: "Manager access removed.", type: "success"});
          await loadUsers();
        } else {
          setAlert({show: true, message: `Error: ${result.error}`, type: "danger"});
        }
      } catch (error) {
        console.error("Error removing manager access:", error);
        setAlert({show: true, message: `Error removing manager access: ${error.message}`, type: "danger"});
      } finally {
        setSending(previous => ({...previous, [userId]: false}));
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

  const formatUserDate = (dateString) => {
    if (!dateString) {
      return "Never";
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
      return "Never";
    }

    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
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

  const allUpcoming = sortedEvents.filter((event) => !isEventPast(event.start || event.date));
  const eventMatches = (event) => [event.title, event.location]
    .some(value => String(value || "").toLowerCase().includes(eventSearch.trim().toLowerCase()));
  const upcomingEvents = allUpcoming.filter(eventMatches);
  const activeEventIds = new Set(allUpcoming.map(event => event.id));
  const pendingRSVPs = rsvps.filter(rsvp => activeEventIds.has(rsvp.eventId) && rsvp.status === "pending").length;
  const pendingInvites = users.filter(user => user.managerEligible && user.invitationStatus === "Pending").length;
  const visibleUsers = users.filter(user =>
    [user.displayName, user.email].some(value => String(value || "").toLowerCase().includes(userSearch.trim().toLowerCase())) &&
    (!inviteFilter || user.invitationStatus === inviteFilter)
  );
  const eventTimeMinutes = (time = "") => {
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(String(time || "").trim());
    if (!match) return 0;
    const [, hour, minute, period] = match;
    const hours = period ? Number(hour) % 12 + (period.toUpperCase() === "PM" ? 12 : 0) : Number(hour);
    return hours * 60 + Number(minute);
  };
  const pastEvents = sortedEvents.filter((e) => isEventPast(e.start || e.date) && eventMatches(e)).sort((a, b) =>
    new Date(b.date) - new Date(a.date) || eventTimeMinutes(b.time) - eventTimeMinutes(a.time));

  if (!currentUser || !isManager) {
    return null;
  }

  // Add RSVP button with dynamic color based on pending RSVPs
  const getRSVPButtonVariant = (eventId) => {
    const pendingRSVPs = rsvps.filter((rsvp) => rsvp.eventId === eventId && rsvp.status === "pending");
    return pendingRSVPs.length > 0 ? "warning" : "success";
  };

  return (
    <div className="admin-page min-vh-100">
      <Container fluid>
        <div className="dashboard-shell">
          <aside className="dashboard-sidebar">
            <div className="dashboard-sidebar-title">
              <img src="/images/logo.webp" alt="" width="34" height="34" />
              <span>Backcountry Bayit</span>
            </div>
            <nav className="dashboard-menu" aria-label="Dashboard sections">
              {[
                ["events", "Events", FaCalendarAlt],
                ...(canManageUsers ? [["users", "Users", FaUsers]] : []),
                ["account", "Account & security", FaLock],
              ].map(([section, label, Icon]) => (
                <button key={section} type="button" className="dashboard-menu-item"
                  aria-current={activeTab === section ? "page" : undefined}
                  onClick={() => setActiveTab(section)}>
                  <Icon aria-hidden="true" /> <span>{label}</span>
                </button>
              ))}
            </nav>
            <button type="button" className="dashboard-menu-item dashboard-signout" onClick={handleLogout}>
              <FaSignOutAlt aria-hidden="true" /> <span>Log out</span>
            </button>
          </aside>
          <div className="dashboard-content">
        <div className="admin-page-header">
          <div>
            <h1 className="fw-bold">{dashboardPath === "/manager" ? "Manager Dashboard" : "Admin Dashboard"}</h1>
            <p className="text-muted mb-0">{fullName ? `Welcome, ${fullName}` : "Welcome back"}</p>
          </div>
        </div>

        {alert.show && (
          <Alert variant={alert.type} onClose={() => setAlert({show: false, message: "", type: ""})} dismissible className="mb-4">
            {alert.message}
          </Alert>
        )}

        {activeTab === "events" && <section className="dashboard-stats" aria-label="Dashboard overview">
          {[
            [FaCalendarAlt, allUpcoming.length, "Upcoming events"],
            [FaUsers, pendingRSVPs, "Upcoming RSVPs awaiting approval"],
            ...(canManageUsers ? [[FaEnvelope, pendingInvites, "Pending invitations"]] : []),
          ].map(([Icon, count, label]) => (
            <div className="dashboard-stat" key={label}>
              <Icon aria-hidden="true" />
              <div><strong>{count}</strong><span>{label}</span></div>
            </div>
          ))}
        </section>}

        {activeTab === "account" && <DashboardPassword user={currentUser} />}

        {/* Users Tab */}
        {canManageUsers && activeTab === "users" && (
          <>
            <div className="dashboard-toolbar mb-4">
              {isAdmin && (
                <Form className="manager-invite-form" onSubmit={handleManagerSubmit}>
                  <Form.Label htmlFor="manager-email" className="visually-hidden">Manager email address</Form.Label>
                  <Form.Control id="manager-email" type="email" required maxLength={254} autoComplete="off"
                    value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="Manager email address" />
                  <Button type="submit" disabled={creatingManager}>
                    <FaUserPlus className="me-2" aria-hidden="true" />
                    {creatingManager ? "Sending…" : "Send invitation"}
                  </Button>
                </Form>
              )}
              <Button variant="secondary" className="dashboard-refresh" onClick={() => loadUsers()} title="Refresh users list">
                Refresh Users
              </Button>
            </div>

            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <div className="dashboard-section-head">
                  <h2>User Management <span>{visibleUsers.length} of {users.length}</span></h2>
                  <div className="dashboard-filters">
                    <Form.Control type="search" aria-label="Search users" placeholder="Search name or email" value={userSearch} onChange={e => setUserSearch(e.target.value)} />
                    <Form.Select aria-label="Invitation status" value={inviteFilter} onChange={e => setInviteFilter(e.target.value)}>
                      <option value="">All invitation statuses</option>
                      {["Never sent", "Pending", "Accepted", "Expired", "Failed", "Revoked"].map(status => <option key={status}>{status}</option>)}
                    </Form.Select>
                  </div>
                </div>
                <Table responsive hover className="dashboard-users">
                  <thead className="bg-light">
                    <tr>
                      <th>Account</th>
                        <th>Role</th>
                      <th>Created</th>
                      <th>Last Signed In</th><th>Invitation</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((user) => (
                      <tr key={user.uid}>
                        <td>
                          <div className="dashboard-person">
                            <span className="dashboard-initial" aria-hidden="true">{(user.displayName || user.email || "?").trim().charAt(0).toUpperCase()}</span>
                            <div><strong>{user.displayName || user.email?.split("@")[0] || "Unnamed user"}</strong>
                              <small>{user.email}</small></div>
                          </div>
                        </td>
                        <td>
                          <span className="dashboard-role" data-role={user.role}>{user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "User"}</span>
                        </td>
                        <td data-label="Created">{formatUserDate(user.metadata.creationTime).split(",")[0]}</td>
                        <td data-label="Last signed in">{formatUserDate(user.metadata.lastSignInTime)}</td>
                        <td data-label="Invitation">
                          {user.invitationStatus && user.invitationStatus !== "Never sent" ? <div className="dashboard-invitation">
                            <span className="invitation-status" data-status={user.invitationStatus}>{user.invitationStatus}</span>
                            {user.lastSent && <small className="text-muted">Sent {formatUserDate(user.lastSent)}</small>}
                          </div> : <span className="text-muted">—</span>}
                        </td>
                        <td>
                          {isAdmin && <div className="dashboard-user-actions">
                            {(user.canResetInvitation ?? user.managerEligible) && <button
                              type="button" className="dashboard-icon-action reset-invitation"
                              title={user.role === "manager" ? "Reset invitation" : "Send new invitation"}
                              aria-busy={Boolean(sending[user.uid])}
                              aria-label={user.role === "manager" ? `Reset invitation for ${user.displayName || user.email}` : "Resend Invitation"}
                              disabled={sending[user.uid]} onClick={() => resendInvitation(user)}>
                              <FaRedoAlt aria-hidden="true" />
                            </button>}
                            {(user.canRevokeManager ?? (user.role === "manager")) && <button
                              type="button" className="dashboard-icon-action revoke-manager" title="Revoke manager access"
                              aria-label={`Remove manager access for ${user.displayName || user.email}`}
                              onClick={() => handleRemoveManager(user.uid, user.email)}
                              disabled={user.uid === currentUser.uid || sending[user.uid]}>
                              <FaUserSlash aria-hidden="true" />
                            </button>}
                          </div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                {visibleUsers.length === 0 && (
                  <div className="text-center text-muted py-5">
                    <FaUsers size={50} className="mb-3" />
                    <p>{users.length ? "No users match your filters." : "No users found."}</p>
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
                <div className="dashboard-section-head">
                  <h2>Upcoming Events ({upcomingEvents.length})</h2>
                  <div className="dashboard-filters">
                    <Form.Control type="search" aria-label="Search upcoming and past events" placeholder="Search title or location" value={eventSearch} onChange={e => {setEventSearch(e.target.value); setLimit(10);}} />
                  </div>
                </div>
                <Table responsive hover className="responsive-event-table">
                  <thead className="bg-light">
                    <tr>
                      <th aria-sort={eventSortConfig.key === "title" ? (eventSortConfig.direction === "asc" ? "ascending" : "descending") : "none"}>
                        <button className="event-sort" type="button" onClick={() => handleEventSort("title")}>
                          Title {getSortIcon("title", eventSortConfig)}
                        </button>
                      </th>
                      <th aria-sort={eventSortConfig.key === "date" ? (eventSortConfig.direction === "asc" ? "ascending" : "descending") : "none"}>
                        <button className="event-sort" type="button" onClick={() => handleEventSort("date")}>
                          Date {getSortIcon("date", eventSortConfig)}
                        </button>
                      </th>
                      <th aria-sort={eventSortConfig.key === "time" ? (eventSortConfig.direction === "asc" ? "ascending" : "descending") : "none"}>
                        <button className="event-sort" type="button" onClick={() => handleEventSort("time")}>
                          Time {getSortIcon("time", eventSortConfig)}
                        </button>
                      </th>
                      <th aria-sort={eventSortConfig.key === "location" ? (eventSortConfig.direction === "asc" ? "ascending" : "descending") : "none"}>
                        <button className="event-sort" type="button" onClick={() => handleEventSort("location")}>
                          Location {getSortIcon("location", eventSortConfig)}
                        </button>
                      </th>
                      <th aria-sort={eventSortConfig.key === "rsvpCount" ? (eventSortConfig.direction === "asc" ? "ascending" : "descending") : "none"}>
                        <button className="event-sort" type="button" onClick={() => handleEventSort("rsvpCount")}>
                          RSVPs {getSortIcon("rsvpCount", eventSortConfig)}
                        </button>
                      </th>
                      <th aria-sort={eventSortConfig.key === "capacity" ? (eventSortConfig.direction === "asc" ? "ascending" : "descending") : "none"}>
                        <button className="event-sort" type="button" onClick={() => handleEventSort("capacity")}>
                          Capacity {getSortIcon("capacity", eventSortConfig)}
                        </button>
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingEvents.map((event) => {
                      const isPast = isEventPast(event.start || event.date);
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
                            <Button variant="outline-primary" size="sm" className="me-2" disabled={event.recurring} title={event.recurring ? "Edit recurring events in Google Calendar" : "Edit event"} onClick={() => handleEditEvent(event)}>
                              <FaEdit />
                            </Button>
                            <Button variant="outline-danger" size="sm" className="me-2" disabled={event.recurring} title={event.recurring ? "Cancel recurring events in Google Calendar" : "Delete event"} onClick={() => handleDeleteEvent(event.id)}>
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
                                navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`, {state: {fromTab: "events", dashboardPath}});
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
                  <h3 className="mb-0"><button className="archive-toggle" aria-expanded={archiveOpen} aria-controls="past-events" onClick={() => {setArchiveOpen(!archiveOpen); setLimit(10);}}>
                    Past Events ({pastEvents.length}) <span aria-hidden="true">{archiveOpen ? "−" : "+"}</span>
                  </button></h3>
                  <div id="past-events" hidden={!archiveOpen} className="event-archive" tabIndex={0} aria-label="Past events" role="region" onScroll={({currentTarget: box}) => {
                    if (box.scrollHeight - box.scrollTop - box.clientHeight < 48) setLimit(Math.min(limit + 10, pastEvents.length));
                  }}>
                  {pastEvents.length > 0 ? (
                    <Table responsive hover className="responsive-event-table">
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
                        {pastEvents.slice(0, archiveOpen ? limit : 0).map((event) => (
                          <tr key={event.id} >
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
                              {isAdmin && <>
                              <Button variant="outline-primary" size="sm" className="me-2" disabled={event.recurring} title={event.recurring ? "Edit recurring events in Google Calendar" : "Edit event"} onClick={() => handleEditEvent(event)}>
                                <FaEdit />
                              </Button>
                              <Button variant="outline-danger" size="sm" className="me-2" disabled={event.recurring} title={event.recurring ? "Cancel recurring events in Google Calendar" : "Delete event"} onClick={() => handleDeleteEvent(event.id)}>
                                <FaTrash />
                              </Button>
                              </>}
                              <Button
                                variant={getRSVPButtonVariant(event.id)}
                                size="sm"
                                onClick={() => {
                                  const eventNameSlug = event.title
                                    .toLowerCase()
                                    .replace(/[^a-z0-9]+/g, "-")
                                    .replace(/^-+|-+$/g, "");
                                  navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`, {state: {fromTab: "events", dashboardPath}});
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
                  {limit < pastEvents.length && <Button size="sm" variant="outline-primary" onClick={() => setLimit(limit + 10)}>Show 10 more</Button>}
                  </div>
                </Card.Body>
              </Card>
            </div>
          </>
        )}
          </div>
        </div>
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

      {/* Manager Creation Modal */}
    </div>
  );
}

export default Admin;
