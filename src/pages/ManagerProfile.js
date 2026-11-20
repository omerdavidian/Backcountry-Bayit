import React, {useEffect, useState} from "react";
import {Alert, Button, Card, Col, Container, Form, Row} from "react-bootstrap";
import {signInWithCustomToken} from "firebase/auth";
import {Link, useNavigate} from "react-router-dom";
import {useAuth} from "../utils/AuthContext";
import {auth} from "../config/firebase";

const fields = [
  {name: "firstName", label: "First name", autoComplete: "given-name", maxLength: 80},
  {name: "lastName", label: "Last name", autoComplete: "family-name", maxLength: 80},
  {name: "phone", label: "Phone number", autoComplete: "tel", type: "tel", maxLength: 30},
  {name: "birthday", label: "Birthday", autoComplete: "bday", type: "date"},
];

export default function ManagerProfile() {
  const navigate = useNavigate();
  const {isManager} = useAuth();
  const [invite] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("invite"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [linkState, setLinkState] = useState(invite ? "checking" : "unavailable");

  useEffect(() => {
    if (invite) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, [invite]);

  useEffect(() => {
    if (!invite) return;
    const controller = new AbortController();
    (async () => {
      try {
        const response = await fetch("/api/manager-invitation", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({invite, checkProfile: true}),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if ([400, 403, 410].includes(response.status)) {
          setLinkState("unavailable");
          return;
        }
        if (!response.ok || !(await response.json()).profileRequired) throw new Error();
        if (!controller.signal.aborted) setLinkState("ready");
      } catch {
        if (!controller.signal.aborted) setLinkState("error");
      }
    })();
    return () => controller.abort();
  }, [invite]);

  useEffect(() => {
    if (linkState === "unavailable" && isManager) navigate("/manager", {replace: true});
  }, [linkState, isManager, navigate]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const profile = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/manager-invitation", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({invite, profile}),
      });
      const data = await response.json();
      if (response.status === 410) {
        setLinkState("unavailable");
        return;
      }
      if (!response.ok) throw new Error(data.error || "We couldn’t save your profile. Try again.");
      setComplete(true);
      await signInWithCustomToken(auth, data.token);
      navigate("/manager", {replace: true});
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="py-5" style={{background: "#edf4fb"}}>
      <Container style={{maxWidth: 670}}>
        <Card className="border-0 shadow-sm overflow-hidden rounded-4">
          <div className="p-4 p-md-5 text-white" style={{background: "#004080", borderTop: "4px solid #ffd700"}}>
            <div className="small mb-2">Backcountry Bayit · Manager access</div>
            <h1 className="h2 mb-0">{linkState === "ready" && !complete ? "Complete your manager profile" : "Manager access"}</h1>
          </div>
          <Card.Body className="p-4 p-md-5">
            {error && <Alert variant="danger">{error}</Alert>}
            {complete ? (
              <p>Your profile has been saved. If you can’t sign in, ask an administrator for a new sign-in link.</p>
            ) : linkState === "checking" ? (
              <p role="status" className="mb-0">Checking your invitation…</p>
            ) : linkState === "error" ? (
              <Alert variant="danger" className="mb-0">Couldn’t check this link. Reopen it from your invitation email to try again.</Alert>
            ) : linkState === "ready" ? (
              <>
                <p className="text-muted mb-4">Enter all four fields to activate your manager account.</p>
                <Form onSubmit={submit}>
                  <Row className="g-3 mb-4">
                    {fields.map(({name, label, type = "text", ...props}) => (
                      <Col xs={12} sm={6} key={name}>
                        <Form.Group controlId={name}>
                          <Form.Label>{label}</Form.Label>
                          <Form.Control name={name} type={type} required {...props}
                            {...(type === "date" && {min: "1900-01-01", max: new Date().toISOString().slice(0, 10)})} />
                        </Form.Group>
                      </Col>
                    ))}
                  </Row>
                  <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save profile and sign in"}</Button>
                </Form>
              </>
            ) : (
              <p className="mb-0">{invite ? "This invitation has already been used or has expired. " : "Open the link in your invitation email to complete your profile. "}<Link to="/login">Go to manager sign-in</Link>. If you need a new link, ask an administrator.</p>
            )}
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}
