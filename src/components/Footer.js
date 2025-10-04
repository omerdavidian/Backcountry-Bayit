import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { FaFacebook, FaInstagram, FaEnvelope } from 'react-icons/fa';

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer-bcb">
      <Container>
        <Row>
          <Col md={4} className="mb-4 mb-md-0">
            <h5 className="mb-3">Backcountry Bayit</h5>
            <p>
              Building Jewish community in the heart of the Colorado Rockies.
              Join us for Shabbat dinners and holiday celebrations.
            </p>
            <p className="mb-0">
              <strong>Est. 2016 • Frisco, CO</strong>
            </p>
          </Col>
          <Col md={4} className="mb-4 mb-md-0">
            <h5 className="mb-3">Quick Links</h5>
            <ul className="list-unstyled">
              <li className="mb-2">
                <Link to="/about">About Us</Link>
              </li>
              <li className="mb-2">
                <Link to="/events">Events Calendar</Link>
              </li>
              <li className="mb-2">
                <Link to="/donate">Support BCB</Link>
              </li>
              <li className="mb-2">
                <Link to="/contact">Contact</Link>
              </li>
            </ul>
          </Col>
          <Col md={4}>
            <h5 className="mb-3">Connect With Us</h5>
            <div className="mb-3">
              <a
                href="https://www.facebook.com/BackcountryBayit"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon"
              >
                <FaFacebook size={20} />
              </a>
              <a
                href="https://www.instagram.com/bcbayit/"
                target="_blank"
                rel="noopener noreferrer"
                className="social-icon"
              >
                <FaInstagram size={20} />
              </a>
              <a
                href="mailto:info@bcbayit.org"
                className="social-icon"
              >
                <FaEnvelope size={20} />
              </a>
            </div>
            <p>
              <FaEnvelope className="me-2" />
              <a href="mailto:info@bcbayit.org">info@bcbayit.org</a>
            </p>
          </Col>
        </Row>
        <Row className="mt-4 pt-4 border-top border-light">
          <Col className="text-center">
            <p className="mb-0">
              &copy; {currentYear} Backcountry Bayit. All rights reserved. | 501(c)(3) Non-Profit Organization
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}

export default Footer;
