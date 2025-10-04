import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaStar, FaCalendarAlt, FaHeart, FaUsers } from 'react-icons/fa';

function Home() {
  return (
    <div>
      {/* Hero Section */}
      <section className="hero-section">
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
              size="lg"
              className="px-4 py-3"
            >
              <FaCalendarAlt className="me-2" />
              View Events
            </Button>
            <Button
              as={Link}
              to="/donate"
              className="donate-btn"
            >
              <FaHeart className="me-2" />
              Support Our Community
            </Button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-5 bg-light">
        <Container>
          <Row className="align-items-center">
            <Col md={6} className="mb-4 mb-md-0">
              <img
                src="/images/20241226_184527.webp"
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
    </div>
  );
}

export default Home;
