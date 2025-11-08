import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Alert, Table } from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../utils/AuthContext';
import { FaCalendarAlt, FaUsers, FaClock, FaMapMarkerAlt, FaPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { sendRSVPConfirmationEmail } from '../utils/emailService';

function Events() {
  const { isAdmin, isManager } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [existingRSVP, setExistingRSVP] = useState(null);
  const [rsvpData, setRSVPData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    attendees: [],
    dietaryRestrictions: ''
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    hour: '6',
    minute: '30',
    period: 'PM',
    location: 'BCB Community Center, Frisco',
    description: '',
    capacity: 40,
    requireRSVP: true,
    rsvpApprovalMode: 'immediate',
    limitCapacity: false // New state for capacity limit toggle
  });
  const [rsvpStatus, setRsvpStatus] = useState({ show: false, message: '', type: '' });
  const [eventStatus, setEventStatus] = useState({ show: false, message: '', type: '' });
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const calendarRef = useRef(null);
  const monthPickerRef = useRef(null);

  // Parse event dates consistently without timezone shifts
  const parseEventDate = (dateValue) => {
    if (!dateValue) return null;
    if (dateValue instanceof Date) return dateValue;
    if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    if (typeof dateValue === 'string') {
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
    if (!date || isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    });
  };

  const isEventToday = (eventDate) => {
    const date = parseEventDate(eventDate);
    if (!date || isNaN(date.getTime())) return false;

    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate();
  };

  const isEventTomorrow = (eventDate) => {
    const date = parseEventDate(eventDate);
    if (!date || isNaN(date.getTime())) return false;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate();
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
      const eventsCollection = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsCollection);
      const eventsList = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: doc.data().date,
        title: doc.data().title
      }));

      console.log('All events loaded:', eventsList);

      setEvents(eventsList.sort((a, b) => {
        const dateA = parseEventDate(a.date);
        const dateB = parseEventDate(b.date);
        return dateA - dateB;
      }));
    } catch (error) {
      console.error('Error loading events:', error);
    }
  }, []);

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
      const monthsButton = document.querySelector('.fc-monthsLabel-button');
      if (monthsButton && monthsButton.contains(event.target)) {
        return;
      }
      setShowMonthPicker(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPicker]);

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  // calendarRef.getApi() is accessed directly where needed; avoid unused var
  const activeMonth = currentCalendarDate.getMonth();
  const activeYear = currentCalendarDate.getFullYear();

  const handleEventClick = (clickInfo) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
      setExistingRSVP(null); // Reset existing RSVP when opening modal
      setRsvpStatus({ show: false, message: '', type: '' }); // Reset status messages
      // Load saved user info from localStorage
      loadSavedUserInfo();
      setShowRSVPModal(true);
    }
  };

  // Load saved user information from localStorage
  const loadSavedUserInfo = () => {
    try {
      const savedInfo = localStorage.getItem('bcb_user_info');
      if (savedInfo) {
        const userInfo = JSON.parse(savedInfo);
        setRSVPData({
          firstName: userInfo.firstName || '',
          lastName: userInfo.lastName || '',
          email: userInfo.email || '',
          phone: userInfo.phone || '',
          attendees: []
        });
      }
    } catch (error) {
      console.error('Error loading saved user info:', error);
    }
  };

  // Save user information to localStorage
  const saveUserInfo = (data) => {
    try {
      const userInfo = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone
      };
      localStorage.setItem('bcb_user_info', JSON.stringify(userInfo));
    } catch (error) {
      console.error('Error saving user info:', error);
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);

    // Parse existing time
    let hour = '6', minute = '30', period = 'PM';
    if (event.time) {
      const timeMatch = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        hour = timeMatch[1];
        minute = timeMatch[2];
        period = timeMatch[3].toUpperCase();
      }
    }

    // Ensure date is in YYYY-MM-DD format
    let dateStr = event.date;
    if (typeof event.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.date)) {
      dateStr = event.date;
    } else {
      const parsedDate = parseEventDate(event.date);
      if (parsedDate && !isNaN(parsedDate.getTime())) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
      }
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
      requireRSVP: event.requireRSVP !== undefined ? event.requireRSVP : true,
      rsvpApprovalMode: event.rsvpApprovalMode || 'immediate',
      limitCapacity: event.limitCapacity !== undefined ? event.limitCapacity : false // Ensure toggle state is set
    });
    setShowEventModal(true);
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    try {
      const timeStr = `${eventForm.hour}:${eventForm.minute} ${eventForm.period}`;

      const eventData = {
        title: eventForm.title,
        date: eventForm.date,
        time: timeStr,
        hour: eventForm.hour,
        minute: eventForm.minute,
        period: eventForm.period,
        location: eventForm.location,
        description: eventForm.description,
        capacity: parseInt(eventForm.capacity),
        requireRSVP: eventForm.requireRSVP,
        rsvpApprovalMode: eventForm.rsvpApprovalMode,
        limitCapacity: eventForm.limitCapacity // Include capacity limit in event data
      };

      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), eventData);
        setEventStatus({
          show: true,
          message: 'Event updated successfully!',
          type: 'success'
        });
      } else {
        await addDoc(collection(db, 'events'), {
          ...eventData,
          createdAt: new Date()
        });
        setEventStatus({
          show: true,
          message: 'Event created successfully!',
          type: 'success'
        });
      }

      resetEventForm();
      loadEvents();

      setTimeout(() => {
        setShowEventModal(false);
        setEventStatus({ show: false, message: '', type: '' });
      }, 2000);
    } catch (error) {
      console.error('Error saving event:', error);
      setEventStatus({
        show: true,
        message: 'Error saving event. Please try again.',
        type: 'danger'
      });
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        setEventStatus({
          show: true,
          message: 'Event deleted successfully!',
          type: 'success'
        });
        loadEvents();
        setTimeout(() => {
          setEventStatus({ show: false, message: '', type: '' });
        }, 2000);
      } catch (error) {
        console.error('Error deleting event:', error);
        setEventStatus({
          show: true,
          message: 'Error deleting event. Please try again.',
          type: 'danger'
        });
      }
    }
  };

  const resetEventForm = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      date: '',
      hour: '6',
      minute: '30',
      period: 'PM',
      location: 'BCB Community Center, Frisco',
      description: '',
      capacity: 40,
      requireRSVP: true,
      rsvpApprovalMode: 'immediate',
      limitCapacity: false // Reset capacity limit toggle
    });
  };

  const handleRSVPSubmit = async (e) => {
    e.preventDefault();
    try {
      const rsvpsCollection = collection(db, 'rsvps');

      if (selectedEvent.requireRSVP === false) {
        setRsvpStatus({
          show: true,
          message: 'This event does not require RSVP. Just show up!',
          type: 'info'
        });
        return;
      }

      // Check if this email already has an RSVP for this event
      const q = query(
        rsvpsCollection,
        where('eventId', '==', selectedEvent.id),
        where('email', '==', rsvpData.email)
      );
      const existingRSVPs = await getDocs(q);

      if (!existingRSVPs.empty && !existingRSVP) {
        // Found existing RSVP, load it and show update options
        const existingDoc = existingRSVPs.docs[0];
        const existingData = existingDoc.data();
        setExistingRSVP({ id: existingDoc.id, ...existingData });
        
        // Pre-populate the form with existing data
        setRSVPData({
          firstName: existingData.firstName || '',
          lastName: existingData.lastName || '',
          email: existingData.email || '',
          phone: existingData.phone || '',
          attendees: existingData.attendees || [],
          dietaryRestrictions: existingData.dietaryRestrictions || ''
        });
        
        setRsvpStatus({
          show: true,
          message: `You already have an RSVP for this event. You can update your information below or unregister.`,
          type: 'info'
        });
        return;
      }

      const allRSVPsQuery = query(
        rsvpsCollection,
        where('eventId', '==', selectedEvent.id)
      );
      const allRSVPsSnapshot = await getDocs(allRSVPsQuery);

      let totalApprovedGuests = 0;
      allRSVPsSnapshot.forEach((doc) => {
        const rsvp = doc.data();
        // Skip the current user's existing RSVP when calculating capacity
        if (existingRSVP && doc.id === existingRSVP.id) return;
        
        if (rsvp.status === 'approved' || (rsvp.status === undefined && selectedEvent.rsvpApprovalMode === 'immediate')) {
          // Count primary guest + additional attendees
          totalApprovedGuests += 1 + (rsvp.attendees?.length || 0);
        }
      });

      const requestedGuests = 1 + (rsvpData.attendees?.length || 0); // Primary + additional attendees
      const capacity = selectedEvent.capacity || 40;
      const isOverCapacity = selectedEvent.limitCapacity && (totalApprovedGuests + requestedGuests > capacity);

      let rsvpStatus = 'approved';
      let statusMessage = existingRSVP 
        ? 'Your RSVP has been updated successfully!' 
        : 'Thank you for your RSVP! We look forward to seeing you.';
      let statusType = 'success';

      if (selectedEvent.rsvpApprovalMode === 'approval') {
        rsvpStatus = existingRSVP?.status || 'pending';
        statusMessage = existingRSVP
          ? 'Your RSVP has been updated successfully!'
          : 'Your RSVP has been submitted and is awaiting approval from our team. You will receive confirmation via email.';
        statusType = 'info';
      } else if (isOverCapacity) {
        rsvpStatus = 'waitlist';
        statusMessage = `We're sorry, but this event has reached capacity (${capacity} guests). Your RSVP has been added to the waitlist, and you'll be notified if space becomes available.`;
        statusType = 'warning';
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
        dietaryRestrictions: rsvpData.dietaryRestrictions || '',
        status: rsvpStatus,
        timestamp: existingRSVP ? existingRSVP.timestamp : serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (existingRSVP) {
        // Update existing RSVP
        await updateDoc(doc(db, 'rsvps', existingRSVP.id), rsvpDataToSave);
      } else {
        // Create new RSVP
        await addDoc(rsvpsCollection, rsvpDataToSave);
      }

      // Save user info to localStorage for future RSVPs
      saveUserInfo(rsvpData);

      // Send confirmation email
      try {
        await sendRSVPConfirmationEmail(rsvpData, selectedEvent, rsvpStatus);
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the RSVP if email fails
      }

      setRsvpStatus({
        show: true,
        message: statusMessage,
        type: statusType
      });

      setRSVPData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        attendees: [],
        dietaryRestrictions: ''
      });
      
      setExistingRSVP(null);

      setTimeout(() => {
        setShowRSVPModal(false);
        setRsvpStatus({ show: false, message: '', type: '' });
      }, 4000);
    } catch (error) {
      console.error('Error submitting RSVP:', error);

      // If permission denied, store a pending RSVP locally so user doesn't lose data.
      let shortMsg = error?.message ? `There was an error submitting your RSVP: ${error.message}` : 'There was an error submitting your RSVP. Please try again or contact us directly.';
      if (error?.code === 'permission-denied') {
        try {
          const pendingKey = 'bcb_pending_rsvps';
          const existing = JSON.parse(localStorage.getItem(pendingKey) || '[]');
          existing.push({
            savedAt: new Date().toISOString(),
            eventId: selectedEvent?.id,
            eventTitle: selectedEvent?.title,
            eventDate: selectedEvent?.date,
            ...rsvpData
          });
          localStorage.setItem(pendingKey, JSON.stringify(existing));
          shortMsg = 'Permissions error: your RSVP was saved locally and will need to be resubmitted once our system permissions are updated. Please try again later or contact us directly.';
        } catch (storageError) {
          console.error('Failed to store pending RSVP locally:', storageError);
        }
      }

      setRsvpStatus({
        show: true,
        message: shortMsg,
        type: 'danger'
      });
    }
  };

  const handleUnregister = async () => {
    if (!existingRSVP) return;
    
    if (window.confirm('Are you sure you want to unregister from this event?')) {
      try {
        await deleteDoc(doc(db, 'rsvps', existingRSVP.id));
        
        setRsvpStatus({
          show: true,
          message: 'You have been successfully unregistered from this event.',
          type: 'success'
        });
        
        setRSVPData({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          attendees: [],
          dietaryRestrictions: ''
        });
        
        setExistingRSVP(null);
        
        setTimeout(() => {
          setShowRSVPModal(false);
          setRsvpStatus({ show: false, message: '', type: '' });
        }, 2000);
      } catch (error) {
        console.error('Error unregistering:', error);
        setRsvpStatus({
          show: true,
          message: 'Error unregistering. Please try again or contact us directly.',
          type: 'danger'
        });
      }
    }
  };

  // Add functionality to RSVP form for multiple attendees
  const handleAddAttendee = () => {
    setRSVPData((prevData) => ({
      ...prevData,
      attendees: [...prevData.attendees, { firstName: '', lastName: '', email: '', phone: '' }]
    }));
  };

  const handleRemoveAttendee = (index) => {
    setRSVPData((prevData) => ({
      ...prevData,
      attendees: prevData.attendees.filter((_, i) => i !== index)
    }));
  };

  const handleAttendeeChange = (index, field, value) => {
    setRSVPData((prevData) => {
      const updatedAttendees = [...prevData.attendees];
      updatedAttendees[index][field] = value;
      return { ...prevData, attendees: updatedAttendees };
    });
  };

  // Add functionality to toggle capacity limit
  const handleToggleCapacityLimit = () => {
    setEventForm((prevForm) => ({
      ...prevForm,
      limitCapacity: !prevForm.limitCapacity
    }));
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-5">

        <Container>
          <div className="text-center py-4">
            <FaCalendarAlt size={60} className="mb-3" />
            <h1 className="display-4 fw-bold">Events Calendar</h1>
            <p className="lead">
              Join us for Shabbat dinners, holiday celebrations, and community gatherings
            </p>
            <p className="mb-0">November through April</p>

            {(isAdmin || isManager) && (
              <Button
                variant="light"
                size="lg"
                className="mt-4"
                onClick={() => {
                  resetEventForm();
                  setShowEventModal(true);
                }}
              >
                <FaPlus className="me-2" />
                Create New Event
              </Button>
            )}
          </div>
        </Container>
      </section>

      {eventStatus.show && (
        <Container className="mt-3">
          <Alert
            variant={eventStatus.type}
            onClose={() => setEventStatus({ show: false, message: '', type: '' })}
            dismissible
          >
            {eventStatus.message}
          </Alert>
        </Container>
      )}

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
                        position: 'absolute',
                        top: '3.25rem',
                        right: '1.5rem',
                        zIndex: 20,
                        width: '320px',
                        backgroundColor: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
                        padding: '16px'
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => handleYearChange(-1)}
                          type="button"
                        >
                          &lt;
                        </Button>
                        <span className="fw-semibold text-primary">{pickerYear}</span>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => handleYearChange(1)}
                          type="button"
                        >
                          &gt;
                        </Button>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {monthNames.map((month, index) => {
                          const isActive = activeYear === pickerYear && activeMonth === index;
                          return (
                            <Button
                              key={month}
                              variant={isActive ? 'primary' : 'outline-primary'}
                              size="sm"
                              type="button"
                              onClick={() => handleSelectMonth(index)}
                              style={{ flex: '0 0 48%' }}
                            >
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
                      left: 'today',
                      center: 'title',
                      right: 'monthsLabel,separator,prev,next'
                    }}
                    customButtons={{
                      monthsLabel: {
                        text: 'Months',
                        click: handleMonthsButtonClick
                      },
                      separator: {
                        text: '|',
                        click: () => { }
                      }
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
                    <Card.Body className="p-4">
                      {isEventToday(event.date) && (
                        <div className="mb-3 text-center">
                          <span className="badge bg-success" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
                            Today
                          </span>
                        </div>
                      )}
                      {!isEventToday(event.date) && isEventTomorrow(event.date) && (
                        <div className="mb-3 text-center">
                          <span className="badge bg-info" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>
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
                            setRsvpStatus({ show: false, message: '', type: '' });
                            loadSavedUserInfo();
                            setShowRSVPModal(true);
                          }}
                        >
                          RSVP Now
                        </Button>
                        {(isAdmin || isManager) && (
                          <>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => handleEditEvent(event)}
                            >
                              <FaEdit />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDeleteEvent(event.id)}
                            >
                              <FaTrash />
                            </Button>
                          </>
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
          <h2 className="section-title text-center mb-5">Past Events</h2>
          {events.filter((e) => isEventPast(e.date)).length === 0 ? (
            <p className="text-center text-muted">No past events to display.</p>
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
                      {(isAdmin || isManager) && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {events
                      .filter((e) => isEventPast(e.date))
                      .sort((a, b) => parseEventDate(b.date) - parseEventDate(a.date))
                      .map((event) => (
                        <tr key={event.id} style={{ opacity: 0.7 }}>
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
                          <td style={{ maxWidth: '300px' }}>
                            {event.description}
                          </td>
                          <td>
                            <FaUsers className="me-2 text-secondary" />
                            {event.capacity}
                          </td>
                          {(isAdmin || isManager) && (
                            <td>
                              <div className="d-flex gap-1">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleEditEvent(event)}
                                  title="Edit Event"
                                >
                                  <FaEdit />
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDeleteEvent(event.id)}
                                  title="Delete Event"
                                >
                                  <FaTrash />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}
        </Container>
      </section>

      {/* RSVP Modal */}
      <Modal show={showRSVPModal} onHide={() => {
        setShowRSVPModal(false);
        setExistingRSVP(null);
        setRsvpStatus({ show: false, message: '', type: '' });
      }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>RSVP for {selectedEvent?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEvent && (
            <div className="mb-4 p-3 bg-light rounded">
              <h5 className="mb-3">{selectedEvent.title}</h5>
              <p className="mb-1">
                <strong>Date:</strong> {formatEventDate(selectedEvent.date)}
              </p>
              <p className="mb-1"><strong>Time:</strong> {selectedEvent.time}</p>
              <p className="mb-0"><strong>Location:</strong> {selectedEvent.location}</p>
            </div>
          )}

          <Form onSubmit={handleRSVPSubmit} autoComplete="on">
            <Form.Group className="mb-3">
              <Form.Label>First Name *</Form.Label>
              <Form.Control
                type="text"
                required
                value={rsvpData.firstName}
                onChange={(e) => setRSVPData({ ...rsvpData, firstName: e.target.value })}
                placeholder="John"
                autoComplete="given-name"
                name="firstName"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Last Name *</Form.Label>
              <Form.Control
                type="text"
                required
                value={rsvpData.lastName}
                onChange={(e) => setRSVPData({ ...rsvpData, lastName: e.target.value })}
                placeholder="Doe"
                autoComplete="family-name"
                name="lastName"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                required
                value={rsvpData.email}
                onChange={(e) => setRSVPData({ ...rsvpData, email: e.target.value })}
                placeholder="john@example.com"
                autoComplete="email"
                name="email"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Phone Number</Form.Label>
              <Form.Control
                type="tel"
                value={rsvpData.phone}
                onChange={(e) => setRSVPData({ ...rsvpData, phone: e.target.value })}
                placeholder="(123) 456-7890"
                autoComplete="tel"
                name="phone"
              />
            </Form.Group>

            {rsvpData.attendees.map((attendee, index) => (
              <div key={index} className="mb-4 p-3 bg-light rounded position-relative">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0">Additional Guest {index + 1}</h5>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleRemoveAttendee(index)}
                  >
                    <FaTrash /> Remove
                  </Button>
                </div>
                <Form.Group className="mb-3">
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={attendee.firstName}
                    onChange={(e) => handleAttendeeChange(index, 'firstName', e.target.value)}
                    placeholder="John"
                    autoComplete="given-name"
                    name={`attendee-${index}-firstName`}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={attendee.lastName}
                    onChange={(e) => handleAttendeeChange(index, 'lastName', e.target.value)}
                    placeholder="Doe"
                    autoComplete="family-name"
                    name={`attendee-${index}-lastName`}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    required
                    value={attendee.email}
                    onChange={(e) => handleAttendeeChange(index, 'email', e.target.value)}
                    placeholder="john@example.com"
                    autoComplete="email"
                    name={`attendee-${index}-email`}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    type="tel"
                    value={attendee.phone}
                    onChange={(e) => handleAttendeeChange(index, 'phone', e.target.value)}
                    placeholder="(123) 456-7890"
                    autoComplete="tel"
                    name={`attendee-${index}-phone`}
                  />
                </Form.Group>
              </div>
            ))}

            <Button
              variant="outline-primary"
              onClick={handleAddAttendee}
              className="mt-3"
            >
              Add Another Person
            </Button>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="remember-info"
                label="Remember my information for future RSVPs"
                defaultChecked={!!localStorage.getItem('bcb_user_info')}
                onChange={(e) => {
                  if (!e.target.checked) {
                    localStorage.removeItem('bcb_user_info');
                  }
                }}
              />
              <Form.Text className="text-muted">
                Your information is saved locally on your device
              </Form.Text>
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" size="lg">
                {existingRSVP ? 'Update RSVP' : 'Submit RSVP'}
              </Button>
              {existingRSVP && (
                <Button variant="danger" onClick={handleUnregister} size="lg">
                  Unregister
                </Button>
              )}
              <Button variant="secondary" onClick={() => {
                setShowRSVPModal(false);
                setExistingRSVP(null);
                setRsvpStatus({ show: false, message: '', type: '' });
              }} size="lg">
                Cancel
              </Button>
            </div>

            {rsvpStatus.show && (
              <Alert variant={rsvpStatus.type} className="mt-4 mb-0">
                {rsvpStatus.message}
              </Alert>
            )}
          </Form>
        </Modal.Body>
      </Modal>

      {/* Event Form Modal (Create/Edit) */}
      <Modal show={showEventModal} onHide={() => setShowEventModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingEvent ? 'Edit Event' : 'Create New Event'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {eventStatus.show && (
            <Alert variant={eventStatus.type} className="mb-4">
              {eventStatus.message}
            </Alert>
          )}

          <Form onSubmit={handleEventSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Event Title *</Form.Label>
              <Form.Control
                type="text"
                required
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="e.g., Shabbat Dinner"
              />
            </Form.Group>

            <Row>
              <Col lg={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Date *</Form.Label>
                  <Form.Control
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col lg={6}>
                <Form.Label>Time *</Form.Label>
                <Row>
                  <Col xs={4}>
                    <Form.Select
                      value={eventForm.hour}
                      onChange={(e) => setEventForm({ ...eventForm, hour: e.target.value })}
                    >
                      {[...Array(12)].map((_, i) => {
                        const hour = i + 1;
                        return <option key={hour} value={hour}>{hour}</option>;
                      })}
                    </Form.Select>
                    <Form.Text className="text-muted small">Hour</Form.Text>
                  </Col>
                  <Col xs={4}>
                    <Form.Select
                      value={eventForm.minute}
                      onChange={(e) => setEventForm({ ...eventForm, minute: e.target.value })}
                    >
                      {['00', '10', '20', '30', '40', '50'].map(min => (
                        <option key={min} value={min}>{min}</option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted small">Min</Form.Text>
                  </Col>
                  <Col xs={4}>
                    <Form.Select
                      value={eventForm.period}
                      onChange={(e) => setEventForm({ ...eventForm, period: e.target.value })}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </Form.Select>
                    <Form.Text className="text-muted small">AM/PM</Form.Text>
                  </Col>
                </Row>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Location *</Form.Label>
              <Form.Control
                type="text"
                required
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="e.g., BCB Community Center, Frisco, CO"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Event description..."
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="limitCapacity"
                label="Limit Capacity"
                checked={eventForm.limitCapacity}
                onChange={handleToggleCapacityLimit}
              />
            </Form.Group>

            {eventForm.limitCapacity && (
              <Form.Group className="mb-3">
                <Form.Label>Capacity *</Form.Label>
                <Form.Control
                  type="number"
                  required
                  min="1"
                  value={eventForm.capacity}
                  onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })}
                />
                <Form.Text className="text-muted">Maximum number of guests</Form.Text>
              </Form.Group>
            )}

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="requireRSVP"
                label="Require RSVP for this event"
                checked={eventForm.requireRSVP}
                onChange={(e) => setEventForm({ ...eventForm, requireRSVP: e.target.checked })}
              />
            </Form.Group>

            {eventForm.requireRSVP && (
              <Form.Group className="mb-4">
                <Form.Label>RSVP Approval Mode</Form.Label>
                <Form.Select
                  value={eventForm.rsvpApprovalMode}
                  onChange={(e) => setEventForm({ ...eventForm, rsvpApprovalMode: e.target.value })}
                >
                  <option value="immediate">Immediate - Auto-approve all RSVPs</option>
                  <option value="approval">Approval Required - Manually approve each RSVP</option>
                </Form.Select>
              </Form.Group>
            )}

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" size="lg">
                {editingEvent ? 'Update Event' : 'Create Event'}
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

export default Events;
