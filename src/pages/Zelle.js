import React from 'react';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { FaArrowLeft } from 'react-icons/fa';
import { Link } from 'react-router-dom';

function Zelle() {
  return (
    <div className="bg-light min-vh-100 py-5">
      <Container>
        <Row className="justify-content-center">
          <Col lg={6} md={8}>
            <Link to="/donate" className="btn btn-outline-secondary mb-4">
              <FaArrowLeft className="me-2" />
              Back to Donate
            </Link>

            <Card className="border-0 shadow-lg">
              <Card.Body className="p-5 text-center">
                <h1 className="mb-2" style={{ color: '#6D1ED4' }}>
                  Donate with Zelle
                </h1>
                <p className="text-muted mb-4">Send money directly from your bank</p>

                <div className="mb-4">
                  <img 
                    src="/images/BCB_Zelle_qr_code.jpg"
                    alt="Zelle QR Code - Send to info@bcbayit.org" 
                    style={{ 
                      maxWidth: '280px', 
                      width: '100%',
                      borderRadius: '12px',
                      boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                    }} 
                  />
                </div>

                <div className="bg-light rounded p-4 mb-4">
                  <p className="mb-2"><strong>Recipient</strong></p>
                  <h4 className="mb-3">BACKCOUNTRY BAYIT</h4>
                  <p className="mb-2"><strong>Email</strong></p>
                  <h5 className="text-primary mb-0">info@bcbayit.org</h5>
                </div>

                <div className="text-start">
                  <h5 className="mb-3">How to donate with Zelle:</h5>
                  <ol className="text-muted">
                    <li className="mb-2">Open your bank's mobile app or website</li>
                    <li className="mb-2">Find Zelle in the payments or transfers section</li>
                    <li className="mb-2">Enter <strong>info@bcbayit.org</strong> as the recipient</li>
                    <li className="mb-2">Enter your donation amount</li>
                    <li className="mb-2">Review and send!</li>
                  </ol>
                </div>

                <hr className="my-4" />

                <p className="text-muted small mb-0">
                  <strong>Backcountry Bayit</strong> is a registered 501(c)(3) non-profit organization.
                  <br />
                  Your donation is tax-deductible to the fullest extent allowed by law.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Zelle;
