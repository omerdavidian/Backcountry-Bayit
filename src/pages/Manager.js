import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaUsers, FaSignOutAlt } from 'react-icons/fa';

function Manager() {
  const { currentUser, logout, isManager, userRole } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [rsvps, setRSVPs] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
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
    rsvpApprovalMode: 'immediate'
  });

  // Redirect if not logged in or not a manager
  useEffect(() => {
    if (!currentUser || !isManager) {
      navigate('/login');
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
      setAlert({ show: true, message: 'Error loading events. Please refresh the page.', type: 'danger' });
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
      const timeString = `${eventForm.hour}:${eventForm.minute} ${eventForm.period}`;

      const eventData = {
        ...eventForm,
        time: timeString
      };

      if (editingEvent) {
        await updateDoc(doc(db, 'events', editingEvent.id), eventData);
        setAlert({ show: true, message: 'Event updated successfully!', type: 'success' });
      } else {
        await addDoc(collection(db, 'events'), eventData);
        setAlert({ show: true, message: 'Event created successfully!', type: 'success' });
      }

      setShowEventModal(false);
      setEditingEvent(null);
      resetEventForm();
      loadEvents();

      setTimeout(() => {
        setAlert({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Error saving event:', error);
      setAlert({ show: true, message: 'Error saving event. Please try again.', type: 'danger' });
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);

    let hour = '6', minute = '30', period = 'PM';
    if (event.time) {
      const timeMatch = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        hour = timeMatch[1];
        minute = timeMatch[2];
        period = timeMatch[3].toUpperCase();
      }
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
      requireRSVP: event.requireRSVP !== undefined ? event.requireRSVP : true,
      rsvpApprovalMode: event.rsvpApprovalMode || 'immediate'
    });
    setShowEventModal(true);
  };

  const resetEventForm = () => {
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
      rsvpApprovalMode: 'immediate'
    });
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        await deleteDoc(doc(db, 'events', eventId));
        setAlert({ show: true, message: 'Event deleted successfully!', type: 'success' });
        loadEvents();
        setTimeout(() => {
          setAlert({ show: false, message: '', type: '' });
        }, 3000);
      } catch (error) {
        console.error('Error deleting event:', error);
        setAlert({ show: true, message: 'Error deleting event. Please try again.', type: 'danger' });
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (!currentUser || !isManager) {
    return null;
  }

  return (
    <div className="bg-light min-vh-100 py-4">
      <Container>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="mb-1">
              <FaUsers className="me-2 text-primary" />
              Manager Dashboard
            </h1>
            <p className="text-muted mb-0">
              Welcome, {currentUser.email} | Role: <Badge bg="primary">{userRole}</Badge>
            </p>
          </div>
          <Button variant="outline-danger" onClick={handleLogout}>
            <FaSignOutAlt className="me-2" />
            Logout
          </Button>
        </div>

        {alert.show && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert({ show: false, message: '', type: '' })}>
            {alert.message}
          </Alert>
        )}

        {/* Events Section */}
        <Card className="mb-4 border-0 shadow-sm">
          <Card.Header className="bg-white py-3">
            <div className="d-flex justify-content-between align-items-center">
              <h4 className="mb-0">
                <FaCalendarAlt className="me-2 text-primary" />
                Manage Events
              </h4>
              <Button
                variant="primary"
                onClick={() => {
                  setEditingEvent(null);
                  resetEventForm();
                  setShowEventModal(true);
                }}
              >
                <FaPlus className="me-2" />
                Create Event
              </Button>
            </div>
          </Card.Header>
          <Card.Body>
            {events.length === 0 ? (
              <p className="text-muted text-center py-4">No events yet. Create your first event!</p>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Location</th>
                    <th>Capacity</th>
                    <th>RSVPs</th>
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
                      <td>{event.capacity}</td>
                      <td>
                        <Badge bg="info">
                          {rsvps.filter(r => r.eventId === event.id).length} RSVPs
                        </Badge>
                      </td>
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
            )}
          </Card.Body>
        </Card>

        {/* RSVPs Summary */}
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white py-3">
            <h4 className="mb-0">
              <FaUsers className="me-2 text-primary" />
              Recent RSVPs
            </h4>
          </Card.Header>
          <Card.Body>
            {rsvps.length === 0 ? (
              <p className="text-muted text-center py-4">No RSVPs yet.</p>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Guests</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rsvps.slice(0, 10).map(rsvp => (
                    <tr key={rsvp.id}>
                      <td><strong>{rsvp.eventTitle}</strong></td>
                      <td>{rsvp.name}</td>
                      <td>{rsvp.email}</td>
                      <td>{rsvp.guests}</td>
                      <td>
                        {rsvp.timestamp?.toDate
                          ? rsvp.timestamp.toDate().toLocaleDateString()
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>
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

export default Manager;
