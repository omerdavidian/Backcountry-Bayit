import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Modal, Form, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaSignOutAlt, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import LocationAutocomplete from '../components/LocationAutocomplete';

function Admin() {
  const { currentUser, logout, isManager } = useAuth();
  const navigate = useNavigate();
  // location is unused in this component
  const [events, setEvents] = useState([]);
  const [rsvps, setRSVPs] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [eventSortConfig, setEventSortConfig] = useState({ key: 'date', direction: 'asc' });
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
    rsvpApprovalMode: 'immediate', // 'immediate' or 'approval'
    limitCapacity: false // New state for capacity limit toggle
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
    if (window.confirm('Are you sure you want to delete this event? This will also delete all associated RSVPs.')) {
      try {
        // Delete the event
        await deleteDoc(doc(db, 'events', eventId));
        
        // Delete all RSVPs for this event
        const eventRSVPs = rsvps.filter(rsvp => rsvp.eventId === eventId);
        const deletePromises = eventRSVPs.map(rsvp => 
          deleteDoc(doc(db, 'rsvps', rsvp.id))
        );
        await Promise.all(deletePromises);
        
        setAlert({ show: true, message: 'Event and associated RSVPs deleted successfully!', type: 'success' });
        loadEvents();
        loadRSVPs();
        
        setTimeout(() => {
          setAlert({ show: false, message: '', type: '' });
        }, 3000);
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
      rsvpApprovalMode: event.rsvpApprovalMode || 'immediate',
      limitCapacity: event.limitCapacity !== undefined ? event.limitCapacity : false // Ensure limitCapacity is set
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
      rsvpApprovalMode: 'immediate',
      limitCapacity: false // Reset limitCapacity to false
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

  const handleTestEmail = async () => {
    try {
      setAlert({ show: true, message: 'Sending test email...', type: 'info' });

      const response = await fetch('/api/send-rsvp-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rsvpData: {
            firstName: 'Test',
            lastName: 'User',
            email: 'omer.davidian@bcbayit.org',
            dietaryRestrictions: 'None'
          },
          eventData: {
            title: 'Test Event',
            date: 'December 31, 2023',
            time: '6:30 PM',
            location: 'BCB Community Center, Frisco'
          },
          status: 'approved',
          dryRun: true // don't send real email during local/live quick tests
        })
      });

      const rawBody = await response.text();
      let result;
      try {
        result = rawBody ? JSON.parse(rawBody) : {};
      } catch (parseError) {
        result = { error: rawBody || parseError.message };
      }
      console.log('API Response:', result);

      if (response.ok) {
        setAlert({ show: true, message: 'Test email sent successfully! Check your inbox.', type: 'success' });
      } else {
        setAlert({ show: true, message: `Failed to send test email: ${result.error || 'Unknown error'}`, type: 'danger' });
      }
    } catch (error) {
      console.error('Error sending test email:', error);
      setAlert({ show: true, message: `Error sending test email: ${error.message}`, type: 'danger' });
    }
  };

  const getRSVPsForEvent = (eventId) => {
    return rsvps.filter(rsvp => rsvp.eventId === eventId);
  };

  const getTotalGuestsForEvent = (eventId) => {
    const eventRSVPs = getRSVPsForEvent(eventId);
    return eventRSVPs.reduce((total, rsvp) => total + (rsvp.guests || 1), 0);
  };

  const isEventPast = (eventDate) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse date as local time to avoid timezone shifts
    let eventD;
    if (typeof eventDate === 'string' && eventDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = eventDate.split('-').map(Number);
      eventD = new Date(year, month - 1, day);
    } else {
      eventD = new Date(eventDate);
    }
    eventD.setHours(0, 0, 0, 0);
    return eventD < today;
  };

  const formatEventDate = (dateString) => {
    // Parse date as local time to avoid timezone shifts
    if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const handleEventSort = (key) => {
    let direction = 'asc';
    if (eventSortConfig.key === key && eventSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setEventSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey, sortConfig) => {
    if (sortConfig.key !== columnKey) {
      return <FaSort className="ms-1" style={{ opacity: 0.3 }} />;
    }
    return sortConfig.direction === 'asc' ? 
      <FaSortUp className="ms-1" /> : 
      <FaSortDown className="ms-1" />;
  };

  const sortedEvents = [...events].sort((a, b) => {
    const { key, direction } = eventSortConfig;
    let aVal = a[key];
    let bVal = b[key];

    if (key === 'date') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    } else if (key === 'capacity') {
      aVal = parseInt(aVal) || 0;
      bVal = parseInt(bVal) || 0;
    } else if (key === 'rsvpCount') {
      aVal = getRSVPsForEvent(a.id).length;
      bVal = getRSVPsForEvent(b.id).length;
    } else {
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
    }

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  if (!currentUser || !isManager) {
    return null;
  }

  // Add RSVP button with dynamic color based on pending RSVPs
  const getRSVPButtonVariant = (eventId) => {
    const pendingRSVPs = rsvps.filter(rsvp => rsvp.eventId === eventId && rsvp.status === 'pending');
    return pendingRSVPs.length > 0 ? 'warning' : 'success';
  };

  return (
    <div className="bg-light min-vh-100 py-5">
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold">Event Management</h1>
            <p className="text-muted mb-0">Welcome, {currentUser.email}</p>
          </div>
          <div>
            <Button variant="outline-danger" onClick={handleLogout}>
              <FaSignOutAlt className="me-2" />
              Logout
            </Button>
            <Button variant="secondary" className="ms-2" onClick={handleTestEmail}>
              Send Test Email
            </Button>
          </div>
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

        <div className="mb-4">
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

        <Card className="border-0 shadow">
          <Card.Body className="p-4">
            <Table responsive hover>
              <thead className="bg-light">
                <tr>
                  <th onClick={() => handleEventSort('title')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Title {getSortIcon('title', eventSortConfig)}
                  </th>
                  <th onClick={() => handleEventSort('date')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Date {getSortIcon('date', eventSortConfig)}
                  </th>
                  <th onClick={() => handleEventSort('time')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Time {getSortIcon('time', eventSortConfig)}
                  </th>
                  <th onClick={() => handleEventSort('location')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Location {getSortIcon('location', eventSortConfig)}
                  </th>
                  <th onClick={() => handleEventSort('rsvpCount')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    RSVPs {getSortIcon('rsvpCount', eventSortConfig)}
                  </th>
                  <th onClick={() => handleEventSort('capacity')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Capacity {getSortIcon('capacity', eventSortConfig)}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map(event => {
                  const isPast = isEventPast(event.date);
                  return (
                    <tr key={event.id} style={{ opacity: isPast ? 0.5 : 1 }}>
                      <td><strong>{event.title}</strong></td>
                      <td>{formatEventDate(event.date)}</td>
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
                        <Button
                          variant={getRSVPButtonVariant(event.id)}
                          size="sm"
                          onClick={() => {
                            const eventNameSlug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                            navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`);
                          }}
                          title="Manage RSVPs"
                        >
                          RSVPs
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
              <Form.Check
                type="checkbox"
                id="limitCapacity"
                label="Limit Capacity"
                checked={eventForm.limitCapacity}
                onChange={() => setEventForm((prevForm) => ({
                  ...prevForm,
                  limitCapacity: !prevForm.limitCapacity
                }))}
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
              <Form.Label>RSVP Settings</Form.Label>
              <Form.Text className="text-muted">
                Configure how RSVPs are handled for this event.
              </Form.Text>
            </Form.Group>

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
