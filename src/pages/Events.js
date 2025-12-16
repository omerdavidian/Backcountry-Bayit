import React, {useState, useEffect, useRef, useCallback} from "react";
import {Container, Row, Col, Card, Button, Modal, Alert, Table} from "react-bootstrap";
import {collection, getDocs, doc, query, where, updateDoc, addDoc, serverTimestamp, deleteDoc} from "firebase/firestore";
import {db} from "../config/firebase";
import {useAuth} from "../utils/AuthContext";
import {FaCalendarAlt, FaUsers, FaClock, FaMapMarkerAlt} from "react-icons/fa";
import {sendRSVPConfirmationEmail} from "../utils/emailService";
import RSVPForm from "../components/RSVPForm";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

function Events() {
  const {isAdmin, isManager} = useAuth();
  const [events, setEvents] = useState([]);
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
  const [rsvpStatus, setRsvpStatus] = useState({show: false, message: "", type: ""});
  const [confirmOneTable, setConfirmOneTable] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showPastEvents, setShowPastEvents] = useState(false);

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

  // Determine if an event date is in the past (compares date parts only)
  const isEventPast = (eventDate) => {
    const d = parseEventDate(eventDate);
    if (!d || isNaN(d.getTime())) return false;
    const today = new Date();
    // Compare only Y/M/D to avoid timezone/time issues
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return a < b;
  };

  const loadEvents = useCallback(async () => {
    try {
      // Fetch events from our API proxy which gets them from Google Calendar
      const response = await fetch("/api/fetch-google-calendar");
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      const allEvents = data.events || [];

      console.log("All events loaded from Google Calendar:", allEvents);

      setEvents(allEvents);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  }, []);

  const handleTogglePastEvents = () => {
    setShowPastEvents(!showPastEvents);
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
      setExistingRSVP(null); // Reset existing RSVP when opening modal
      setRsvpStatus({show: false, message: "", type: ""}); // Reset status messages
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

  const handleRSVPSubmit = async (e) => {
    e.preventDefault();
    try {
      const rsvpsCollection = collection(db, "rsvps");

      // Website RSVPs are always allowed. If OneTable is enabled, we still require confirmation below.

      // Check if this email already has an RSVP for this event (as primary or attendee)
      const q = query(rsvpsCollection, where("eventId", "==", selectedEvent.id), where("email", "==", rsvpData.email));
      const existingRSVPs = await getDocs(q);

      if (!existingRSVPs.empty && !existingRSVP) {
        // Found existing RSVP, load it and show update options
        const existingDoc = existingRSVPs.docs[0];
        const existingData = existingDoc.data();
        setExistingRSVP({id: existingDoc.id, ...existingData});

        // Pre-populate the form with existing data
        setRSVPData({
          firstName: existingData.firstName || "",
          lastName: existingData.lastName || "",
          email: existingData.email || "",
          phone: existingData.phone || "",
          attendees: existingData.attendees || [],
          dietaryRestrictions: existingData.dietaryRestrictions || "",
        });

        setRsvpStatus({
          show: true,
          message: `You already have an RSVP for this event. You can update your information below or unregister.`,
          type: "info",
        });
        return;
      }

      // Check if this email is registered as an attendee under someone else
      const allEventRSVPsQuery = query(rsvpsCollection, where("eventId", "==", selectedEvent.id));
      const allEventRSVPs = await getDocs(allEventRSVPsQuery);

      for (const doc of allEventRSVPs.docs) {
        const rsvp = doc.data();
        if (Array.isArray(rsvp.attendees)) {
          const foundAsAttendee = rsvp.attendees.find((att) => att.email === rsvpData.email);
          if (foundAsAttendee) {
            const primaryName = `${rsvp.firstName || ""} ${rsvp.lastName || ""}`.trim() || "Unknown";
            setRsvpStatus({
              show: true,
              message: `This email (${rsvpData.email}) is already registered for this event as an additional guest under ${primaryName} (${rsvp.email}). If you need to make changes, please contact the person who registered you.`,
              type: "warning",
            });
            return;
          }
        }
      }

      const allRSVPsQuery = query(rsvpsCollection, where("eventId", "==", selectedEvent.id));
      const allRSVPsSnapshot = await getDocs(allRSVPsQuery);

      let totalApprovedGuests = 0;
      allRSVPsSnapshot.forEach((doc) => {
        const rsvp = doc.data();
        // Skip the current user's existing RSVP when calculating capacity
        if (existingRSVP && doc.id === existingRSVP.id) return;

        if (rsvp.status === "approved" || (rsvp.status === undefined && selectedEvent.rsvpApprovalMode === "immediate")) {
          // Count primary guest + additional attendees
          totalApprovedGuests += 1 + (rsvp.attendees?.length || 0);
        }
      });

      const requestedGuests = 1 + (rsvpData.attendees?.length || 0); // Primary + additional attendees
      const capacity = selectedEvent.capacity || 40;
      const isOverCapacity = selectedEvent.limitCapacity && totalApprovedGuests + requestedGuests > capacity;

      let rsvpStatus = "approved";
      let statusMessage = existingRSVP ? "Your RSVP has been updated successfully!" : "Thank you for your RSVP! We look forward to seeing you.";
      let statusType = "success";

      if (selectedEvent.rsvpApprovalMode === "approval") {
        rsvpStatus = existingRSVP?.status || "pending";
        statusMessage = existingRSVP ? "Your RSVP has been updated successfully!" : "Your RSVP has been submitted and is awaiting approval from our team. You will receive confirmation via email.";
        statusType = "info";
      } else if (isOverCapacity) {
        rsvpStatus = "waitlist";
        statusMessage = `We're sorry, but this event has reached capacity (${capacity} guests). Your RSVP has been added to the waitlist, and you'll be notified if space becomes available.`;
        statusType = "warning";
      }

      const rsvpDataToSave = {
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventDate: selectedEvent.date,
        firstName: rsvpData.firstName,
        lastName: rsvpData.lastName,
        email: rsvpData.email,
        phone: rsvpData.phone,
        attendees: rsvpData.attendees,
        dietaryRestrictions: rsvpData.dietaryRestrictions || "",
        status: rsvpStatus,
        timestamp: existingRSVP ? existingRSVP.timestamp : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (existingRSVP) {
        // Update existing RSVP
        await updateDoc(doc(db, "rsvps", existingRSVP.id), rsvpDataToSave);
      } else {
        // Create new RSVP
        await addDoc(rsvpsCollection, rsvpDataToSave);
      }

      // Save user info to localStorage for future RSVPs
      saveUserInfo(rsvpData);

      // Send confirmation email
      let emailWarning;
      try {
        await sendRSVPConfirmationEmail(rsvpData, selectedEvent, rsvpStatus);
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        emailWarning = emailError.message || "confirmation email could not be sent";
      }

      const finalMessage = emailWarning ? `${statusMessage} We could not send a confirmation email (${emailWarning}).` : statusMessage;
      const finalType = emailWarning ? "warning" : statusType;

      setRsvpStatus({
        show: true,
        message: finalMessage,
        type: finalType,
      });

      setRSVPData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        attendees: [],
        dietaryRestrictions: "",
      });

      setExistingRSVP(null);

      setTimeout(() => {
        setShowRSVPModal(false);
        setRsvpStatus({show: false, message: "", type: ""});
      }, 4000);
    } catch (error) {
      console.error("Error submitting RSVP:", error);

      // If permission denied, store a pending RSVP locally so user doesn't lose data.
      let shortMsg = error?.message ? `There was an error submitting your RSVP: ${error.message}` : "There was an error submitting your RSVP. Please try again or contact us directly.";
      if (error?.code === "permission-denied") {
        try {
          const pendingKey = "bcb_pending_rsvps";
          const existing = JSON.parse(localStorage.getItem(pendingKey) || "[]");
          existing.push({
            savedAt: new Date().toISOString(),
            eventId: selectedEvent?.id,
            eventTitle: selectedEvent?.title,
            eventDate: selectedEvent?.date,
            ...rsvpData,
          });
          localStorage.setItem(pendingKey, JSON.stringify(existing));
          shortMsg = "Permissions error: your RSVP was saved locally and will need to be resubmitted once our system permissions are updated. Please try again later or contact us directly.";
        } catch (storageError) {
          console.error("Failed to store pending RSVP locally:", storageError);
        }
      }

      setRsvpStatus({
        show: true,
        message: shortMsg,
        type: "danger",
      });
    }
  };

  const handleUnregister = async () => {
    if (!existingRSVP) return;

    if (window.confirm("Are you sure you want to unregister from this event?")) {
      try {
        await deleteDoc(doc(db, "rsvps", existingRSVP.id));

        setRsvpStatus({
          show: true,
          message: "You have been successfully unregistered from this event.",
          type: "success",
        });

        setRSVPData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          attendees: [],
          dietaryRestrictions: "",
        });

        setExistingRSVP(null);

        setTimeout(() => {
          setShowRSVPModal(false);
          setRsvpStatus({show: false, message: "", type: ""});
        }, 2000);
      } catch (error) {
        console.error("Error unregistering:", error);
        setRsvpStatus({
          show: true,
          message: "Error unregistering. Please try again or contact us directly.",
          type: "danger",
        });
      }
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-5">
        <Container>
          <div className="text-center py-4">
            <FaCalendarAlt size={60} className="mb-3" />
            <h1 className="display-4 fw-bold">Events Calendar</h1>
            <p className="lead">Join us for Shabbat dinners, holiday celebrations, and community gatherings</p>
            <p className="mb-0">November through April</p>

            {/* 
              Add BCB Calendar to Google Calendar Button
            */}
            <div className="mt-4">
              <Button variant="outline-light" href="https://calendar.google.com/calendar/render?cid=c_8d4665aa1fe4810f58bcc8c8bbb4be5d6dc14824ea33016fbab9e18fb8172382@group.calendar.google.com" target="_blank" rel="noopener noreferrer">
                <FaCalendarAlt className="me-2" />
                Add BCB Calendar to Google Calendar
              </Button>
              <div className="small mt-2 text-white-50">Automatically stays up to date</div>
            </div>
          </div>
        </Container>
      </section>

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
                    events={events}
                    eventClick={handleEventClick}
                    headerToolbar={{
                      left: "today",
                      center: "title",
                      right: "monthsLabel,separator,prev,next",
                    }}
                    customButtons={{
                      monthsLabel: {
                        text: "Months",
                        click: handleMonthsButtonClick,
                      },
                      separator: {
                        text: "|",
                        click: () => {},
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
                        <strong>Time:</strong> {event.time}
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
                            setExistingRSVP(null);
                            setRsvpStatus({show: false, message: "", type: ""});
                            loadSavedUserInfo();
                            setShowRSVPModal(true);
                          }}>
                          RSVP Now
                        </Button>
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
            <Button variant="outline-secondary" onClick={handleTogglePastEvents}>
              {showPastEvents ? "Hide Past Events" : "Show Past Events"}
            </Button>
          </div>

          {showPastEvents && (
            <>
              {events.filter((e) => isEventPast(e.date)).length === 0 ? (
                <p className="text-center text-muted">No past events found.</p>
              ) : (
                <Card className="border-0 shadow-sm">
                  <Card.Body className="p-0">
                    <Table responsive hover className="mb-0">
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
                        {events
                          .filter((e) => isEventPast(e.date))
                          .sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date))
                          .map((event) => (
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
                                {event.time}
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
                </Card>
              )}
            </>
          )}
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
          <Modal.Title>RSVP for {selectedEvent?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <RSVPForm
            selectedEvent={selectedEvent}
            rsvpData={rsvpData}
            setRSVPData={setRSVPData}
            handleRSVPSubmit={handleRSVPSubmit}
            existingRSVP={existingRSVP}
            handleUnregister={handleUnregister}
            onCancel={() => {
              setShowRSVPModal(false);
              setExistingRSVP(null);
              setRsvpStatus({show: false, message: "", type: ""});
            }}
            rsvpStatus={rsvpStatus}
            confirmOneTable={confirmOneTable}
            setConfirmOneTable={setConfirmOneTable}
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
                      <strong>Time:</strong> {selectedEvent.time}
                    </p>
                    <p className="mb-0">
                      <strong>Location:</strong> {selectedEvent.location}
                    </p>
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
