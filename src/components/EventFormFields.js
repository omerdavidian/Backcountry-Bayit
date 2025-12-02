import React from 'react';
import { Form, Row, Col } from 'react-bootstrap';

const MAX_IMAGE_DIMENSION = 2048;
const WEBP_QUALITY = 0.78;

const createCanvas = (image) => {
  const ratio = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const processImageFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  const image = new Image();

  image.onerror = () => reject(new Error('Unable to load image for compression.'));
  image.onload = () => {
    const canvas = createCanvas(image);
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Image compression failed.'));
      const dataReader = new FileReader();
      dataReader.onload = () => resolve({ blob, dataUrl: dataReader.result });
      dataReader.onerror = () => reject(new Error('Failed to read compressed image.'));
      dataReader.readAsDataURL(blob);
    }, 'image/webp', WEBP_QUALITY);
  };

  reader.onload = () => { image.src = reader.result; };
  reader.onerror = () => reject(new Error('Failed to load selected image.'));
  reader.readAsDataURL(file);
});

const downloadAsUploadedPhoto = (blob, originalName) => {
  const safeName = (originalName || 'event-image')
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename = `uploaded event photos/${safeName || 'event'}-${Date.now()}.webp`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

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
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const { blob, dataUrl } = await processImageFile(file);
      setEventForm({ ...eventForm, imageUrl: dataUrl, imageFile: file });
      downloadAsUploadedPhoto(blob, file.name);
    } catch (error) {
      console.error('Image processing failed:', error);
      alert('Unable to process this image. Please try a different file or check the file type.');
    }
    e.target.value = '';
  };
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
        <Form.Label>Event Image/Flyer URL</Form.Label>
        <Form.Control
          type="text"
          value={eventForm.imageUrl || ''}
          onChange={(e) => {
            const newUrl = e.target.value;
            console.log('Image URL changed to:', newUrl);
            setEventForm({ ...eventForm, imageUrl: newUrl });
          }}
          placeholder="https://... or /images/Event Flyers/your-image.jpg"
        />
        <Form.Text className="text-muted">
          Enter a full URL or a path like /images/Event Flyers/filename.jpg (after placing the file in that folder)
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Or Upload Image File</Form.Label>
        <Form.Control
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
        />
        <Form.Text className="text-muted">
          For small images only (&lt;750KB). For larger images, manually place them in public/images/Event Flyers/ and use the URL field above.
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

      {/* RSVP Sources - website RSVP is always enabled; users can optionally enable OneTable */}
      <Form.Group className="mb-3">
        <Form.Label>RSVP to this event through:</Form.Label>
        <div className="d-flex gap-3 align-items-center">
          <div>
            <strong>This website</strong>
            <div className="text-muted small">(always enabled)</div>
          </div>
          <Form.Check
            type="checkbox"
            id="rsvpOneTable"
            label="OneTable"
            checked={!!eventForm.rsvpSources?.oneTable}
            onChange={(e) => setEventForm({ 
              ...eventForm, 
              // keep website RSVP always true
              rsvpSources: { website: true, oneTable: e.target.checked } 
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
