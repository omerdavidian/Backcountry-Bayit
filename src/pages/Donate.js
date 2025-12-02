import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { FaHeart, FaHandHoldingHeart, FaUsers, FaUtensils, FaStar } from 'react-icons/fa';
import { Link } from 'react-router-dom';

function Donate() {
  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-5">
        <Container>
          <div className="text-center py-4">
            <FaHeart size={60} className="mb-3" />
            <h1 className="display-4 fw-bold">Support Our Community</h1>
            <p className="lead">
              Your generosity helps us continue building Jewish life in the Colorado mountains
            </p>
            <div className="star-decoration">✡</div>
          </div>
        </Container>
      </section>

      {/* Why Donate Section */}
      <section className="py-5">
        <Container>
          <h2 className="section-title text-center mb-5">Why Your Support Matters</h2>
          <Row className="justify-content-center">
            <Col lg={10}>
              <p className="lead text-center mb-5">
                As a 501(c)(3) non-profit organization, Backcountry Bayit relies on the
                generosity of our community to continue hosting meaningful gatherings,
                celebrating holidays, and building connections.
              </p>
            </Col>
          </Row>
          <Row className="g-4">
            <Col md={4}>
              <Card className="h-100 text-center border-0 shadow-sm card-hover">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{ fontSize: '3rem', color: 'var(--bcb-blue)' }}>
                    <FaUtensils />
                  </div>
                  <h4>Shabbat Dinners</h4>
                  <p>
                    Your donations help us provide delicious, home-cooked meals,
                    wine, and challah for our weekly Shabbat gatherings.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 text-center border-0 shadow-sm card-hover">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{ fontSize: '3rem', color: 'var(--bcb-blue)' }}>
                    <FaStar />
                  </div>
                  <h4>Holiday Celebrations</h4>
                  <p>
                    From Chanukah menorahs to Passover Seders, your support makes
                    our holiday celebrations special and memorable.
                  </p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 text-center border-0 shadow-sm card-hover">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{ fontSize: '3rem', color: 'var(--bcb-blue)' }}>
                    <FaUsers />
                  </div>
                  <h4>Community Growth</h4>
                  <p>
                    Help us expand our programs, reach more people, and strengthen
                    Jewish life in Summit County.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Donation Section */}
      <section className="py-5 bg-light">
        <Container>
          <Row className="justify-content-center">
            <Col lg={8}>
              <Card className="border-0 shadow-lg">
                <Card.Body className="p-5 text-center">
                  <FaHandHoldingHeart size={50} className="text-primary mb-4" />
                  <h2 className="mb-4">Make a Donation</h2>
                  <p className="lead mb-4">
                    Every contribution, large or small, makes a difference in our ability
                    to serve the Jewish community in the Colorado backcountry.
                  </p>
                  <p className="mb-4">
                    <strong>Backcountry Bayit is a registered 501(c)(3) non-profit organization.</strong>
                    <br />
                    Your donation is tax-deductible to the fullest extent allowed by law.
                  </p>

                  {/* Donation Buttons */}
                  <div className="d-flex flex-wrap justify-content-center gap-3 mb-4">
                    {/* PayPal */}
                    <form
                      action="https://www.paypal.com/donate"
                      method="post"
                      target="_blank"
                    >
                      <input type="hidden" name="hosted_button_id" value="JXQT492LBPVXC" />
                      <button
                        type="submit"
                        className="donate-btn"
                        style={{
                          border: 'none',
                          cursor: 'pointer',
                          backgroundColor: '#0070ba'
                        }}
                      >
                        <FaHeart className="me-2" />
                        Donate via PayPal
                      </button>
                    </form>

                    {/* Venmo */}
                    <a
                      href="https://venmo.com/u/bcbayit"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="donate-btn text-decoration-none"
                      style={{
                        backgroundColor: '#008CFF',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      <FaHeart className="me-2" />
                      Donate via Venmo
                    </a>

                    {/* Zelle */}
                    <Link
                      to="/zelle"
                      className="donate-btn text-decoration-none"
                      style={{
                        backgroundColor: '#6D1ED4',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      <FaHeart className="me-2" />
                      Donate via Zelle
                    </Link>
                  </div>

                  <p className="text-muted mb-0">
                    <small>
                      Choose your preferred payment method. All donations are tax-deductible.
                    </small>
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Alternative Ways to Give */}
      <section className="py-5">
        <Container>
          <Row className="justify-content-center">
            <Col lg={8}>
              <h2 className="section-title text-center mb-5">Other Ways to Support</h2>

              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <h4 className="text-primary mb-3">Volunteer Your Time</h4>
                  <p>
                    Help us set up events, cook meals, or lead services. Your time and
                    talents are invaluable to our community.
                  </p>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <h4 className="text-primary mb-3">Sponsor an Event</h4>
                  <p>
                    Sponsor a Shabbat dinner or holiday celebration in honor or memory
                    of a loved one. Contact us at{' '}
                    <a href="mailto:info@bcbayit.org">info@bcbayit.org</a> for more information.
                  </p>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow-sm mb-4">
                <Card.Body className="p-4">
                  <h4 className="text-primary mb-3">Spread the Word</h4>
                  <p>
                    Share our website and social media pages with friends, family, and
                    anyone who might be interested in joining our mountain Jewish community.
                  </p>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Thank You Section */}
      <section className="py-5 bg-gradient-primary text-white">
        <Container>
          <Row className="justify-content-center text-center">
            <Col lg={8}>
              <h2 className="display-5 fw-bold mb-4">Thank You</h2>
              <div className="star-decoration mb-4">✡</div>
              <p className="lead mb-0">
                Your support helps us continue the tradition of Jewish hospitality and
                community building in the beautiful Colorado Rockies. From all of us at
                Backcountry Bayit, toda raba (thank you so much)!
              </p>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
}

export default Donate;
