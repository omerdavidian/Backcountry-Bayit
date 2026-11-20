import {DateTime} from "luxon";
import React, {useState, useEffect, useRef, useCallback} from "react";
import {Container, Row, Col, Card, Button, Modal, Alert, Table, Form} from "react-bootstrap";
import {useAuth} from "../utils/AuthContext";
import {FaCalendarAlt, FaUsers, FaClock, FaMapMarkerAlt, FaEdit, FaTrash, FaGoogle, FaFileDownload, FaCheckCircle, FaPlus} from "react-icons/fa";
import {authorizedFetch} from "../utils/apiClient";
import RSVPForm from "../components/RSVPForm";
import EventFormFields from "../components/EventFormFields";
import {calendarTimes, compactCalendarTime, todayInMountainTime, rsvpRequest, eventFormTimes, editTimes} from "../utils/calendar";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

const PAST_EVENTS_PAGE_SIZE = 10;

function Events() {
  const {isAdmin, isManager, currentUser} = useAuth();
  const [events, setEvents] = useState([]);
  const [calendarId, setCalendarId] = useState("");
  const [feedMessage, setFeedMessage] = useState("");
  const [eventState, setEventState] = useState("loading");
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [remaining, setRemaining] = useState(null);
  const [manageToken, setManageToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("rsvp"));
  const selectedFromLink = useRef(false);
  const createKey = useRef(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [existingRSVP, setExistingRSVP] = useState(null);
  const [rsvpData, setRSVPData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    attendees: [],
    dietaryRestrictions: "",
  });
  const [rememberMe, setRememberMe] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState({show: false, message: "", type: ""});
  const [confirmOneTable, setConfirmOneTable] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [pastEventLimit, setPastEventLimit] = useState(PAST_EVENTS_PAGE_SIZE);
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);

  // Edit Event State
  const [showEditModal, setShowEditModal] = useState(false);
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

  // Calendar state
  const calendarRef = useRef(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const monthPickerRef = useRef(null);

  // Parse event dates consistently without timezone shifts
  const parseEventDate = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate && typeof dateValue.toDate === "function") {
      return dateValue.toDate();
    }
    if (typeof dateValue === "string") {
      // Always treat as local date (not UTC)
      const match = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, y, m, d] = match;
        return new Date(Number(y), Number(m) - 1, Number(d));
      }
    }
    // Fallback: try to parse as local date
    const d = new Date(dateValue);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  // Format date for display
  const formatEventDate = (dateValue, options = {}) => {
    const date = parseEventDate(dateValue);
    if (!date || isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      ...options,
    });
  };

  const isEventToday = (eventDate) => {
    const date = parseEventDate(eventDate);
    if (!date || isNaN(date.getTime())) return false;

    const today = new Date();
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
  };

  const isEventTomorrow = (eventDate) => {
    const date = parseEventDate(eventDate);
    if (!date || isNaN(date.getTime())) return false;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return date.getFullYear() === tomorrow.getFullYear() && date.getMonth() === tomorrow.getMonth() && date.getDate() === tomorrow.getDate();
  };

  const isEventPast = date => date < todayInMountainTime();

  const loadEvents = useCallback(async () => {
    setEventState("loading");
    try {
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Failed to fetch events");
      const data = await response.json();
      setEvents((data.events || []).map(calendarTimes));
      setCalendarId(data.calendarId || "");
      setEventState("ready");
    } catch {
      setEventState("error");
    }
  }, []);

  useEffect(() => {
    if (!manageToken) return;
    if (window.location.hash.startsWith("#rsvp=")) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
    let active = true;
    rsvpRequest({action: "read", token: manageToken}).then(data => {
      if (!active) return;
      setSelectedEvent(calendarTimes(data.event));
      setExistingRSVP({status: data.status});
      setRSVPData(data.guest);
      setShowRSVPModal(true);
    }).catch(error => {
      if (active) setAlert({show: true, type: "warning", message: error.message});
    });
    return () => {active = false;};
  }, [manageToken]);

  useEffect(() => {
    if (eventState !== "ready" || selectedFromLink.current) return;
    const id = new URLSearchParams(window.location.search).get("event");
    if (!id) return;
    selectedFromLink.current = true;
    const event = events.find(event => event.id === id);
    if (event) {
      setSelectedEvent(event);
      setShowRSVPModal(true);
    } else {
      setAlert({show: true, type: "warning", message: "This event is no longer available."});
    }
  }, [eventState, events]);

  useEffect(() => {
    let active = true;
    setRemaining(null);
    if (showRSVPModal && selectedEvent?.limitCapacity) {
      rsvpRequest({action: "availability", eventId: selectedEvent.id}).then(data => {
        if (active) setRemaining(data.remaining);
      }).catch(() => {});
    }
    return () => {active = false;};
  }, [selectedEvent, showRSVPModal]);
  const pastEvents = events.filter(event => isEventPast(event.date))
    .sort((a, b) => b.date.localeCompare(a.date) || new Date(b.start) - new Date(a.start));
  const loadMorePastEvents = () => setPastEventLimit(limit => Math.min(limit + PAST_EVENTS_PAGE_SIZE, pastEvents.length));

  const handleTogglePastEvents = () => {
    setShowPastEvents(open => !open);
    setPastEventLimit(PAST_EVENTS_PAGE_SIZE);
  };

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleMonthsButtonClick = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      const currentDate = api.getDate();
      setPickerYear(currentDate.getFullYear());
      setCurrentCalendarDate(currentDate);
    } else {
      setPickerYear(currentCalendarDate.getFullYear());
    }
    setShowMonthPicker((prev) => !prev);
  };

  const handleSelectMonth = (monthIndex) => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.gotoDate(new Date(pickerYear, monthIndex, 1));
    }
    setCurrentCalendarDate(new Date(pickerYear, monthIndex, 1));
    setShowMonthPicker(false);
  };

  const handleYearChange = (offset) => {
    setPickerYear((prev) => prev + offset);
  };

  useEffect(() => {
    if (!showMonthPicker) return;

    const handleClickOutside = (event) => {
      if (monthPickerRef.current && monthPickerRef.current.contains(event.target)) {
        return;
      }
      const monthsButton = document.querySelector(".fc-monthsLabel-button");
      if (monthsButton && monthsButton.contains(event.target)) {
        return;
      }
      setShowMonthPicker(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMonthPicker]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // calendarRef.getApi() is accessed directly where needed; avoid unused var
  const activeMonth = currentCalendarDate.getMonth();
  const activeYear = currentCalendarDate.getFullYear();

  const handleEventClick = (clickInfo) => {
    const event = events.find((e) => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
      setManageToken(null);
      setExistingRSVP(null); // Reset existing RSVP when opening modal
      setRsvpStatus({show: false, message: "", type: ""}); // Reset status messages
      setAddToCalendar(false);
      setShowCalendarOptions(false);
      // Load saved user info from localStorage
      loadSavedUserInfo();
      setShowRSVPModal(true);
    }
  };

  // Load saved user information from localStorage
  const loadSavedUserInfo = () => {
    try {
      const savedInfo = localStorage.getItem("bcb_user_info");
      if (savedInfo) {
        const userInfo = JSON.parse(savedInfo);
        setRSVPData({
          firstName: userInfo.firstName || "",
          lastName: userInfo.lastName || "",
          email: userInfo.email || "",
          phone: userInfo.phone || "",
          attendees: [],
          dietaryRestrictions: "",
        });
      } else if (currentUser) {
        // Fallback to logged-in user info if no local storage
        const names = (currentUser.displayName || "").split(" ");
        const firstName = names[0] || "";
        const lastName = names.length > 1 ? names.slice(1).join(" ") : "";

        setRSVPData({
          firstName: firstName,
          lastName: lastName,
          email: currentUser.email || "",
          phone: currentUser.phoneNumber || "",
          attendees: [],
          dietaryRestrictions: "",
        });
      }
    } catch (error) {
      console.error("Error loading saved user info:", error);
    }
  };

  // Save user information to localStorage
  const saveUserInfo = (data) => {
    try {
      const userInfo = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
      };
      localStorage.setItem("bcb_user_info", JSON.stringify(userInfo));
    } catch (error) {
      console.error("Error saving user info:", error);
    }
  };

  const generateGoogleCalendarUrl = event => {
    const query = new URLSearchParams({
      action: "TEMPLATE", text: event.title, details: event.description || "", location: event.location || "",
      dates: `${compactCalendarTime(event.start)}/${compactCalendarTime(event.end)}`,
    });
    return "https://calendar.google.com/calendar/render?" + query;
  };

  const downloadICS = event => {
    const escape = value => String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
    const dateField = event.start.includes("T") ? "" : ";VALUE=DATE";
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Backcountry Bayit//Events//EN", "BEGIN:VEVENT",
      `UID:${escape(event.id)}@backcountrybayit.com`, `DTSTAMP:${compactCalendarTime(new Date().toISOString())}`,
      `DTSTART${dateField}:${compactCalendarTime(event.start)}`, `DTEND${dateField}:${compactCalendarTime(event.end)}`,
      `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `LOCATION:${escape(event.location)}`,
      "END:VEVENT", "END:VCALENDAR", ""];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], {type: "text/calendar"}));
    const link = document.createElement("a");
    link.href = url;
    link.download = "backcountry-bayit-event.ics";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const showRSVPMessage = (message, type = "info") => setRsvpStatus({show: true, message, type});

  const handleRSVPSubmit = async event => {
    event.preventDefault();
    if (rsvpBusy) return;
    setRsvpBusy(true);
    try {
      const result = await rsvpRequest(existingRSVP
        ? {action: "update", token: manageToken, guest: rsvpData}
        : {action: "register", eventId: selectedEvent.id, guest: rsvpData, confirmOneTable});
      if (existingRSVP) {
        showRSVPMessage("Your RSVP was updated.", "success");
      } else if (result.accepted) {
        showRSVPMessage("If you already have an RSVP, check your email for a private link to manage it.");
      } else {
        const message = {approved: "Your RSVP is confirmed.", pending: "Your RSVP is awaiting approval.", waitlist: "You’re on the waitlist."}[result.status];
        showRSVPMessage(message + (result.emailed ? " Check your email for your private RSVP link." : " Use Manage my RSVP to request a link if you need one."), "success");
        if (rememberMe) saveUserInfo(rsvpData);
        else localStorage.removeItem("bcb_user_info");
        if (addToCalendar) setShowCalendarOptions(true);
      }
    } catch (error) {
      showRSVPMessage(error.message, "danger");
    } finally {
      setRsvpBusy(false);
    }
  };

  const requestManageLink = async () => {
    if (rsvpBusy) return;
    setRsvpBusy(true);
    try {
      await rsvpRequest({action: "request", eventId: selectedEvent.id, email: rsvpData.email});
      showRSVPMessage("If that email has an RSVP, we’ll send a private link. Check your inbox and spam folder.");
    } catch (error) {
      showRSVPMessage(error.message, "danger");
    } finally {
      setRsvpBusy(false);
    }
  };

  const handleUnregister = async () => {
    if (rsvpBusy || !window.confirm("Cancel your RSVP for this event?")) return;
    setRsvpBusy(true);
    try {
      await rsvpRequest({action: "cancel", token: manageToken});
      setManageToken(null);
      setExistingRSVP(null);
      setShowRSVPModal(false);
      setAlert({show: true, message: "Your RSVP was canceled.", type: "success"});
    } catch (error) {
      showRSVPMessage(error.message, "danger");
    } finally {
      setRsvpBusy(false);
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
      ...editTimes(event),
    });
    setShowEditModal(true);
  };

  const handleToggleCapacityLimit = (enabled) => {
    setEventForm((prev) => ({
      ...prev,
      limitCapacity: enabled,
    }));
  };

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

  const handleSaveEvent = async (e) => {
    e.preventDefault();
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

      if (!editingEvent) {
        createKey.current ||= window.crypto.randomUUID();
        eventData.createKey = createKey.current;
      }
      let response;
      if (editingEvent) {
        response = await authorizedFetch("/api/events", {
          method: "PUT",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({id: editingEvent.id, ...eventData}),
        });
      } else {
        // Should not happen in edit mode, but good to have
        response = await authorizedFetch("/api/events", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(eventData),
        });
      }

      if (!response.ok) throw new Error((await response.json()).error || "Failed to save event");

      setAlert({show: true, message: "Event updated successfully!", type: "success"});

      setShowEditModal(false);
      setEditingEvent(null);
      resetEventForm();
      loadEvents();

      setTimeout(() => {
        setAlert({show: false, message: "", type: ""});
      }, 3000);
    } catch (error) {
      console.error("Error saving event:", error);
      setAlert({show: true, message: error.message || "Error saving event. Please try again.", type: "danger"});
    }
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent) return;
    if (window.confirm("Are you sure you want to delete this event?")) {
      try {
        const response = await authorizedFetch(`/api/events?id=${encodeURIComponent(editingEvent.id)}&version=${encodeURIComponent(editingEvent.version || "")}`, {
          method: "DELETE",
        });

        if (!response.ok) throw new Error("Failed to delete event");

        setAlert({show: true, message: "Event deleted successfully!", type: "success"});
        setShowEditModal(false);
        setEditingEvent(null);
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

  return (
    <div className="events-page">
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-5">
        <Container>
          <div className="text-center py-4">
            <FaCalendarAlt size={60} className="mb-3" />
            <h1 className="display-4 fw-bold">Events Calendar</h1>
            <p className="lead">Join us for Shabbat dinners, holiday celebrations, and community gatherings</p>
            <p className="mb-0">November through April</p>

            {/* 
              Subscribe in Google Calendar Button
            */}
            <div className="mt-4">
              {calendarId && <Button variant="outline-light" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(calendarId)}`} target="_blank" rel="noopener noreferrer">
                <FaCalendarAlt className="me-2" />
                Subscribe in Google Calendar
              </Button>}
              <Button className="ms-sm-2 mt-2 mt-sm-0" variant="outline-light" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(new URL("/api/calendar", window.location.origin).href);
                  setFeedMessage("Subscription link copied.");
                } catch {
                  setFeedMessage("Open the calendar feed below and copy its address.");
                }
              }}>Copy calendar subscription link</Button>
              {feedMessage && <p role="status" className="mt-2 mb-0">{feedMessage} <a className="text-white" href="/api/calendar">Open calendar feed</a></p>}
              <div className="small mt-2 text-white">Calendar subscriptions receive updates. Single-event downloads are copies.</div>
            </div>

            {(isAdmin || isManager) && (
              <div className="mt-4">
                <Button
                  variant="light"
                  size="lg"
                  onClick={() => {
                    resetEventForm();
                    setShowEditModal(true);
                  }}>
                  <FaPlus className="me-2" />
                  Create New Event
                </Button>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* Alert Messages */}
      <Container className="mt-4">
        {alert.show && (
          <Alert variant={alert.type} onClose={() => setAlert({show: false, message: "", type: ""})} dismissible>
            {alert.message}
          </Alert>
        )}
      </Container>

      {/* Calendar Section */}
      <section className="py-5">
        <Container>
          <Row>
            <Col lg={12}>
              <Card className="border-0 shadow">
                <Card.Body className="p-4 position-relative">
                  {showMonthPicker && (
                    <div
                      ref={monthPickerRef}
                      style={{
                        position: "absolute",
                        top: "3.25rem",
                        right: "1.5rem",
                        zIndex: 20,
                        width: "320px",
                        backgroundColor: "#ffffff",
                        borderRadius: "12px",
                        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
                        padding: "16px",
                      }}>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <Button variant="outline-secondary" size="sm" onClick={() => handleYearChange(-1)} type="button">
                          &lt;
                        </Button>
                        <span className="fw-semibold text-primary">{pickerYear}</span>
                        <Button variant="outline-secondary" size="sm" onClick={() => handleYearChange(1)} type="button">
                          &gt;
                        </Button>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {monthNames.map((month, index) => {
                          const isActive = activeYear === pickerYear && activeMonth === index;
                          return (
                            <Button key={month} variant={isActive ? "primary" : "outline-primary"} size="sm" type="button" onClick={() => handleSelectMonth(index)} style={{flex: "0 0 48%"}}>
                              {month}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    timeZone="America/Denver"
                    events={events.map(event => {
                      const wallTime = value => value.includes("T")
                        ? DateTime.fromISO(value, {zone: "America/Denver"}).toISO({includeOffset: false})
                        : value;
                      return {...event, start: wallTime(event.start), end: wallTime(event.end)};
                    })}
                    viewDidMount={({el}) => {
                      el.closest(".fc")?.querySelectorAll(".fc-icon").forEach(icon => icon.setAttribute("aria-hidden", "true"));
                    }}
                    eventClick={handleEventClick}
                    eventDidMount={({el}) => {
                      el.tabIndex = 0;
                      el.setAttribute("role", "button");
                      el.onkeydown = event => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          el.click();
                        }
                      };
                    }}
                    eventDisplay="block"
                    eventContent={(eventInfo) => (
                      <div style={{padding: "1px 2px", overflow: "hidden"}}>
                        {eventInfo.timeText && <div style={{fontSize: "0.75em", fontWeight: "bold", lineHeight: "1"}}>{eventInfo.timeText}</div>}
                        <div style={{fontSize: "0.9em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"}}>{eventInfo.event.title}</div>
                      </div>
                    )}
                    headerToolbar={{
                      left: "today",
                      center: "title",
                      right: "monthsLabel,prev,next",
                    }}
                    customButtons={{
                      monthsLabel: {
                        text: "Months",
                        click: handleMonthsButtonClick,
                      },
                    }}
                    datesSet={() => {
                      const apiInstance = calendarRef.current?.getApi();
                      if (apiInstance) {
                        setCurrentCalendarDate(apiInstance.getDate());
                      }
                    }}
                    height="auto"
                  />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Upcoming Events List */}
      <section className="py-5 bg-light">
        <Container>
          <h2 className="section-title text-center mb-5">Upcoming Events</h2>
          {eventState === "loading" && <p role="status" className="text-center">Loading events…</p>}
          {eventState === "error" && <Alert variant="warning" className="text-center">Events couldn’t be loaded. <Button variant="outline-dark" size="sm" onClick={loadEvents}>Try again</Button></Alert>}
          {eventState === "ready" && !events.some(event => !isEventPast(event.date)) && (
            <p className="text-center">No upcoming events are scheduled. Subscribe above for new dates.</p>
          )}
          <Row className="g-4">
            {events
              .filter((e) => !isEventPast(e.date))
              .sort((a, b) => parseEventDate(a.date) - parseEventDate(b.date))
              .map((event) => (
                <Col key={event.id} md={6}>
                  <Card className="h-100 border-0 shadow-sm card-hover">
                    {event.imageUrl && (
                      <div
                        style={{
                          width: "100%",
                          height: "200px",
                          overflow: "hidden",
                          cursor: "pointer",
                          position: "relative",
                        }}
                        onClick={() => {
                          setSelectedImage({url: event.imageUrl, title: event.title});
                          setShowImageModal(true);
                        }}>
                        <img
                          src={event.imageUrl}
                          alt={event.title}
                          loading="lazy"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: `center ${event.imagePosition || 50}%`,
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "8px",
                            backgroundColor: "rgba(0,0,0,0.6)",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}>
                          Click to view full image
                        </div>
                      </div>
                    )}
                    <Card.Body className="p-4">
                      {isEventToday(event.date) && (
                        <div className="mb-3 text-center">
                          <span className="badge bg-success" style={{fontSize: "0.9rem", padding: "0.5rem 1rem"}}>
                            Today
                          </span>
                        </div>
                      )}
                      {!isEventToday(event.date) && isEventTomorrow(event.date) && (
                        <div className="mb-3 text-center">
                          <span className="badge bg-info" style={{fontSize: "0.9rem", padding: "0.5rem 1rem"}}>
                            Tomorrow
                          </span>
                        </div>
                      )}
                      <h4 className="text-primary mb-3">{event.title}</h4>
                      <div className="mb-2">
                        <FaCalendarAlt className="me-2 text-primary" />
                        <strong>Date:</strong> {formatEventDate(event.date)}
                      </div>
                      <div className="mb-2">
                        <FaClock className="me-2 text-primary" />
                        <strong>Time:</strong> {event.time}{event.time !== "All day" && " MT"}
                      </div>
                      {event?.oneTableLink && (
                        <div className="mb-2">
                          <a href={event.oneTableLink} target="_blank" rel="noreferrer">
                            RSVP through OneTable
                          </a>
                        </div>
                      )}
                      <div className="mb-3">
                        <FaMapMarkerAlt className="me-2 text-primary" />
                        <strong>Location:</strong> {event.location}
                      </div>
                      <p className="mb-3">{event.description}</p>
                      <div className="mb-3">
                        <FaUsers className="me-2 text-primary" />
                        <strong>Capacity:</strong> {event.capacity} guests
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="primary"
                          onClick={() => {
                            setSelectedEvent(event);
                            setManageToken(null);
                            setExistingRSVP(null);
                            setRsvpStatus({show: false, message: "", type: ""});
                            loadSavedUserInfo();
                            setShowRSVPModal(true);
                          }}>
                          {event.rsvpSources?.website === false ? "View details" : "RSVP now"}
                        </Button>
                        {(isAdmin || isManager) && (
                          <Button variant="outline-primary" disabled={event.recurring} onClick={() => handleEditEvent(event)}>
                            <FaEdit className="me-2" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
          </Row>
        </Container>
      </section>

      {/* Past Events List */}
      <section className="py-5 bg-light">
        <Container>
          <h2 className="section-title text-center mb-3">Past Events</h2>

          <div className="text-center mb-4">
            <Button variant="outline-secondary" aria-expanded={showPastEvents} aria-controls="public-past-events" onClick={handleTogglePastEvents}>
              {showPastEvents ? "Hide Past Events" : "Show Past Events"}
            </Button>
          </div>

          <div id="public-past-events" hidden={!showPastEvents}>
            {showPastEvents && (pastEvents.length === 0 ? (
                <p className="text-center text-muted">No past events found.</p>
              ) : (
                <Card className="border-0 shadow-sm">
                  <Card.Body className="p-0 public-event-archive" tabIndex={0} role="region" aria-label="Past events archive"
                    onScroll={({currentTarget: box}) => {
                      if (pastEventLimit < pastEvents.length && box.scrollHeight - box.scrollTop - box.clientHeight < 48) {
                        loadMorePastEvents();
                      }
                    }}>
                    <Table responsive hover className="responsive-event-table mb-0">
                      <thead className="bg-light">
                        <tr>
                          <th>Event</th>
                          <th>Date</th>
                          <th>Time</th>
                          <th>Location</th>
                          <th>Description</th>
                          <th>Capacity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastEvents.slice(0, pastEventLimit).map((event) => (
                            <tr key={event.id} style={{opacity: 0.7}}>
                              <td>
                                <strong className="text-secondary">{event.title}</strong>
                              </td>
                              <td>
                                <FaCalendarAlt className="me-2 text-secondary" />
                                {formatEventDate(event.date)}
                              </td>
                              <td>
                                <FaClock className="me-2 text-secondary" />
                                {event.time}{event.time !== "All day" && " MT"}
                              </td>
                              <td>
                                <FaMapMarkerAlt className="me-2 text-secondary" />
                                {event.location}
                              </td>
                              <td style={{maxWidth: "300px"}}>{event.description}</td>
                              <td>
                                <FaUsers className="me-2 text-secondary" />
                                {event.capacity}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </Table>
                  </Card.Body>
                  {pastEventLimit < pastEvents.length && (
                    <Card.Footer className="bg-white p-3 text-center">
                      <Button size="sm" variant="outline-secondary" onClick={loadMorePastEvents}>Show 10 more</Button>
                    </Card.Footer>
                  )}
                </Card>
              ))}
          </div>
        </Container>
      </section>

      {/* RSVP Modal */}
      <Modal
        show={showRSVPModal}
        onHide={() => {
          setShowRSVPModal(false);
          setExistingRSVP(null);
          setRsvpStatus({show: false, message: "", type: ""});
        }}
        size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{existingRSVP ? "Manage RSVP for" : "Event details:"} {selectedEvent?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {showCalendarOptions ? (
            <div className="text-center py-4">
              <FaCheckCircle className="text-success mb-3" size={50} />
              <h4 className="mb-4">RSVP Confirmed!</h4>
              <p className="mb-4">Add this event to your calendar:</p>
              <div className="d-flex justify-content-center gap-3 mb-4">
                <Button variant="outline-primary" href={generateGoogleCalendarUrl(selectedEvent)} target="_blank" rel="noopener noreferrer" className="d-flex align-items-center">
                  <FaGoogle className="me-2" /> Google Calendar
                </Button>
                <Button variant="outline-secondary" onClick={() => downloadICS(selectedEvent)} className="d-flex align-items-center">
                  <FaFileDownload className="me-2" /> Download ICS
                </Button>
              </div>
              <Button
                variant="link"
                onClick={() => {
                  setShowRSVPModal(false);
                  setShowCalendarOptions(false);
                }}>
                Close
              </Button>
            </div>
          ) : (
            <RSVPForm
              selectedEvent={selectedEvent}
              rsvpData={rsvpData}
              setRSVPData={setRSVPData}
              handleRSVPSubmit={handleRSVPSubmit}
              existingRSVP={existingRSVP}
              requestManageLink={requestManageLink}
              busy={rsvpBusy}
              remaining={remaining}
              registrationClosed={Boolean(selectedEvent && (isEventPast(selectedEvent.date) || selectedEvent.rsvpSources?.website === false))}

              handleUnregister={handleUnregister}
              onCancel={() => {
                setShowRSVPModal(false);
                setExistingRSVP(null);
                setRsvpStatus({show: false, message: "", type: ""});
              }}
              rsvpStatus={rsvpStatus}
              confirmOneTable={confirmOneTable}
              setConfirmOneTable={setConfirmOneTable}
              addToCalendar={addToCalendar}
              setAddToCalendar={setAddToCalendar}
              rememberMe={rememberMe}
              setRememberMe={setRememberMe}
              eventInfoDisplay={
                selectedEvent && (
                  <div className="mb-4 bg-light rounded overflow-hidden">
                    {selectedEvent.imageUrl && (
                      <div
                        style={{
                          width: "100%",
                          height: "200px",
                          overflow: "hidden",
                          cursor: "pointer",
                          position: "relative",
                        }}
                        onClick={() => {
                          setSelectedImage({url: selectedEvent.imageUrl, title: selectedEvent.title});
                          setShowImageModal(true);
                        }}>
                        <img
                          src={selectedEvent.imageUrl}
                          alt={selectedEvent.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: `center ${selectedEvent.imagePosition || 50}%`,
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "8px",
                            backgroundColor: "rgba(0,0,0,0.6)",
                            color: "white",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                          }}>
                          Click to view full image
                        </div>
                      </div>
                    )}
                    <div className="p-3">
                      <h5 className="mb-3">{selectedEvent.title}</h5>
                      <p className="mb-1">
                        <strong>Date:</strong> {formatEventDate(selectedEvent.date)}
                      </p>
                      <p className="mb-1">
                        <strong>Time:</strong> {selectedEvent.time}{selectedEvent.time !== "All day" && " MT"}
                      </p>
                      <p className="mb-0">
                        <strong>Location:</strong> {selectedEvent.location}
                      </p>
                      {selectedEvent.description && (
                        <p className="mt-2 mb-0" style={{whiteSpace: "pre-wrap"}}>
                          {selectedEvent.description}
                        </p>
                      )}
                      {selectedEvent?.oneTableLink && (
                        <div className="mt-2">
                          <a href={selectedEvent.oneTableLink} target="_blank" rel="noreferrer">
                            RSVP through OneTable
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
            />
          )}
        </Modal.Body>
      </Modal>

      {/* Edit Event Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSaveEvent}>
            <EventFormFields eventForm={eventForm} setEventForm={setEventForm} handleToggleCapacityLimit={handleToggleCapacityLimit} />
            <div className="d-flex justify-content-between mt-4">
              <Button variant="danger" onClick={handleDeleteEvent}>
                <FaTrash className="me-2" /> Delete Event
              </Button>
              <div className="d-flex gap-2">
                <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Save Changes
                </Button>
              </div>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Image Modal (Full-size view) */}
      <Modal show={showImageModal} onHide={() => setShowImageModal(false)} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedImage?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          {selectedImage?.url && (
            <img
              src={selectedImage.url}
              alt={selectedImage.title}
              style={{
                width: "100%",
                height: "auto",
                maxHeight: "80vh",
                objectFit: "contain",
              }}
            />
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Events;
