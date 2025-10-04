import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { FaFacebook, FaInstagram, FaUserShield } from 'react-icons/fa';
import { useAuth } from '../utils/AuthContext';

function Navigation() {
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { currentUser, isAdmin, userRole } = useAuth();

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

  const handleNavClick = (path) => {
    setExpanded(false);
    window.scrollTo(0, 0); // Scroll to top
  };

  const getAdminPath = () => {
    if (isAdmin) return '/admin';
    if (userRole === 'manager') return '/manager';
    return '/login';
  };

  return (
    <Navbar
      bg="white"
      expand="lg"
      className={`navbar-bcb sticky-top ${scrolled ? 'navbar-scrolled' : ''}`}
      expanded={expanded}
    >
      <Container fluid className="px-4">
        <div className="navbar-three-section">
          {/* Left Section: Logo */}
          <div className="navbar-left">
            <Navbar.Brand as={Link} to="/" onClick={() => setExpanded(false)}>
              <img
                src="/images/logo.webp"
                height={scrolled ? "50" : "60"}
                className="d-inline-block align-top navbar-logo"
                alt="Backcountry Bayit"
                style={{ transition: 'height 0.3s ease' }}
              />
            </Navbar.Brand>
          </div>

          <Navbar.Toggle
            aria-controls="basic-navbar-nav"
            onClick={() => setExpanded(!expanded)}
          />

          <Navbar.Collapse id="basic-navbar-nav">
            {/* Center Section: Main Navigation */}
            <div className="navbar-center">
              <Nav className="align-items-center">
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
            </div>

            {/* Right Section: Social + Admin */}
            <div className="navbar-right">
              <Nav className="align-items-center">
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
                  <Nav.Link
                    as={Link}
                    to={getAdminPath()}
                    className={`admin-link ${isActive('/admin') || isActive('/manager') ? 'active' : ''}`}
                    onClick={() => setExpanded(false)}
                  >
                    <FaUserShield size={20} className="me-1" />
                    Admin
                  </Nav.Link>
                ) : (
                  <Nav.Link
                    as={Link}
                    to="/login"
                    className={`${isActive('/login') ? 'active' : ''}`}
                    onClick={() => setExpanded(false)}
                  >
                    Login
                  </Nav.Link>
                )}
              </Nav>
            </div>
          </Navbar.Collapse>
        </div>
      </Container>
    </Navbar>
  );
}

export default Navigation;
