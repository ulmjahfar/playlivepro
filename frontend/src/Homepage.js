import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppLogo } from './hooks/useAppLogo';
import { API_BASE_URL } from './utils/apiConfig';
import './styles/homepage.css';

const formatDateDisplay = (value) => {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const formatDateRangeDisplay = (start, end) => {
  const startText = formatDateDisplay(start);
  const endText = formatDateDisplay(end);
  if (startText === 'TBD' && endText === 'TBD') return 'Schedule TBA';
  if (startText === 'TBD') return `Ends ${endText}`;
  if (endText === 'TBD') return `Starts ${startText}`;
  return `${startText} – ${endText}`;
};

// Comprehensive Feature Highlights
const FEATURE_HIGHLIGHTS = [
  {
    icon: '🚀',
    title: 'Launch in Minutes',
    description: 'Spin up branded tournaments with registration, payments and scoring ready to go.',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '🧾',
    title: 'Smart Operations',
    description: 'Automate player onboarding, role approvals, communications and match schedules.',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '📺',
    title: 'Live Auction Control',
    description: 'Run hybrid auctions with live dashboards, spending controls and instant rosters.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '📊',
    title: 'Insights & Reporting',
    description: 'Track finances, squad balance and performance with export-ready reports.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '🎯',
    title: 'Auto Grouping',
    description: 'Intelligent team grouping with drag-and-drop interface and automatic balancing.',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '📅',
    title: 'Fixture Generation',
    description: 'Automatically generate match schedules with round-robin, knockout, and custom formats.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '📱',
    title: 'Digital Player Cards',
    description: 'Auto-generate professional digital IDs with photos, QR codes, and tournament branding.',
    image: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '📡',
    title: 'Live Broadcast',
    description: 'Stream auctions and matches with real-time overlays, commentary, and multi-screen displays.',
    image: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '💬',
    title: 'Multi-Channel Notifications',
    description: 'Send updates via Email, WhatsApp, and in-app notifications to keep everyone informed.',
    image: 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '💰',
    title: 'Finance Management',
    description: 'Track budgets, payments, transactions, and generate financial reports automatically.',
    image: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '🌐',
    title: 'Multi-Language Support',
    description: 'Built-in i18n support for multiple languages to serve diverse tournament communities.',
    image: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&h=600&fit=crop&q=80'
  },
  {
    icon: '🖼️',
    title: 'Smart Image Handling',
    description: 'Advanced image upload, crop, compression, and optimization for logos and photos.',
    image: 'https://images.unsplash.com/photo-1614680376573-df3480f0c6ff?w=800&h=600&fit=crop&q=80'
  }
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Create & Configure',
    description: 'Define formats, budgets, squads and branding. Invite co-admins in a click.',
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=800&fit=crop&q=80'
  },
  {
    step: '02',
    title: 'Onboard Players',
    description: 'Collect player data, verify documents, capture payments and auto-generate digital IDs.',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=1200&h=800&fit=crop&q=80'
  },
  {
    step: '03',
    title: 'Draft & Broadcast',
    description: 'Drive bidding through live auction tools with real-time spend tracking and streaming overlays.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&fit=crop&q=80'
  },
  {
    step: '04',
    title: 'Engage & Analyse',
    description: 'Share leaderboards, send notifications and export insights to keep stakeholders aligned.',
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&h=800&fit=crop&q=80'
  }
];

const VALUE_METRICS = [
  { value: '120+', label: 'Tournaments launched' },
  { value: '18K+', label: 'Players managed' },
  { value: '40%', label: 'Less manual effort' },
  { value: '24/7', label: 'Support coverage' }
];

const TESTIMONIALS = [
  {
    quote: 'PlayLive helped us digitise our entire league in under a week. Live auctions and instant scorecards won our sponsors over.',
    name: 'Rohan Shah',
    role: 'Commissioner, Mumbai Premier League',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop&q=80'
  },
  {
    quote: 'The admin console is a powerhouse. From credentials to reports, we finally have one source of truth.',
    name: 'Geeta Nair',
    role: 'Head of Operations, South Sports Collective',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&h=600&fit=crop&q=80'
  },
  {
    quote: 'Fixture generation saved us days of manual work. The live broadcast feature is a game-changer.',
    name: 'Arjun Mehta',
    role: 'Tournament Director, Elite Sports Academy',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&h=600&fit=crop&q=80'
  }
];

