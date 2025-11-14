import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';

/**
 * Shared event form fields component used across Admin, Manager, and Events pages.
 * Renders all input fields for creating/editing events.
 * 
 * @param {Object} eventForm - Current form state
 * @param {Function} setEventForm - State setter for form
 * @param {boolean} showCapacityToggle - Whether to show the "Limit Capacity" toggle
 * @param {Function} handleToggleCapacityLimit - Handler for capacity toggle (optional)
 */
function EventFormFields({ eventForm, setEventForm, showCapacityToggle = true, handleToggleCapacityLimit }) {
  return (
    <>
      <Form.Group className="mb-3">
        <Form.Label>Event Title *</Form.Label>
        <Form.Control
          type="text"
          required
          value={eventForm.title}
          onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
          placeholder="e.g., Shabbat Dinner"
        />
      </Form.Group>

      <Row className="mb-3">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Date *</Form.Label>
            <Form.Control
              type="date"
              required
              value={eventForm.date}
              onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Label>Time *</Form.Label>
          <Row>
            <Col xs={4}>
              <Form.Select
                value={eventForm.hour}
                onChange={(e) => setEventForm({ ...eventForm, hour: e.target.value })}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted small">Hour</Form.Text>
            </Col>
            <Col xs={4}>
              <Form.Select
                value={eventForm.minute}
                onChange={(e) => setEventForm({ ...eventForm, minute: e.target.value })}
              >
                {['00', '15', '30', '45'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </Form.Select>
              <Form.Text className="text-muted small">Min</Form.Text>
            </Col>
            <Col xs={4}>
              <Form.Select
                value={eventForm.period}
                onChange={(e) => setEventForm({ ...eventForm, period: e.target.value })}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </Form.Select>
              <Form.Text className="text-muted small">AM/PM</Form.Text>
            </Col>
          </Row>
        </Col>
      </Row>

      <Form.Group className="mb-3">
        <Form.Label>Location *</Form.Label>
        <Form.Control
          type="text"
          required
          value={eventForm.location}
          onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
          placeholder="e.g., BCB Community Center, Frisco, CO"
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Description</Form.Label>
        <Form.Control
          as="textarea"
          rows={3}
          value={eventForm.description}
          onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
          placeholder="Event description..."
        />
      </Form.Group>

      {/* Event Image/Flyer */}
      <Form.Group className="mb-3">
        <Form.Label>Event Image/Flyer</Form.Label>
        <Form.Control
          type="text"
          value={eventForm.imageUrl || ''}
          onChange={(e) => setEventForm({ ...eventForm, imageUrl: e.target.value })}
          placeholder="Image URL or upload a file below"
        />
        <Form.Text className="text-muted">
          Paste an image URL or use the upload button below to select a file
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Or Upload Image File</Form.Label>
        <Form.Control
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              // For now, we'll store the file in the form state and let the parent handle upload
              // In a full implementation, you'd upload to storage and get a URL
              const reader = new FileReader();
              reader.onloadend = () => {
                setEventForm({ ...eventForm, imageUrl: reader.result, imageFile: file });
              };
              reader.readAsDataURL(file);
            }
          }}
        />
        <Form.Text className="text-muted">
          Upload an image file (will be stored in /images/Event Flyers/)
        </Form.Text>
      </Form.Group>

      {eventForm.imageUrl && (
        <>
          <Form.Group className="mb-3">
            <Form.Label>Image Preview</Form.Label>
            <div style={{ 
              width: '100%', 
              height: '200px', 
              overflow: 'hidden', 
              borderRadius: '8px',
              border: '1px solid #dee2e6'
            }}>
              <img 
                src={eventForm.imageUrl} 
                alt="Event preview"
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  objectPosition: `center ${eventForm.imagePosition || 50}%`
                }}
              />
            </div>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Image Vertical Position: {eventForm.imagePosition || 50}%</Form.Label>
            <Form.Range
              min="0"
              max="100"
              value={eventForm.imagePosition || 50}
              onChange={(e) => setEventForm({ ...eventForm, imagePosition: parseInt(e.target.value) })}
            />
            <Form.Text className="text-muted">
              Adjust which part of the image shows in the banner (0% = top, 50% = center, 100% = bottom)
            </Form.Text>
          </Form.Group>
        </>
      )}

      {showCapacityToggle && (
        <Form.Group className="mb-3">
          <Form.Check
            type="checkbox"
            id="limitCapacity"
            label="Limit Capacity"
            checked={eventForm.limitCapacity}
            onChange={handleToggleCapacityLimit || ((e) => setEventForm({ ...eventForm, limitCapacity: e.target.checked }))}
          />
        </Form.Group>
      )}

      {eventForm.limitCapacity && (
        <Form.Group className="mb-3">
          <Form.Label>Capacity *</Form.Label>
          <Form.Control
            type="number"
            required
            min="1"
            value={eventForm.capacity}
            onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })}
          />
          <Form.Text className="text-muted">Maximum number of guests</Form.Text>
        </Form.Group>
      )}

      {/* RSVP Sources */}
      <Form.Group className="mb-3">
        <Form.Label>RSVP to this event through:</Form.Label>
        <div className="d-flex gap-3">
          <Form.Check
            type="checkbox"
            id="rsvpWebsite"
            label="This website"
            checked={!!eventForm.rsvpSources?.website}
            onChange={(e) => setEventForm({ 
              ...eventForm, 
              rsvpSources: { ...eventForm.rsvpSources, website: e.target.checked } 
            })}
          />
          <Form.Check
            type="checkbox"
            id="rsvpOneTable"
            label="OneTable"
            checked={!!eventForm.rsvpSources?.oneTable}
            onChange={(e) => setEventForm({ 
              ...eventForm, 
              rsvpSources: { ...eventForm.rsvpSources, oneTable: e.target.checked } 
            })}
          />
        </div>
      </Form.Group>

      {eventForm.rsvpSources?.oneTable && (
        <Form.Group className="mb-3">
          <Form.Label>OneTable Link *</Form.Label>
          <Form.Control
            type="url"
            required
            value={eventForm.oneTableLink || ''}
            onChange={(e) => setEventForm({ ...eventForm, oneTableLink: e.target.value })}
            placeholder="https://onetable.org/event/…"
          />
          <Form.Text className="text-muted">Attendees will see this link and must confirm registering via OneTable to RSVP on the website.</Form.Text>
        </Form.Group>
      )}

      {eventForm.rsvpSources?.website && (
        <Form.Group className="mb-4">
          <Form.Label>RSVP Approval Mode</Form.Label>
          <Form.Select
            value={eventForm.rsvpApprovalMode}
            onChange={(e) => setEventForm({ ...eventForm, rsvpApprovalMode: e.target.value })}
          >
            <option value="immediate">Immediate - Auto-approve all RSVPs</option>
            <option value="approval">Approval Required - Manually approve each RSVP</option>
          </Form.Select>
        </Form.Group>
      )}
    </>
  );
}

export default EventFormFields;
