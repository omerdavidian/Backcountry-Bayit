import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { FaMountain, FaStar, FaHandsHelping, FaHome } from 'react-icons/fa';

function About() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-5">
        <Container>
          <Row className="align-items-center py-5">
            <Col lg={6}>
              <h1 className="display-4 fw-bold mb-4">Our Story</h1>
              <p className="lead">
                Backcountry Bayit was founded in 2016 with a simple mission:
                to create a warm, welcoming Jewish community in the heart of
                Colorado's ski country.
              </p>
            </Col>
            <Col lg={6}>
              <img
                src="/images/logo.webp"
                alt="BCB Logo"
                className="img-fluid"
                style={{ maxWidth: '400px' }}
              />
            </Col>
          </Row>
        </Container>
      </section>

      {/* Mission Section */}
      <section className="py-5">
        <Container>
          <Row className="justify-content-center">
            <Col lg={10}>
              <h2 className="section-title text-center mb-5">Our Mission</h2>
              <p className="lead text-center mb-5">
                We bring together Jewish families and individuals—both locals and
                visitors—to celebrate Shabbat, holidays, and life's special moments
                in the spectacular Colorado Rockies.
              </p>
              <Row className="g-4">
                <Col md={6}>
                  <Card className="h-100 border-0 shadow-sm">
                    <Card.Body className="p-4">
                      <div className="mb-3" style={{ fontSize: '2.5rem', color: 'var(--bcb-blue)' }}>
                        <FaMountain />
                      </div>
                      <h4>Mountain Jewish Life</h4>
                      <p>
                        We embrace the unique opportunity to blend Jewish tradition
                        with the outdoor mountain lifestyle that defines Colorado's
                        backcountry.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="h-100 border-0 shadow-sm">
                    <Card.Body className="p-4">
                      <div className="mb-3" style={{ fontSize: '2.5rem', color: 'var(--bcb-blue)' }}>
                        <FaStar />
                      </div>
                      <h4>Inclusive Community</h4>
                      <p>
                        From beginners to deeply observant, young families to
                        retirees, everyone is welcome at our table. We celebrate
                        diversity within our Jewish heritage.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="h-100 border-0 shadow-sm">
                    <Card.Body className="p-4">
                      <div className="mb-3" style={{ fontSize: '2.5rem', color: 'var(--bcb-blue)' }}>
                        <FaHandsHelping />
                      </div>
                      <h4>Community Support</h4>
                      <p>
                        As a 501(c)(3) non-profit, we rely on the generosity of
                        our community to continue hosting meaningful gatherings
                        and growing our programs.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
                <Col md={6}>
                  <Card className="h-100 border-0 shadow-sm">
                    <Card.Body className="p-4">
                      <div className="mb-3" style={{ fontSize: '2.5rem', color: 'var(--bcb-blue)' }}>
                        <FaHome />
                      </div>
                      <h4>Home Away From Home</h4>
                      <p>
                        Whether you're a Summit County local or visiting for the
                        season, BCB provides a warm, familiar place to connect
                        with your heritage.
                      </p>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>
            </Col>
          </Row>
        </Container>
      </section>

      {/* What We Do Section */}
      <section className="py-5 bg-light">
        <Container>
          <h2 className="section-title text-center mb-5">What We Do</h2>
          <Row className="justify-content-center">
            <Col lg={10}>
              <Card className="border-0 shadow mb-4">
                <Card.Body className="p-4">
                  <h4 className="text-primary mb-3">Weekly Shabbat Dinners</h4>
                  <p>
                    Every Friday night during the winter season (November-April),
                    we gather for traditional Shabbat dinners featuring home-cooked
                    meals, wine, blessings, and spirited conversation. It's a chance
                    to pause, reflect, and connect after a week on the slopes.
                  </p>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow mb-4">
                <Card.Body className="p-4">
                  <h4 className="text-primary mb-3">Holiday Celebrations</h4>
                  <p>
                    From lighting the menorah at Chanukah to reading the Megillah
                    at Purim, from Passover Seders to Rosh Hashanah services, we
                    observe the full cycle of Jewish holidays with joy, meaning,
                    and mountain hospitality.
                  </p>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow mb-4">
                <Card.Body className="p-4">
                  <h4 className="text-primary mb-3">Community Building</h4>
                  <p>
                    Beyond formal gatherings, we foster connections through shared
                    experiences, welcoming newcomers, and creating a network of
                    support for Jewish life in Summit County and beyond.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* The Meaning Behind Our Name */}
      <section className="py-5">
        <Container>
          <Row className="justify-content-center">
            <Col lg={8} className="text-center">
              <h2 className="section-title mb-4">Why "Backcountry Bayit"?</h2>
              <div className="star-decoration mb-4">✡</div>
              <p className="lead">
                "Bayit" (בית) is the Hebrew word for "home." Combined with
                "Backcountry"—the wild, beautiful terrain that defines our Colorado
                mountains—our name reflects who we are: a Jewish home in the heart
                of the backcountry.
              </p>
              <p className="mt-4">
                The Star of David in our logo, integrated with the Colorado flag
                and mountain peaks, symbolizes the fusion of our Jewish identity
                with our Rocky Mountain home.
              </p>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Community Photos */}
      <section className="py-5 bg-light">
        <Container>
          <h2 className="section-title text-center mb-5">Our Community in Action</h2>
          <Row className="g-3">
            <Col md={3} sm={6}>
              <img
                src="/images/IMG-20240905-WA0003.webp"
                alt="BCB Event"
                className="img-fluid rounded shadow"
              />
            </Col>
            <Col md={3} sm={6}>
              <img
                src="/images/IMG-20240905-WA0010.webp"
                alt="BCB Event"
                className="img-fluid rounded shadow"
              />
            </Col>
            <Col md={3} sm={6}>
              <img
                src="/images/IMG-20240905-WA0015.webp"
                alt="BCB Event"
                className="img-fluid rounded shadow"
              />
            </Col>
            <Col md={3} sm={6}>
              <img
                src="/images/IMG-20240905-WA0018.webp"
                alt="BCB Event"
                className="img-fluid rounded shadow"
              />
            </Col>
          </Row>
        </Container>
      </section>

      {/* Location */}
      <section className="py-5">
        <Container>
          <Row className="justify-content-center text-center">
            <Col lg={8}>
              <h2 className="section-title mb-4">Find Us</h2>
              <p className="lead">
                <FaMountain className="me-2 text-primary" />
                Frisco, Colorado
              </p>
              <p>
                Located in Summit County, we're easily accessible from Breckenridge,
                Keystone, Copper Mountain, and Vail. Our events take place throughout
                the winter season, bringing Jewish warmth to the snowy peaks.
              </p>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
}

export default About;
