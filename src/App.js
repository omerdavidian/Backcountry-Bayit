import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { AuthProvider } from './utils/AuthContext';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/theme.css';

// Route-level code splitting: each page loads in its own chunk on demand,
// keeping the initial bundle small (the heavy Events/calendar page especially).
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Events = lazy(() => import('./pages/Events'));
const Donate = lazy(() => import('./pages/Donate'));
const Contact = lazy(() => import('./pages/Contact'));
const Login = lazy(() => import('./pages/Login'));
const Admin = lazy(() => import('./pages/Admin'));
const Manager = lazy(() => import('./pages/Manager'));
const EventRSVPs = lazy(() => import('./pages/EventRSVPs'));
const Zelle = lazy(() => import('./pages/Zelle'));

const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center py-5" style={{ minHeight: '50vh' }}>
    <Spinner animation="border" role="status" variant="primary">
      <span className="visually-hidden">Loading…</span>
    </Spinner>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="d-flex flex-column min-vh-100">
          <Navigation />
          <main className="flex-grow-1">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/about" element={<About />} />
                <Route path="/events" element={<Events />} />
                <Route path="/donate" element={<Donate />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/manager" element={<Manager />} />
                <Route path="/admin/rsvps/:eventId/:eventName" element={<EventRSVPs />} />
                <Route path="/zelle" element={<Zelle />} />
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
