# Refactoring Summary

## Changes Made

### 1. Created Shared Event Form Component

**File:** `src/components/EventFormFields.js`

- Extracted all event form fields into a reusable component
- Handles all event creation/editing fields:
  - Title, Date, Time (hour, minute, period)
  - Location, Description, Capacity
  - RSVP Sources (Website, OneTable)
  - OneTable Link (conditional)
  - RSVP Approval Mode
  - Capacity Limit Toggle
- Props: `eventForm`, `setEventForm`, `showCapacityToggle`,
  `handleToggleCapacityLimit`

### 2. Refactored Admin.js

**Changes:**

- Added `EventFormFields` component import
- Replaced ~150 lines of duplicate form JSX with component call
- Updated state structure:
  - `eventForm.ampm` → `eventForm.period` (standardized)
  - Added `eventForm.rsvpSources` object:
    `{ website: boolean, oneTable: boolean }`
  - Added `eventForm.oneTableLink` field
  - Added `eventForm.limitCapacity` field
  - Added `managerForm` state: `{ email, password, displayName }`
  - Added `showManagerModal` boolean
- Updated handlers:
  - `handleEventSubmit`: Uses `period` instead of `ampm`
  - `handleEditEvent`: Maps legacy `requireRSVP` to `rsvpSources.website` for
    backward compatibility
  - `resetEventForm`: Initializes with new field structure
  - Added `handleManagerSubmit`: Creates manager accounts via API
- Added UI:
  - "Create Manager" button in header
  - Manager creation modal with email/password/displayName form

### 3. Refactored Events.js

**Changes:**

- Added `EventFormFields` component import
- Replaced ~150 lines of duplicate form JSX with component call
- Updated state structure to match Admin.js
- Updated handlers to use new field structure

### 4. Refactored Manager.js

**Changes:**

- Added `EventFormFields` component import
- Replaced ~150 lines of duplicate form JSX with component call
- Updated state structure to match Admin.js and Events.js
- Updated handlers:
  - `handleEditEvent`: Maps legacy `requireRSVP` to `rsvpSources.website`
  - Added `handleToggleCapacityLimit` function
  - `resetEventForm`: Uses new field structure

### 5. Added Manager Account Creation API

**File:** `api/create-manager.js`

- Vercel serverless function for creating manager accounts
- Uses Firebase Admin SDK to:
  - Create user with email/password
  - Set custom claim: `isManager: true`
- Handles validation and error cases
- Requires environment variables:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_CLIENT_EMAIL`
  - `FIREBASE_PRIVATE_KEY`

**File:** `api/package.json`

- Added `firebase-admin` dependency: `^12.0.0`

## Benefits

### Code Quality

- **DRY Principle:** Eliminated ~450 lines of duplicate code across 3 files
- **Single Source of Truth:** All event form fields defined in one place
- **Consistency:** Standardized field names and structure across all pages
- **Maintainability:** Changes to form fields only need to be made once

### Features

- **RSVP Sources:** All admin pages now support Website/OneTable RSVP options
- **Manager Creation:** Admin can create manager accounts with custom
  credentials
- **Backward Compatibility:** Legacy events with `requireRSVP` properly mapped
  to new `rsvpSources` structure

## Deployment Requirements

### Firebase Admin Setup (for Manager Creation)

You need to add these environment variables to your Vercel project:

1. Go to your Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key" and download the JSON file
3. Add these environment variables to Vercel:
   - `FIREBASE_PROJECT_ID`: Found in the JSON (project_id)
   - `FIREBASE_CLIENT_EMAIL`: Found in the JSON (client_email)
   - `FIREBASE_PRIVATE_KEY`: Found in the JSON (private_key) - paste the entire
     key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

### Vercel Settings

```bash
# In your Vercel project dashboard:
Settings → Environment Variables → Add:

Name: FIREBASE_PROJECT_ID
Value: your-project-id

Name: FIREBASE_CLIENT_EMAIL
Value: firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com

Name: FIREBASE_PRIVATE_KEY
Value: -----BEGIN PRIVATE KEY-----\nYour Key Here...\n-----END PRIVATE KEY-----
```

### Install API Dependencies

```bash
cd api
npm install
```

## Testing

### Event Form Testing

1. **Admin Page:**

   - Create a new event with Website RSVP only
   - Create a new event with OneTable RSVP only
   - Create a new event with both RSVP sources
   - Edit an existing event and verify fields populate correctly
   - Toggle capacity limit and verify it saves

2. **Events Page:**

   - Same tests as Admin page
   - Verify public-facing event creation works

3. **Manager Page:**
   - Same tests as Admin page
   - Verify managers can create/edit events

### Manager Creation Testing

1. **Admin Page:**

   - Click "Create Manager" button
   - Fill in display name, email, and password (min 6 chars)
   - Submit and verify success message
   - Try to login with the new manager credentials at `/login`
   - Verify manager can access Manager page but not Admin page

2. **Error Cases:**
   - Try creating manager with existing email (should show error)
   - Try creating manager with password < 6 chars (should show error)
   - Try creating manager with invalid email format (should show error)

## Data Structure Changes

### Event Document (Firestore)

```javascript
{
  title: string,
  date: string,  // YYYY-MM-DD format
  time: string,  // "6:30 PM" format
  hour: string,
  minute: string,
  period: string,  // "AM" or "PM" (was "ampm" in old structure)
  location: string,
  description: string,
  capacity: number,

  // New RSVP structure (backward compatible)
  rsvpSources: {
    website: boolean,
    oneTable: boolean
  },
  oneTableLink: string,  // Only if rsvpSources.oneTable is true

  rsvpApprovalMode: string,  // "immediate" or "approval"
  limitCapacity: boolean

  // Legacy fields (still read for backward compatibility)
  // requireRSVP: boolean  // Mapped to rsvpSources.website if present
}
```

### User Document (Firebase Auth Custom Claims)

```javascript
{
  isAdmin: boolean,   // Existing
  isManager: boolean  // New - set by create-manager API
}
```

## Notes

- The `EventFormFields` component is fully controlled by parent components
- Legacy events with `requireRSVP` field are automatically mapped to
  `rsvpSources.website`
- OneTable link field only appears when OneTable RSVP source is selected
- Manager creation requires Firebase Admin SDK, which runs server-side in Vercel
  functions
- All three admin pages (Admin, Manager, Events) now use identical form fields
