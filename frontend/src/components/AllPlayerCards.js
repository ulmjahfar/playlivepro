import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../utils/apiConfig';
import { buildLogoUrl, buildPhotoUrl } from '../utils/playerCardUtils';
import { getAppLogoUrl } from '../hooks/useAppLogo';
import PlayerCardCanvas from './PlayerCardCanvas';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import '../styles/player-card-designer.css';
import '../styles/all-player-cards.css';

function AllPlayerCards() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0, percentage: 0 });
  const cancelPdfGeneration = useRef(false);
  const cardRefs = useRef({});

  useEffect(() => {
    fetchData();
  }, [code]);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        navigate('/login/tournament-admin');
        return;
      }

      // Check user role
      const userStr = localStorage.getItem('user');
      let user = null;
      try {
        user = userStr ? JSON.parse(userStr) : null;
      } catch (e) {
        console.error('Failed to parse user data', e);
      }

      const userRole = user?.role;
      const isAuthorized = userRole === 'SuperAdmin' || userRole === 'TournamentAdmin';
      
      if (!isAuthorized) {
        toast.error('Access denied. Only Tournament Admins and Super Admins can access this page.');
        navigate(`/tournament/${code}/settings`);
        return;
      }

      // Fetch tournament and players in parallel
      const [tournamentRes, playersRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/api/players/${code}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!tournamentRes.data.success) {
        throw new Error('Failed to fetch tournament');
      }

      setTournament(tournamentRes.data.tournament);
      const playersData = playersRes.data.players || [];
      console.log('All players fetched:', playersData.length);
      console.log('First player in array:', playersData[0]);
      console.log('First player is null/undefined:', playersData[0] == null);
      // Check for player ID ending with -1 or containing 1 (e.g., PLTC003-1)
      const playerId1 = playersData.find(p => {
        const pid = String(p.playerId || '');
        const id = String(p._id || '');
        return pid.endsWith('-1') || pid === '1' || id === '1' || id.endsWith('1');
      });
      console.log('Player ID 1 check:', playerId1);
      console.log('All player IDs:', playersData.map((p, idx) => ({ 
        index: idx,
        _id: p?._id, 
        playerId: p?.playerId, 
        name: p?.name,
        isNull: p == null
      })));
      
      // Sort players by playerId (extract numeric part for proper numeric sorting)
      const sortedPlayers = [...playersData].sort((a, b) => {
        if (!a || !b) return 0;
        
        const getPlayerIdNumber = (playerId) => {
          if (!playerId) return 0;
          const str = String(playerId);
          // Extract numeric part after last dash (e.g., "PLTC003-1" -> 1)
          if (str.includes('-')) {
            const parts = str.split('-');
            const num = parseInt(parts[parts.length - 1], 10);
            return isNaN(num) ? 0 : num;
          }
          // If no dash, try to parse the whole string as number
          const num = parseInt(str, 10);
          return isNaN(num) ? 0 : num;
        };
        
        const aNum = getPlayerIdNumber(a.playerId);
        const bNum = getPlayerIdNumber(b.playerId);
        
        return aNum - bNum;
      });
      
      console.log('Players after sorting:', sortedPlayers.map((p, idx) => ({ 
        index: idx,
        playerId: p?.playerId, 
        name: p?.name
      })));
      
      setPlayers(sortedPlayers);
    } catch (error) {
      console.error('Failed to fetch data', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. You do not have permission to access this tournament.');
      } else if (error.response?.status === 404) {
        toast.error('Tournament not found.');
      } else {
        toast.error('Failed to load data');
      }
      navigate(`/tournament/${code}/settings`);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not available';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCancelPDF = () => {
    cancelPdfGeneration.current = true;
    // Keep overlay visible until cancellation is processed
    toast.info('Cancelling PDF generation...');
  };

  // Helper function to preload all player images
  const preloadPlayerImages = async () => {
    const imagePromises = [];
    const loadedImages = new Set();

    // Preload all player photos
    players.forEach((player) => {
      if (player?.photo) {
        const photoUrl = buildPhotoUrl(player.photo);
        if (photoUrl && !loadedImages.has(photoUrl)) {
          loadedImages.add(photoUrl);
          const promise = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve();
            img.onerror = () => resolve(); // Continue even if image fails
            img.src = photoUrl;
            // Timeout after 5 seconds
            setTimeout(() => resolve(), 5000);
          });
          imagePromises.push(promise);
        }
      }
    });

    // Preload tournament logo
    const logoUrl = buildLogoUrl(tournament?.logo);
    if (logoUrl && !logoUrl.includes('/default-logo.png') && !loadedImages.has(logoUrl)) {
      loadedImages.add(logoUrl);
      const promise = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = logoUrl;
        setTimeout(() => resolve(), 5000);
      });
      imagePromises.push(promise);
    }

    // Preload background image if card design has one
    if (tournament?.playerCardDesign?.background?.type === 'image' && tournament?.playerCardDesign?.background?.imageUrl) {
      const bgImageUrl = tournament.playerCardDesign.background.imageUrl;
      let fullBgUrl = bgImageUrl;
      
      // Build full URL if needed
      if (!bgImageUrl.startsWith('http')) {
        if (bgImageUrl.startsWith('uploads')) {
          fullBgUrl = `${API_BASE_URL}/${bgImageUrl}`;
        } else if (bgImageUrl.startsWith('/')) {
          fullBgUrl = `${API_BASE_URL}${bgImageUrl}`;
        } else {
          fullBgUrl = `${API_BASE_URL}/${bgImageUrl}`;
        }
      }
      
      if (fullBgUrl && !loadedImages.has(fullBgUrl)) {
        loadedImages.add(fullBgUrl);
        const promise = new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = fullBgUrl;
          setTimeout(() => resolve(), 5000);
        });
        imagePromises.push(promise);
      }
    }

    // Wait for all images to load (or timeout)
    await Promise.all(imagePromises);
  };

  // Helper function to wait for all images to load in an element
  const waitForImages = (element) => {
    return new Promise((resolve) => {
      const images = element.querySelectorAll('img');
      if (images.length === 0) {
        resolve();
        return;
      }

      let loadedCount = 0;
      let errorCount = 0;
      const totalImages = images.length;

      const checkComplete = () => {
        if (loadedCount + errorCount >= totalImages) {
          resolve();
        }
      };

      images.forEach((img) => {
        // If image is already loaded
        if (img.complete && img.naturalHeight !== 0) {
          loadedCount++;
          checkComplete();
        } else {
          // Wait for image to load
          const onLoad = () => {
            loadedCount++;
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            checkComplete();
          };

          const onError = () => {
            errorCount++;
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            checkComplete();
          };

          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);

          // Force reload if src is set but image hasn't loaded
          if (img.src && !img.complete) {
            const src = img.src;
            img.src = '';
            img.src = src;
          }
        }
      });

      // Timeout after 10 seconds to prevent hanging
      setTimeout(() => {
        resolve();
      }, 10000);
    });
  };

  // Helper function to load and register Alexandria SemiBold font
  const loadAlexandriaSemiBoldFont = async (pdfInstance) => {
    try {
      // Check if font is already loaded
      const fontList = pdfInstance.getFontList();
      if (fontList && fontList['Alexandria-SemiBold']) {
        return true;
      }

      // Load the font file
      const fontPath = '/fonts/ALEXANDRIA-SEMIBOLD.TTF';
      const response = await fetch(fontPath);
      if (!response.ok) {
        console.warn('Failed to load Alexandria SemiBold font, falling back to helvetica');
        return false;
      }

      const fontArrayBuffer = await response.arrayBuffer();
      const uint8Array = new Uint8Array(fontArrayBuffer);
      
      // Convert to base64 more efficiently for large files
      let binaryString = '';
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, i + chunkSize);
        binaryString += String.fromCharCode.apply(null, chunk);
      }
      const fontBase64 = btoa(binaryString);

      // Add font to jsPDF's virtual file system
      pdfInstance.addFileToVFS('Alexandria-SemiBold.ttf', fontBase64);
      
      // Register the font - use 'normal' as the style since it's already SemiBold
      pdfInstance.addFont('Alexandria-SemiBold.ttf', 'Alexandria-SemiBold', 'normal');
      
      return true;
    } catch (error) {
      console.warn('Error loading Alexandria SemiBold font:', error);
      return false;
    }
  };

  const handleGeneratePDF = async () => {
    if (players.length === 0) {
      toast.error('No players to generate PDF');
      return;
    }

    cancelPdfGeneration.current = false;
    setGeneratingPDF(true);
    setPdfProgress({ current: 0, total: players.length, percentage: 0 });
    toast.info('Preloading images... This may take a moment.');

    try {
      // Preload all player images before starting PDF generation
      await preloadPlayerImages();
      
      toast.info('Generating PDF from player cards... This may take a moment.');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Load Alexandria SemiBold font
      const fontLoaded = await loadAlexandriaSemiBoldFont(pdf);

      // Fixed card dimensions in mm
      const finalScaledWidth = 40; // 40mm width
      const finalScaledHeight = 50; // 50mm height
      
      // Get actual card dimensions from design (for rendering the card)
      const defaultCardWidth = tournament.playerCardDesign?.cardDimensions?.width || 600;
      const defaultCardHeight = tournament.playerCardDesign?.cardDimensions?.height || 800;
      
      const pdfWidth = pdf.internal.pageSize.getWidth(); // A4 width: ~210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // A4 height: ~297mm
      
      // Fixed layout: 20 cards per page in a 4x5 grid
      const cardsPerRow = 4;
      const cardsPerColumn = 5;
      const cardsPerPage = 20;
      
      // Header and footer dimensions
      const headerHeight = 25; // 25mm for header (to accommodate title, and better spacing)
      const footerHeight = 20; // 20mm for footer (to accommodate logo and text)
      
      // Load footer logo image
      let footerLogoDataUrl = null;
      try {
        const footerLogoPath = '/logo192.png';
        const response = await fetch(footerLogoPath);
        if (response.ok) {
          const blob = await response.blob();
          footerLogoDataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        }
      } catch (error) {
        console.warn('Failed to load footer logo for PDF:', error);
      }
      
      // Calculate spacing with header and footer
      const margin = 5;
      const availableWidth = pdfWidth - (2 * margin);
      const availableHeight = pdfHeight - (2 * margin) - headerHeight - footerHeight;
      
      // Calculate spacing between cards
      const horizontalGap = 3; // 3mm gap between cards horizontally
      const verticalGap = 3; // 3mm gap between cards vertically
      
      // Recalculate spacing to center cards nicely
      const totalCardsWidth = (finalScaledWidth * cardsPerRow) + (horizontalGap * (cardsPerRow - 1));
      const totalCardsHeight = (finalScaledHeight * cardsPerColumn) + (verticalGap * (cardsPerColumn - 1));
      
      const horizontalSpacing = margin + (availableWidth - totalCardsWidth) / 2;
      const verticalSpacing = margin + headerHeight + (availableHeight - totalCardsHeight) / 2;

      // Function to add header and footer to a page
      const addPageHeaderAndFooter = (pdfInstance, pageNumber, totalPages) => {
        const pageWidth = pdfInstance.internal.pageSize.getWidth();
        
        // Tournament name and subtitle (right-aligned)
        const rightMargin = 25; // Right margin in mm
        const textRightX = pageWidth - rightMargin;
        
        // Tournament name - using Alexandria SemiBold
        pdfInstance.setFontSize(12);
        // Use Alexandria SemiBold if loaded, otherwise fall back to helvetica bold
        try {
          if (fontLoaded) {
            const fontList = pdfInstance.getFontList();
            if (fontList && (fontList['Alexandria-SemiBold'] || fontList['alexandria-sembold'])) {
              pdfInstance.setFont('Alexandria-SemiBold', 'normal');
            } else {
              pdfInstance.setFont('helvetica', 'bold');
            }
          } else {
            pdfInstance.setFont('helvetica', 'bold');
          }
        } catch (error) {
          console.warn('Error setting Alexandria SemiBold font, using helvetica:', error);
          pdfInstance.setFont('helvetica', 'bold');
        }
        pdfInstance.setTextColor(10, 10, 10);
        const tournamentName = tournament.name || 'Tournament';
        const headerTextWidth = pdfInstance.getTextWidth(tournamentName);
        // Right-align: position text so it ends at the right margin
        pdfInstance.text(tournamentName, textRightX - headerTextWidth, 8.5);
        
        // Subtitle (using helvetica-normal, right-aligned)
        pdfInstance.setFontSize(8);
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setTextColor(100, 100, 100);
        const subtitle = 'Register players Card';
        const subtitleWidth = pdfInstance.getTextWidth(subtitle);
        // Right-align: position text so it ends at the right margin
        pdfInstance.text(subtitle, textRightX - subtitleWidth, 14.5);
        
        // Footer - matching the page footer style (one line: logo + text)
        const pageHeight = pdfInstance.internal.pageSize.getHeight();
        const footerTopY = pageHeight - footerHeight;
        const footerCenterX = pageWidth / 2;
        const footerY = footerTopY + footerHeight / 2; // Vertical center of footer
        
        // Calculate total width for logo + gap + text to center everything
        const logoSize = 8; // 8mm logo size (approximately 32px equivalent)
        const gapBetweenLogoAndText = 4; // 4mm gap between logo and text
        
        pdfInstance.setFontSize(8);
        pdfInstance.setFont('helvetica', 'normal');
        pdfInstance.setTextColor(107, 114, 128); // #6b7280 color
        const footerText = 'Powered by PlayLive';
        const footerTextWidth = pdfInstance.getTextWidth(footerText);
        
        // Total width of logo + gap + text
        const totalFooterWidth = logoSize + gapBetweenLogoAndText + footerTextWidth;
        
        // Starting X position to center the entire footer (logo + text)
        const footerStartX = footerCenterX - totalFooterWidth / 2;
        
        // Footer logo (left side of the footer block)
        if (footerLogoDataUrl) {
          try {
            const logoY = footerY - logoSize / 2; // Center logo vertically
            pdfInstance.addImage(footerLogoDataUrl, 'PNG', footerStartX, logoY, logoSize, logoSize);
          } catch (error) {
            console.warn('Failed to add footer logo to PDF:', error);
          }
        }
        
        // Footer text "Powered by PlayLive" (right side of logo, same line)
        const textX = footerStartX + logoSize + gapBetweenLogoAndText;
        pdfInstance.text(footerText, textX, footerY);
      };

      // Calculate total pages
      const totalPages = Math.ceil(players.length / cardsPerPage);

      // Capture each card
      for (let i = 0; i < players.length; i++) {
        // Check for cancellation
        if (cancelPdfGeneration.current) {
          return;
        }

        // Update progress
        const progressPercentage = Math.round(((i + 1) / players.length) * 100);
        setPdfProgress({ current: i + 1, total: players.length, percentage: progressPercentage });

        const player = players[i];
        // Use same key format as rendering to ensure consistency
        const cardKey = String(player._id || player.playerId || `player-${i}`);
        const cardElement = cardRefs.current[cardKey];
        
        if (!cardElement) {
          console.warn(`Card element not found for player ${cardKey}`);
          continue;
        }

        // Find the canvas element inside the card scaler
        const canvasElement = cardElement.querySelector('.player-card-canvas');
        if (!canvasElement) {
          console.warn(`Canvas not found for player ${cardKey}`);
          continue;
        }

        // Get actual card dimensions from design
        const actualCardWidth = tournament.playerCardDesign?.cardDimensions?.width || defaultCardWidth;
        const actualCardHeight = tournament.playerCardDesign?.cardDimensions?.height || defaultCardHeight;
        
        // Create a temporary isolated container with EXACT card dimensions (no scaler, no wrapper)
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'fixed';
        tempContainer.style.left = '-99999px';
        tempContainer.style.top = '0';
        tempContainer.style.width = `${actualCardWidth}px`;
        tempContainer.style.height = `${actualCardHeight}px`;
        tempContainer.style.overflow = 'hidden';
        tempContainer.style.backgroundColor = 'transparent';
        tempContainer.style.margin = '0';
        tempContainer.style.padding = '0';
        tempContainer.style.border = 'none';
        tempContainer.style.boxShadow = 'none';
        
        // Clone the canvas element to avoid affecting the original
        const clonedCanvas = canvasElement.cloneNode(true);
        
        // Set cloned canvas to exact card size - NO scaling, NO transforms
        clonedCanvas.style.transform = 'none';
        clonedCanvas.style.transformOrigin = 'top left';
        clonedCanvas.style.width = `${actualCardWidth}px`;
        clonedCanvas.style.height = `${actualCardHeight}px`;
        clonedCanvas.style.position = 'relative';
        clonedCanvas.style.left = '0';
        clonedCanvas.style.top = '0';
        clonedCanvas.style.margin = '0';
        clonedCanvas.style.padding = '0';
        clonedCanvas.style.boxShadow = 'none';
        clonedCanvas.style.border = 'none';
        clonedCanvas.style.overflow = 'hidden';
        
        // Ensure all images have 100% opacity and are properly loaded
        const images = clonedCanvas.querySelectorAll('img');
        images.forEach(img => {
          // Force 100% opacity using important to override any CSS rules
          img.style.setProperty('opacity', '1', 'important');
          img.style.setProperty('display', 'block', 'important');
          img.style.setProperty('visibility', 'visible', 'important');
          
          // Also ensure parent containers have 100% opacity (for canvas-element.player-photo, etc.)
          let parent = img.parentElement;
          while (parent && parent !== clonedCanvas) {
            if (parent.classList.contains('canvas-element') || parent.classList.contains('player-photo')) {
              parent.style.setProperty('opacity', '1', 'important');
            }
            parent = parent.parentElement;
          }
          
          // Ensure image is loaded - if src exists but image isn't complete, reload it
          if (img.src && (!img.complete || img.naturalHeight === 0)) {
            const src = img.src;
            // Force reload by clearing and resetting src
            img.src = '';
            img.src = src;
            // Set crossOrigin for CORS
            img.crossOrigin = 'anonymous';
          } else if (img.src) {
            // Ensure crossOrigin is set even if image is already loaded
            img.crossOrigin = 'anonymous';
          }
        });

        // Append to body temporarily (off-screen)
        document.body.appendChild(tempContainer);
        tempContainer.appendChild(clonedCanvas);

        try {
          // Wait for all images to load before capturing
          await waitForImages(tempContainer);

          // Additional small delay to ensure rendering is complete
          await new Promise(resolve => setTimeout(resolve, 100));

          // Capture ONLY the card area - exact dimensions, no scaler, no wrapper
          // Use 1.5x scale for fast processing while maintaining good quality for small cards
          const canvas = await html2canvas(tempContainer, {
            width: actualCardWidth,
            height: actualCardHeight,
            scale: 1.5, // 1.5x scale: 2.25x faster than 2x, still excellent quality for PDF
            useCORS: true,
            logging: false,
            backgroundColor: null,
            allowTaint: true,
            imageTimeout: 15000, // Increased timeout to 15 seconds to ensure images load
            x: 0,
            y: 0,
            scrollX: 0,
            scrollY: 0,
            pixelRatio: 1, // Fixed ratio for consistent, faster processing
            onclone: (clonedDoc, element) => {
              // Ensure all images in the cloned document have 100% opacity
              const clonedImages = clonedDoc.querySelectorAll('img');
              clonedImages.forEach(img => {
                // Force 100% opacity using important to override any CSS
                img.style.setProperty('opacity', '1', 'important');
                img.style.setProperty('display', 'block', 'important');
                img.style.setProperty('visibility', 'visible', 'important');
                
                // Also ensure parent containers have 100% opacity
                let parent = img.parentElement;
                while (parent && parent !== element) {
                  if (parent.classList && (parent.classList.contains('canvas-element') || parent.classList.contains('player-photo'))) {
                    parent.style.setProperty('opacity', '1', 'important');
                  }
                  parent = parent.parentElement;
                }
              });
              
              // Also ensure all canvas-element containers have 100% opacity
              const canvasElements = clonedDoc.querySelectorAll('.canvas-element, .player-photo');
              canvasElements.forEach(el => {
                el.style.setProperty('opacity', '1', 'important');
              });
            }
          });
          
          // Clean up temporary container immediately after capture
          document.body.removeChild(tempContainer);

          // Calculate position on page
          const cardIndex = i % cardsPerPage;
          const row = Math.floor(cardIndex / cardsPerRow);
          const col = cardIndex % cardsPerRow;

          // Add new page if needed (except for first card)
          if (i > 0 && cardIndex === 0) {
            pdf.addPage();
            // Add header and footer to the new page
            const currentPage = Math.floor(i / cardsPerPage) + 1;
            addPageHeaderAndFooter(pdf, currentPage, totalPages);
          }

          // Calculate position
          const x = horizontalSpacing + col * (finalScaledWidth + horizontalGap);
          const y = verticalSpacing + row * (finalScaledHeight + verticalGap);

          // Convert canvas to JPEG for faster processing (PNG is 3-5x slower)
          // JPEG quality 0.95 provides excellent quality with full clarity
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          
          // Add image to PDF
          pdf.addImage(imgData, 'JPEG', x, y, finalScaledWidth, finalScaledHeight, undefined, 'FAST');
        } catch (error) {
          console.error(`Error capturing card for player ${cardKey}:`, error);
          // Clean up temporary container on error
          if (tempContainer && tempContainer.parentNode) {
            try {
              document.body.removeChild(tempContainer);
            } catch (e) {
              // Container may have been auto-removed
            }
          }
        }
      }

      // Check for cancellation before saving
      if (cancelPdfGeneration.current) {
        return;
      }

      // Add header and footer to the first page (if we have any cards)
      if (players.length > 0) {
        pdf.setPage(1);
        addPageHeaderAndFooter(pdf, 1, totalPages);
      }

      // Save the PDF
      pdf.save(`player_cards_${code}.pdf`);
      toast.success('PDF generated successfully!');
    } catch (error) {
      console.error('Failed to generate PDF', error);
      if (!cancelPdfGeneration.current) {
        toast.error('Failed to generate PDF. Please try again.');
      }
    } finally {
      setGeneratingPDF(false);
      setPdfProgress({ current: 0, total: 0, percentage: 0 });
      cancelPdfGeneration.current = false;
    }
  };

  if (loading) {
    return (
      <div className="all-player-cards-loading">
        <div className="loading-spinner"></div>
        <p>Loading player cards...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="all-player-cards-error">
        <p>Tournament not found</p>
      </div>
    );
  }

  // Check if design exists
  const hasDesign = tournament.playerCardDesign && Object.keys(tournament.playerCardDesign).length > 0;
  const logoUrl = buildLogoUrl(tournament?.logo);

  if (!hasDesign) {
    return (
      <div className="all-player-cards-container">
        <div className="all-player-cards-header">
          {logoUrl && (
            <img src={logoUrl} alt={tournament.name} className="header-logo" />
          )}
          <div className="header-text">
            <h1>{tournament.name || 'Tournament'}</h1>
            <p className="header-subtitle">Register players Card</p>
          </div>
        </div>
        <div className="all-player-cards-error">
          <p>No card design found. Please create and save a design first.</p>
          <button 
            className="btn-primary"
            onClick={() => navigate(`/tournament/${code}/settings/player-card-designer`)}
          >
            Go to Designer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="all-player-cards-container">
      <div className="all-player-cards-header">
        {logoUrl && (
          <img src={logoUrl} alt={tournament.name} className="header-logo" />
        )}
        <div className="header-text">
          <h1>{tournament.name || 'Tournament'}</h1>
          <p className="header-subtitle">Register players Card</p>
        </div>
        {players.length > 0 && (
          <button
            className="btn-generate-pdf"
            onClick={handleGeneratePDF}
            disabled={generatingPDF}
          >
            {generatingPDF ? 'Generating PDF...' : 'Generate PDF'}
          </button>
        )}
      </div>

      {players.length === 0 ? (
        <div className="all-player-cards-empty">
          <p>No players registered for this tournament yet.</p>
        </div>
      ) : (
        <div className="all-player-cards-grid">
          {players.filter(player => player != null).map((player, index) => {
            // Ensure cardKey is always a string to avoid React key issues
            const cardKey = String(player._id || player.playerId || `player-${index}`);
            
            // Debug logging for first player (index 0)
            if (index === 0) {
              console.log('=== FIRST PLAYER DEBUG ===');
              console.log('Index:', index);
              console.log('Player data:', player);
              console.log('Card key:', cardKey);
              console.log('Has _id:', !!player._id);
              console.log('Has playerId:', !!player.playerId);
            }
            
            // Debug logging for player ID ending with -1 (e.g., PLTC003-1)
            const pid = String(player.playerId || '');
            if (pid.endsWith('-1') || pid === '1' || index === 0) {
              console.log(`Rendering player [index ${index}]:`, { 
                player, 
                cardKey, 
                index, 
                _id: player._id, 
                playerId: player.playerId,
                name: player.name 
              });
            }
            
            try {
              return (
                <div 
                  key={cardKey} 
                  className="player-card-scaler"
                  data-player-index={index}
                  data-player-id={player.playerId}
                  data-player-name={player.name}
                  style={index === 0 ? { 
                    border: '2px solid red', 
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    position: 'relative',
                    zIndex: 1000
                  } : {}}
                  ref={(el) => {
                    if (el) {
                      cardRefs.current[cardKey] = el;
                      if (index === 0) {
                        console.log('First player card element mounted:', el);
                        console.log('First player card computed styles:', window.getComputedStyle(el));
                        console.log('First player card offset:', {
                          offsetTop: el.offsetTop,
                          offsetLeft: el.offsetLeft,
                          offsetWidth: el.offsetWidth,
                          offsetHeight: el.offsetHeight
                        });
                      }
                    }
                  }}
                >
                  {index === 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      background: 'yellow',
                      color: 'black',
                      padding: '4px 8px',
                      fontSize: '12px',
                      zIndex: 10000,
                      fontWeight: 'bold'
                    }}>
                      FIRST PLAYER (Index: {index})
                    </div>
                  )}
                  <PlayerCardCanvas
                    design={tournament.playerCardDesign}
                    tournament={tournament}
                    previewPlayer={{
                      name: player.name || 'Player Name',
                      playerId: player.playerId || 'PL001',
                      role: player.role || 'Player',
                      city: player.city || 'City',
                      mobile: player.mobile || '+91 0000000000',
                      photo: player.photo || null,
                      countryCode: player.countryCode || '+91'
                    }}
                    selectedElement={null}
                    onElementSelect={() => {}}
                    onDesignChange={() => {}}
                    onShapeChange={() => {}}
                    previewMode={true}
                    previewZoom={1}
                  />
                </div>
              );
            } catch (error) {
              console.error(`Error rendering card for player ${cardKey}:`, error, player);
              return (
                <div key={cardKey} className="player-card-scaler" style={{ border: '2px solid red', padding: '10px' }}>
                  <p>Error rendering card for player {player.name || cardKey}</p>
                  <p style={{ fontSize: '12px', color: '#666' }}>{error.message}</p>
                </div>
              );
            }
          })}
        </div>
      )}

      {generatingPDF && (
        <div className="progress-overlay">
          <div className="progress-card">
            <div className="progress-header">
              <div className="progress-spinner"></div>
              <div className="progress-text">
                <div className="progress-percentage">{pdfProgress.percentage}%</div>
                <div className="progress-message">Generating PDF from player cards...</div>
              </div>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${pdfProgress.percentage}%` }}></div>
            </div>
            <div className="progress-subtext">
              Processing card {pdfProgress.current} of {pdfProgress.total}
            </div>
            <button className="progress-cancel-btn" onClick={handleCancelPDF}>
              Cancel
            </button>
          </div>
        </div>
      )}
      
      <div className="all-player-cards-footer">
        <img src="/logo192.png" alt="PlayLive" className="footer-logo" />
        <p>Powered by PlayLive</p>
      </div>
    </div>
  );
}

export default AllPlayerCards;

