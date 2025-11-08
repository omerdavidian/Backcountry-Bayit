import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Table, Button, Alert } from 'react-bootstrap';
import { collection, getDocs, getDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { sendRSVPConfirmationEmail } from '../utils/emailService';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

function EventRSVPs() {
  const { eventId, eventName } = useParams();
  const navigate = useNavigate();
  const [rsvps, setRSVPs] = useState([]);
  const [event, setEvent] = useState(null);
  const [statusMessage, setStatusMessage] = useState({ show: false, message: '', type: '' });
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  useEffect(() => {
    const fetchEventAndRSVPs = async () => {
      try {
        // Fetch event details
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          setEvent({ id: eventDoc.id, ...eventDoc.data() });
        }

        // Fetch RSVPs for this event
        const rsvpsCollection = collection(db, 'rsvps');
        const q = query(rsvpsCollection, where('eventId', '==', eventId));
        const rsvpsSnapshot = await getDocs(q);
        const rsvpsList = rsvpsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        setRSVPs(rsvpsList);
      } catch (error) {
        console.error('Error fetching event and RSVPs:', error);
        setStatusMessage({ show: true, message: 'Error loading RSVPs. Please try again.', type: 'danger' });
      }
    };

    fetchEventAndRSVPs();
  }, [eventId]);

  const handleApproveRSVP = async (rsvp) => {
    try {
      await updateDoc(doc(db, 'rsvps', rsvp.id), { status: 'approved' });
      setRSVPs((prevRSVPs) => prevRSVPs.map(r => r.id === rsvp.id ? { ...r, status: 'approved' } : r));
      setStatusMessage({ show: true, message: 'RSVP approved successfully!', type: 'success' });

      // Send confirmation email
      try {
        await sendRSVPConfirmationEmail(rsvp, event, 'approved');
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
      }

      setTimeout(() => {
        setStatusMessage({ show: false, message: '', type: '' });
      }, 3000);
    } catch (error) {
      console.error('Error approving RSVP:', error);
      setStatusMessage({ show: true, message: 'Error approving RSVP. Please try again.', type: 'danger' });
    }
  };

  const handleRejectRSVP = async (rsvp) => {
    if (window.confirm('Are you sure you want to reject this RSVP?')) {
      try {
        await updateDoc(doc(db, 'rsvps', rsvp.id), { status: 'rejected' });
        setRSVPs((prevRSVPs) => prevRSVPs.map(r => r.id === rsvp.id ? { ...r, status: 'rejected' } : r));
        setStatusMessage({ show: true, message: 'RSVP rejected successfully!', type: 'success' });

        setTimeout(() => {
          setStatusMessage({ show: false, message: '', type: '' });
        }, 3000);
      } catch (error) {
        console.error('Error rejecting RSVP:', error);
        setStatusMessage({ show: true, message: 'Error rejecting RSVP. Please try again.', type: 'danger' });
      }
    }
  };

  const handleDeleteRSVP = async (rsvp) => {
    if (window.confirm('Are you sure you want to permanently delete this RSVP? This action cannot be undone.')) {
      try {
        await deleteDoc(doc(db, 'rsvps', rsvp.id));
        setRSVPs((prevRSVPs) => prevRSVPs.filter(r => r.id !== rsvp.id));
        setStatusMessage({ show: true, message: 'RSVP deleted successfully!', type: 'success' });

        setTimeout(() => {
          setStatusMessage({ show: false, message: '', type: '' });
        }, 3000);
      } catch (error) {
        console.error('Error deleting RSVP:', error);
        setStatusMessage({ show: true, message: 'Error deleting RSVP. Please try again.', type: 'danger' });
      }
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <FaSort className="ms-1" />;
    }
    return sortConfig.direction === 'asc' ? <FaSortUp className="ms-1" /> : <FaSortDown className="ms-1" />;
  };

  const sortedRSVPs = [...rsvps].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    // Handle name sorting
    if (sortConfig.key === 'name') {
      aVal = a.name || `${a.firstName} ${a.lastName}`;
      bVal = b.name || `${b.firstName} ${b.lastName}`;
    }

    // Handle null/undefined values
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';

    // Convert to strings for comparison
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();

    if (aVal < bVal) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (aVal > bVal) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return (
    <Container className="mt-5 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="fw-bold">RSVPs for {event?.title || 'Loading...'}</h1>
        <Button variant="outline-secondary" onClick={() => navigate('/admin')}>
          Back to Admin
        </Button>
      </div>

      {statusMessage.show && (
        <Alert
          variant={statusMessage.type}
          onClose={() => setStatusMessage({ show: false, message: '', type: '' })}
          dismissible
        >
          {statusMessage.message}
        </Alert>
      )}

      {rsvps.length === 0 ? (
        <div className="text-center text-muted py-5">
          <p>No RSVPs yet for this event.</p>
        </div>
      ) : (
        <Table responsive hover className="mb-0">
          <thead className="bg-light">
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                Name {getSortIcon('name')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('email')}>
                Email {getSortIcon('email')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('phone')}>
                Phone {getSortIcon('phone')}
              </th>
              <th>Guests</th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('status')}>
                Status {getSortIcon('status')}
              </th>
              <th style={{ cursor: 'pointer' }} onClick={() => handleSort('dietaryRestrictions')}>
                Dietary Restrictions {getSortIcon('dietaryRestrictions')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedRSVPs.map((rsvp) => (
              <tr key={rsvp.id}>
                <td>
                  <strong>{rsvp.name || `${rsvp.firstName} ${rsvp.lastName}`}</strong>
                  {rsvp.attendees && rsvp.attendees.length > 0 && (
                    <div className="mt-2">
                      {rsvp.attendees.map((attendee, index) => (
                        <div key={index} className="text-muted small">
                          <span className="badge bg-secondary me-1">+{index + 1}</span>
                          {attendee.firstName} {attendee.lastName}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  {rsvp.email}
                  {rsvp.attendees && rsvp.attendees.length > 0 && (
                    <div className="mt-2">
                      {rsvp.attendees.map((attendee, index) => (
                        <div key={index} className="text-muted small">
                          {attendee.email || 'N/A'}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  {rsvp.phone || 'N/A'}
                  {rsvp.attendees && rsvp.attendees.length > 0 && (
                    <div className="mt-2">
                      {rsvp.attendees.map((attendee, index) => (
                        <div key={index} className="text-muted small">
                          {attendee.phone || 'N/A'}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  <span className="badge bg-info">
                    {1 + (rsvp.attendees?.length || 0)}
                  </span>
                </td>
                <td>
                  <span className={`badge bg-${
                    rsvp.status === 'approved' ? 'success' : 
                    rsvp.status === 'pending' ? 'warning' : 
                    rsvp.status === 'rejected' ? 'danger' : 
                    'secondary'
                  }`}>
                    {rsvp.status}
                  </span>
                </td>
                <td>{rsvp.dietaryRestrictions || 'None'}</td>
                <td>
                  {rsvp.status !== 'approved' && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => handleApproveRSVP(rsvp)}
                      className="me-2"
                    >
                      Approve
                    </Button>
                  )}
                  {rsvp.status !== 'rejected' && (
                    <Button
                      variant="warning"
                      size="sm"
                      onClick={() => handleRejectRSVP(rsvp)}
                      className="me-2"
                    >
                      Reject
                    </Button>
                  )}
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDeleteRSVP(rsvp)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Container>
  );
}

export default EventRSVPs;
