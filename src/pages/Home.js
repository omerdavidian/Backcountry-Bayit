import {applicationsOpen} from "../config/applications";
import {calendarTimes, todayInMountainTime} from "../utils/calendar";
import React, {useState, useEffect, useRef} from "react";
import {Container, Row, Col, Card, Button} from "react-bootstrap";
import {Link} from "react-router-dom";
import {FaStar, FaCalendarAlt, FaHeart, FaUsers, FaMapMarkerAlt, FaClock, FaEdit} from "react-icons/fa";
import {useAuth} from "../utils/AuthContext";

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
            loading="lazy"
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
      const response = await fetch("/api/events");
      if (!response.ok) throw new Error("Could not load events");
      const {events} = await response.json();
      setUpcomingEvents(events.map(calendarTimes).filter(event => event.date >= todayInMountainTime()));
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
            {applicationsOpen && (<Button
              href="#application"
              onClick={scrollToApplication}
              size="md"
              className="px-3 py-2 fw-bold"
              style={{background: "linear-gradient(90deg, #0074d9, #00a8ff)", border: "none"}}>
              <FaEdit className="me-2" />
              2026-27 Application
            </Button>)}
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
      {applicationsOpen && (<section id="application" className="py-5" style={{background: "linear-gradient(135deg, #eaf2ff 0%, #fdfbf7 60%)"}}>
        <Container>
          <div
            className="application-card overflow-hidden rounded-4"
            style={{
              background: "#fff",
              boxShadow: "0 24px 60px rgba(0, 36, 84, 0.18)",
              border: "1px solid rgba(0, 116, 217, 0.12)",
            }}>
            <div className="application-mobile-photo" aria-hidden="true">
              <img src="/images/BCB_Backyard.webp" alt="" loading="lazy" />
            </div>
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
              <Col lg={6} className="application-desktop-photo position-relative" style={{minHeight: "340px"}}>
                <img
                  src="/images/BCB_Backyard.webp"
                  alt="The Backcountry Bayit backyard in Frisco, Colorado"
                  loading="lazy"
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
          .application-mobile-photo {
            display: none;
          }
          @media (max-width: 576px) {
            #application {
              padding-top: 1.25rem !important;
            }
            .application-mobile-photo {
              display: block;
              height: 180px;
              overflow: hidden;
              width: 100%;
            }
            .application-mobile-photo img {
              display: block;
              height: 100%;
              object-fit: cover;
              object-position: center 58%;
              width: 100%;
            }
            .application-desktop-photo {
              display: none;
            }
          }
        `}</style>
      </section>)}

      {/* About Section */}
      <section className="py-5 bg-light">
        <Container>
          <Row className="align-items-center">
            <Col md={6} className="mb-4 mb-md-0">
              <img src="/images/2024-25_season/BCB_2024-25_15.webp" alt="BCB Community" loading="lazy" className="img-fluid rounded shadow-lg" />
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
                                as={Link}
                                to={`/events?event=${encodeURIComponent(event.id)}`}>
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


    </div>
  );
}

export default Home;