const SUPPORT_CHANNELS = [
  {
    icon: '📞',
    label: 'Talk to product specialists',
    value: '+91 98765 43210',
    action: () => window.open('tel:+919876543210')
  },
  {
    icon: '💬',
    label: 'WhatsApp concierge',
    value: '+91 90123 45678',
    action: () => window.open('https://wa.me/919012345678', '_blank')
  },
  {
    icon: '✉️',
    label: 'Write to us',
    value: 'hello@playlive.in',
    action: () => window.open('mailto:hello@playlive.in')
  }
];

// Platform Capabilities
const PLATFORM_CAPABILITIES = [
  {
    category: 'Tournament Management',
    features: [
      'Multi-sport support (Cricket, Football, Volleyball, Basketball)',
      'Custom tournament formats and rules',
      'Branded tournament pages with custom logos',
      'Role-based access control (SuperAdmin, TournamentAdmin, Player)',
      'Tournament settings and configuration'
    ]
  },
  {
    category: 'Registration & Onboarding',
    features: [
      'Player registration with photo upload',
      'Team registration and management',
      'Document verification',
      'Payment collection and receipts',
      'Auto-generated player IDs and digital cards'
    ]
  },
  {
    category: 'Auction System',
    features: [
      'Live auction with real-time bidding',
      'Slab and straight auction rules',
      'Budget tracking and spending controls',
      'Bid history and analytics',
      'Socket.io powered real-time updates'
    ]
  },
  {
    category: 'Team Management',
    features: [
      'Team balancing algorithms',
      'Squad management',
      'Team dashboards and reports',
      'Team logo and branding'
    ]
  },
  {
    category: 'Match & Fixtures',
    features: [
      'Automatic fixture generation',
      'Round-robin and knockout formats',
      'Match scheduling and management',
      'Score tracking',
      'Match results and standings'
    ]
  },
  {
    category: 'Broadcast & Display',
    features: [
      'Live auction display screens',
      'Broadcast mode with overlays',
      'Multi-screen support',
      'Real-time commentary',
      'QR code integration'
    ]
  },
  {
    category: 'Analytics & Reports',
    features: [
      'Financial reports (PDF/Excel)',
      'Player performance analytics',
      'Team statistics and charts',
      'Tournament summaries',
      'Export-ready data'
    ]
  },
  {
    category: 'Communication',
    features: [
      'Email notifications',
      'WhatsApp integration',
      'In-app notifications',
      'Bulk messaging',
      'Custom notification templates'
    ]
  }
];

