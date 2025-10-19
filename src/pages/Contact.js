import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { FaEnvelope, FaFacebook, FaInstagram, FaMapMarkerAlt } from 'react-icons/fa';
import emailjs from '@emailjs/browser';

function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState({ show: false, message: '', type: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // TODO: Configure EmailJS or use alternative email service
      // For now, we'll use a simple mailto fallback
      const mailtoLink = `mailto:info@bcbayit.org?subject=${encodeURIComponent(formData.subject)}&body=${encodeURIComponent(
        `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
      )}`;

      // Try to send via EmailJS if configured
      // Otherwise, open mailto link
      if (process.env.REACT_APP_EMAILJS_SERVICE_ID) {
        await emailjs.send(
          process.env.REACT_APP_EMAILJS_SERVICE_ID,
          process.env.REACT_APP_EMAILJS_TEMPLATE_ID,
          {
            from_name: formData.name,
            from_email: formData.email,
            subject: formData.subject,
            message: formData.message,
            to_email: 'info@bcbayit.org'
          },
          process.env.REACT_APP_EMAILJS_PUBLIC_KEY
        );

        setStatus({
          show: true,
          message: 'Thank you for your message! We will get back to you soon.',
          type: 'success'
        });

        // Reset form
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        });
      } else {
        // Fallback to mailto
        window.location.href = mailtoLink;
        setStatus({
          show: true,
          message: 'Opening your email client...',
          type: 'info'
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus({
        show: true,
        message: 'There was an error sending your message. Please email us directly at info@bcbayit.org',
        type: 'danger'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-gradient-primary text-white py-5">
        <Container>
          <div className="text-center py-4">
            <FaEnvelope size={60} className="mb-3" />
            <h1 className="display-4 fw-bold">Get in Touch</h1>
            <p className="lead">
              We'd love to hear from you! Reach out with questions, ideas, or just to say shalom.
            </p>
          </div>
        </Container>
      </section>

      {/* Contact Form and Info */}
      <section className="py-5">
        <Container>
          <Row className="g-4">
            <Col lg={6}>
              <Card className="border-0 shadow h-100">
                <Card.Body className="p-4">
                  <h2 className="mb-4">Send Us a Message</h2>

                  {status.show && (
                    <Alert
                      variant={status.type}
                      onClose={() => setStatus({ show: false, message: '', type: '' })}
                      dismissible
                    >
                      {status.message}
                    </Alert>
                  )}

                  <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Name *</Form.Label>
                      <Form.Control
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Your name"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Email *</Form.Label>
                      <Form.Control
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="your.email@example.com"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Subject *</Form.Label>
                      <Form.Control
                        type="text"
                        required
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder="What is this regarding?"
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label>Message *</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={6}
                        required
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder="Your message..."
                      />
                    </Form.Group>

                    <Button
                      variant="primary"
                      type="submit"
                      size="lg"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Sending...' : 'Send Message'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>

            <Col lg={6}>
              <Card className="border-0 shadow mb-4">
                <Card.Body className="p-4">
                  <h3 className="mb-4">Contact Information</h3>

                  <div className="mb-4">
                    <h5 className="text-primary">
                      <FaEnvelope className="me-2" />
                      Email
                    </h5>
                    <p className="mb-0">
                      <a href="mailto:info@bcbayit.org">info@bcbayit.org</a>
                    </p>
                    <p className="text-muted">
                      <small>We typically respond within 24-48 hours</small>
                    </p>
                  </div>

                  <div className="mb-4">
                    <h5 className="text-primary">
                      <FaMapMarkerAlt className="me-2" />
                      Location
                    </h5>
                    <p className="mb-0">Frisco, Colorado</p>
                    <p className="text-muted">
                      <small>Summit County, CO 80443</small>
                    </p>
                  </div>

                  <div className="mb-0">
                    <h5 className="text-primary mb-3">Follow Us</h5>
                    <div className="d-flex gap-2">
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
                    </div>
                    <p className="text-muted mt-3">
                      <small>
                        Stay updated on events and community news by following us on social media!
                      </small>
                    </p>
                  </div>
                </Card.Body>
              </Card>

              <Card className="border-0 shadow">
                <Card.Body className="p-4">
                  <h4 className="mb-3">Frequently Asked Questions</h4>

                  <div className="mb-3">
                    <h6 className="text-primary">Do I need to be Jewish to attend?</h6>
                    <p className="mb-0">
                      Everyone is welcome! We welcome Jews and non-Jews alike to our events.
                    </p>
                  </div>

                  <div className="mb-3">
                    <h6 className="text-primary">Is there a cost to attend events?</h6>
                    <p className="mb-0">
                      We typically ask for a suggested donation to help cover costs, but no
                      one is turned away for inability to pay.
                    </p>
                  </div>

                  <div className="mb-3">
                    <h6 className="text-primary">When is the season?</h6>
                    <p className="mb-0">
                      We host events during the winter season, from November through April.
                    </p>
                  </div>

                  <div className="mb-0">
                    <h6 className="text-primary">How do I RSVP?</h6>
                    <p className="mb-0">
                      Check our Events calendar and RSVP directly through the website, or
                      contact us via email.
                    </p>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Map or Additional Info Section */}
      <section className="py-5 bg-light">
        <Container>
          <Row className="justify-content-center text-center">
            <Col lg={8}>
              <h2 className="section-title mb-4">Visit Us in Frisco</h2>
              <p className="lead mb-4">
                Located in beautiful Summit County, Colorado, we're easily accessible from
                Breckenridge, Keystone, Copper Mountain, Vail, and beyond.
              </p>
              <p>
                Whether you're a local resident or visiting the mountains for the season,
                we'd love to have you join our community. Reach out to learn about our
                next gathering!
              </p>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
}

export default Contact;
