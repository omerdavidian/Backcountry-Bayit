import React, {useState} from "react";
import {Modal, Button, Form, Alert, Spinner} from "react-bootstrap";

const EmailRSVPsModal = ({show, onHide, event, recipients, onSuccess}) => {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({show: false, message: "", type: ""});

  // Pre-fill subject if event is available
  React.useEffect(() => {
    if (event && show) {
      setSubject(`Update regarding ${event.title}`);
    }
  }, [event, show]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject || !message) {
      setStatus({show: true, message: "Please fill in all fields.", type: "warning"});
      return;
    }

    if (!recipients || recipients.length === 0) {
      setStatus({show: true, message: "No recipients to send to.", type: "warning"});
      return;
    }

    setSending(true);
    setStatus({show: false, message: "", type: ""});

    try {
      const response = await fetch("/api/send-bulk-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients,
          subject,
          message,
          eventId: event.id,
          eventTitle: event.title,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send emails");
      }

      setStatus({
        show: true,
        message: `Emails sent successfully! (${data.results.success} sent, ${data.results.failed} failed)`,
        type: "success",
      });

      setTimeout(() => {
        onSuccess();
        onHide();
        setSubject("");
        setMessage("");
        setStatus({show: false, message: "", type: ""});
      }, 2000);
    } catch (error) {
      console.error("Error sending emails:", error);
      setStatus({
        show: true,
        message: `Error: ${error.message}`,
        type: "danger",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Send Email to Guests</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {status.show && (
          <Alert variant={status.type} onClose={() => setStatus({...status, show: false})} dismissible>
            {status.message}
          </Alert>
        )}

        <div className="mb-3">
          <strong>Recipients:</strong> {recipients.length} guests
          <div className="text-muted small">Sending to all approved and pending RSVPs. Canceled RSVPs are excluded.</div>
        </div>

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Subject</Form.Label>
            <Form.Control type="text" placeholder="Enter email subject" value={subject} onChange={(e) => setSubject(e.target.value)} required disabled={sending} />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Message</Form.Label>
            <Form.Control as="textarea" rows={6} placeholder="Enter your message here..." value={message} onChange={(e) => setMessage(e.target.value)} required disabled={sending} />
            <Form.Text className="text-muted">Tip: Use [Name] to insert the guest's name automatically.</Form.Text>
          </Form.Group>

          <div className="d-flex justify-content-end gap-2">
            <Button variant="secondary" onClick={onHide} disabled={sending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={sending}>
              {sending ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Sending...
                </>
              ) : (
                "Send Email"
              )}
            </Button>
          </div>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default EmailRSVPsModal;
