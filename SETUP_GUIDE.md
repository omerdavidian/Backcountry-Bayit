# BCB Website - Quick Setup Guide

## 🚀 Quick Start

1. **Start Development Server**
   ```bash
   cd bcb-website
   npm start
   ```
   Opens at http://localhost:3000

2. **Build for Production**
   ```bash
   npm run build
   ```

## 🔥 Firebase Setup (Required)

### Step 1: Create Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Add Project"
3. Name it "backcountry-bayit" (or your choice)
4. Follow the setup wizard

### Step 2: Enable Services
1. **Authentication**:
   - Go to Build → Authentication
   - Click "Get Started"
   - Enable "Email/Password" sign-in method

2. **Firestore Database**:
   - Go to Build → Firestore Database
   - Click "Create database"
   - Start in **test mode** (we'll add security rules later)
   - Choose your region (us-central recommended)

### Step 3: Get Firebase Config
1. Go to Project Settings (⚙️ icon)
2. Scroll to "Your apps" → Click web icon (</>)
3. Register app (nickname: "BCB Website")
4. Copy the firebaseConfig object

### Step 4: Update Firebase Configuration
Edit `src/config/firebase.js` and replace:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Step 5: Add Security Rules
In Firestore → Rules tab, paste:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Events: public read, managers can write
    match /events/{eventId} {
      allow read: if true;
      allow write: if request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager');
    }

    // RSVPs: public create, managers can read
    match /rsvps/{rsvpId} {
      allow create: if true;
      allow read: if request.auth != null &&
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
         get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'manager');
    }

    // Users: only admins can read/write
    match /users/{userId} {
      allow read, write: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

### Step 6: Create Admin User
1. **Add Authentication User**:
   - Go to Authentication → Users
   - Click "Add user"
   - Email: your.email@bcbayit.org
   - Password: (create secure password)
   - Copy the **User UID** (you'll need this)

2. **Add User Role**:
   - Go to Firestore Database
   - Create collection: `users`
   - Add document with ID = the User UID you copied
   - Add field:
     - Field: `role`
     - Type: `string`
     - Value: `admin`
   - Add another field:
     - Field: `email`
     - Type: `string`
     - Value: `your.email@bcbayit.org`

## 🌐 Deploy to Vercel

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - BCB Website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bcb-website.git
git push -u origin main
```

### Step 2: Deploy on Vercel
1. Go to https://vercel.com
2. Sign up/Login with GitHub
3. Click "New Project"
4. Import your `bcb-website` repository
5. Vercel auto-detects React settings
6. Click "Deploy"

### Step 3: Add Custom Domain
1. In Vercel project → Settings → Domains
2. Add `backcountrybayit.com`
3. Follow DNS configuration:
   - Add A record pointing to Vercel's IP
   - Or add CNAME pointing to `cname.vercel-dns.com`
4. Wait for DNS propagation (5-30 minutes)

## 📧 Email Setup (ImprovMX)

1. Go to https://improvmx.com
2. Sign up free
3. Add domain: `backcountrybayit.com` (or `bcbayit.org`)
4. Create alias: `info@bcbayit.org` → your.personal@email.com
5. Update DNS records as shown:
   - MX record: `mx1.improvmx.com` (priority 10)
   - MX record: `mx2.improvmx.com` (priority 20)

## 📝 Testing Locally

1. **Test without Firebase**:
   - The site will work with sample data
   - Login and Events won't persist

2. **Test with Firebase**:
   - Complete Firebase setup above
   - Restart dev server
   - Login at http://localhost:3000/login
   - Access admin at http://localhost:3000/admin

## 🎯 Next Steps

1. ✅ Complete Firebase setup
2. ✅ Create admin user
3. ✅ Deploy to Vercel
4. ✅ Configure domain
5. ✅ Set up email forwarding
6. ✅ Add first events in admin panel
7. ✅ Test RSVP functionality
8. ✅ Share with community!

## 🆘 Troubleshooting

**Issue**: "Module not found" errors
- **Fix**: Run `npm install` to ensure all dependencies are installed

**Issue**: Firebase errors in console
- **Fix**: Make sure you've updated `src/config/firebase.js` with your config

**Issue**: Can't login to admin
- **Fix**: Check that you've created a user in Firebase Auth AND added their role in Firestore `users` collection

**Issue**: RSVPs not saving
- **Fix**: Check Firestore security rules are properly set

**Issue**: Images not loading
- **Fix**: Make sure images are in `public/images/` folder

## 📞 Need Help?

Contact: info@bcbayit.org

---

**Good luck with your website! 🏔️ ✡️**
