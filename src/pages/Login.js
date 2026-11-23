import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import { FaLock, FaUser } from 'react-icons/fa';

import {signInWithCustomToken} from "firebase/auth";
import {auth} from "../config/firebase";
import {requestPasswordReset} from "../utils/passwordReset";

function Login() {
  const [invite, setInvite] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("invite"));
  const missingInvite = !invite && new URLSearchParams(window.location.search).get("invitation") === "1";
  React.useEffect(() => {
    if (invite) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [invite]);
  const {state} = useLocation();
  const [email, setEmail] = useState(state?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState("");
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
                  <h2 className="fw-bold">{invite ? "Set your manager password" : "Manager Login"}</h2>
                  <p className="text-muted">{invite ? "Choose a password to accept your invitation and open the dashboard." : "Access the event management portal"}</p>
                </div>

                {error && (
                  <Alert variant="danger" onClose={() => setError('')} dismissible>
                    {error}
                  </Alert>
                )}

                {missingInvite && <Alert variant="warning">This invitation link is incomplete. Open the original link in your email or ask an administrator for a new one.</Alert>}
                {state?.passwordChanged && <Alert variant="success">Password changed. Sign in with your new password.</Alert>}
                {notice && <Alert variant="info">{notice}</Alert>}
                {invite && <Form onSubmit={async event => {
                  event.preventDefault();
                  const {newPassword, confirmPassword} = Object.fromEntries(new FormData(event.currentTarget));
                  if (newPassword !== confirmPassword) {
                    setError("The passwords don’t match.");
                    return;
                  }
                  setLoading(true);
                  setError("");
                  try {
                    const response = await fetch("/api/manager-invitation", {
                      method: "POST", headers: {"Content-Type": "application/json"},
                      body: JSON.stringify({invite, password: newPassword}),
                    });
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error);
                    await signInWithCustomToken(auth, data.token);
                    navigate("/manager", {replace: true});
                  } catch (failure) {
                    setError(failure.message);
                  } finally {
                    setLoading(false);
                  }
                }}>
                  {["newPassword", "confirmPassword"].map((name, index) => (
                    <Form.Group key={name} controlId={"invite-" + name} className="mb-3">
                      <Form.Label>{index ? "Confirm password" : "Create a password"}</Form.Label>
                      <Form.Control name={name} type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
                      {!index && <Form.Text>Use at least 12 characters.</Form.Text>}
                    </Form.Group>
                  ))}
                  <Button type="submit" disabled={loading} className="w-100 mb-3">
                    Save password and sign in
                  </Button>
                </Form>}
                {!invite && <Form onSubmit={handleSubmit}>
                  <Form.Group controlId="login-email" className="mb-3">
                    <Form.Label>
                      <FaUser className="me-2" />
                      Email Address
                    </Form.Label>
                    <Form.Control
                      type="email"
                      name="username" autoComplete="username"
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
                      name="password" autoComplete="current-password"
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
                </Form>}
                <Button type="button" variant="link" className="px-0 mt-2" disabled={loading} onClick={async () => {
                  if (!email.trim()) {
                    setError("Enter your email address to request a password reset.");
                    return;
                  }
                  setLoading(true);
                  setError("");
                  try {
                    await requestPasswordReset(email.trim());
                    setNotice("If there’s an account for this address, check your email for a reset link.");
                  } catch (failure) {
                    setError(failure.message);
                  } finally {
                    setLoading(false);
                  }
                }}>Forgot password?</Button>


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
