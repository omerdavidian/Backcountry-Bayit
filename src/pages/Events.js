import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Alert } from 'react-bootstrap';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FaCalendarAlt, FaUsers, FaClock, FaMapMarkerAlt } from 'react-icons/fa';

function Events() {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [rsvpData, setRSVPData] = useState({
    name: '',
    email: '',
    phone: '',
    guests: 1,
    dietaryRestrictions: ''
  });
  const [rsvpStatus, setRsvpStatus] = useState({ show: false, message: '', type: '' });

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

      await addDoc(rsvpsCollection, {
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventDate: selectedEvent.date,
        ...rsvpData,
        timestamp: new Date()
      });

      setRsvpStatus({
        show: true,
        message: 'Thank you for your RSVP! We look forward to seeing you.',
        type: 'success'
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
      }, 2000);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      setRsvpStatus({
        show: true,
        message: 'There was an error submitting your RSVP. Please try again or contact us directly.',
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
    </div>
  );
}

export default Events;
