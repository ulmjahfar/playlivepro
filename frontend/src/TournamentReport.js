import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import html2pdf from 'html2pdf.js';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { useAppLogo } from './hooks/useAppLogo';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-tournament-admin-modern.css';
import './styles-tournament-report.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '₹0';
  const num = Number(value);
  if (isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num);
};

// Helper to convert HTTP URLs to HTTPS only for PDF export (to avoid mixed content)
// Only use this when exporting PDF from an HTTPS page
const convertToHttpsForPdf = (url) => {
  if (!url) return url;
  // Only convert if we're on HTTPS page and URL is HTTP
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }
  return url;
};

// Helper to get player ID number (remove tournament code)
const getPlayerIdNumber = (playerId) => {
  if (!playerId) return 'PL001';
  if (playerId.includes('-')) {
    return playerId.split('-').pop();
  }
  return playerId;
};

// Helper to build asset URLs
const buildAssetUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const baseUrl = API_BASE_URL.replace(/\/$/, '');
  if (path.startsWith('/')) return `${baseUrl}${path}`;
  if (path.startsWith('uploads')) return `${baseUrl}/${path}`;
  return `${baseUrl}/uploads/${path}`;
};

// Helper to get element style for print (with scaling)
const getPrintElementStyle = (element, scale = 0.075) => {
  if (!element || !element.position || element.visible === false) {
    return { display: 'none' };
  }
  
  const style = {
    position: 'absolute',
    left: `${element.position.x}%`,
    top: `${element.position.y}%`,
    zIndex: element.zIndex !== undefined ? element.zIndex : 10
  };
  
  if (element.fontSize) style.fontSize = `${element.fontSize * scale}px`;
  if (element.color) style.color = element.color;
  if (element.fontFamily) style.fontFamily = element.fontFamily;
  if (element.fontWeight) style.fontWeight = element.fontWeight;
  
  // Handle circular border
  if (element.circularBorder === true) {
    const size = Math.max((element.fontSize || 14) * scale, 8 * scale);
    const borderSize = size * (element.borderSizeMultiplier || 1.8);
    style.width = `${borderSize}px`;
    style.height = `${borderSize}px`;
    style.borderRadius = (element.borderShape || 'circle') === 'circle' ? '50%' : `${4 * scale}px`;
    style.border = `${2 * scale}px solid ${element.borderColor || element.color || '#ffffff'}`;
    style.backgroundColor = element.borderColor || element.color || '#ffffff';
    style.display = 'flex';
    style.alignItems = 'center';
    style.justifyContent = 'center';
    style.padding = '0';
    if (element.shadowEnabled) {
      const sc = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
      const sb = (element.shadowBlur || 4) * scale;
      const sox = (element.shadowOffsetX || 2) * scale;
      const soy = (element.shadowOffsetY || 2) * scale;
      style.boxShadow = `${sox}px ${soy}px ${sb}px ${sc}`;
    }
  } else if (element.shadowEnabled) {
    const sc = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
    const sb = (element.shadowBlur || 4) * scale;
    const sox = (element.shadowOffsetX || 2) * scale;
    const soy = (element.shadowOffsetY || 2) * scale;
    style.textShadow = `${sox}px ${soy}px ${sb}px ${sc}`;
  }
  
  return style;
};

// Helper to get background style
const getPrintBackgroundStyle = (customDesign) => {
  if (customDesign?.background) {
    const bg = customDesign.background;
    if (bg.type === 'image' && bg.imageUrl) {
      const imageUrl = bg.imageUrl.startsWith('http') 
        ? bg.imageUrl 
        : `${API_BASE_URL}${bg.imageUrl.startsWith('/') ? '' : '/'}${bg.imageUrl}`;
      return {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: bg.opacity || 1
      };
    } else if (bg.type === 'gradient' && bg.gradient) {
      return { background: bg.gradient };
    }
  }
  return { background: 'linear-gradient(135deg, #1f004f 0%, #312e81 40%, #3b82f6 100%)' };
};

