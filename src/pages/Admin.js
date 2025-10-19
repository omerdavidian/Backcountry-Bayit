import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaUsers, FaSignOutAlt, FaCheck, FaTimes } from 'react-icons/fa';
import LocationAutocomplete from '../components/LocationAutocomplete';

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
    hour: '6',
    minute: '30',
    ampm: 'PM',
    location: 'BCB Community Center, Frisco',
    description: '',
    capacity: 40,
    requireRSVP: true,
    rsvpApprovalMode: 'immediate' // 'immediate' or 'approval'
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
      // Convert time to display format
      const timeString = `${eventForm.hour}:${eventForm.minute} ${eventForm.ampm}`;

      const eventData = {
        ...eventForm,
        time: timeString
      };

      if (editingEvent) {
        // Update existing event
        await updateDoc(doc(db, 'events', editingEvent.id), eventData);
        setAlert({ show: true, message: 'Event updated successfully!', type: 'success' });
      } else {
        // Create new event
        await addDoc(collection(db, 'events'), eventData);
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

    // Parse existing time if it exists
    let hour = '6', minute = '30', ampm = 'PM';
    if (event.time) {
      const timeMatch = event.time.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (timeMatch) {
        hour = timeMatch[1];
        minute = timeMatch[2];
        ampm = timeMatch[3].toUpperCase();
      }
    }

    setEventForm({
      title: event.title,
      date: event.date,
      hour: hour,
      minute: minute,
      ampm: ampm,
      location: event.location,
      description: event.description,
      capacity: event.capacity,
      requireRSVP: event.requireRSVP !== undefined ? event.requireRSVP : true,
      rsvpApprovalMode: event.rsvpApprovalMode || 'immediate'
    });
    setShowEventModal(true);
  };

  const resetEventForm = () => {
    setEditingEvent(null);
    setEventForm({
      title: '',
      date: '',
      hour: '6',
      minute: '30',
      ampm: 'PM',
      location: 'BCB Community Center, Frisco',
      description: '',
      capacity: 40,
      requireRSVP: true,
      rsvpApprovalMode: 'immediate'
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

  const handleApproveRSVP = async (rsvpId) => {
    try {
      await updateDoc(doc(db, 'rsvps', rsvpId), {
        status: 'approved'
      });
      setAlert({ show: true, message: 'RSVP approved successfully!', type: 'success' });
      loadRSVPs();
    } catch (error) {
      console.error('Error approving RSVP:', error);
      setAlert({ show: true, message: 'Error approving RSVP. Please try again.', type: 'danger' });
    }
  };

  const handleRejectRSVP = async (rsvpId) => {
    if (window.confirm('Are you sure you want to reject this RSVP?')) {
      try {
        await updateDoc(doc(db, 'rsvps', rsvpId), {
          status: 'rejected'
        });
        setAlert({ show: true, message: 'RSVP rejected.', type: 'info' });
        loadRSVPs();
      } catch (error) {
        console.error('Error rejecting RSVP:', error);
        setAlert({ show: true, message: 'Error rejecting RSVP. Please try again.', type: 'danger' });
      }
    }
  };

  const getStatusBadge = (status) => {
    if (!status || status === 'approved') {
      return <span className="badge bg-success">Approved</span>;
    } else if (status === 'pending') {
      return <span className="badge bg-warning text-dark">Pending</span>;
    } else if (status === 'waitlist') {
      return <span className="badge bg-info">Waitlist</span>;
    } else if (status === 'rejected') {
      return <span className="badge bg-danger">Rejected</span>;
    }
    return null;
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
                      <th>Status</th>
                      <th>Dietary Restrictions</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.map(rsvp => (
                      <tr key={rsvp.id}>
                        <td><strong>{rsvp.eventTitle}</strong></td>
                        <td>{rsvp.name}</td>
                        <td>{rsvp.email}</td>
                        <td>{rsvp.phone || '-'}</td>
                        <td className="text-center">{rsvp.guests}</td>
                        <td>{getStatusBadge(rsvp.status)}</td>
                        <td>{rsvp.dietaryRestrictions || '-'}</td>
                        <td>
                          {rsvp.timestamp?.toDate
                            ? rsvp.timestamp.toDate().toLocaleDateString()
                            : '-'}
                        </td>
                        <td>
                          {(rsvp.status === 'pending' || rsvp.status === 'waitlist') && (
                            <>
                              <Button
                                variant="success"
                                size="sm"
                                className="me-1"
                                onClick={() => handleApproveRSVP(rsvp.id)}
                                title="Approve RSVP"
                              >
                                <FaCheck />
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleRejectRSVP(rsvp.id)}
                                title="Reject RSVP"
                              >
                                <FaTimes />
                              </Button>
                            </>
                          )}
                          {rsvp.status === 'approved' && (
                            <span className="text-muted small">
                              <FaCheck className="text-success" /> Confirmed
                            </span>
                          )}
                          {rsvp.status === 'rejected' && (
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={() => handleApproveRSVP(rsvp.id)}
                              title="Re-approve RSVP"
                            >
                              <FaCheck /> Approve
                            </Button>
                          )}
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
                    <Form.Group className="mb-3">
                      <Form.Select
                        required
                        value={eventForm.hour}
                        onChange={(e) => setEventForm({ ...eventForm, hour: e.target.value })}
                      >
                        {[...Array(12)].map((_, i) => {
                          const hour = i + 1;
                          return <option key={hour} value={hour}>{hour}</option>;
                        })}
                      </Form.Select>
                      <Form.Text className="text-muted small">Hour</Form.Text>
                    </Form.Group>
                  </Col>
                  <Col xs={4}>
                    <Form.Group className="mb-3">
                      <Form.Select
                        required
                        value={eventForm.minute}
                        onChange={(e) => setEventForm({ ...eventForm, minute: e.target.value })}
                      >
                        {['00', '10', '20', '30', '40', '50'].map(min => (
                          <option key={min} value={min}>{min}</option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted small">Min</Form.Text>
                    </Form.Group>
                  </Col>
                  <Col xs={4}>
                    <Form.Group className="mb-3">
                      <Form.Select
                        required
                        value={eventForm.ampm}
                        onChange={(e) => setEventForm({ ...eventForm, ampm: e.target.value })}
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </Form.Select>
                      <Form.Text className="text-muted small">AM/PM</Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Location *</Form.Label>
              <LocationAutocomplete
                value={eventForm.location}
                onChange={(value) => setEventForm({ ...eventForm, location: value })}
                required={true}
              />
              <Form.Text className="text-muted">
                Start typing to search for addresses. Google Maps autocomplete available if API key is configured.
              </Form.Text>
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

            <Form.Group className="mb-3">
              <Form.Label>Capacity *</Form.Label>
              <Form.Control
                type="number"
                required
                min="1"
                value={eventForm.capacity}
                onChange={(e) => setEventForm({ ...eventForm, capacity: parseInt(e.target.value) })}
              />
            </Form.Group>

            <hr className="my-4" />

            <h5 className="mb-3">RSVP Settings</h5>

            <Form.Group className="mb-3">
              <Form.Check
                type="checkbox"
                id="requireRSVP"
                label="Require RSVP for this event"
                checked={eventForm.requireRSVP}
                onChange={(e) => setEventForm({ ...eventForm, requireRSVP: e.target.checked })}
              />
              <Form.Text className="text-muted">
                Uncheck if this is an open event without RSVP requirements
              </Form.Text>
            </Form.Group>

            {eventForm.requireRSVP && (
              <Form.Group className="mb-4">
                <Form.Label>RSVP Approval Mode *</Form.Label>
                <Form.Select
                  value={eventForm.rsvpApprovalMode}
                  onChange={(e) => setEventForm({ ...eventForm, rsvpApprovalMode: e.target.value })}
                >
                  <option value="immediate">Immediate - Auto-approve all RSVPs</option>
                  <option value="approval">Approval Required - Manually approve each RSVP</option>
                </Form.Select>
                <Form.Text className="text-muted">
                  {eventForm.rsvpApprovalMode === 'immediate'
                    ? 'RSVPs will be automatically confirmed. Users over capacity will be added to a waitlist.'
                    : 'All RSVPs will require your manual approval before confirmation.'}
                </Form.Text>
              </Form.Group>
            )}

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
