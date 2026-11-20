import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { FaLock, FaUser } from 'react-icons/fa';

import {signInWithCustomToken} from "firebase/auth";
import {auth} from "../config/firebase";

function Login() {
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("invite"));
  React.useEffect(() => {
    if (invite) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [invite]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, currentUser, userRole, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in based on role
  React.useEffect(() => {
    if (currentUser && userRole && !invite) {
      if (isAdmin) {
        navigate('/admin');
      } else if (userRole === 'manager') {
        navigate('/manager');
      } else {
        navigate('/');
      }
    }
  }, [currentUser, userRole, isAdmin, navigate, invite]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setError('');
      setLoading(true);
      await login(email, password);
      setInvite(null);

      // Note: The redirect will happen automatically via useEffect
      // when userRole is loaded
    } catch (error) {
      console.error('Login error:', error);
      setError('Failed to log in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-light min-vh-100 d-flex align-items-center py-5">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={5}>
            <Card className="border-0 shadow-lg">
              <Card.Body className="p-5">
                <div className="text-center mb-4">
                  <img
                    src="/images/logo.webp"
                    alt="BCB Logo"
                    style={{ maxWidth: '150px' }}
                    className="mb-3"
                  />
                  <h2 className="fw-bold">Manager Login</h2>
                  <p className="text-muted">Access the event management portal</p>
                </div>

                {error && (
                  <Alert variant="danger" onClose={() => setError('')} dismissible>
                    {error}
                  </Alert>
                )}

                {invite && <Button disabled={loading} className="w-100 mb-3" onClick={async () => {
                  setLoading(true);
                  try {
                    const response = await fetch("/api/manager-invitation", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({invite})});
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    await signInWithCustomToken(auth, data.token);
                    navigate("/manager", {replace:true});
                  } catch (err) {setError(err.message);}
                  finally {setLoading(false);}
                }}>Accept invitation and sign in</Button>}
                <Form onSubmit={handleSubmit}>
                  <Form.Group controlId="login-email" className="mb-3">
                    <Form.Label>
                      <FaUser className="me-2" />
                      Email Address
                    </Form.Label>
                    <Form.Control
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your.email@example.com"
                      size="lg"
                    />
                  </Form.Group>

                  <Form.Group controlId="login-password" className="mb-4">
                    <Form.Label>
                      <FaLock className="me-2" />
                      Password
                    </Form.Label>
                    <Form.Control
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      size="lg"
                    />
                  </Form.Group>

                  <Button
                    variant="primary"
                    type="submit"
                    size="lg"
                    className="w-100"
                    disabled={loading}
                  >
                    {loading ? 'Logging in...' : 'Login'}
                  </Button>
                </Form>

                <div className="text-center mt-4">
                  <p className="text-muted mb-0">
                    <small>
                      For manager access, please contact the board of directors at{' '}
                      <a href="mailto:info@bcbayit.org">info@bcbayit.org</a>
                    </small>
                  </p>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Login;
