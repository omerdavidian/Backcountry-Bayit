import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Alert } from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../utils/AuthContext';
import { FaCalendarAlt, FaUsers, FaClock, FaMapMarkerAlt, FaPlus } from 'react-icons/fa';

function Events() {
  const { isAdmin, isManager } = useAuth();
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rsvpData, setRSVPData] = useState({
    name: '',
    email: '',
    phone: '',
    guests: 1,
    dietaryRestrictions: ''
  });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    hour: '6',
    minute: '00',
    period: 'PM',
    location: '',
    description: '',
    capacity: 40,
    requireRSVP: true,
    rsvpApprovalMode: 'immediate'
  });
  const [rsvpStatus, setRsvpStatus] = useState({ show: false, message: '', type: '' });
  const [createStatus, setCreateStatus] = useState({ show: false, message: '', type: '' });

  useEffect(() => {
    loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadEvents = async () => {
    try {
      const eventsCollection = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsCollection);
      const eventsList = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        start: doc.data().date,
        title: doc.data().title
      }));
      setEvents(eventsList);
    } catch (error) {
      console.error('Error loading events:', error);
      // Use sample events if Firebase is not configured yet
      loadSampleEvents();
    }
  };

  const loadSampleEvents = () => {
    const sampleEvents = [
      {
        id: '1',
        title: 'Shabbat Dinner',
        date: '2025-11-15',
        start: '2025-11-15',
        time: '6:30 PM',
        location: 'BCB Community Center, Frisco',
        description: 'Join us for our weekly Shabbat dinner with traditional blessings, delicious food, and warm community.',
        capacity: 40
      },
      {
        id: '2',
        title: 'Chanukah Celebration',
        date: '2025-12-20',
        start: '2025-12-20',
        time: '5:00 PM',
        location: 'BCB Community Center, Frisco',
        description: 'Light the menorah, play dreidel, enjoy latkes and sufganiyot, and celebrate the Festival of Lights!',
        capacity: 60
      },
      {
        id: '3',
        title: 'Shabbat Dinner',
        date: '2025-11-22',
        start: '2025-11-22',
        time: '6:30 PM',
        location: 'BCB Community Center, Frisco',
        description: 'Join us for our weekly Shabbat dinner with traditional blessings, delicious food, and warm community.',
        capacity: 40
      },
      {
        id: '4',
        title: 'Purim Party',
        date: '2026-03-14',
        start: '2026-03-14',
        time: '6:00 PM',
        location: 'BCB Community Center, Frisco',
        description: 'Costumes, Megillah reading, hamantaschen, and fun! Celebrate the story of Queen Esther.',
        capacity: 50
      }
    ];
    setEvents(sampleEvents);
  };

  const handleEventClick = (clickInfo) => {
    const event = events.find(e => e.id === clickInfo.event.id);
    setSelectedEvent(event);
    setShowRSVPModal(true);
  };

  const handleRSVPSubmit = async (e) => {
    e.preventDefault();
    try {
      const rsvpsCollection = collection(db, 'rsvps');

      // Check if event requires RSVP
      if (selectedEvent.requireRSVP === false) {
        setRsvpStatus({
          show: true,
          message: 'This event does not require RSVP. Just show up!',
          type: 'info'
        });
        return;
      }

      // Check if already RSVP'd
      const q = query(
        rsvpsCollection,
        where('eventId', '==', selectedEvent.id),
        where('email', '==', rsvpData.email)
      );
      const existingRSVPs = await getDocs(q);

      if (!existingRSVPs.empty) {
        setRsvpStatus({
          show: true,
          message: 'You have already RSVP\'d for this event!',
          type: 'warning'
        });
        return;
      }

      // Get all approved RSVPs for this event to check capacity
      const allRSVPsQuery = query(
        rsvpsCollection,
        where('eventId', '==', selectedEvent.id)
      );
      const allRSVPsSnapshot = await getDocs(allRSVPsQuery);

      // Calculate total approved guests
      let totalApprovedGuests = 0;
      allRSVPsSnapshot.forEach((doc) => {
        const rsvp = doc.data();
        if (rsvp.status === 'approved' || (rsvp.status === undefined && selectedEvent.rsvpApprovalMode === 'immediate')) {
          totalApprovedGuests += rsvp.guests || 1;
        }
      });

      const requestedGuests = parseInt(rsvpData.guests);
      const capacity = selectedEvent.capacity || 40;
      const isOverCapacity = totalApprovedGuests + requestedGuests > capacity;

      // Determine RSVP status
      let rsvpStatus = 'approved';
      let statusMessage = 'Thank you for your RSVP! We look forward to seeing you.';
      let statusType = 'success';

      if (selectedEvent.rsvpApprovalMode === 'approval') {
        rsvpStatus = 'pending';
        statusMessage = 'Your RSVP has been submitted and is awaiting approval from our team. You will receive confirmation via email.';
        statusType = 'info';
      } else if (isOverCapacity) {
        rsvpStatus = 'waitlist';
        statusMessage = `We're sorry, but this event has reached capacity (${capacity} guests). Your RSVP has been added to the waitlist, and you'll be notified if space becomes available. An admin notification has been sent.`;
        statusType = 'warning';
      }

      // Add RSVP to database
      await addDoc(rsvpsCollection, {
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventDate: selectedEvent.date,
        ...rsvpData,
        status: rsvpStatus,
        timestamp: new Date()
      });

      setRsvpStatus({
        show: true,
        message: statusMessage,
        type: statusType
      });

      // Reset form
      setRSVPData({
        name: '',
        email: '',
        phone: '',
        guests: 1,
        dietaryRestrictions: ''
      });

      setTimeout(() => {
        setShowRSVPModal(false);
        setRsvpStatus({ show: false, message: '', type: '' });
      }, 4000);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      setRsvpStatus({
        show: true,
        message: 'There was an error submitting your RSVP. Please try again or contact us directly.',
        type: 'danger'
      });
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    try {
      const eventsCollection = collection(db, 'events');
      const timeStr = `${eventForm.hour}:${eventForm.minute} ${eventForm.period}`;

      await addDoc(eventsCollection, {
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
        createdAt: new Date()
      });

      setCreateStatus({
        show: true,
        message: 'Event created successfully!',
        type: 'success'
      });

      // Reset form
      setEventForm({
        title: '',
        date: '',
        hour: '6',
        minute: '00',
        period: 'PM',
        location: '',
        description: '',
        capacity: 40,
        requireRSVP: true,
        rsvpApprovalMode: 'immediate'
      });

      // Reload events
      loadEvents();

      setTimeout(() => {
        setShowCreateModal(false);
        setCreateStatus({ show: false, message: '', type: '' });
      }, 2000);
    } catch (error) {
      console.error('Error creating event:', error);
      setCreateStatus({
        show: true,
        message: 'Error creating event. Please try again.',
        type: 'danger'
      });
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
            <p className="lead">
              Join us for Shabbat dinners, holiday celebrations, and community gatherings
            </p>
            <p className="mb-0">November through April</p>

            {(isAdmin || isManager) && (
              <Button
                variant="light"
                size="lg"
                className="mt-4"
                onClick={() => setShowCreateModal(true)}
              >
                <FaPlus className="me-2" />
                Create New Event
              </Button>
            )}
          </div>
        </Container>
      </section>

      {/* Calendar Section */}
      <section className="py-5">
        <Container>
          <Row>
            <Col lg={12}>
              <Card className="border-0 shadow">
                <Card.Body className="p-4">
                  <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    events={events}
                    eventClick={handleEventClick}
                    headerToolbar={{
                      left: 'prev,next today',
                      center: 'title',
                      right: 'dayGridMonth'
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
            {events.slice(0, 4).map((event) => (
              <Col key={event.id} md={6}>
                <Card className="h-100 border-0 shadow-sm card-hover">
                  <Card.Body className="p-4">
                    <h4 className="text-primary mb-3">{event.title}</h4>
                    <div className="mb-2">
                      <FaCalendarAlt className="me-2 text-primary" />
                      <strong>Date:</strong> {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
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
                    <Button
                      variant="primary"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowRSVPModal(true);
                      }}
                    >
                      RSVP Now
                    </Button>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        </Container>
      </section>

      {/* RSVP Modal */}
      <Modal show={showRSVPModal} onHide={() => setShowRSVPModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>RSVP for {selectedEvent?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {rsvpStatus.show && (
            <Alert variant={rsvpStatus.type} className="mb-4">
              {rsvpStatus.message}
            </Alert>
          )}

          {selectedEvent && (
            <div className="mb-4 p-3 bg-light rounded">
              <h5 className="mb-3">{selectedEvent.title}</h5>
              <p className="mb-1">
                <strong>Date:</strong> {new Date(selectedEvent.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
              <p className="mb-1"><strong>Time:</strong> {selectedEvent.time}</p>
              <p className="mb-0"><strong>Location:</strong> {selectedEvent.location}</p>
            </div>
          )}

          <Form onSubmit={handleRSVPSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Full Name *</Form.Label>
              <Form.Control
                type="text"
                required
                value={rsvpData.name}
                onChange={(e) => setRSVPData({ ...rsvpData, name: e.target.value })}
                placeholder="John Doe"
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
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Phone Number</Form.Label>
              <Form.Control
                type="tel"
                value={rsvpData.phone}
                onChange={(e) => setRSVPData({ ...rsvpData, phone: e.target.value })}
                placeholder="(123) 456-7890"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Number of Guests (including yourself) *</Form.Label>
              <Form.Control
                type="number"
                required
                min="1"
                max="10"
                value={rsvpData.guests}
                onChange={(e) => setRSVPData({ ...rsvpData, guests: parseInt(e.target.value) })}
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Dietary Restrictions or Allergies</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={rsvpData.dietaryRestrictions}
                onChange={(e) => setRSVPData({ ...rsvpData, dietaryRestrictions: e.target.value })}
                placeholder="Please let us know about any dietary restrictions or allergies..."
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" size="lg">
                Submit RSVP
              </Button>
              <Button variant="secondary" onClick={() => setShowRSVPModal(false)} size="lg">
                Cancel
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Create Event Modal (Admin/Manager Only) */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create New Event</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {createStatus.show && (
            <Alert variant={createStatus.type} className="mb-4">
              {createStatus.message}
            </Alert>
          )}

          <Form onSubmit={handleCreateEvent}>
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
                Create Event
              </Button>
              <Button variant="secondary" onClick={() => setShowCreateModal(false)} size="lg">
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
