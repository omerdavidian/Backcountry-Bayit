import React, {useState} from "react";
import {Alert, Button, Card, Form} from "react-bootstrap";
import {EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword} from "firebase/auth";
import {auth} from "../config/firebase";
import {useNavigate} from "react-router-dom";
import {requestPasswordReset} from "../utils/passwordReset";

export default function DashboardPassword({user}) {
  const navigate = useNavigate();
  const hasPassword = Boolean(user.providerData?.some(provider => provider.providerId === "password"));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function save(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const {currentPassword, password, confirmPassword} = Object.fromEntries(new FormData(form));
    if (password !== confirmPassword) {
      setFeedback({type: "danger", text: "The new passwords don’t match."});
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      if (hasPassword) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      await updatePassword(user, password);
    } catch (error) {
      const text = error.code === "auth/requires-recent-login"
        ? "Your sign-in is too old to save a password. Use the password reset link below."
        : ["auth/wrong-password", "auth/invalid-credential"].includes(error.code)
          ? "Your current password is incorrect."
          : "We couldn’t save your password. Check the requirements and try again.";
      setFeedback({type: "danger", text});
      setBusy(false);
      return;
    }
    try {
      await signOut(auth);
      navigate("/login", {replace: true, state: {email: user.email, passwordChanged: true}});
    } catch {
      setFeedback({type: "info", text: "Password saved. Log out to sign in with your new password."});
      setBusy(false);
    }
  }

  async function reset() {
    if (busy) return;
    setBusy(true);
    try {
      await requestPasswordReset(user.email);
      setFeedback({type: "info", text: "If a reset is available for this account, check your email for a link."});
    } catch {
      setFeedback({type: "danger", text: "We couldn’t send the reset email. Try again shortly."});
    } finally {
      setBusy(false);
    }
  }

  return <Card className="border-0 dashboard-security">
    <Card.Body className="p-4">
      <h2 className="h4">{hasPassword ? "Change password" : "Set a password"}</h2>
      {feedback && <Alert variant={feedback.type}>{feedback.text}</Alert>}
      <Form onSubmit={save}>
        <Form.Control name="username" type="email" autoComplete="username" value={user.email} aria-label="Email address" readOnly className="mb-3" />
        {hasPassword && <Form.Group controlId="dashboard-current-password" className="mb-3">
          <Form.Label>Current password</Form.Label>
          <Form.Control name="currentPassword" type="password" autoComplete="current-password" required />
        </Form.Group>}
        {["password", "confirmPassword"].map((name, index) => (
          <Form.Group key={name} controlId={"dashboard-" + name} className="mb-3">
            <Form.Label>{index ? "Confirm new password" : "New password"}</Form.Label>
            <Form.Control name={name} type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
            {!index && <Form.Text>Use at least 12 characters.</Form.Text>}
          </Form.Group>
        ))}
        <Button type="submit" disabled={busy}>Save password</Button>
        <Button className="ms-2" variant="link" type="button" disabled={busy} onClick={reset}>Email a password reset link</Button>
      </Form>
    </Card.Body>
  </Card>;
}
