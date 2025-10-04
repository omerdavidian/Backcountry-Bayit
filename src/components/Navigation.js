import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { FaFacebook, FaInstagram, FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '../utils/AuthContext';

function Navigation() {
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  // Handle scroll for transparent navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setExpanded(false);
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handleNavClick = (path) => {
    setExpanded(false);
    window.scrollTo(0, 0); // Scroll to top
  };

  return (
    <Navbar
      bg="white"
      expand="lg"
      className={`navbar-bcb sticky-top ${scrolled ? 'navbar-scrolled' : ''}`}
      expanded={expanded}
    >
      <Container>
        <Navbar.Brand as={Link} to="/" onClick={() => setExpanded(false)}>
          <img
            src="/images/logo.webp"
            height={scrolled ? "50" : "60"}
            className="d-inline-block align-top navbar-logo"
            alt="Backcountry Bayit"
            style={{ transition: 'height 0.3s ease' }}
          />
        </Navbar.Brand>
        <Navbar.Toggle
          aria-controls="basic-navbar-nav"
          onClick={() => setExpanded(!expanded)}
        />
        <Navbar.Collapse id="basic-navbar-nav">
          {/* Center Navigation Links */}
          <Nav className="mx-auto align-items-center justify-content-center flex-grow-1">
            <Nav.Link
              as={Link}
              to="/"
              className={isActive('/') ? 'active' : ''}
              onClick={handleNavClick}
            >
              Home
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/about"
              className={isActive('/about') ? 'active' : ''}
              onClick={handleNavClick}
            >
              About
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/events"
              className={isActive('/events') ? 'active' : ''}
              onClick={handleNavClick}
            >
              Events
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/donate"
              className={isActive('/donate') ? 'active' : ''}
              onClick={handleNavClick}
            >
              Donate
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/contact"
              className={isActive('/contact') ? 'active' : ''}
              onClick={handleNavClick}
            >
              Contact
            </Nav.Link>
          </Nav>

          {/* Right Side: Social Icons + Login/Logout */}
          <Nav className="ms-auto align-items-center">
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

            {currentUser ? (
              <Button
                variant="outline-primary"
                size="sm"
                onClick={handleLogout}
                className="ms-2"
              >
                <FaSignOutAlt className="me-1" />
                Logout
              </Button>
            ) : (
              <Nav.Link
                as={Link}
                to="/login"
                className={`ms-2 ${isActive('/login') ? 'active' : ''}`}
                onClick={() => setExpanded(false)}
              >
                Login
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}

export default Navigation;