// Generate print HTML for all player cards using custom design
const generatePrintHTML = (players, tournament, showPrintButton = false) => {
  const customDesign = tournament?.playerCardDesign;
  const logoUrl = buildAssetUrl(tournament?.logo);
  const cardsPerPage = 20; // 4 columns x 5 rows
  const totalPages = Math.ceil(players.length / cardsPerPage);
  
  // Card dimensions - scale to fit 20 per A4 page (4x5 grid)
  // Each card slot is approximately 45mm x 55mm (accounting for gaps and padding)
  const cardWidth = customDesign?.cardDimensions?.width || 600;
  const cardHeight = customDesign?.cardDimensions?.height || 800;
  const scale = 0.075; // Scale factor to fit cards in grid (45mm / 600px ≈ 0.075)
  const scaledCardWidth = cardWidth * scale;
  const scaledCardHeight = cardHeight * scale;

  let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>RP Cards - ${tournament?.name || 'Tournament'}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Poppins', 'Inter', Arial, sans-serif;
      background: ${showPrintButton ? '#f5f5f5' : 'white'};
      padding: 0;
      margin: 0;
    }
    
    ${showPrintButton ? `
    .print-header {
      position: sticky;
      top: 0;
      background: white;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    .print-header h1 {
      font-size: 24px;
      color: #1f2937;
      margin: 0;
    }
    
    .print-header-info {
      color: #6b7280;
      font-size: 14px;
    }
    
    .print-button {
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: white;
      border: none;
      padding: 12px 24px;
      font-size: 16px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .print-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4);
    }
    
    .print-button:active {
      transform: translateY(0);
    }
    ` : ''}
    
    .print-container {
      width: 100%;
      ${showPrintButton ? 'padding: 0 20px 20px;' : ''}
    }
    
    .print-page {
      width: 210mm;
      min-height: 297mm;
      padding: 10mm;
      margin: 0 auto;
      page-break-after: always;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: repeat(5, 1fr);
      gap: 4mm;
      background: white;
    }
    
    .print-page:last-child {
      page-break-after: auto;
    }
    
    .rp-card {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      page-break-inside: avoid;
    }
    
    .rp-card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: visible;
    }
    
    .pl-player-card {
      position: relative;
      width: ${scaledCardWidth}mm;
      height: ${scaledCardHeight}mm;
      border-radius: ${28 * scale}px;
      overflow: hidden;
    }
    
    .pl-card__logo {
      position: absolute;
      width: ${(customDesign?.logo?.size || 100) * scale}px;
      height: ${(customDesign?.logo?.size || 100) * scale}px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: ${18 * scale}px;
      display: grid;
      place-items: center;
      border: ${2 * scale}px solid rgba(255, 255, 255, 0.3);
      overflow: hidden;
    }
    
    .pl-card__logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .pl-card__logo span {
      font-size: ${40 * scale}px;
    }
    
    .pl-card__tournament-label {
      font-size: ${12 * scale}px;
      text-transform: uppercase;
      letter-spacing: ${0.38 * scale}em;
      color: rgba(248, 250, 252, 0.68);
      margin: 0;
    }
    
    .pl-card__tournament-label + h1 {
      margin: ${4 * scale}px 0;
      font-size: ${28 * scale}px;
      font-weight: 700;
      color: #fefcbf;
      letter-spacing: ${-0.02 * scale}em;
    }
    
    .pl-card__subtext {
      display: inline-block;
      margin-top: ${2 * scale}px;
      font-size: ${13 * scale}px;
      letter-spacing: ${0.18 * scale}em;
      color: rgba(248, 250, 252, 0.65);
    }
    
    .pl-card__details {
      position: absolute;
    }
    
    .pl-card__details ul {
      margin: 0;
      padding: 0;
      list-style: none;
      display: grid;
      gap: ${14 * scale}px;
    }
    
    .pl-card__details li {
      display: flex;
      align-items: center;
      gap: ${14 * scale}px;
      font-size: ${18 * scale}px;
      font-weight: 500;
      color: rgba(248, 250, 252, 0.92);
    }
    
    .pl-card__details .detail-icon {
      display: inline-flex;
      width: ${26 * scale}px;
      height: ${26 * scale}px;
      border-radius: 50%;
      background: rgba(15, 23, 42, 0.3);
      border: ${1 * scale}px solid rgba(248, 250, 252, 0.25);
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    
    .pl-card__photo {
      position: absolute;
      border-radius: ${24 * scale}px;
      border: ${5 * scale}px solid rgba(255, 255, 255, 0.8);
      background: rgba(15, 23, 42, 0.25);
      box-shadow: 0 ${22 * scale}px ${36 * scale}px rgba(15, 23, 42, 0.35);
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    
    .pl-card__photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .pl-card__photo-placeholder {
      text-align: center;
      color: rgba(248, 250, 252, 0.7);
      font-size: ${16 * scale}px;
      display: grid;
      gap: ${6 * scale}px;
      place-items: center;
    }
    
    .pl-card__photo-placeholder span {
      font-size: ${38 * scale}px;
    }
    
    .pl-card__tag-name {
      position: absolute;
      font-size: ${20 * scale}px;
      letter-spacing: ${0.12 * scale}em;
      text-transform: uppercase;
      font-weight: 700;
    }
    
    .pl-card__tag-id {
      position: absolute;
      font-size: ${16 * scale}px;
      display: flex;
      align-items: center;
      gap: ${6 * scale}px;
      font-weight: 500;
    }
    
    .shape-element {
      position: absolute;
      pointer-events: none;
    }
    
    @media print {
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
      
      .print-header {
        display: none !important;
      }
      
      .print-page {
        margin: 0;
        padding: 10mm;
      }
      
      @page {
        size: A4;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  ${showPrintButton ? `
  <div class="print-header">
    <div>
      <h1>RP Cards - ${tournament?.name || 'Tournament'}</h1>
      <div class="print-header-info">${players.length} player cards • ${totalPages} page${totalPages !== 1 ? 's' : ''}</div>
    </div>
    <button class="print-button" onclick="window.print()">🖨️ Print All Cards</button>
  </div>
  ` : ''}
  <div class="print-container">
`;

  // Group players into pages
  for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
    html += '<div class="print-page">';
    
    const startIndex = pageIndex * cardsPerPage;
    const endIndex = Math.min(startIndex + cardsPerPage, players.length);
    
    for (let i = startIndex; i < endIndex; i++) {
      const player = players[i];
      const photoUrl = buildAssetUrl(player.photo);
      const playerIdNumber = getPlayerIdNumber(player.playerId);
      const playerName = player.name || 'Player';
      const role = player.role || 'Role not set';
      const city = player.city || 'City not provided';
      const countryCode = player.countryCode || '+91';
      const mobile = player.mobile ? `${countryCode} ${player.mobile}` : 'Not provided';
      
      const backgroundStyle = getPrintBackgroundStyle(customDesign);
      const bgStyleStr = Object.entries(backgroundStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
      
      html += `
        <div class="rp-card">
          <div class="rp-card-inner">
            <div class="pl-player-card" style="${bgStyleStr}">
      `;
      
      // Render shapes
      if (customDesign?.shapes) {
        customDesign.shapes.forEach((shape, idx) => {
          if (!shape.visible) return;
          const shapeStyle = {
            position: 'absolute',
            left: `${shape.position.x}%`,
            top: `${shape.position.y}%`,
            width: `${shape.size.width * scale}px`,
            height: `${shape.size.height * scale}px`,
            backgroundColor: shape.color,
            opacity: shape.opacity || 1,
            borderRadius: shape.type === 'ellipse' ? '50%' : `${(shape.borderRadius || 0) * scale}px`,
            zIndex: shape.zIndex !== undefined ? shape.zIndex : 5
          };
          if (shape.shadowEnabled) {
            const sc = shape.shadowColor || 'rgba(0, 0, 0, 0.5)';
            const sb = (shape.shadowBlur || 4) * scale;
            const sox = (shape.shadowOffsetX || 2) * scale;
            const soy = (shape.shadowOffsetY || 2) * scale;
            shapeStyle.boxShadow = `${sox}px ${soy}px ${sb}px ${sc}`;
          }
          const shapeStyleStr = Object.entries(shapeStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
          html += `<div class="shape-element" style="${shapeStyleStr}"></div>`;
        });
      }
      
      // Render logo
      if (customDesign?.logo && customDesign.logo.visible !== false) {
        const logoStyle = getPrintElementStyle(customDesign.logo, scale);
        const logoStyleStr = Object.entries(logoStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
        html += `
          <div class="pl-card__logo" style="${logoStyleStr}">
            ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : '<span>🏆</span>'}
          </div>
        `;
      }
      
      // Render tournament name
      if (customDesign?.tournamentName && customDesign.tournamentName.visible !== false) {
        const tnStyle = getPrintElementStyle(customDesign.tournamentName, scale);
        const tnStyleStr = Object.entries(tnStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
        html += `
          <div style="${tnStyleStr}">
            <p class="pl-card__tournament-label">Official Tournament</p>
            <h1>${tournament?.name || 'Tournament'}</h1>
            <span class="pl-card__subtext">${tournament?.code || ''}</span>
          </div>
        `;
      }
      
      // Render player photo
      if (customDesign?.playerPhoto && customDesign.playerPhoto.visible !== false) {
        const photoEl = customDesign.playerPhoto;
        const photoStyle = {
          position: 'absolute',
          left: `${photoEl.position.x}%`,
          top: `${photoEl.position.y}%`,
          width: `${photoEl.size.width * scale}px`,
          height: `${photoEl.size.height * scale}px`,
          borderRadius: photoEl.shape === 'circle' ? '50%' : (photoEl.shape === 'rounded' ? `${12 * scale}px` : '0'),
          border: photoEl.borderWidth > 0 ? `${photoEl.borderWidth * scale}px solid ${photoEl.borderColor}` : 'none',
          zIndex: photoEl.zIndex !== undefined ? photoEl.zIndex : 30
        };
        if (photoEl.shadowEnabled) {
          const sc = photoEl.shadowColor || 'rgba(0, 0, 0, 0.5)';
          const sb = (photoEl.shadowBlur || 4) * scale;
          const sox = (photoEl.shadowOffsetX || 2) * scale;
          const soy = (photoEl.shadowOffsetY || 2) * scale;
          photoStyle.boxShadow = `${sox}px ${soy}px ${sb}px ${sc}`;
        }
        const photoStyleStr = Object.entries(photoStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
        html += `
          <div class="pl-card__photo" style="${photoStyleStr}">
            ${photoUrl ? `<img src="${photoUrl}" alt="${playerName}" />` : '<div class="pl-card__photo-placeholder"><span>📸</span><p>No portrait</p></div>'}
          </div>
        `;
      }
      
      // Render player details
      if (customDesign?.playerDetails && customDesign.playerDetails.visible !== false) {
        const detailsStyle = getPrintElementStyle(customDesign.playerDetails, scale);
        const detailsStyleStr = Object.entries(detailsStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
        const showLabels = customDesign.playerDetails.showLabels !== false;
        html += `
          <div class="pl-card__details" style="${detailsStyleStr}">
            <ul>
              <li><span class="detail-icon">✔</span><span>${showLabels ? `Role: ${role}` : role}</span></li>
              <li><span class="detail-icon">✔</span><span>${showLabels ? `City: ${city}` : city}</span></li>
              <li><span class="detail-icon">✔</span><span>${showLabels ? `Mobile: ${mobile}` : mobile}</span></li>
            </ul>
          </div>
        `;
      }
      
      // Render player name
      if (customDesign?.playerName && customDesign.playerName.visible !== false) {
        const nameStyle = getPrintElementStyle(customDesign.playerName, scale);
        const nameStyleStr = Object.entries(nameStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
        html += `
          <div class="pl-card__tag-name" style="${nameStyleStr}">${playerName.toUpperCase()}</div>
        `;
      }
      
      // Render player ID
      if (customDesign?.playerId && customDesign.playerId.visible !== false) {
        const idStyle = getPrintElementStyle(customDesign.playerId, scale);
        const idStyleStr = Object.entries(idStyle).map(([k, v]) => `${k}: ${v}`).join('; ');
        html += `
          <div class="pl-card__tag-id" style="${idStyleStr}">${playerIdNumber}</div>
        `;
      }
      
      html += `
            </div>
          </div>
        </div>
      `;
    }
    
    html += '</div>';
  }

  html += `
  </div>
</body>
</html>
  `;

  return html;
};

const TournamentReport = () => {
  const { code } = useParams();
  const { logoUrl } = useAppLogo();
  const reportRef = useRef(null);
  const firstPageInputRef = useRef(null);
  const secondPageInputRef = useRef(null);
  const lastPageInputRef = useRef(null);
  const [currentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  });

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [posters, setPosters] = useState({ firstPage: null, secondPage: null, lastPage: null });
  const [uploadingPoster, setUploadingPoster] = useState({ position: null, loading: false });

  const isSuperAdmin = useMemo(() => {
    const role = (currentUser?.role || '').toString().trim().replace(/[\s_]/g, '').toLowerCase();
    return role === 'superadmin';
  }, [currentUser]);

  const fetchAnalytics = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(
        `${API_BASE_URL}/api/reports/${code}/analytics`,
        { headers }
      );

      if (response.data.success) {
        setAnalytics(response.data);
        // Set posters from tournament data
        if (response.data.tournament?.reportPosters) {
          const normalizePath = (path) => {
            if (!path) return null;
            return path.startsWith('/') ? path : `/${path}`;
          };
          setPosters({
            firstPage: normalizePath(response.data.tournament.reportPosters.firstPage),
            secondPage: normalizePath(response.data.tournament.reportPosters.secondPage),
            lastPage: normalizePath(response.data.tournament.reportPosters.lastPage)
          });
        }
      } else {
        throw new Error('Failed to load analytics data');
      }
    } catch (err) {
      console.error('Failed to load tournament analytics', err);
      setError('Unable to load analytics data right now. Please try again later.');
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [code]);

  useEffect(() => {
    fetchAnalytics();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchAnalytics(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  useEffect(() => {
    if (analytics?.tournament) {
      document.title = `${analytics.tournament.name} — Tournament Analytics`;
    } else {
      document.title = 'Tournament Analytics';
    }
    return () => {
      document.title = 'PlayLive';
    };
  }, [analytics]);

  const handleRefresh = useCallback(() => {
    fetchAnalytics(true);
    toast.success('Refreshing data...');
  }, [fetchAnalytics]);

  const handleExportPDF = useCallback(async () => {
    if (!reportRef.current) return;

    const tournamentName = analytics?.tournament?.name || code;
    const safeName = tournamentName.replace(/\s+/g, '_');

    // Create a clone of the report element to modify
    const reportClone = reportRef.current.cloneNode(true);
    
    // Create container for PDF generation
    const pdfContainer = document.createElement('div');
    pdfContainer.style.position = 'absolute';
    pdfContainer.style.left = '-9999px';
    pdfContainer.style.width = '210mm'; // A4 width
    document.body.appendChild(pdfContainer);

    // Add first page poster if exists
    if (posters.firstPage) {
      const firstPagePoster = document.createElement('div');
      firstPagePoster.className = 'pdf-poster pdf-poster-first';
      firstPagePoster.style.pageBreakAfter = 'always';
      firstPagePoster.style.width = '100%';
      firstPagePoster.style.height = '297mm'; // A4 height
      firstPagePoster.style.overflow = 'hidden';
      const img = document.createElement('img');
      img.src = `${API_BASE_URL}${posters.firstPage}`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      firstPagePoster.appendChild(img);
      pdfContainer.appendChild(firstPagePoster);
    }

    // Add the main report content
    pdfContainer.appendChild(reportClone);

    // Find the first major section (Statistics Cards) to insert second page poster after it
    if (posters.secondPage) {
      const statsSection = reportClone.querySelector('.auction-section--metrics');
      if (statsSection) {
        const secondPagePoster = document.createElement('div');
        secondPagePoster.className = 'pdf-poster pdf-poster-second';
        secondPagePoster.style.pageBreakBefore = 'always';
        secondPagePoster.style.pageBreakAfter = 'always';
        secondPagePoster.style.width = '100%';
        secondPagePoster.style.height = '297mm'; // A4 height
        secondPagePoster.style.overflow = 'hidden';
        const img = document.createElement('img');
        img.src = `${API_BASE_URL}${posters.secondPage}`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        secondPagePoster.appendChild(img);
        statsSection.parentNode.insertBefore(secondPagePoster, statsSection.nextSibling);
      } else {
        // If stats section not found, insert at the beginning
        const secondPagePoster = document.createElement('div');
        secondPagePoster.className = 'pdf-poster pdf-poster-second';
        secondPagePoster.style.pageBreakBefore = 'always';
        secondPagePoster.style.pageBreakAfter = 'always';
        secondPagePoster.style.width = '100%';
        secondPagePoster.style.height = '297mm';
        secondPagePoster.style.overflow = 'hidden';
        const img = document.createElement('img');
        img.src = `${API_BASE_URL}${posters.secondPage}`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        secondPagePoster.appendChild(img);
        pdfContainer.insertBefore(secondPagePoster, reportClone);
      }
    }

    // Add last page poster at the end
    if (posters.lastPage) {
      const lastPagePoster = document.createElement('div');
      lastPagePoster.className = 'pdf-poster pdf-poster-last';
      lastPagePoster.style.pageBreakBefore = 'always';
      lastPagePoster.style.width = '100%';
      lastPagePoster.style.height = '297mm'; // A4 height
      lastPagePoster.style.overflow = 'hidden';
      const img = document.createElement('img');
      img.src = `${API_BASE_URL}${posters.lastPage}`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      lastPagePoster.appendChild(img);
      pdfContainer.appendChild(lastPagePoster);
    }

    const options = {
      margin: [0, 0, 0, 0],
      filename: `${safeName}_Analytics_Report.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        logging: false,
        allowTaint: true,
        windowWidth: 794, // A4 width in pixels at 96 DPI
        windowHeight: 1123 // A4 height in pixels at 96 DPI
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], before: '.page-break', after: '.pdf-poster' },
    };

    try {
      await html2pdf().set(options).from(pdfContainer).save();
      toast.success('PDF exported successfully');
    } catch (err) {
      console.error('PDF export error:', err);
      toast.error('Failed to export PDF');
    } finally {
      // Clean up
      document.body.removeChild(pdfContainer);
    }
  }, [analytics, code, posters]);

  const handleExportExcel = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE_URL}/api/reports/analytics/excel/${code}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `tournament_analytics_${code}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Excel file downloaded successfully');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel');
    }
  }, [code]);

  // Fallback function for copying to clipboard (defined first)
  const copyToClipboardFallback = useCallback((text) => {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast.success('Public link copied to clipboard!');
      } else {
        // Show prompt as last resort
        const copied = window.prompt('Copy this public link:', text);
        if (copied) {
          toast.info('Link ready to copy');
        }
      }
    } catch (err) {
      // Show prompt as last resort
      const copied = window.prompt('Copy this public link:', text);
      if (copied) {
        toast.info('Link ready to copy');
      }
    } finally {
      document.body.removeChild(textarea);
    }
  }, []);

  // Helper function to copy text to clipboard with fallback
  const copyToClipboard = useCallback((text) => {
    // Check if clipboard API is available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        toast.success('Public link copied to clipboard!');
      }).catch(() => {
        // Fallback: use textarea method
        copyToClipboardFallback(text);
      });
    } else {
      // Use fallback method
      copyToClipboardFallback(text);
    }
  }, [copyToClipboardFallback]);


  const handlePosterUpload = useCallback(async (position, file) => {
    if (!file) return;

    // Validate file
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please upload JPG, PNG, or WEBP files.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setUploadingPoster({ position, loading: true });

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('image', file);
      formData.append('position', position);

      const response = await axios.post(
        `${API_BASE_URL}/api/tournaments/${code}/report-posters/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setPosters(prev => ({
          ...prev,
          [position]: response.data.poster.url
        }));
        toast.success('Poster uploaded successfully');
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Error uploading poster:', err);
      toast.error(err.response?.data?.message || 'Failed to upload poster');
    } finally {
      setUploadingPoster({ position: null, loading: false });
    }
  }, [code]);

  const handlePosterDelete = useCallback(async (position) => {
    if (!posters[position]) return;

    if (!window.confirm('Are you sure you want to delete this poster?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(
        `${API_BASE_URL}/api/tournaments/${code}/report-posters/${position}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setPosters(prev => ({
          ...prev,
          [position]: null
        }));
        toast.success('Poster deleted successfully');
      } else {
        throw new Error(response.data.message || 'Delete failed');
      }
    } catch (err) {
      console.error('Error deleting poster:', err);
      toast.error(err.response?.data?.message || 'Failed to delete poster');
    }
  }, [code, posters]);

  // Chart data for revenue breakdown
  const revenueChartData = useMemo(() => {
    if (!analytics?.revenueBreakdown) return null;

    const { revenueBreakdown } = analytics;
    const labels = ['Player Registrations', 'Team Registrations', 'Auction Revenue', 'Sponsorship'];
    const data = [
      revenueBreakdown.playerRegistrations || 0,
      revenueBreakdown.teamRegistrations || 0,
      revenueBreakdown.auctionRevenue || 0,
      revenueBreakdown.sponsorship || 0,
    ];

    // Use light theme colors
    const backgroundColor = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const borderColor = ['#2563eb', '#059669', '#d97706', '#dc2626'];

    return {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor,
          borderWidth: 2,
        },
      ],
    };
  }, [analytics]);

  const metricCards = useMemo(() => {
    const stats = analytics?.statistics;
    if (!stats) return [];
    return [
      {
        key: 'players',
        label: 'Registered players',
        value: stats.totalPlayers?.count ?? 0,
        detail:
          stats.totalPlayers && stats.totalPlayers.capacity
            ? `${stats.totalPlayers.percent}% of ${stats.totalPlayers.capacity} slots`
            : null,
        meter: stats.totalPlayers?.percent ?? 0,
      },
      {
        key: 'teams',
        label: 'Active teams',
        value: stats.activeTeams?.count ?? 0,
        detail:
          stats.activeTeams?.averagePlayersPerTeam !== undefined
            ? `Avg ${stats.activeTeams.averagePlayersPerTeam} players`
            : null,
      },
      {
        key: 'revenue',
        label: 'Total revenue',
        value: formatCurrency(stats.totalRevenue),
        detail: 'Combined across streams',
      },
      {
        key: 'pending',
        label: 'Pending payments',
        value: formatCurrency(stats.pendingPayments),
        detail: 'Awaiting confirmation',
      },
      {
        key: 'soldPlayers',
        label: 'Sold players',
        value: stats.soldPlayers ?? 0,
        detail: 'Auction complete',
      },
      {
        key: 'unsoldPlayers',
        label: 'Unsold players',
        value: stats.unsoldPlayers ?? 0,
        detail: 'Still available for bids',
      },
    ];
  }, [analytics]);

  const revenueChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#1f2937',
          font: {
            family: 'Inter, sans-serif',
          },
        },
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#1f2937',
        bodyColor: '#1f2937',
        borderColor: 'rgba(15, 23, 42, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            return `${context.label}: ${formatCurrency(context.parsed)}`;
          },
        },
      },
    },
  }), []);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-spinner"></div>
        <p>Loading tournament analytics...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="analytics-error">
        <h2>⚠️ Analytics Unavailable</h2>
        <p>{error || 'Unable to load analytics data'}</p>
        <button type="button" onClick={() => fetchAnalytics()} className="btn-retry">
          Try Again
        </button>
      </div>
    );
  }

  const {
    tournament: analyticsTournament,
    statistics,
    timeline,
    topPerformers,
    teamPerformance,
    revenueBreakdown
  } = analytics;

  const tournament = analyticsTournament;

  const posterSlots = [
    {
      key: 'firstPage',
      label: 'First Page',
      description: 'Greets readers when the PDF opens',
      ref: firstPageInputRef,
    },
    {
      key: 'secondPage',
      label: 'Second Page',
      description: 'Appears between overview and metrics',
      ref: secondPageInputRef,
    },
    {
      key: 'lastPage',
      label: 'Last Page',
      description: 'Closes the report on a high note',
      ref: lastPageInputRef,
    },
  ];

  const timelineHasData = Array.isArray(timeline) && timeline.length > 0;
  const hasTopPerformers = Array.isArray(topPerformers) && topPerformers.length > 0;
  const hasTeamPerformance = Array.isArray(teamPerformance) && teamPerformance.length > 0;

  return (
    <div className="auction-report">
      <div className="auction-shell">
        {tournament && (
          <section className="auction-hero">
            <div className="auction-hero__identity">
              <div className="auction-hero__logo-frame">
                {tournament?.logo ? (
                  <img
                    src={`${API_BASE_URL}/${tournament.logo}`}
                    alt={`${tournament.name} logo`}
                    className="auction-hero__logo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="auction-hero__logo auction-hero__logo--fallback">
                    {(tournament?.name || 'T')[0]}
                  </div>
                )}
              </div>
              <div className="auction-hero__details">
                <p className="auction-eyebrow">Auction overview</p>
                <h1>{tournament?.name || 'Tournament'}</h1>
                {tournament?.subtitle && <p className="auction-hero__subtitle">{tournament.subtitle}</p>}
                <dl className="auction-meta-grid">
                  <div>
                    <dt>Status</dt>
                    <dd>{tournament?.status || '—'}</dd>
                  </div>
                  <div>
                    <dt>Sport</dt>
                    <dd>{tournament?.sport || '—'}</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>{tournament?.location || 'TBA'}</dd>
                  </div>
                  <div>
                    <dt>Code</dt>
                    <dd>{tournament?.code || '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="auction-hero__actions">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshing}
                className="auction-btn auction-btn--ghost"
              >
                {refreshing ? 'Refreshing…' : 'Refresh data'}
              </button>
              <button type="button" onClick={handleExportPDF} className="auction-btn auction-btn--primary">
                Export PDF
              </button>
              <button type="button" onClick={handleExportExcel} className="auction-btn auction-btn--secondary">
                Export Excel
              </button>
            </div>
          </section>
        )}

        <section className="auction-posters" aria-labelledby="auction-posters-heading">
          <div className="auction-section-heading">
            <div>
              <p className="auction-eyebrow">Optional</p>
              <h2 id="auction-posters-heading">Report Posters</h2>
            </div>
            <p className="auction-section-support">
              Warm, full-bleed visuals that frame the PDF journey.
            </p>
          </div>
          <div className="auction-posters__grid">
            {posterSlots.map((slot) => {
              const imagePath = posters[slot.key];
              const isUploading = uploadingPoster.position === slot.key && uploadingPoster.loading;
              return (
                <article key={slot.key} className="auction-poster-card">
                  <header className="auction-poster-card__header">
                    <div>
                      <p className="auction-eyebrow">{slot.label}</p>
                      <h3>{slot.label} poster</h3>
                    </div>
                    <p className="auction-poster-card__support">{slot.description}</p>
                  </header>
                  <div className={`auction-poster-card__body ${imagePath ? 'is-filled' : 'is-empty'}`}>
                    {imagePath ? (
                      <>
                        <img
                          src={`${API_BASE_URL}${imagePath}`}
                          alt={`${slot.label} poster`}
                        />
                        <div className="auction-poster-card__actions">
                          <button
                            type="button"
                            onClick={() => slot.ref.current?.click()}
                            disabled={uploadingPoster.loading}
                            className="auction-btn auction-btn--secondary"
                          >
                            {isUploading ? 'Uploading…' : 'Replace'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePosterDelete(slot.key)}
                            disabled={uploadingPoster.loading}
                            className="auction-btn auction-btn--ghost"
                          >
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => slot.ref.current?.click()}
                        disabled={uploadingPoster.loading}
                        className="auction-btn auction-btn--dashed"
                      >
                        {isUploading ? 'Uploading…' : 'Upload poster'}
                      </button>
                    )}
                    <input
                      ref={slot.ref}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handlePosterUpload(slot.key, e.target.files[0]);
                        }
                        e.target.value = '';
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <main className="auction-layout" ref={reportRef}>
          <section className="auction-section auction-section--metrics">
            <div className="auction-section-heading">
              <div>
                <p className="auction-eyebrow">Live snapshot</p>
                <h2>Auction health</h2>
              </div>
              <p className="auction-section-support">Auto-refreshes every 30 seconds</p>
            </div>
            <div className="auction-metrics__grid">
              {metricCards.map((card) => (
                <article key={card.key} className="auction-metric-card">
                  <p className="auction-metric-card__label">{card.label}</p>
                  <p className="auction-metric-card__value">{card.value}</p>
                  {card.detail && <p className="auction-metric-card__detail">{card.detail}</p>}
                  {typeof card.meter === 'number' && (
                    <div className="auction-metric-card__meter">
                      <div style={{ width: `${Math.min(card.meter, 100)}%` }} />
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="auction-section">
            <div className="auction-section-heading">
              <div>
                <p className="auction-eyebrow">Pace</p>
                <h2>Registration timeline</h2>
              </div>
            </div>
            {timelineHasData ? (
              <ol className="auction-timeline">
                {timeline.map((week, index) => (
                  <li key={index} className="auction-timeline__item">
                    <div className="auction-timeline__header">
                      <span>Week {week.week}</span>
                      {week.date && (
                        <span>
                          {week.date}
                          {week.dateEnd && ` – ${week.dateEnd}`}
                        </span>
                      )}
                    </div>
                    <div className="auction-timeline__bar">
                      <div style={{ width: `${Math.min(week.progress, 100)}%` }} />
                    </div>
                    <div className="auction-timeline__stats">
                      <span>{week.players} players</span>
                      <span>{week.progress}%</span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="auction-empty">No registration timeline data available</div>
            )}
          </section>

          <div className="auction-panel-grid">
            <section className="auction-section">
              <div className="auction-section-heading">
                <div>
                  <p className="auction-eyebrow">Top bids</p>
                  <h2>Top performers</h2>
                </div>
              </div>
              {hasTopPerformers ? (
                <div className="auction-performers">
                  {topPerformers.map((performer, index) => (
                    <article key={index} className="auction-performer">
                      <span className="auction-performer__rank">#{index + 1}</span>
                      <div className="auction-performer__body">
                        <p className="auction-performer__name">{performer.name}</p>
                        <p className="auction-performer__meta">
                          {performer.role} • {performer.team}
                        </p>
                      </div>
                      <span className="auction-performer__value">{formatCurrency(performer.price)}</span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="auction-empty">No top performers data available</div>
              )}
            </section>

            <section className="auction-section">
              <div className="auction-section-heading">
                <div>
                  <p className="auction-eyebrow">Club view</p>
                  <h2>Team performance</h2>
                </div>
              </div>
              {hasTeamPerformance ? (
                <div className="auction-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Players</th>
                        <th>Wins</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamPerformance.map((team, index) => (
                        <tr key={index}>
                          <td>{team.name}</td>
                          <td>{team.players}</td>
                          <td>{team.wins || 0}</td>
                          <td>{formatCurrency(team.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="auction-empty">No team performance data available</div>
              )}
            </section>
          </div>

          <section className="auction-section">
            <div className="auction-section-heading">
              <div>
                <p className="auction-eyebrow">Flows</p>
                <h2>Revenue breakdown</h2>
              </div>
            </div>
            {revenueChartData ? (
              <div className="auction-revenue">
                <div className="auction-revenue__chart">
                  <Doughnut data={revenueChartData} options={revenueChartOptions} />
                </div>
                <div className="auction-revenue__list">
                  <div className="auction-revenue__item">
                    <span>Player registrations</span>
                    <strong>{formatCurrency(revenueBreakdown.playerRegistrations)}</strong>
                  </div>
                  <div className="auction-revenue__item">
                    <span>Team registrations</span>
                    <strong>{formatCurrency(revenueBreakdown.teamRegistrations)}</strong>
                  </div>
                  <div className="auction-revenue__item">
                    <span>Auction revenue</span>
                    <strong>{formatCurrency(revenueBreakdown.auctionRevenue)}</strong>
                  </div>
                  <div className="auction-revenue__item">
                    <span>Sponsorship</span>
                    <strong>{formatCurrency(revenueBreakdown.sponsorship)}</strong>
                  </div>
                  <div className="auction-revenue__total">
                    <span>Total revenue</span>
                    <strong>{formatCurrency(statistics.totalRevenue)}</strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="auction-empty">No revenue breakdown data available</div>
            )}
          </section>

        </main>
      </div>

      {/* Footer App Info */}
      <footer style={{
        marginTop: '48px',
        padding: '24px',
        textAlign: 'center',
        borderTop: '1px solid rgba(0, 0, 0, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px'
      }}>
        <img 
          src="/logo192.png" 
          alt="PlayLive" 
          style={{ width: '32px', height: '32px', objectFit: 'contain' }}
        />
        <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
          💙 Powered by <strong>PlayLive</strong> — Tournament Made Simple
        </p>
      </footer>
    </div>
  );
};

export default TournamentReport;
