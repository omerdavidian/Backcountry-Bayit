import React, {useState, useEffect, useRef} from "react";
import {Container, Row, Col, Card, Button, Modal} from "react-bootstrap";
import {Link} from "react-router-dom";
import {FaStar, FaCalendarAlt, FaHeart, FaUsers, FaMapMarkerAlt, FaClock, FaEdit} from "react-icons/fa";
import {collection, getDocs, query, orderBy, where, addDoc, updateDoc, deleteDoc, doc, serverTimestamp} from "firebase/firestore";
import {db} from "../config/firebase";
import {useAuth} from "../utils/AuthContext";
import RSVPForm from "../components/RSVPForm";

// ScrollingGallery component for continuous leftward movement with infinite loop
const ScrollingGallery = () => {
  const galleryImages = [
    {src: "/images/2024-25_season/BCB_2024-25_1.webp", pos: "center 73%"},
    {src: "/images/2024-25_season/BCB_2024-25_7.webp"},
    {src: "/images/2025-26_season/BCB_2025-26_2.webp"},
    {src: "/images/2024-25_season/BCB_2024-25_15.webp"},
    {src: "/images/2024-25_season/BCB_2024-25_22.webp", pos: "center 30%"},
    {src: "/images/2024-25_season/BCB_2024-25_27.webp", pos: "center 90%"},
    {src: "/images/2024-25_season/BCB_2024-25_50.webp", pos: "center 80%"},
    {src: "/images/2025-26_season/BCB_2025-26_1.webp"},
    {src: "/images/2025-26_season/BCB_2025-26_2.webp"},
    {src: "/images/2025-26_season/BCB_2025-26_3.webp", pos: "center 30%"}, // Using percentage for vertical alignment
    {src: "/images/2025-26_season/BCB_2025-26_4.webp", pos: "center 25%"},
    {src: "/images/2025-26_season/BCB_2025-26_5.webp", pos: "center 80%"},
  ];
  const [offset, setOffset] = useState(0);
  const [isScrollingDragging, setIsScrollingDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [prevOffset, setPrevOffset] = useState(0);

  const speed = 0.5;
  const galleryRef = useRef();

  useEffect(() => {
    let animationFrame;
    function animate() {
      if (!isScrollingDragging) {
        setOffset((prev) => {
          const gallery = galleryRef.current;
          if (!gallery) return prev;

          const singleSetWidth = gallery.scrollWidth / 3;

          let nextOffset = prev - speed;
          if (Math.abs(nextOffset) >= singleSetWidth) {
            nextOffset += singleSetWidth;
          }
          return nextOffset;
        });
      }
      animationFrame = requestAnimationFrame(animate);
    }
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isScrollingDragging]);

  const handleDragStart = (e) => {
    setIsScrollingDragging(true);
    const clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
    setPrevOffset(offset);
  };

  const handleDragMove = (e) => {
    if (!isScrollingDragging) return;

    const clientX = e.type.includes("touch") ? e.touches[0].clientX : e.clientX;
    const diff = clientX - dragStartX;

    setOffset(() => {
      const gallery = galleryRef.current;
      if (!gallery) return prevOffset + diff;

      const singleSetWidth = gallery.scrollWidth / 3;
      let nextOffset = prevOffset + diff;

      // Handle infinite loop logic while dragging
      if (nextOffset > 0) {
        nextOffset -= singleSetWidth;
      } else if (Math.abs(nextOffset) >= singleSetWidth) {
        nextOffset += singleSetWidth;
      }

      return nextOffset;
    });
  };

  const handleDragEnd = () => {
    setIsScrollingDragging(false);
  };

  // Triple the images for seamless infinite scroll
  const allImages = [...galleryImages, ...galleryImages, ...galleryImages];

  return (
    <div
      style={{
        width: "100vw",
        overflow: "hidden",
        position: "relative",
        height: 220,
        margin: 0,
        padding: 0,
        cursor: isScrollingDragging ? "grabbing" : "grab",
      }}
      onMouseDown={handleDragStart}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
      onTouchStart={handleDragStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}>
      <div
        ref={galleryRef}
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "2rem",
          transform: `translateX(${offset}px)`,
          willChange: "transform",
          paddingLeft: "2rem",
          paddingRight: "2rem",
          pointerEvents: "none", // Prevent image dragging/saving from interfering
          userSelect: "none",
          WebkitUserSelect: "none",
        }}>
        {allImages.map((img, idx) => (
          <img
            key={idx}
            src={img.src}
            alt={`Community Moment ${(idx % galleryImages.length) + 1}`}
            draggable="false"
            style={{
              height: 200,
              width: "auto",
              borderRadius: 16,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              objectFit: "cover",
              objectPosition: img.pos || "center",
              background: "#eee",
              minWidth: 320,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
};

function Home() {
  const {isAdmin, isManager} = useAuth();
  // Hero slider state
  const heroImages = [
    "/images/2024-25_season/BCB_2024-25_15.webp", 
    "/images/2024-25_season/BCB_2024-25_38.webp", 
    "/images/2024-25_season/BCB_2024-25_10.webp", 
    "/images/2024-25_season/BCB_2024-25_6.webp", 
    "/images/2025-26_season/BCB_2025-26_12.webp"
  ];
  const [heroIndex, setHeroIndex] = useState(0);
  // Auto-slide every 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 10000);
    return () => clearTimeout(timer);
  }, [heroIndex, heroImages.length]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [existingRSVP, setExistingRSVP] = useState(null);
  const [confirmOneTable, setConfirmOneTable] = useState(false);
  const [rsvpData, setRSVPData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    attendees: [],
    dietaryRestrictions: "",
  });
  const [rsvpStatus, setRsvpStatus] = useState({show: false, message: "", type: ""});
  const carouselRef = useRef(null);

  useEffect(() => {
    loadUpcomingEvents();
  }, []);

  // Smoothly scroll to the resident-application section and keep the URL hash in sync
  const scrollToApplication = (e) => {
    if (e) e.preventDefault();
    const el = document.getElementById("application");
    if (el) {
      el.scrollIntoView({behavior: "smooth", block: "start"});
      window.history.replaceState(null, "", "#application");
    }
  };

  // If the user lands on the homepage with #application in the URL
  // (e.g. clicking the nav button from another page), scroll to it once rendered.
  useEffect(() => {
    if (window.location.hash === "#application") {
      requestAnimationFrame(() => {
        document.getElementById("application")?.scrollIntoView({behavior: "smooth", block: "start"});
      });
    }
  }, []);

  const handleRSVPSubmit = async (e) => {
    e.preventDefault();
    try {
      const rsvpsCollection = collection(db, "rsvps");

      // Website RSVPs are always allowed. If OneTable is enabled, we still require confirmation below.

      // If OneTable is enabled, require user confirmation
      if (selectedEvent?.rsvpSources?.oneTable && !confirmOneTable) {
        setRsvpStatus({
          show: true,
          message: "Please confirm that you registered through OneTable before submitting your RSVP here.",
          type: "warning",
        });
        return;
      }

      // Check if this email already has an RSVP for this event (as primary)
      const q = query(rsvpsCollection, where("eventId", "==", selectedEvent.id), where("email", "==", rsvpData.email));
      const existingRSVPs = await getDocs(q);

      if (!existingRSVPs.empty && !existingRSVP) {
        // Found existing RSVP, load it and show update options
        const existingDoc = existingRSVPs.docs[0];
        const existingData = existingDoc.data();
        setExistingRSVP({id: existingDoc.id, ...existingData});

        // Pre-populate the form with existing data
        setRSVPData({
          firstName: existingData.firstName || "",
          lastName: existingData.lastName || "",
          email: existingData.email || "",
          phone: existingData.phone || "",
          attendees: existingData.attendees || [],
          dietaryRestrictions: existingData.dietaryRestrictions || "",
        });

        setRsvpStatus({
          show: true,
          message: `You already have an RSVP for this event. You can update your information below or unregister.`,
          type: "info",
        });
        return;
      }

      // Check if this email is registered as an attendee under someone else
      const allEventRSVPsQuery = query(rsvpsCollection, where("eventId", "==", selectedEvent.id));
      const allEventRSVPs = await getDocs(allEventRSVPsQuery);

      for (const doc of allEventRSVPs.docs) {
        const rsvp = doc.data();
        if (Array.isArray(rsvp.attendees)) {
          const foundAsAttendee = rsvp.attendees.find((att) => att.email === rsvpData.email);
          if (foundAsAttendee) {
            const primaryName = `${rsvp.firstName || ""} ${rsvp.lastName || ""}`.trim() || "Unknown";
            setRsvpStatus({
              show: true,
              message: `This email (${rsvpData.email}) is already registered for this event as an additional guest under ${primaryName} (${rsvp.email}). If you need to make changes, please contact the person who registered you.`,
              type: "warning",
            });
            return;
          }
        }
      }

      const allRSVPsQuery = query(rsvpsCollection, where("eventId", "==", selectedEvent.id));
      const allRSVPsSnapshot = await getDocs(allRSVPsQuery);

      let totalApprovedGuests = 0;
      allRSVPsSnapshot.forEach((doc) => {
        const rsvp = doc.data();
        // Skip the current user's existing RSVP when calculating capacity
        if (existingRSVP && doc.id === existingRSVP.id) return;

        if (rsvp.status === "approved" || (rsvp.status === undefined && selectedEvent.rsvpApprovalMode === "immediate")) {
          totalApprovedGuests += 1 + (rsvp.attendees?.length || 0);
        }
      });

      const requestedGuests = 1 + (rsvpData.attendees?.length || 0);
      const capacity = selectedEvent.capacity || 40;
      const isOverCapacity = selectedEvent.limitCapacity && totalApprovedGuests + requestedGuests > capacity;

      let rsvpStatus = "approved";
      let statusMessage = existingRSVP ? "Your RSVP has been updated successfully!" : "Thank you for your RSVP! We look forward to seeing you.";
      let statusType = "success";

      if (selectedEvent.rsvpApprovalMode === "approval") {
        rsvpStatus = existingRSVP?.status || "pending";
        statusMessage = existingRSVP ? "Your RSVP has been updated successfully!" : "Your RSVP has been submitted and is awaiting approval from our team. You will receive confirmation via email.";
        statusType = "info";
      } else if (isOverCapacity) {
        rsvpStatus = "waitlist";
        statusMessage = `We're sorry, but this event has reached capacity (${capacity} guests). Your RSVP has been added to the waitlist, and you'll be notified if space becomes available.`;
        statusType = "warning";
      }

      const rsvpDataToSave = {
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventDate: selectedEvent.date,
        firstName: rsvpData.firstName,
        lastName: rsvpData.lastName,
        email: rsvpData.email,
        phone: rsvpData.phone,
        attendees: rsvpData.attendees,
        dietaryRestrictions: rsvpData.dietaryRestrictions || "",
        status: rsvpStatus,
        timestamp: existingRSVP ? existingRSVP.timestamp : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (existingRSVP) {
        // Update existing RSVP
        await updateDoc(doc(db, "rsvps", existingRSVP.id), rsvpDataToSave);
      } else {
        // Create new RSVP
        await addDoc(rsvpsCollection, rsvpDataToSave);
      }

      // Send confirmation email and capture any failure message so we can inform the guest
      let emailWarning;
      try {
        const {sendRSVPConfirmationEmail} = await import("../utils/emailService");
        await sendRSVPConfirmationEmail(rsvpData, selectedEvent, rsvpStatus);
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
        emailWarning = emailError.message || "confirmation email could not be sent";
      }

      const finalMessage = emailWarning ? `${statusMessage} We could not send a confirmation email (${emailWarning}).` : statusMessage;
      const finalType = emailWarning ? "warning" : statusType;

      setRsvpStatus({
        show: true,
        message: finalMessage,
        type: finalType,
      });

      setRSVPData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        attendees: [],
        dietaryRestrictions: "",
      });

      setExistingRSVP(null);

      setTimeout(() => {
        setShowRSVPModal(false);
        setRsvpStatus({show: false, message: "", type: ""});
      }, 4000);
    } catch (error) {
      console.error("Error submitting RSVP:", error);

      // If permission denied, store a pending RSVP locally so user doesn't lose data.
      let shortMsg = error?.message ? `There was an error submitting your RSVP: ${error.message}` : "There was an error submitting your RSVP. Please try again or contact us directly.";
      if (error?.code === "permission-denied") {
        try {
          const pendingKey = "bcb_pending_rsvps";
          const existing = JSON.parse(localStorage.getItem(pendingKey) || "[]");
          existing.push({
            savedAt: new Date().toISOString(),
            eventId: selectedEvent?.id,
            eventTitle: selectedEvent?.title,
            eventDate: selectedEvent?.date,
            ...rsvpData,
          });
          localStorage.setItem(pendingKey, JSON.stringify(existing));
          shortMsg = "Permissions error: your RSVP was saved locally and will need to be resubmitted once our system permissions are updated. Please try again later or contact us directly.";
        } catch (storageError) {
          console.error("Failed to store pending RSVP locally:", storageError);
        }
      }

      setRsvpStatus({
        show: true,
        message: shortMsg,
        type: "danger",
      });
    }
  };

  const handleUnregister = async () => {
    if (!existingRSVP) return;

    if (window.confirm("Are you sure you want to unregister from this event?")) {
      try {
        await deleteDoc(doc(db, "rsvps", existingRSVP.id));

        setRsvpStatus({
          show: true,
          message: "You have been successfully unregistered from this event.",
          type: "success",
        });

        setRSVPData({
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          attendees: [],
          dietaryRestrictions: "",
        });

        setExistingRSVP(null);

        setTimeout(() => {
          setShowRSVPModal(false);
          setRsvpStatus({show: false, message: "", type: ""});
        }, 2000);
      } catch (error) {
        console.error("Error unregistering:", error);
        setRsvpStatus({
          show: true,
          message: "Error unregistering. Please try again or contact us directly.",
          type: "danger",
        });
      }
    }
  };

  // Load saved user information from localStorage
  const loadSavedUserInfo = () => {
    try {
      const savedInfo = localStorage.getItem("bcb_user_info");
      if (savedInfo) {
        const userInfo = JSON.parse(savedInfo);
        setRSVPData({
          firstName: userInfo.firstName || "",
          lastName: userInfo.lastName || "",
          email: userInfo.email || "",
          phone: userInfo.phone || "",
          attendees: [],
          dietaryRestrictions: "",
        });
      }
    } catch (error) {
      console.error("Error loading saved user info:", error);
    }
  };

  // Intentionally no saveUserInfo function; we no longer persist user info from this form.

  // Mouse/Touch drag handlers
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed multiplier
    carouselRef.current.scrollLeft = scrollLeft - walk;
  };

  // Arrow button handlers
  const scrollToLeft = () => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth / 3;
      carouselRef.current.scrollBy({left: -cardWidth, behavior: "smooth"});
    }
  };

  const scrollToRight = () => {
    if (carouselRef.current) {
      const cardWidth = carouselRef.current.offsetWidth / 3;
      carouselRef.current.scrollBy({left: cardWidth, behavior: "smooth"});
    }
  };

  const loadUpcomingEvents = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // 1. Fetch from Google Calendar API
      let apiEvents = [];
      try {
        const response = await fetch("/api/events");
        if (response.ok) {
          const data = await response.json();
          apiEvents = data.events.map((event) => {
            const startDate = new Date(event.start);
            const dateStr = event.start.split("T")[0];
            const timeStr = startDate.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });
            return {
              ...event,
              date: dateStr,
              time: timeStr,
              capacity: event.capacity || 40,
              rsvpSources: event.rsvpSources || {website: true, oneTable: false},
              source: "google",
            };
          });
        }
      } catch (err) {
        console.error("Error fetching API events:", err);
      }

      // 2. Fetch from Firestore (Legacy)
      let firestoreEvents = [];
      try {
        const todayStr = today.toISOString().split("T")[0];
        const eventsCollection = collection(db, "events");
        const q = query(eventsCollection, where("date", ">=", todayStr), orderBy("date", "asc"));
        const querySnapshot = await getDocs(q);
        firestoreEvents = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          source: "firestore",
        }));
      } catch (err) {
        console.error("Error fetching Firestore events:", err);
      }

      // 3. Merge and Deduplicate
      // Prefer API events if duplicates exist (to ensure fresh data from Google Calendar)
      const apiMap = new Map();
      apiEvents.forEach((e) => {
        const key = `${e.date}_${e.title}`.toLowerCase();
        apiMap.set(key, e);
      });

      const uniqueFirestoreEvents = firestoreEvents.filter((e) => {
        const key = `${e.date}_${e.title}`.toLowerCase();
        return !apiMap.has(key);
      });

      let allEvents = [...apiEvents, ...uniqueFirestoreEvents];

      // 4. Filter for upcoming only (API returns all events, so we must filter here)
      allEvents = allEvents.filter((event) => {
        if (!event.date) return false;

        // Parse date as local time to avoid timezone issues
        let eventDate;
        if (typeof event.date === "string" && event.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [y, m, d] = event.date.split("-").map(Number);
          eventDate = new Date(y, m - 1, d);
        } else {
          eventDate = new Date(event.date);
        }

        // Set to midnight for comparison
        eventDate.setHours(0, 0, 0, 0);

        return eventDate >= today;
      });

      // 5. Sort by date
      allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

      setUpcomingEvents(allEvents);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatEventDateTime = (event) => {
    // Parse date as local date to avoid UTC timezone shift
    let date;
    if (typeof event.date === "string") {
      const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.test(event.date);
      if (dateOnlyMatch) {
        const [y, m, day] = event.date.split("-").map(Number);
        date = new Date(y, m - 1, day);
      } else {
        date = new Date(event.date);
      }
    } else if (event.date?.toDate) {
      date = event.date.toDate();
    } else if (event.date instanceof Date) {
      date = event.date;
    } else {
      date = new Date(event.date);
    }

    const dateStr = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    // Build a robust time string that avoids "undefined"
    const pad2 = (v) => `${v}`.padStart(2, "0");
    let rawHour = event?.hour;
    let rawMinute = event?.minute;
    let period = (event?.period || "").toString().trim().toUpperCase();

    // If period (or hour/minute) missing but combined time exists, parse it
    if ((!period || !rawHour || !rawMinute) && typeof event?.time === "string") {
      const match = event.time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
      if (match) {
        if (!rawHour) rawHour = match[1];
        if (!rawMinute) rawMinute = match[2];
        if (!period) period = match[3].toUpperCase();
      }
    }

    const hasHour = rawHour !== undefined && rawHour !== null && rawHour !== "";
    let hourNum = hasHour ? Number(rawHour) : NaN;
    let minute = rawMinute !== undefined && rawMinute !== null && rawMinute !== "" ? pad2(rawMinute) : "00";

    // Derive AM/PM only if still missing AND hour seems to be 24h style
    if (!period && !Number.isNaN(hourNum)) {
      if (hourNum === 0) {
        period = "AM";
        hourNum = 12;
      } else if (hourNum < 12) {
        period = "AM";
      } else if (hourNum === 12) {
        period = "PM";
      } else {
        period = "PM";
        hourNum = hourNum - 12;
      }
    }

    let timeStr = "Time TBD";
    if (!Number.isNaN(hourNum)) {
      const displayHour = Math.max(1, Math.min(12, hourNum));
      timeStr = `${displayHour}:${minute}${period ? " " + period : ""}`.trim();
    } else if (event?.time) {
      timeStr = event.time; // final fallback keeps original string
    }

    return {dateStr, timeStr};
  };

  // chunkArray removed (unused) to satisfy lint rules

  const toMountainTime = (date) => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Denver",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year").value;
    const month = parts.find((p) => p.type === "month").value - 1;
    const day = parts.find((p) => p.type === "day").value;
    return new Date(year, month, day);
  };

  // helper to normalize various date formats and check if an event date is today (local timezone)
  const isEventToday = (eventDate) => {
    if (!eventDate) return false;

    const toDate = (d) => {
      if (!d) return null;
      if (d instanceof Date) return d;
      if (typeof d === "string") {
        const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(d);
        if (dateOnlyMatch) {
          const [y, m, day] = d.split("-").map(Number);
          return new Date(y, m - 1, day);
        }
        return new Date(d);
      }
      if (typeof d.toDate === "function") return d.toDate();
      if (typeof d.seconds === "number") return new Date(d.seconds * 1000);
      return new Date(d);
    };

    const today = toMountainTime(new Date());
    const d = toMountainTime(toDate(eventDate));
    if (!d || Number.isNaN(d.getTime())) return false;

    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  };

  const isEventTomorrow = (eventDate) => {
    if (!eventDate) return false;

    const toDate = (d) => {
      if (!d) return null;
      if (d instanceof Date) return d;
      if (typeof d === "string") {
        const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(d);
        if (dateOnlyMatch) {
          const [y, m, day] = d.split("-").map(Number);
          return new Date(y, m - 1, day);
        }
        return new Date(d);
      }
      if (typeof d.toDate === "function") return d.toDate();
      if (typeof d.seconds === "number") return new Date(d.seconds * 1000);
      return new Date(d);
    };

    const today = toMountainTime(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const d = toMountainTime(toDate(eventDate));
    if (!d || Number.isNaN(d.getTime())) return false;

    return d.getFullYear() === tomorrow.getFullYear() && d.getMonth() === tomorrow.getMonth() && d.getDate() === tomorrow.getDate();
  };

  return (
    <div>
      {/* Hero Section Slider */}
      <section
        className="hero-section"
        style={{
          position: "relative",
          minHeight: "500px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
        {/* Blurred background image for current slide with zoom and fade effect */}
        <div
          key={heroIndex}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage: `url(${heroImages[heroIndex]})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(4px)",
            zIndex: 1,
            animation: `${heroIndex % 2 === 0 ? "zoomInFade" : "zoomOutFade"} 10s ease-in-out`,
          }}
        />
        {/* Semi-transparent overlay for extra contrast */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 32, 0.45)",
            zIndex: 2,
          }}
        />
        {/* Main hero content */}
        <div className="hero-content" style={{position: "relative", zIndex: 3, width: "100%"}}>
          <h1 className="display-3 fw-bold mb-4 text-center">Welcome to the Backcountry Bayit</h1>
          <p className="lead mb-4 text-center" style={{fontSize: "1.5rem"}}>
            A vibrant Jewish community for people in their 20's and 30's in Frisco, Colorado
          </p>
          <div className="star-decoration text-center">✡</div>
          <p className="mt-4 mb-4 text-center" style={{fontSize: "1.2rem"}}>
            Join other young adults for Shabbat dinners and seasonal socials
            <br />
            November through April
          </p>
          <div className="d-flex gap-3 justify-content-center flex-wrap mb-4">
            <Button as={Link} to="/events" variant="light" size="md" className="px-3 py-2">
              <FaCalendarAlt className="me-2" />
              View Events
            </Button>
            <Button as={Link} to="/donate" className="donate-btn px-3 py-2">
              <FaHeart className="me-2" />
              Support Our Community
            </Button>
            {/* Temporary: 2026-27 resident application */}
            <Button
              href="#application"
              onClick={scrollToApplication}
              size="md"
              className="px-3 py-2 fw-bold"
              style={{background: "linear-gradient(90deg, #0074d9, #00a8ff)", border: "none"}}>
              <FaEdit className="me-2" />
              2026-27 Application
            </Button>
          </div>
          {/* Modern Navigation dots */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
              marginTop: "2rem",
              alignItems: "center",
            }}>
            {heroImages.map((img, idx) => (
              <button
                key={img}
                onClick={() => setHeroIndex(idx)}
                style={{
                  position: "relative",
                  width: idx === heroIndex ? "40px" : "12px",
                  height: "12px",
                  borderRadius: "6px",
                  border: "none",
                  background: idx === heroIndex ? "linear-gradient(90deg, #0074d9, #00a8ff)" : "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  outline: "none",
                  transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  transform: idx === heroIndex ? "scale(1.1)" : "scale(1)",
                  boxShadow: idx === heroIndex ? "0 4px 12px rgba(0, 116, 217, 0.4)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (idx !== heroIndex) {
                    e.target.style.background = "rgba(255,255,255,0.8)";
                    e.target.style.transform = "scale(1.2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (idx !== heroIndex) {
                    e.target.style.background = "rgba(255,255,255,0.5)";
                    e.target.style.transform = "scale(1)";
                  }
                }}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {/* CSS Animation Keyframes */}
        <style>{`
          @keyframes zoomInFade {
            0% {
              opacity: 0;
              transform: scale(1.1);
            }
            3% {
              opacity: 1;
            }
            97% {
              opacity: 1;
              transform: scale(1.25);
            }
            100% {
              opacity: 0;
              transform: scale(1.25);
            }
          }
          
          @keyframes zoomOutFade {
            0% {
              opacity: 0;
              transform: scale(1.25);
            }
            3% {
              opacity: 1;
            }
            97% {
              opacity: 1;
              transform: scale(1.1);
            }
            100% {
              opacity: 0;
              transform: scale(1.1);
            }
          }
        `}</style>
      </section>

      {/* Resident Application Section */}
      <section id="application" className="py-5" style={{background: "linear-gradient(135deg, #eaf2ff 0%, #fdfbf7 60%)"}}>
        <Container>
          <div
            className="application-card overflow-hidden rounded-4"
            style={{
              background: "#fff",
              boxShadow: "0 24px 60px rgba(0, 36, 84, 0.18)",
              border: "1px solid rgba(0, 116, 217, 0.12)",
            }}>
            <Row className="g-0 align-items-stretch">
              <Col lg={6} className="p-4 p-md-5 d-flex flex-column justify-content-center">
                <span
                  className="align-self-start d-inline-flex align-items-center mb-3"
                  style={{
                    background: "linear-gradient(90deg, #0074d9, #00a8ff)",
                    color: "white",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    padding: "0.45rem 1rem",
                    borderRadius: "999px",
                    boxShadow: "0 4px 12px rgba(0, 116, 217, 0.35)",
                  }}>
                  <span className="application-pulse" />
                  NOW ACCEPTING APPLICATIONS
                </span>
                <h2 className="text-start mb-3" style={{fontWeight: 800, color: "#001f54", lineHeight: 1.15}}>
                  Live at the Bayit
                  <br />
                  <span style={{color: "var(--bcb-blue)"}}>2026&ndash;2027 Season</span>
                </h2>
                <p className="lead mb-3">
                  We&apos;re looking for community-oriented individuals or couples to call the Backcountry Bayit in Frisco, Colorado home for the winter season.
                </p>
                <p className="mb-4 text-muted">
                  As a resident, you&apos;ll help create a warm and welcoming environment by hosting weekly Shabbat dinners, holiday celebrations, and outdoor adventures with our community of young Jewish adults in the mountains.
                </p>
                <Row className="g-3 mb-4">
                  <Col xs={6}>
                    <div className="h-100 p-3 rounded-3" style={{background: "#f4f8ff"}}>
                      <FaCalendarAlt className="mb-2" style={{color: "var(--bcb-blue)", fontSize: "1.4rem"}} />
                      <div className="fw-bold" style={{fontSize: "0.95rem"}}>Season Dates</div>
                      <div className="text-muted" style={{fontSize: "0.9rem"}}>Nov 1, 2026 &ndash; Apr 30, 2027</div>
                    </div>
                  </Col>
                  <Col xs={6}>
                    <div className="h-100 p-3 rounded-3" style={{background: "#f4f8ff"}}>
                      <FaMapMarkerAlt className="mb-2" style={{color: "var(--bcb-blue)", fontSize: "1.4rem"}} />
                      <div className="fw-bold" style={{fontSize: "0.95rem"}}>Location</div>
                      <div className="text-muted" style={{fontSize: "0.9rem"}}>Frisco, Colorado</div>
                    </div>
                  </Col>
                </Row>
                <div className="d-flex flex-wrap gap-3">
                  <Button
                    href="https://docs.google.com/forms/d/1NUueH0-xPTwAIZIZuZk_X-s1kyB61NQfP5RQRbCT77Q/viewform"
                    target="_blank"
                    rel="noreferrer"
                    variant="primary"
                    size="lg"
                    className="px-4 fw-bold">
                    <FaEdit className="me-2" />
                    Apply Now
                  </Button>
                  <Button as={Link} to="/about" variant="outline-primary" size="lg" className="px-4">
                    Learn More
                  </Button>
                </div>
              </Col>
              <Col lg={6} className="position-relative" style={{minHeight: "340px"}}>
                <img
                  src="/images/BCB_Backyard.webp"
                  alt="The Backcountry Bayit backyard in Frisco, Colorado"
                  className="w-100 h-100"
                  style={{objectFit: "cover", display: "block"}}
                />
              </Col>
            </Row>
          </div>
        </Container>

        <style>{`
          .application-pulse {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #fff;
            margin-right: 0.55rem;
            box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.8);
            animation: applicationPulse 1.8s infinite;
          }
          @keyframes applicationPulse {
            0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.7); }
            70% { box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
            100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); }
          }
        `}</style>
      </section>

      {/* About Section */}
      <section className="py-5 bg-light">
        <Container>
          <Row className="align-items-center">
            <Col md={6} className="mb-4 mb-md-0">
              <img src="/images/2024-25_season/BCB_2024-25_15.webp" alt="BCB Community" className="img-fluid rounded shadow-lg" />
            </Col>
            <Col md={6}>
              <h2 className="section-title text-start">About Backcountry Bayit</h2>
              <p className="lead">Since 2016, the Backcountry Bayit has been bringing the warmth of Jewish tradition to the Colorado mountains.</p>
              <p>We create meaningful connections through shared meals, holiday celebrations, and community gatherings. Whether you're a local resident or visiting for the ski season, you'll find a welcoming home away from home.</p>
              <Button as={Link} to="/about" variant="primary" size="lg" className="mt-3">
                Learn More About Us
              </Button>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Upcoming Events Carousel */}
      {!loading && upcomingEvents.length > 0 && (
        <section className="py-5">
          <Container>
            <h2 className="section-title text-center mb-5">Upcoming Events</h2>
            <div className="position-relative">
              {upcomingEvents.length > 3 && (
                <>
                  <button className="carousel-arrow carousel-arrow-left" onClick={scrollToLeft} aria-label="Scroll left">
                    ‹
                  </button>
                  <button className="carousel-arrow carousel-arrow-right" onClick={scrollToRight} aria-label="Scroll right">
                    ›
                  </button>
                </>
              )}
              <div className="events-scroll-container" ref={carouselRef} onMouseDown={handleMouseDown} onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} onMouseMove={handleMouseMove} style={{cursor: isDragging ? "grabbing" : "grab"}}>
                <div className="events-scroll-track">
                  {upcomingEvents.map((event) => {
                    const {dateStr, timeStr} = formatEventDateTime(event);
                    return (
                      <div key={event.id} className="event-card-wrapper">
                        <Card className="h-100 card-hover border-0 shadow">
                          <Card.Body className="d-flex flex-column">
                            {isEventToday(event.date) && (
                              <div className="mb-3 text-center">
                                <span className="badge bg-success" style={{fontSize: "0.9rem", padding: "0.5rem 1rem"}}>
                                  Today
                                </span>
                              </div>
                            )}
                            {!isEventToday(event.date) && isEventTomorrow(event.date) && (
                              <div className="mb-3 text-center">
                                <span className="badge bg-info" style={{fontSize: "0.9rem", padding: "0.5rem 1rem"}}>
                                  Tomorrow
                                </span>
                              </div>
                            )}
                            <div className="text-center mb-3" style={{fontSize: "2.5rem", color: "var(--bcb-blue)"}}>
                              <FaCalendarAlt />
                            </div>
                            <Card.Title as="h4" className="text-center mb-3">
                              {event.title}
                            </Card.Title>
                            <Card.Text className="mb-2">
                              <FaClock className="me-2" style={{color: "var(--bcb-blue)"}} />
                              <strong>{dateStr}</strong>
                            </Card.Text>
                            <Card.Text className="mb-2">
                              <FaClock className="me-2" style={{color: "var(--bcb-blue)"}} />
                              {timeStr}
                            </Card.Text>
                            {event.location && (
                              <Card.Text className="mb-3">
                                <FaMapMarkerAlt className="me-2" style={{color: "var(--bcb-blue)"}} />
                                {event.location}
                              </Card.Text>
                            )}
                            <div className="mt-auto text-center">
                              <Button
                                variant="primary"
                                className="w-100"
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setExistingRSVP(null);
                                  setRsvpStatus({show: false, message: "", type: ""});
                                  loadSavedUserInfo();
                                  setConfirmOneTable(false);
                                  setShowRSVPModal(true);
                                }}>
                                View Details & RSVP
                              </Button>
                              {(isAdmin || isManager) && (
                                <Button variant="outline-primary" as={Link} to="/manager" state={{editEvent: event}} className="w-100 mt-2">
                                  <FaEdit className="me-2" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          </Card.Body>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="text-center mt-4">
              <Button as={Link} to="/events" variant="outline-primary" size="lg">
                View All Events
              </Button>
            </div>
          </Container>
        </section>
      )}

      {/* Features Section */}
      <section className="py-5">
        <Container>
          <h2 className="section-title text-center mb-5">What We Offer</h2>
          <Row className="g-4">
            <Col md={4}>
              <Card className="h-100 text-center card-hover border-0 shadow">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{fontSize: "3rem", color: "var(--bcb-blue)"}}>
                    <FaStar />
                  </div>
                  <Card.Title as="h4">Shabbat Dinners</Card.Title>
                  <Card.Text>Join us for traditional Friday night Shabbat dinners with delicious food, wine, and wonderful company in a warm, welcoming atmosphere.</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 text-center card-hover border-0 shadow">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{fontSize: "3rem", color: "var(--bcb-blue)"}}>
                    <FaCalendarAlt />
                  </div>
                  <Card.Title as="h4">Holiday Celebrations</Card.Title>
                  <Card.Text>Experience meaningful holiday observances including Chanukah, Purim, Passover, and more, bringing ancient traditions to life in the mountains.</Card.Text>
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="h-100 text-center card-hover border-0 shadow">
                <Card.Body className="p-4">
                  <div className="mb-3" style={{fontSize: "3rem", color: "var(--bcb-blue)"}}>
                    <FaUsers />
                  </div>
                  <Card.Title as="h4">Community Building</Card.Title>
                  <Card.Text>Connect with fellow Jewish community members, both locals and visitors, creating lasting friendships and memories in the beautiful Colorado backcountry.</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Photo Gallery Preview - Scrolling */}
      <section className="py-5 bg-light" style={{overflow: "hidden"}}>
        <h2 className="section-title text-center mb-5">Community Moments</h2>
        <ScrollingGallery />
      </section>

      {/* Call to Action */}
      <section className="py-5 bg-gradient-primary text-white">
        <Container className="text-center">
          <h2 className="display-5 fw-bold mb-4">Help Us Grow Our Community</h2>
          <p className="lead mb-4">Your donation helps us continue hosting meaningful gatherings and building Jewish life in the Colorado mountains.</p>
          <Button as={Link} to="/donate" variant="light" size="lg" className="px-5 py-3">
            <FaHeart className="me-2" />
            Donate Now
          </Button>
        </Container>
      </section>

      {/* RSVP Modal */}
      <Modal
        show={showRSVPModal}
        onHide={() => {
          setShowRSVPModal(false);
          setExistingRSVP(null);
          setRsvpStatus({show: false, message: "", type: ""});
          setConfirmOneTable(false);
        }}
        size="lg">
        <Modal.Header closeButton>
          <Modal.Title>RSVP for {selectedEvent?.title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <RSVPForm
            selectedEvent={selectedEvent}
            rsvpData={rsvpData}
            setRSVPData={setRSVPData}
            handleRSVPSubmit={handleRSVPSubmit}
            existingRSVP={existingRSVP}
            handleUnregister={handleUnregister}
            onCancel={() => {
              setShowRSVPModal(false);
              setExistingRSVP(null);
              setRsvpStatus({show: false, message: "", type: ""});
            }}
            rsvpStatus={rsvpStatus}
            confirmOneTable={confirmOneTable}
            setConfirmOneTable={setConfirmOneTable}
            eventInfoDisplay={
              selectedEvent && (
                <div className="mb-4 p-3 bg-light rounded">
                  <h5 className="mb-3">{selectedEvent.title}</h5>
                  <p className="mb-1">
                    <strong>Date:</strong> {formatEventDateTime(selectedEvent).dateStr}
                  </p>
                  <p className="mb-1">
                    <strong>Time:</strong> {formatEventDateTime(selectedEvent).timeStr}
                  </p>
                  <p className="mb-0">
                    <strong>Location:</strong> {selectedEvent.location}
                  </p>
                  {selectedEvent.description && (
                    <p className="mt-2 mb-0" style={{whiteSpace: "pre-wrap"}}>
                      {selectedEvent.description}
                    </p>
                  )}
                  {selectedEvent?.rsvpSources?.oneTable && selectedEvent?.oneTableLink && (
                    <div className="mt-2">
                      <a href={selectedEvent.oneTableLink} target="_blank" rel="noreferrer">
                        RSVP through OneTable
                      </a>
                    </div>
                  )}
                </div>
              )
            }
          />
        </Modal.Body>
      </Modal>
    </div>
  );
}

export default Home;
