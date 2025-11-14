import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Table, Modal, Form, Alert, Nav, Row, Col } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { FaPlus, FaEdit, FaTrash, FaCalendarAlt, FaSignOutAlt, FaSort, FaSortUp, FaSortDown, FaUserPlus, FaUsers } from 'react-icons/fa';
import EventFormFields from '../components/EventFormFields';

function Admin() {
  const { currentUser, logout, isManager } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [rsvps, setRSVPs] = useState([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showManagerModal, setShowManagerModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [alert, setAlert] = useState({ show: false, message: '', type: '' });
  const [eventSortConfig, setEventSortConfig] = useState({ key: 'date', direction: 'asc' });
  const [managerForm, setManagerForm] = useState({
    email: '',
    password: '',
    displayName: ''
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
    rsvpSources: { website: true, oneTable: false },
    oneTableLink: '',
    rsvpApprovalMode: 'immediate',
    limitCapacity: false
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
      loadUsers();
      loadEvents();
      loadRSVPs();
    }
  }, [currentUser, isManager]);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/list-users');
      const result = await response.json();
      if (response.ok) {
        setUsers(result.users || []);
      } else {
        console.error('Error loading users:', result.error);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

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
      const timeString = `${eventForm.hour}:${eventForm.minute} ${eventForm.period}`;

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
      rsvpSources: { website: true, oneTable: false },
      oneTableLink: '',
      rsvpApprovalMode: 'immediate',
      limitCapacity: false,
      imageUrl: '',
      imagePosition: 50
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

  const handleManagerSubmit = async (e) => {
    e.preventDefault();
    try {
      setAlert({ show: true, message: 'Creating manager account...', type: 'info' });

      const response = await fetch('/api/create-manager', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: managerForm.email,
          password: managerForm.password,
          displayName: managerForm.displayName
        })
      });

      const result = await response.json();

      if (response.ok) {
        setAlert({ show: true, message: 'Manager account created successfully!', type: 'success' });
        setShowManagerModal(false);
        setManagerForm({ email: '', password: '', displayName: '' });
        loadUsers(); // Reload users list
      } else {
        setAlert({ show: true, message: `Error: ${result.error}`, type: 'danger' });
      }
    } catch (error) {
      console.error('Error creating manager:', error);
      setAlert({ show: true, message: `Error creating manager: ${error.message}`, type: 'danger' });
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    if (window.confirm(`Are you sure you want to delete user ${userEmail}?`)) {
      try {
        setAlert({ show: true, message: 'Deleting user...', type: 'info' });

        const response = await fetch('/api/delete-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId })
        });

        const result = await response.json();

        if (response.ok) {
          setAlert({ show: true, message: 'User deleted successfully!', type: 'success' });
          loadUsers(); // Reload users list
        } else {
          setAlert({ show: true, message: `Error: ${result.error}`, type: 'danger' });
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        setAlert({ show: true, message: `Error deleting user: ${error.message}`, type: 'danger' });
      }
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
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h1 className="fw-bold">Admin Dashboard</h1>
            <p className="text-muted mb-0">Welcome, {currentUser.email}</p>
          </div>
          <div>
            <Button variant="outline-danger" onClick={handleLogout}>
              <FaSignOutAlt className="me-2" />
              Logout
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

        <Row>
          <Col md={2}>
            <Nav variant="pills" className="flex-column" style={{ position: 'sticky', top: '20px' }}>
              <Nav.Item>
                <Nav.Link 
                  active={activeTab === 'users'} 
                  onClick={() => setActiveTab('users')}
                  className="mb-2"
                >
                  <FaUsers className="me-2" />
                  Users
                </Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link 
                  active={activeTab === 'events'} 
                  onClick={() => setActiveTab('events')}
                  className="mb-2"
                >
                  <FaCalendarAlt className="me-2" />
                  Events
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>

          <Col md={10}>
            {/* Users Tab */}
            {activeTab === 'users' && (
              <>
                <div className="mb-4">
                  <Button
                    variant="primary"
                    onClick={() => setShowManagerModal(true)}
                  >
                    <FaUserPlus className="me-2" />
                    Create Manager
                  </Button>
                </div>

                <Card className="border-0 shadow">
                  <Card.Body className="p-4">
                    <h3 className="mb-4">User Management</h3>
                    <Table responsive hover>
                      <thead className="bg-light">
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Role</th>
                          <th>Created</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map(user => (
                          <tr key={user.uid}>
                            <td><strong>{user.displayName || 'N/A'}</strong></td>
                            <td>{user.email}</td>
                            <td>
                              <span className={`badge ${user.customClaims?.admin ? 'bg-danger' : 'bg-primary'}`}>
                                {user.customClaims?.admin ? 'Admin' : 'Manager'}
                              </span>
                            </td>
                            <td>{new Date(user.metadata.creationTime).toLocaleDateString()}</td>
                            <td>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => handleDeleteUser(user.uid, user.email)}
                                disabled={user.email === currentUser.email}
                                title={user.email === currentUser.email ? "Cannot delete your own account" : "Delete user"}
                              >
                                <FaTrash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>

                    {users.length === 0 && (
                      <div className="text-center text-muted py-5">
                        <FaUsers size={50} className="mb-3" />
                        <p>No users found.</p>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </>
            )}

            {/* Events Tab */}
            {activeTab === 'events' && (
              <>
                <div className="mb-4 d-flex gap-2">
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
                  {/* Test email button removed to prevent sending non-production emails */}
                </div>

                <Card className="border-0 shadow">
                  <Card.Body className="p-4">
                    <h3 className="mb-4">Event Management</h3>
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
                                  className="me-2"
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
              </>
            )}
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
              handleToggleCapacityLimit={() => setEventForm((prevForm) => ({
                ...prevForm,
                limitCapacity: !prevForm.limitCapacity
              }))}
            />

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

      {/* Manager Creation Modal */}
      <Modal show={showManagerModal} onHide={() => setShowManagerModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Manager Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleManagerSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Display Name *</Form.Label>
              <Form.Control
                type="text"
                required
                value={managerForm.displayName}
                onChange={(e) => setManagerForm({ ...managerForm, displayName: e.target.value })}
                placeholder="Manager's full name"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                required
                value={managerForm.email}
                onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })}
                placeholder="manager@example.com"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password *</Form.Label>
              <Form.Control
                type="password"
                required
                minLength="6"
                value={managerForm.password}
                onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })}
                placeholder="Minimum 6 characters"
              />
            </Form.Group>

            <div className="d-flex gap-2">
              <Button variant="primary" type="submit">
                Create Manager
              </Button>
              <Button variant="secondary" onClick={() => setShowManagerModal(false)}>
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
