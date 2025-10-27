import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Button, Modal, Form, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaStar, FaCalendarAlt, FaHeart, FaUsers, FaMapMarkerAlt, FaClock } from 'react-icons/fa';
import { collection, getDocs, query, orderBy, where, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [rsvpData, setRsvpData] = useState({
    name: '',
    email: '',
    phone: '',
    guests: 1,
    dietaryRestrictions: ''
  });
  const [rsvpStatus, setRsvpStatus] = useState({ type: '', message: '' });
  const carouselRef = useRef(null);

  useEffect(() => {
    loadUpcomingEvents();
  }, []);

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
        status: 'approved',
        timestamp: new Date()
      });

      setRsvpStatus({
        show: true,
        message: 'Thank you for your RSVP! We look forward to seeing you.',
        type: 'success'
      });

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
        message: 'There was an error submitting your RSVP. Please try again.',
        type: 'danger'
      });
    }
  };


  // Mouse/Touch drag handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    carouselRef.current.scrollLeft = scrollLeft - walk;
  };

  // Arrow button handlers
  const scrollToLeft = () => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth / 3;
      carouselRef.current.scrollBy({ left: -cardWidth, behavior: 'smooth' });
    }
  };

  const scrollToRight = () => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth / 3;
      carouselRef.current.scrollBy({ left: cardWidth, behavior: 'smooth' });
    }
  };

  const loadUpcomingEvents = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const eventsCollection = collection(db, 'events');
      const q = query(
        eventsCollection,
        where('date', '>=', today),
        orderBy('date', 'asc')
      );
      const querySnapshot = await getDocs(q);
      const events = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUpcomingEvents(events);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatEventDateTime = (event) => {
    // Parse date as local date to avoid UTC timezone shift
    let date;
    if (typeof event.date === 'string') {
      const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.test(event.date);
      if (dateOnlyMatch) {
        const [y, m, day] = event.date.split('-').map(Number);
        date = new Date(y, m - 1, day);
      } else {
        date = new Date(event.date);
      }
    } else if (event.date?.toDate) {
      date = event.date.toDate();
    } else if (event.date instanceof Date) {
      date = event.date;
    } else {
      date = new Date(event.date);
    }
    
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = `${event.hour}:${event.minute} ${event.period}`;
    return { dateStr, timeStr };
  };

  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const toMountainTime = (date) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Denver',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === 'year').value;
    const month = parts.find((p) => p.type === 'month').value - 1;
    const day = parts.find((p) => p.type === 'day').value;
    return new Date(year, month, day);
  };

  // helper to normalize various date formats and check if an event date is today (local timezone)
  const isEventToday = (eventDate) => {
    if (!eventDate) return false;

    const toDate = (d) => {
      if (!d) return null;
      if (d instanceof Date) return d;
      if (typeof d === 'string') {
        const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(d);
        if (dateOnlyMatch) {
          const [y, m, day] = d.split('-').map(Number);
          return new Date(y, m - 1, day);
        }
        return new Date(d);
      }
      if (typeof d.toDate === 'function') return d.toDate();
      if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
      return new Date(d);
    };

    const today = toMountainTime(new Date());
    const d = toMountainTime(toDate(eventDate));
    if (!d || Number.isNaN(d.getTime())) return false;

    return d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
  };

  const isEventTomorrow = (eventDate) => {
    if (!eventDate) return false;

    const toDate = (d) => {
      if (!d) return null;
      if (d instanceof Date) return d;
      if (typeof d === 'string') {
        const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(d);
        if (dateOnlyMatch) {
          const [y, m, day] = d.split('-').map(Number);
          return new Date(y, m - 1, day);
        }
        return new Date(d);
      }
      if (typeof d.toDate === 'function') return d.toDate();
      if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
      return new Date(d);
    };

    const today = toMountainTime(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const d = toMountainTime(toDate(eventDate));
    if (!d || Number.isNaN(d.getTime())) return false;

    return d.getFullYear() === tomorrow.getFullYear() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getDate() === tomorrow.getDate();
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section" style={{
        backgroundImage: 'url(/images/IMG-20240905-WA0003.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '500px',
        position: 'relative'
      }}>
        <div className="hero-content">
          <h1 className="display-3 fw-bold mb-4">
            Welcome to Backcountry Bayit
          </h1>
          <p className="lead mb-4" style={{ fontSize: '1.5rem' }}>
            A vibrant Jewish community in the heart of Frisco, Colorado
          </p>
          <div className="star-decoration">✡</div>
          <p className="mt-4 mb-4" style={{ fontSize: '1.2rem' }}>
            Join us for Shabbat dinners and holiday celebrations<br />
            November through April
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            <Button
              as={Link}
              to="/events"
              variant="light"
              size="md" /* Reduced size */
              className="px-3 py-2" /* Reduced padding */
            >
              <FaCalendarAlt className="me-2" />
              View Events
            </Button>
            <Button
              as={Link}
              to="/donate"
              className="donate-btn px-3 py-2" /* Reduced padding */
            >
              <FaHeart className="me-2" />
              Support Our Community
            </Button>
          </div>
        </div>
      </section>

      {/* Upcoming Events Carousel */}
      {!loading && upcomingEvents.length > 0 && (
        <section className="py-5">
          <Container>
            <h2 className="section-title text-center mb-5">
              Upcoming Events
            </h2>
            <div className="position-relative">
              {upcomingEvents.length > 3 && (
                <>
                  <button
                    className="carousel-arrow carousel-arrow-left"
                    onClick={scrollToLeft}
                    aria-label="Scroll left"
                  >
                    ‹
                  </button>
                  <button
                    className="carousel-arrow carousel-arrow-right"
                    onClick={scrollToRight}
                    aria-label="Scroll right"
                  >
                    ›
                  </button>
                </>
              )}
              <div
                className="events-scroll-container"
                ref={carouselRef}
                onMouseDown={handleMouseDown}
                onMouseLeave={handleMouseLeave}
                onMouseUp={handleMouseUp}
                onMouseMove={handleMouseMove}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <div className="events-scroll-track">
                {upcomingEvents.map((event) => {
                  const { dateStr, timeStr } = formatEventDateTime(event);
                  return (
                    <div key={event.id} className="event-card-wrapper">
                      <Card className="h-100 card-hover border-0 shadow">
                        <Card.Body className="d-flex flex-column">
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
                          <div className="text-center mb-3" style={{ fontSize: '2.5rem', color: 'var(--bcb-blue)' }}>
                            <FaCalendarAlt />
                          </div>
                          <Card.Title as="h4" className="text-center mb-3">
                            {event.title}
                          </Card.Title>
                          <Card.Text className="mb-2">
                            <FaClock className="me-2" style={{ color: 'var(--bcb-blue)' }} />
                            <strong>{dateStr}</strong>
                          </Card.Text>
                          <Card.Text className="mb-2">
                            <FaClock className="me-2" style={{ color: 'var(--bcb-blue)' }} />
                            {timeStr}
                          </Card.Text>
                          {event.location && (
                            <Card.Text className="mb-3">
                              <FaMapMarkerAlt className="me-2" style={{ color: 'var(--bcb-blue)' }} />
                              {event.location}
                            </Card.Text>
                          )}
                          <div className="mt-auto text-center">
                            <Button
                              variant="primary"
                              className="w-100"
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowRSVPModal(true);
                              }}
                            >
                              View Details & RSVP
                            </Button>
                          </div>
                        </Card.Body>
                      </Card>
                    </div>
                  );
                })}
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
              <Button
                as={Link}
                to="/events"
                variant="outline-primary"
                size="lg"
              >
                View All Events
              </Button>
            </div>
          </Container>
        </section>
      )}

      {/* About Section */}
      <section className="py-5 bg-light">
        <Container>
          <Row className="align-items-center">
            <Col md={6} className="mb-4 mb-md-0">
              <img
                src="/images/IMG-20240905-WA0003.webp"
                alt="BCB Community"
                className="img-fluid rounded shadow-lg"
              />
            </Col>
            <Col md={6}>
              <h2 className="section-title text-start">About Backcountry Bayit</h2>
              <p className="lead">
                Since 2016, Backcountry Bayit has been bringing the warmth of Jewish
                tradition to the Colorado mountains.
              </p>
              <p>
                We create meaningful connections through shared meals, holiday
                celebrations, and community gatherings. Whether you're a local
                resident or visiting for the ski season, you'll find a welcoming
                home away from home.
              </p>
              <Button
                as={Link}
                to="/about"
                variant="primary"
                size="lg"
                className="mt-3"
              >
                Learn More About Us
              </Button>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Features Section */}
      <section className="py-5">
        <Container>
          <h2 className="section-title text-center mb-5">
            What We Offer
          </h2>
          <Row className="g-4">
            <Col md={4}>
              <Card className="h-100 text-center card-hover border-0 shadow">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{ fontSize: '3rem', color: 'var(--bcb-blue)' }}>
                    <FaStar />
                  </div>
                  <Card.Title as="h4">Shabbat Dinners</Card.Title>
                  <Card.Text>
                    Join us for traditional Friday night Shabbat dinners with
                    delicious food, wine, and wonderful company in a warm,
                    welcoming atmosphere.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 text-center card-hover border-0 shadow">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{ fontSize: '3rem', color: 'var(--bcb-blue)' }}>
                    <FaCalendarAlt />
                  </div>
                  <Card.Title as="h4">Holiday Celebrations</Card.Title>
                  <Card.Text>
                    Experience meaningful holiday observances including Chanukah,
                    Purim, Passover, and more, bringing ancient traditions to life
                    in the mountains.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 text-center card-hover border-0 shadow">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{ fontSize: '3rem', color: 'var(--bcb-blue)' }}>
                    <FaUsers />
                  </div>
                  <Card.Title as="h4">Community Building</Card.Title>
                  <Card.Text>
                    Connect with fellow Jewish community members, both locals and
                    visitors, creating lasting friendships and memories in the
                    beautiful Colorado backcountry.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Photo Gallery Preview */}
      <section className="py-5 bg-light">
        <Container>
          <h2 className="section-title text-center mb-5">
            Community Moments
          </h2>
          <Row className="g-3">
            <Col md={4}>
              <img
                src="/images/20241227_183542.webp"
                alt="BCB Event"
                className="img-fluid rounded shadow"
              />
            </Col>
            <Col md={4}>
              <img
                src="/images/20241227_183548.webp"
                alt="BCB Event"
                className="img-fluid rounded shadow"
              />
            </Col>
            <Col md={4}>
              <img
                src="/images/20241226_213824.webp"
                alt="BCB Event"
                className="img-fluid rounded shadow"
              />
            </Col>
          </Row>
        </Container>
      </section>

      {/* Call to Action */}
      <section className="py-5 bg-gradient-primary text-white">
        <Container className="text-center">
          <h2 className="display-5 fw-bold mb-4">
            Help Us Grow Our Community
          </h2>
          <p className="lead mb-4">
            Your donation helps us continue hosting meaningful gatherings and
            building Jewish life in the Colorado mountains.
          </p>
          <Button
            as={Link}
            to="/donate"
            variant="light"
            size="lg"
            className="px-5 py-3"
          >
            <FaHeart className="me-2" />
            Donate Now
          </Button>
        </Container>
      </section>

      {/* RSVP Modal */}
      <Modal show={showRSVPModal} onHide={() => setShowRSVPModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>RSVP for {selectedEvent?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEvent && (
            <>
              <div className="mb-4">
                <h5>Event Details</h5>
                <p><strong>Date:</strong> {selectedEvent.date}</p>
                <p><strong>Time:</strong> {selectedEvent.time}</p>
                <p><strong>Location:</strong> {selectedEvent.location}</p>
                {selectedEvent.description && (
                  <p><strong>Description:</strong> {selectedEvent.description}</p>
                )}
              </div>

              {rsvpStatus.type && (
                <Alert variant={rsvpStatus.type}>
                  {rsvpStatus.message}
                </Alert>
              )}

              <Form onSubmit={handleRSVPSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Name *</Form.Label>
                  <Form.Control
                    type="text"
                    required
                    value={rsvpData.name}
                    onChange={(e) => setRsvpData({ ...rsvpData, name: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    required
                    value={rsvpData.email}
                    onChange={(e) => setRsvpData({ ...rsvpData, email: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    type="tel"
                    value={rsvpData.phone}
                    onChange={(e) => setRsvpData({ ...rsvpData, phone: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Number of Guests *</Form.Label>
                  <Form.Control
                    type="number"
                    min="1"
                    required
                    value={rsvpData.guests}
                    onChange={(e) => setRsvpData({ ...rsvpData, guests: e.target.value })}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>Dietary Restrictions</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={rsvpData.dietaryRestrictions}
                    onChange={(e) => setRsvpData({ ...rsvpData, dietaryRestrictions: e.target.value })}
                  />
                </Form.Group>

                <div className="d-flex justify-content-end gap-2">
                  <Button variant="secondary" onClick={() => setShowRSVPModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Submit RSVP
                  </Button>
                </div>
              </Form>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Home;
