import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaUsers, FaSignOutAlt } from 'react-icons/fa';

function Admin() {
  const { currentUser, logout, isManager } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [rsvps, setRSVPs] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    time: '',
    location: 'BCB Community Center, Frisco',
    description: '',
    capacity: 40
  });

  // Redirect if not logged in or not a manager
  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    } else if (!isManager) {
      setAlert({
        show: true,
        message: 'You do not have permission to access this page.',
        type: 'danger'
      });
      setTimeout(() => navigate('/'), 3000);
    }
  }, [currentUser, isManager, navigate]);

  useEffect(() => {
    if (currentUser && isManager) {
      loadEvents();
      loadRSVPs();
    }
  }, [currentUser, isManager]);

  const loadEvents = async () => {
    try {
      const eventsCollection = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsCollection);
      const eventsList = eventsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsList.sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const loadRSVPs = async () => {
    try {
      const rsvpsCollection = collection(db, 'rsvps');
      const rsvpsSnapshot = await getDocs(rsvpsCollection);
      const rsvpsList = rsvpsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setRSVPs(rsvpsList);
    } catch (error) {
      console.error('Error loading RSVPs:', error);
    }
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        // Update existing event
        await updateDoc(doc(db, 'events', editingEvent.id), eventForm);
        setAlert({ show: true, message: 'Event updated successfully!', type: 'success' });
      } else {
        // Create new event
        await addDoc(collection(db, 'events'), eventForm);
        setAlert({ show: true, message: 'Event created successfully!', type: 'success' });
      }

      setShowEventModal(false);
      resetEventForm();
      loadEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      setAlert({ show: true, message: 'Error saving event. Please try again.', type: 'danger' });
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        setAlert({ show: true, message: 'Event deleted successfully!', type: 'success' });
        loadEvents();
      } catch (error) {
        console.error('Error deleting event:', error);
        setAlert({ show: true, message: 'Error deleting event. Please try again.', type: 'danger' });
      }
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title,
      date: event.date,
      time: event.time,
      location: event.location,
      description: event.description,
      capacity: event.capacity
    });
    setShowEventModal(true);
  };

  const resetEventForm = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      date: '',
      time: '',
      location: 'BCB Community Center, Frisco',
      description: '',
      capacity: 40
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const getRSVPsForEvent = (eventId) => {
    return rsvps.filter(rsvp => rsvp.eventId === eventId);
  };

  const getTotalGuestsForEvent = (eventId) => {
    const eventRSVPs = getRSVPsForEvent(eventId);
    return eventRSVPs.reduce((total, rsvp) => total + (rsvp.guests || 1), 0);
  };

  if (!currentUser || !isManager) {
    return null;
  }

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold">Event Management</h1>
            <p className="text-muted mb-0">Welcome, {currentUser.email}</p>
          </div>
          <Button variant="outline-danger" onClick={handleLogout}>
            <FaSignOutAlt className="me-2" />
            Logout
          </Button>
        </div>

        {alert.show && (
          <Alert
            variant={alert.type}
            onClose={() => setAlert({ show: false, message: '', type: '' })}
            dismissible
            className="mb-4"
          >
            {alert.message}
          </Alert>
        )}

        <Tabs defaultActiveKey="events" className="mb-4">
          <Tab eventKey="events" title={<><FaCalendarAlt className="me-2" />Events</>}>
            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <h3 className="mb-0">Manage Events</h3>
                  <Button
                    variant="primary"
                    onClick={() => {
                      resetEventForm();
                      setShowEventModal(true);
                    }}
                  >
                    <FaPlus className="me-2" />
                    Add Event
                  </Button>
                </div>

                <Table responsive hover>
                  <thead className="bg-light">
                    <tr>
                      <th>Title</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Location</th>
                      <th>RSVPs</th>
                      <th>Capacity</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map(event => (
                      <tr key={event.id}>
                        <td><strong>{event.title}</strong></td>
                        <td>{new Date(event.date).toLocaleDateString()}</td>
                        <td>{event.time}</td>
                        <td>{event.location}</td>
                        <td>
                          {getTotalGuestsForEvent(event.id)} guests
                          {' '}({getRSVPsForEvent(event.id).length} RSVPs)
                        </td>
                        <td>{event.capacity}</td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-2"
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
          </Tab>

          <Tab eventKey="rsvps" title={<><FaUsers className="me-2" />RSVPs</>}>
            <Card className="border-0 shadow">
              <Card.Body className="p-4">
                <h3 className="mb-4">All RSVPs</h3>

                <Table responsive hover>
                  <thead className="bg-light">
                    <tr>
                      <th>Event</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Guests</th>
                      <th>Dietary Restrictions</th>
                      <th>Date Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.map(rsvp => (
                      <tr key={rsvp.id}>
                        <td><strong>{rsvp.eventTitle}</strong></td>
                        <td>{rsvp.name}</td>
                        <td>{rsvp.email}</td>
                        <td>{rsvp.phone || '-'}</td>
                        <td>{rsvp.guests}</td>
                        <td>{rsvp.dietaryRestrictions || '-'}</td>
                        <td>
                          {rsvp.timestamp?.toDate
                            ? rsvp.timestamp.toDate().toLocaleDateString()
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>

                {rsvps.length === 0 && (
                  <div className="text-center text-muted py-5">
                    <FaUsers size={50} className="mb-3" />
                    <p>No RSVPs yet.</p>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Tab>
        </Tabs>
      </Container>

      {/* Event Modal */}
      <Modal show={showEventModal} onHide={() => setShowEventModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingEvent ? 'Edit Event' : 'Create New Event'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEventSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Event Title *</Form.Label>
              <Form.Control
                type="text"
                required
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="e.g., Shabbat Dinner, Chanukah Celebration"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
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
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Time *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={eventForm.time}
                    onChange={(e) => setEventForm({ ...eventForm, time: e.target.value })}
                    placeholder="e.g., 6:30 PM"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Location *</Form.Label>
              <Form.Control
                type="text"
                required
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="e.g., BCB Community Center, Frisco"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description *</Form.Label>
              <Form.Control
                as="textarea"
                rows={4}
                required
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Event description..."
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>Capacity *</Form.Label>
              <Form.Control
                type="number"
                required
                min="1"
                value={eventForm.capacity}
                onChange={(e) => setEventForm({ ...eventForm, capacity: parseInt(e.target.value) })}
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit" size="lg">
                {editingEvent ? 'Update Event' : 'Create Event'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEventModal(false);
                  resetEventForm();
                }}
                size="lg"
              >
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
