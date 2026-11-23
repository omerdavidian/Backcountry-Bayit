import React, {useEffect, useState} from "react";
import {Alert, Button, Form} from "react-bootstrap";
import {confirmPasswordReset, signOut, verifyPasswordResetCode} from "firebase/auth";
import {Link, useNavigate} from "react-router-dom";
import {auth} from "../config/firebase";
import "./PasswordReset.css";

const invalidLink = "This link is incomplete, expired, or already used. Request a new reset email from the sign-in page.";

export default function PasswordReset() {
  const navigate = useNavigate();
  const [code] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("oobCode"));
  const [email, setEmail] = useState("");
  const [error, setError] = useState(code ? "" : invalidLink);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!code) return;
    let current = true;
    window.history.replaceState(window.history.state, "", window.location.pathname);
    verifyPasswordResetCode(auth, code)
      .then(address => {if (current) setEmail(address);})
      .catch(() => {if (current) setError(invalidLink);});
    return () => {current = false;};
  }, [code]);

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    const {password, confirmation} = Object.fromEntries(new FormData(event.currentTarget));
    if (password !== confirmation) {
      setError("The passwords don’t match.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await confirmPasswordReset(auth, code, password);
    } catch (failure) {
      if (["auth/expired-action-code", "auth/invalid-action-code"].includes(failure.code)) {
        setEmail("");
        setError(invalidLink);
      } else {
        setError("Couldn’t save the password. Check the password requirements and try again.");
      }
      setSaving(false);
      return;
    }
    try {
      await signOut(auth);
      navigate("/login", {replace: true, state: {email, passwordChanged: true}});
    } catch {
      setEmail("");
      setError("Password saved. Log out before signing in with your new password.");
    }
  }

  return (
    <div className="password-reset-page">
      <section className="password-reset-card" aria-labelledby="reset-heading">
        <div className="password-reset-brand">
          <img src="/images/logo.webp" alt="" width="46" height="46" /> Backcountry Bayit
        </div>
        <header className="password-reset-header"><h1 id="reset-heading">Reset your password</h1></header>
        <div className="password-reset-body">
          {error && <Alert variant="danger">{error}</Alert>}
          {!email && !error && <p role="status">Checking your reset link…</p>}
          {email ? <Form onSubmit={save}>
            <Form.Group controlId="reset-email" className="mb-3">
              <Form.Label>Email address</Form.Label>
              <Form.Control name="username" type="email" autoComplete="username" value={email} readOnly />
            </Form.Group>
            <Form.Group controlId="reset-password" className="mb-3">
              <Form.Label>New password</Form.Label>
              <Form.Control name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
              <Form.Text>Use at least 12 characters.</Form.Text>
            </Form.Group>
            <Form.Group controlId="reset-confirm" className="mb-3">
              <Form.Label>Confirm new password</Form.Label>
              <Form.Control name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
            </Form.Group>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save new password"}</Button>
          </Form> : <Link to="/login">Back to sign-in</Link>}
        </div>
      </section>
    </div>
  );
}
