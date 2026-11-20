import React from "react";
import {Form, Button, Alert} from "react-bootstrap";
import {FaTrash} from "react-icons/fa";

function RSVPForm({selectedEvent, rsvpData, setRSVPData, handleRSVPSubmit, existingRSVP, handleUnregister, onCancel, rsvpStatus, eventInfoDisplay, confirmOneTable, setConfirmOneTable, addToCalendar, setAddToCalendar, rememberMe, setRememberMe, requestManageLink, busy, remaining, registrationClosed}) {
  const handleRemoveAttendee = (index) => {
    setRSVPData({
      ...rsvpData,
      attendees: rsvpData.attendees.filter((_, i) => i !== index),
    });
  };

  const handleAddAttendee = () => {
    setRSVPData({
      ...rsvpData,
      attendees: [...rsvpData.attendees, {firstName: "", lastName: "", email: "", phone: ""}],
    });
  };

  return (
    <>
      {/* Event Info Display */}
      {selectedEvent && eventInfoDisplay}

      {remaining !== null && remaining !== undefined && <p role="status">{remaining ? `${remaining} seats available` : "This event is full. You can join the waitlist."}</p>}
      {registrationClosed && !existingRSVP ? (
        <p className="mb-0">Website RSVP is closed for this event.</p>
      ) : <Form onSubmit={handleRSVPSubmit} autoComplete="on">
        {/* OneTable Confirmation */}
        {!existingRSVP && selectedEvent?.rsvpSources?.oneTable && selectedEvent?.oneTableLink && (
          <Form.Group className="mb-3">
            <Form.Check
              type="checkbox"
              id="confirmOneTable"
              label={
                <span>
                  I confirm I registered via OneTable at{" "}
                  <a href={selectedEvent.oneTableLink} target="_blank" rel="noreferrer">
                    this link
                  </a>
                  .
                </span>
              }
              checked={confirmOneTable}
              onChange={(e) => setConfirmOneTable(e.target.checked)}
              required={selectedEvent?.rsvpSources?.oneTable === true}
            />
          </Form.Group>
        )}

        {/* Primary Registrant Fields */}
        <Form.Group controlId="rsvp-first" className="mb-3">
          <Form.Label>First Name *</Form.Label>
          <Form.Control type="text" required value={rsvpData.firstName} onChange={(e) => setRSVPData({...rsvpData, firstName: e.target.value})} placeholder="John" autoComplete="given-name" name="firstName" />
        </Form.Group>

        <Form.Group controlId="rsvp-last" className="mb-3">
          <Form.Label>Last Name *</Form.Label>
          <Form.Control type="text" required value={rsvpData.lastName} onChange={(e) => setRSVPData({...rsvpData, lastName: e.target.value})} placeholder="Doe" autoComplete="family-name" name="lastName" />
        </Form.Group>

        <Form.Group controlId="rsvp-email" className="mb-3">
          <Form.Label>Email *</Form.Label>
          <Form.Control type="email" required readOnly={Boolean(existingRSVP)} value={rsvpData.email} onChange={(e) => setRSVPData({...rsvpData, email: e.target.value})} placeholder="john@example.com" autoComplete="email" name="email" />
        </Form.Group>

        <Form.Group controlId="rsvp-phone" className="mb-3">
          <Form.Label>Phone Number</Form.Label>
          <Form.Control type="tel" value={rsvpData.phone} onChange={(e) => setRSVPData({...rsvpData, phone: e.target.value})} placeholder="(123) 456-7890" autoComplete="tel" name="phone" />
        </Form.Group>

        {/* Additional Attendees */}
        {rsvpData.attendees.map((attendee, index) => (
          <div key={index} className="mb-4 p-3 bg-light rounded position-relative">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0">Additional Guest {index + 1}</h5>
              <Button variant="outline-danger" size="sm" onClick={() => handleRemoveAttendee(index)}>
                <FaTrash /> Remove
              </Button>
            </div>
            <Form.Group controlId={`rsvp-guest-${index}-first`} className="mb-3">
              <Form.Label>First Name *</Form.Label>
              <Form.Control
                type="text"
                required
                value={attendee.firstName}
                onChange={(e) => {
                  const updated = [...rsvpData.attendees];
                  updated[index].firstName = e.target.value;
                  setRSVPData({...rsvpData, attendees: updated});
                }}
                placeholder="John"
              />
            </Form.Group>

            <Form.Group controlId={`rsvp-guest-${index}-last`} className="mb-3">
              <Form.Label>Last Name *</Form.Label>
              <Form.Control
                type="text"
                required
                value={attendee.lastName}
                onChange={(e) => {
                  const updated = [...rsvpData.attendees];
                  updated[index].lastName = e.target.value;
                  setRSVPData({...rsvpData, attendees: updated});
                }}
                placeholder="Doe"
              />
            </Form.Group>

            <Form.Group controlId={`rsvp-guest-${index}-email`} className="mb-3">
              <Form.Label>Email *</Form.Label>
              <Form.Control
                type="email"
                required
                value={attendee.email}
                onChange={(e) => {
                  const updated = [...rsvpData.attendees];
                  updated[index].email = e.target.value;
                  setRSVPData({...rsvpData, attendees: updated});
                }}
                placeholder="john@example.com"
              />
            </Form.Group>

            <Form.Group controlId={`rsvp-guest-${index}-phone`} className="mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control
                type="tel"
                value={attendee.phone}
                onChange={(e) => {
                  const updated = [...rsvpData.attendees];
                  updated[index].phone = e.target.value;
                  setRSVPData({...rsvpData, attendees: updated});
                }}
                placeholder="(123) 456-7890"
              />
            </Form.Group>
          </div>
        ))}

        <Button variant="outline-primary" onClick={handleAddAttendee} className="mt-3">
          Add Another Person
        </Button>

        <Form.Group controlId="rsvp-dietary" className="mb-4 mt-3">
          <Form.Label>Dietary Restrictions or Allergies</Form.Label>
          <Form.Control as="textarea" rows={3} value={rsvpData.dietaryRestrictions} onChange={(e) => setRSVPData({...rsvpData, dietaryRestrictions: e.target.value})} placeholder="Please let us know about any dietary restrictions or allergies..." />
        </Form.Group>

        {/* Remember Me Checkbox */}
        {setRememberMe && (
          <Form.Group className="mb-2">
            <Form.Check type="checkbox" id="rememberMe" label="Remember my details for next time" checked={rememberMe || false} onChange={(e) => setRememberMe(e.target.checked)} />
          </Form.Group>
        )}

        {/* Add to Calendar Checkbox */}
        {setAddToCalendar && (
          <Form.Group className="mb-4">
            <Form.Check type="checkbox" id="addToCalendar" label="Save a copy of this event after RSVP" checked={addToCalendar || false} onChange={(e) => setAddToCalendar(e.target.checked)} />
          </Form.Group>
        )}

        {/* Action Buttons */}
        <div className="d-flex flex-wrap gap-2">
          <Button variant="primary" type="submit" size="lg" disabled={busy}>
            {existingRSVP ? "Update RSVP" : "Submit RSVP"}
          </Button>
          {existingRSVP && handleUnregister && (
            <Button variant="outline-danger" onClick={handleUnregister} size="lg" disabled={busy}>
              Cancel RSVP
            </Button>
          )}
          <Button variant="secondary" onClick={onCancel} size="lg">
            Cancel
          </Button>
        </div>

        {/* Status Alert */}
        {rsvpStatus.show && (
          <Alert variant={rsvpStatus.type} className="mt-4 mb-0">
            {rsvpStatus.message}
          </Alert>
        )}

        {!existingRSVP && requestManageLink && (
          <div className="mt-3">
            <Button variant="link" className="p-0" disabled={busy} onClick={requestManageLink}>Manage my RSVP</Button>
            <p className="small text-muted mb-0">Enter the email you used to register, then request a private link.</p>
          </div>
        )}
      </Form>}
    </>
  );
}

export default RSVPForm;
