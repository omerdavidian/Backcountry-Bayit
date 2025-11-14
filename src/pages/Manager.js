import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Modal, Form, Alert, Badge, Nav, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaSignOutAlt } from 'react-icons/fa';
import EventFormFields from '../components/EventFormFields';

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
    rsvpSources: { website: true, oneTable: false },
    oneTableLink: '',
    rsvpApprovalMode: 'immediate',
    limitCapacity: false
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

    // Map legacy requireRSVP to rsvpSources for backward compatibility
    let rsvpSources = { website: true, oneTable: false };
    if (event.rsvpSources) {
      rsvpSources = event.rsvpSources;
    } else if (event.requireRSVP !== undefined) {
      rsvpSources = { website: event.requireRSVP, oneTable: false };
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
      oneTableLink: event.oneTableLink || '',
      rsvpApprovalMode: event.rsvpApprovalMode || 'immediate',
      limitCapacity: event.limitCapacity !== undefined ? event.limitCapacity : false,
      imageUrl: event.imageUrl || '',
      imagePosition: event.imagePosition || 50
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
      rsvpSources: { website: true, oneTable: false },
      oneTableLink: '',
      rsvpApprovalMode: 'immediate',
      limitCapacity: false,
      imageUrl: '',
      imagePosition: 50
    });
  };

  const handleToggleCapacityLimit = (enabled) => {
    setEventForm(prev => ({
      ...prev,
      limitCapacity: enabled
    }));
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
    <div className="bg-light min-vh-100 py-5">
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold">Manager Dashboard</h1>
            <p className="text-muted mb-0">Welcome, {currentUser.email} | Role: <Badge bg="primary">{userRole}</Badge></p>
          </div>
          <div>
            <Button variant="outline-danger" onClick={handleLogout}>
              <FaSignOutAlt className="me-2" /> Logout
            </Button>
          </div>
        </div>

        {alert.show && (
          <Alert variant={alert.type} onClose={() => setAlert({ show: false, message: '', type: '' })} dismissible className="mb-4">
            {alert.message}
          </Alert>
        )}

        <Row>
          <Col md={2}>
            <Nav variant="pills" className="flex-column" style={{ position: 'sticky', top: '20px' }}>
              <Nav.Item>
                <Nav.Link active>
                  <FaCalendarAlt className="me-2" /> Events
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>

          <Col md={10}>
            <div className="mb-4 d-flex gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setEditingEvent(null);
                  resetEventForm();
                  setShowEventModal(true);
                }}
              >
                <FaPlus className="me-2" /> Add Event
              </Button>
            </div>

            <Card className="border-0 shadow">
              <Card.Body className="p-4">
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
                        <td>{rsvps.filter(r => r.eventId === event.id).length} RSVPs</td>
                        <td>{event.capacity}</td>
                        <td>
                          <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEditEvent(event)}>
                            <FaEdit />
                          </Button>
                          <Button variant="outline-danger" size="sm" onClick={() => handleDeleteEvent(event.id)}>
                            <FaTrash />
                          </Button>
                          <Button variant="success" size="sm" className="ms-2" onClick={() => {
                            const eventNameSlug = event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
                            navigate(`/admin/rsvps/${event.id}/${eventNameSlug}`);
                          }}>RSVPs</Button>
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
          </Col>
        </Row>
      </Container>

      {/* Event Modal */}
      <Modal show={showEventModal} onHide={() => setShowEventModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editingEvent ? 'Edit Event' : 'Create New Event'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleEventSubmit}>
            <EventFormFields
              eventForm={eventForm}
              setEventForm={setEventForm}
              showCapacityToggle={true}
              handleToggleCapacityLimit={handleToggleCapacityLimit}
            />

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