function Homepage() {
  const navigate = useNavigate();
  const { logoUrl } = useAppLogo();
  const [navOpen, setNavOpen] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [currentTournaments, setCurrentTournaments] = useState([]);
  const [currentTournamentsState, setCurrentTournamentsState] = useState('loading'); // loading | success | empty | error

  const handleScrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setNavOpen(false);
    }
  };

  const handleLoginSuperAdmin = () => {
    setNavOpen(false);
    navigate('/login/super-admin');
  };

  const handleLoginTournamentAdmin = () => {
    setNavOpen(false);
    navigate('/login/tournament-admin');
  };

  const handleCreateTournament = () => {
    navigate('/login/tournament-admin');
  };

  const handleExploreFeatures = () => handleScrollToSection('features');

  useEffect(() => {
    const fetchCurrentTournaments = async () => {
      setCurrentTournamentsState('loading');
      try {
        const response = await axios.get(`${API_BASE_URL}/api/tournaments/public/current`);
        const data = response.data?.tournaments ?? [];
        const enriched = data.map((tournament) => ({
          ...tournament,
          displayDate: formatDateRangeDisplay(tournament.startDate, tournament.endDate),
          locationLabel: tournament.location || 'Venue TBA'
        }));

        setCurrentTournaments(enriched);
        setCurrentTournamentsState(enriched.length ? 'success' : 'empty');
      } catch (error) {
        console.error('Error fetching tournaments:', error);
        setCurrentTournaments([]);
        setCurrentTournamentsState('error');
      }
    };

    fetchCurrentTournaments();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setHasScrolled(scrollY > 12);
      setShowScrollTop(scrollY > 480);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (navOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [navOpen]);

  return (
    <div className="home">
      <div 
        className={`home-nav-overlay ${navOpen ? 'home-nav-overlay--visible' : ''}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <header className={`home-header ${hasScrolled ? 'home-header--scrolled' : ''}`}>
        <div className="home-header__inner container">
          <button className="home-brand" onClick={() => handleScrollToSection('home')}>
            {logoUrl ? (
              <img src={logoUrl} alt="PlayLive" />
            ) : (
              <img src="/logo192.png" alt="PlayLive" />
            )}
            <span>PlayLive</span>
          </button>

          <nav className={`home-nav ${navOpen ? 'home-nav--open' : ''}`}>
            <button onClick={() => handleScrollToSection('home')}>Home</button>
            <button onClick={() => handleScrollToSection('features')}>Features</button>
            <button onClick={() => handleScrollToSection('capabilities')}>Capabilities</button>
            <button onClick={() => handleScrollToSection('workflow')}>Workflow</button>
            <button onClick={() => handleScrollToSection('tournaments')}>Tournaments</button>
            <button onClick={() => handleScrollToSection('testimonials')}>Testimonials</button>
            <button onClick={() => handleScrollToSection('contact')}>Contact</button>
            <div className="home-nav__mobile-cta">
              <button className="home-link" onClick={handleLoginSuperAdmin}>
                Super Admin
              </button>
              <button className="home-button home-button--primary" onClick={handleLoginTournamentAdmin}>
                Tournament Admin
              </button>
            </div>
          </nav>

          <div className="home-header__cta">
            <button className="home-link" onClick={handleLoginSuperAdmin}>
              Super Admin
            </button>
            <button className="home-button home-button--primary" onClick={handleLoginTournamentAdmin}>
              Tournament Admin
            </button>
            <button
              className={`home-nav-toggle ${navOpen ? 'is-active' : ''}`}
              onClick={() => setNavOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <main className="home-main">
        {/* Hero Section with AI Image */}
        <section id="home" className="home-hero">
          <div className="home-hero__background-image">
            <img 
              src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&h=1080&fit=crop&q=80" 
              alt="PlayLive Tournament Platform" 
              className="home-hero__bg-img"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
          <div className="home-hero__content container">
            <div className="home-hero__text">
              <div className="home-hero__eyebrow">Tournament Command Centre</div>
              <h1>Launch. Run. Broadcast. All from one playbook.</h1>
              <p>
                PlayLive unifies admin control, player experiences and live auction tooling so you can move from spreadsheets to
                a connected tournament HQ in days, not months. Complete tournament management with fixture generation,
                digital player cards, live broadcasting, and comprehensive analytics.
              </p>
              <div className="home-hero__actions">
                <button className="home-button home-button--primary" onClick={handleCreateTournament}>
                  Create your tournament
                </button>
                <button className="home-button home-button--ghost" onClick={handleExploreFeatures}>
                  Explore platform
                </button>
              </div>
              <div className="home-hero__stats">
                {VALUE_METRICS.map((metric) => (
                  <div key={metric.label} className="home-hero__stat">
                    <span>{metric.value}</span>
                    <p>{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="home-hero__visual">
              <div className="home-hero__card">
                <div>
                  <p className="home-hero__card-title">Live Auction Snapshot</p>
                  <p className="home-hero__card-value">₹ 52.4L Spent</p>
                </div>
                <div className="home-hero__progress">
                  <span style={{ width: '78%' }} />
                </div>
                <ul>
                  <li>
                    <span className="dot dot--green" />
                    Squads filled
                    <strong>86%</strong>
                  </li>
                  <li>
                    <span className="dot dot--orange" />
                    Average Base Value of Player
                    <strong>₹1.2L</strong>
                  </li>
                  <li>
                    <span className="dot dot--blue" />
                    Remaining budget
                    <strong>₹ 18.6L</strong>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Partners Section */}
        <section className="home-partners">
          <div className="container">
            <p className="home-partners__label">Trusted by fast-growing leagues and academies</p>
            <div className="home-partners__logos">
              <span>Premier Varsity Cup</span>
              <span>Street League Nation</span>
              <span>Coastal Sports Hub</span>
              <span>Elite Cricket Labs</span>
              <span>Metro Hoops</span>
            </div>
          </div>
        </section>

        {/* Features Section with AI Images */}
        <section id="features" className="home-section">
          <div className="container">
            <div className="home-section__heading">
              <h2>Why tournaments choose PlayLive</h2>
              <p>
                Cut through operational chaos with a platform built for organisers who need enterprise-grade control without
                enterprise bloat. Every feature you need, from registration to broadcasting.
              </p>
            </div>
            <div className="home-grid home-grid--features">
              {FEATURE_HIGHLIGHTS.map((feature) => (
                <article key={feature.title} className="home-feature-card">
                  <div className="home-feature-card__image-wrapper">
                    <img 
                      src={feature.image} 
                      alt={feature.title}
                      className="home-feature-card__image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <span className="home-feature-card__icon">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Platform Capabilities Section */}
        <section id="capabilities" className="home-section home-section--alt">
          <div className="container">
            <div className="home-section__heading">
              <h2>Complete Platform Capabilities</h2>
              <p>Everything you need to run a professional tournament from start to finish.</p>
            </div>
            <div className="home-grid home-grid--capabilities">
              {PLATFORM_CAPABILITIES.map((capability) => (
                <div key={capability.category} className="home-capability-card">
                  <h3>{capability.category}</h3>
                  <ul>
                    {capability.features.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow Section with AI Images */}
        <section id="workflow" className="home-section">
          <div className="container">
            <div className="home-section__heading">
              <h2>The modern tournament workflow</h2>
              <p>Guide every stakeholder with a predictable path from sign-up to final whistle.</p>
            </div>
            <div className="home-grid home-grid--workflow">
              {WORKFLOW_STEPS.map((step) => (
                <article key={step.title} className="home-workflow-card">
                  <div className="home-workflow-card__image-wrapper">
                    <img 
                      src={step.image} 
                      alt={step.title}
                      className="home-workflow-card__image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <span className="home-workflow-card__step">{step.step}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Current Tournaments Section */}
        <section id="tournaments" className="home-section home-section--tournaments">
          <div className="container">
            <div className="home-section__heading home-section__heading--inline">
              <div>
                <h2>
                  Current Tournaments
                  {currentTournaments.length ? ` (${currentTournaments.length})` : ''}
                </h2>
                <p>
                  {currentTournaments.length
                    ? 'Posters and highlights from tournaments currently running on PlayLive. Sit back and enjoy the action.'
                    : 'Once organisers publish their posters, the gallery lights up automatically.'}
                </p>
              </div>
            </div>

            <div className="home-tournaments">
              {currentTournamentsState === 'loading' && (
                <div className="home-tournaments__status">Fetching tournaments…</div>
              )}
              {currentTournamentsState === 'error' && (
                <div className="home-tournaments__status home-tournaments__status--error">
                  We couldn't load tournaments right now. Please refresh or try again later.
                </div>
              )}
              {currentTournamentsState === 'empty' && (
                <div className="home-tournaments__status home-tournaments__status--empty">
                  No tournaments are live right now. As soon as posters drop, they will appear here for fans.
                </div>
              )}

              {currentTournamentsState === 'success' && (
                <div className="home-grid home-grid--tournaments">
                  {currentTournaments.slice(0, 6).map((tournament, index) => {
                    const statusLabel = (tournament.status || 'Upcoming').toLowerCase();
                    const statusText = statusLabel === 'active' ? 'Streaming now' : tournament.status || 'Upcoming';
                    return (
                      <article
                        key={tournament.code}
                        className={`home-tournament-card home-tournament-card--public ${
                          tournament.hasPoster ? 'home-tournament-card--has-poster' : 'home-tournament-card--fallback'
                        }`}
                        style={{ '--poster-seq': index }}
                      >
                        <div className="home-tournament-card__poster">
                          {tournament.posterImage ? (
                            <img
                              src={tournament.posterImage}
                              alt={`${tournament.name} poster`}
                              loading="lazy"
                              onError={(event) => {
                                event.currentTarget.classList.add('home-tournament-card__poster-image--hidden');
                                event.currentTarget.setAttribute('aria-hidden', 'true');
                              }}
                            />
                          ) : (
                            <div
                              className="home-tournament-card__poster-fallback-content"
                              style={{ background: tournament.heroColor }}
                            >
                              <span>{tournament.name?.charAt(0) ?? 'P'}</span>
                              <small>{tournament.sport || 'Multi-sport'}</small>
                            </div>
                          )}
                        </div>
                        <div className="home-tournament-card__overlay">
                          <span className="home-tournament-card__sport-tag">{tournament.sport || 'Multi-sport'}</span>
                          <h3>{tournament.name}</h3>
                          <p className="home-tournament-card__dates">{tournament.displayDate}</p>
                          <span className="home-tournament-card__location">{tournament.locationLabel}</span>
                          <span className={`home-tournament-card__status-pill status-${statusLabel}`}>{statusText}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Testimonials Section with AI Images */}
        <section id="testimonials" className="home-section home-section--alt">
          <div className="container">
            <div className="home-section__heading">
              <h2>What organisers say</h2>
              <p>Teams, leagues and academies trust PlayLive to keep the spotlight on sport, not spreadsheets.</p>
            </div>
            <div className="home-grid home-grid--testimonials">
              {TESTIMONIALS.map((testimonial) => (
                <blockquote key={testimonial.name} className="home-testimonial">
                  <div className="home-testimonial__image-wrapper">
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="home-testimonial__image"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  </div>
                  <p>"{testimonial.quote}"</p>
                  <footer>
                    <strong>{testimonial.name}</strong>
                    <span>{testimonial.role}</span>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="home-section home-section--contact">
          <div className="container">
            <div className="home-section__heading">
              <h2>Let's build your next season</h2>
              <p>Drop us a line or request a personalised walkthrough. We respond within one business day.</p>
            </div>
            <div className="home-contact">
              <div className="home-contact__channels">
                {SUPPORT_CHANNELS.map((channel) => (
                  <button key={channel.label} className="home-contact__channel" onClick={channel.action}>
                    <span className="home-contact__icon">{channel.icon}</span>
                    <div>
                      <p>{channel.label}</p>
                      <strong>{channel.value}</strong>
                    </div>
                  </button>
                ))}
              </div>
              <form
                className="home-contact__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleScrollToSection('contact');
                  alert('Thanks! Our team will get in touch shortly.');
                }}
              >
                <label htmlFor="contact-name">Name</label>
                <input id="contact-name" name="name" type="text" placeholder="Alex Fernandes" required />

                <label htmlFor="contact-email">Email</label>
                <input id="contact-email" name="email" type="email" placeholder="you@club.com" required />

                <label htmlFor="contact-message">What should we prepare?</label>
                <textarea
                  id="contact-message"
                  name="message"
                  placeholder="Share your tournament format, timelines or challenges…"
                  rows={4}
                  required
                />

                <button type="submit" className="home-button home-button--primary">
                  Request a demo
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <button
        className={`home-scroll-top ${showScrollTop ? 'home-scroll-top--visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
      >
        ↑
      </button>

      <footer className="home-footer">
        <div className="container home-footer__inner">
          <div className="home-footer__brand">
            <img src="/logo192.png" alt="PlayLive" />
            <div>
              <strong>PlayLive</strong>
              <p>Tournaments made simple.</p>
            </div>
          </div>
          <div className="home-footer__links">
            <h4>Product</h4>
            <button onClick={() => handleScrollToSection('features')}>Platform</button>
            <button onClick={() => handleScrollToSection('capabilities')}>Capabilities</button>
            <button onClick={() => handleScrollToSection('workflow')}>Workflow</button>
            <button onClick={() => handleScrollToSection('tournaments')}>Live tournaments</button>
          </div>
          <div className="home-footer__links">
            <h4>Company</h4>
            <button onClick={() => handleScrollToSection('contact')}>Contact</button>
            <button onClick={() => navigate('/login/super-admin')}>Super Admin login</button>
            <button onClick={() => navigate('/login/tournament-admin')}>Tournament admin login</button>
          </div>
          <div className="home-footer__links">
            <h4>Follow</h4>
            <a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://youtube.com" target="_blank" rel="noreferrer">YouTube</a>
            <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
        <div className="home-footer__bottom">
          <p>© {new Date().getFullYear()} PlayLive. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default Homepage;
