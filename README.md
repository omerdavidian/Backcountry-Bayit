# Backcountry Bayit Website

A modern, responsive website for Backcountry Bayit - a vibrant Jewish community in Frisco, Colorado. Built with React, Bootstrap, and Firebase.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## ✨ Features

- **Home Page**: Hero section with stunning imagery and call-to-action buttons
- **About Page**: Community story, mission, and values
- **Events Calendar**: Interactive calendar with FullCalendar integration and RSVP functionality
- **Donate Page**: Integrated PayPal donation system (501c3 non-profit)
- **Contact Page**: Contact form with email integration
- **Admin Panel**: Secure login for managers to create/edit events and view RSVPs
- **Responsive Design**: Mobile-friendly Bootstrap design with custom BCB theme
- **Social Media Integration**: Links to Facebook and Instagram

## 🎨 Design

The website features a custom theme inspired by:
- Israeli flag colors (blue and white)
- Colorado flag colors (blue, red, gold)
- Mountain Jewish heritage
- Star of David and mountain motifs

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

---

## 🚀 Getting Started - BCB Website Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Firebase account
- Vercel account (for deployment)

### Installation Steps

1. **Install dependencies** (already done)
   ```bash
   npm install
   ```

2. **Set up environment variables**

   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your Firebase configuration and optional EmailJS settings.

3. **Run the development server**
   ```bash
   npm start
   ```

## 🔥 Firebase Setup

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** (Email/Password)
3. Enable **Firestore Database**
4. Update `src/config/firebase.js` with your credentials
5. Create Firestore collections: `events`, `rsvps`, `users`
6. Add admin users in Authentication and create corresponding documents in `users` collection with role: "admin" or "manager"

**Firestore Security Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /events/{eventId} {
      allow read: if true;
      allow write: if request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager');
    }
    match /rsvps/{rsvpId} {
      allow create: if true;
      allow read: if request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager');
    }
    match /users/{userId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## 🌐 Deployment to Vercel

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/bcb-website.git
   git push -u origin main
   ```

2. **Deploy on Vercel**
   - Go to [Vercel](https://vercel.com) and import your GitHub repo
   - Add environment variables in Vercel settings
   - Deploy!

3. **Configure custom domain**: Add `backcountrybayit.com` in Vercel settings

4. **Set up ImprovMX** for email forwarding at [ImprovMX](https://improvmx.com/)

## 📁 Project Structure

```
bcb-website/
├── public/images/       # Optimized WebP images
├── src/
│   ├── components/      # Navigation, Footer
│   ├── pages/          # Home, About, Events, Donate, Contact, Login, Admin
│   ├── config/         # Firebase configuration
│   ├── utils/          # AuthContext
│   ├── styles/         # Custom theme
│   └── App.js
├── .env.example
├── vercel.json
└── README.md
```

## 🔐 Admin Access

1. Go to `/login`
2. Log in with Firebase credentials
3. Access `/admin` to manage events and RSVPs

## 📞 Support

- Email: info@bcbayit.org
- Facebook: [BackcountryBayit](https://www.facebook.com/BackcountryBayit)
- Instagram: [@bcbayit](https://www.instagram.com/bcbayit/)

---

**Shalom from the Colorado Rockies! 🏔️ ✡️**
