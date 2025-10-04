import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { FaFacebook, FaInstagram } from 'react-icons/fa';

function Navigation() {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <Navbar bg="white" expand="lg" className="navbar-bcb sticky-top" expanded={expanded}>
      <Container>
        <Navbar.Brand as={Link} to="/" onClick={() => setExpanded(false)}>
          <img
            src="/images/logo.webp"
            height="60"
            className="d-inline-block align-top"
            alt="Backcountry Bayit"
          />
        </Navbar.Brand>
        <Navbar.Toggle
          aria-controls="basic-navbar-nav"
          onClick={() => setExpanded(!expanded)}
        />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="ms-auto align-items-center">
            <Nav.Link
              as={Link}
              to="/"
              className={isActive('/') ? 'active' : ''}
              onClick={() => setExpanded(false)}
            >
              Home
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/about"
              className={isActive('/about') ? 'active' : ''}
              onClick={() => setExpanded(false)}
            >
              About
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/events"
              className={isActive('/events') ? 'active' : ''}
              onClick={() => setExpanded(false)}
            >
              Events
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/donate"
              className={isActive('/donate') ? 'active' : ''}
              onClick={() => setExpanded(false)}
            >
              Donate
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/contact"
              className={isActive('/contact') ? 'active' : ''}
              onClick={() => setExpanded(false)}
            >
              Contact
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/login"
              className={isActive('/login') ? 'active' : ''}
              onClick={() => setExpanded(false)}
            >
              Login
            </Nav.Link>
            <Nav.Link
              href="https://www.facebook.com/BackcountryBayit"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <FaFacebook size={24} color="#0066CC" />
            </Nav.Link>
            <Nav.Link
              href="https://www.instagram.com/bcbayit/"
              target="_blank"
              rel="noopener noreferrer"
              className="social-link"
            >
              <FaInstagram size={24} color="#0066CC" />
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;
