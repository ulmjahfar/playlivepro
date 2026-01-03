import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { API_BASE_URL } from '../utils/apiConfig';
import ImageUploadCrop from './ImageUploadCrop';
import PlayerCardCanvas from './PlayerCardCanvas';
import DesignToolbox from './DesignToolbox';
import DesignProperties from './DesignProperties';
import '../styles/player-card-designer.css';

const DEFAULT_DESIGN = {
  background: {
    type: 'gradient',
    gradient: 'linear-gradient(135deg, #1f004f 0%, #312e81 40%, #3b82f6 100%)',
    imageUrl: '',
    opacity: 1,
    overlay: '',
    backgroundSize: 'cover',
    customWidth: 100,
    customHeight: 100,
    customUnit: '%'
  },
  logo: {
    position: { x: 5, y: 5 },
    size: 100,
    visible: true,
    zIndex: 10,
    shadowEnabled: false,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2
  },
  tournamentName: {
    position: { x: 30, y: 8 },
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Arial',
    fontWeight: 'bold',
    visible: true,
    zIndex: 20,
    circularBorder: false,
    borderShape: 'circle',
    borderSizeMultiplier: 1.8,
    borderColor: '#ffffff',
    shadowEnabled: false,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    textAlign: 'left',
    maxLettersPerLine: 0,
    textWrap: true,
    textStrokeEnabled: false,
    textStrokeWidth: 1,
    textStrokeColor: '#000000'
  },
  playerPhoto: {
    position: { x: 50, y: 35 },
    size: { width: 180, height: 180 },
    shape: 'circle',
    borderWidth: 0,
    borderColor: '#ffffff',
    visible: true,
    zIndex: 30,
    shadowEnabled: false,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2
  },
  playerDetails: {
    position: { x: 5, y: 60 },
    fontSize: 16,
    color: '#ffffff',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    visible: true,
    zIndex: 40,
    circularBorder: false,
    borderShape: 'circle',
    borderSizeMultiplier: 1.8,
    borderColor: '#ffffff',
    showLabels: true,
    shadowEnabled: false,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    textAlign: 'left',
    maxLettersPerLine: 0,
    textWrap: true,
    textStrokeEnabled: false,
    textStrokeWidth: 1,
    textStrokeColor: '#000000'
  },
  playerName: {
    position: { x: 5, y: 80 },
    fontSize: 24,
    color: '#ffffff',
    fontFamily: 'Arial',
    fontWeight: 'bold',
    visible: true,
    zIndex: 50,
    circularBorder: false,
    borderShape: 'circle',
    borderSizeMultiplier: 1.8,
    borderColor: '#ffffff',
    shadowEnabled: false,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    textAlign: 'left',
    maxLettersPerLine: 0,
    textWrap: true,
    textStrokeEnabled: false,
    textStrokeWidth: 1,
    textStrokeColor: '#000000'
  },
  playerId: {
    position: { x: 5, y: 90 },
    fontSize: 14,
    color: '#ffffff',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    visible: true,
    zIndex: 60,
    circularBorder: true,
    borderShape: 'circle',
    borderSizeMultiplier: 1.8,
    borderColor: '#ffffff',
    shadowEnabled: false,
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    textAlign: 'center',
    maxLettersPerLine: 0,
    textWrap: true
  },
  cardDimensions: {
    width: 600,
    height: 800,
    aspectRatio: 0.75
  },
  shapes: [
    {
      type: 'rect',
      position: { x: 5, y: 30 },
      size: { width: 120, height: 20 },
      color: 'rgba(59, 130, 246, 0.35)',
      opacity: 1,
      borderRadius: 12,
      visible: true
    }
  ]
};

function PlayerCardDesigner() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const [selectedElement, setSelectedElement] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPlayer, setPreviewPlayer] = useState({
    name: 'John Doe',
    playerId: 'PL001',
    role: 'Batsman',
    city: 'Mumbai',
    mobile: '+91 9876543210',
    photo: null
  });
  const [previewKey, setPreviewKey] = useState(0);
  const [previewPlayerLoading, setPreviewPlayerLoading] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(0.7);
  const previewModalBodyRef = React.useRef(null);

  // Mouse wheel zoom for preview modal
  useEffect(() => {
    if (!showPreview || !previewModalBodyRef.current) return;

    const handleWheel = (e) => {
      // Only zoom if hovering over the preview body or using Ctrl/Cmd+scroll
      const isOverPreviewBody = previewModalBodyRef.current?.contains(e.target);
      
      if (isOverPreviewBody || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05; // Scroll down = zoom out, scroll up = zoom in
        setPreviewZoom(prev => {
          const newZoom = prev + zoomDelta;
          return Math.max(0.3, Math.min(2, newZoom)); // Clamp between 0.3 and 2
        });
      }
    };

    const modalBody = previewModalBodyRef.current;
    if (modalBody) {
      modalBody.addEventListener('wheel', handleWheel, { passive: false });
    }

    // Also add to window for Ctrl+scroll anywhere
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (modalBody) {
        modalBody.removeEventListener('wheel', handleWheel);
      }
      window.removeEventListener('wheel', handleWheel);
    };
  }, [showPreview]);

  useEffect(() => {
    fetchTournament();
  }, [code]);

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const container = document.querySelector('.player-card-designer');
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      
      // Min width: 200px, Max width: 500px
      const clampedWidth = Math.max(200, Math.min(500, newWidth));
      setRightPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const fetchTournament = async () => {
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

      const res = await axios.get(`${API_BASE_URL}/api/tournaments/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.data.success) {
        throw new Error('Failed to fetch tournament');
      }

      setTournament(res.data.tournament);

      // Load existing design or use default
      if (res.data.tournament.playerCardDesign) {
        // Use saved design directly, but ensure all required properties exist by merging with defaults
        const savedDesign = res.data.tournament.playerCardDesign;
        
        // DEBUG: Log the raw saved design to see what's actually in the database
        console.log('[Load] Raw saved design from database:', JSON.stringify(savedDesign, null, 2));
        const textFields = ['tournamentName', 'playerDetails', 'playerName', 'playerId'];
        textFields.forEach(key => {
          if (savedDesign[key]) {
            console.log(`[Load] Raw ${key} from DB:`, JSON.stringify(savedDesign[key], null, 2));
            if (savedDesign[key].textAlign) {
              console.log(`[Load] ✅ ${key}.textAlign found in DB: ${savedDesign[key].textAlign}`);
            } else {
              console.warn(`[Load] ❌ ${key}.textAlign MISSING in DB!`);
            }
          }
        });
        
        // Helper function to deep merge element with defaults (preserves all saved properties)
        const mergeElement = (saved, defaults) => {
          if (!saved || typeof saved !== 'object') {
            // If saved is null/undefined, return deep copy of defaults
            return JSON.parse(JSON.stringify(defaults));
          }
          
          // Start with a deep copy of defaults
          const merged = JSON.parse(JSON.stringify(defaults));
          
          // Override with all saved properties (including falsy values like false, 0, '', null)
          // Skip undefined values to use defaults instead
          for (const key in saved) {
            if (saved.hasOwnProperty(key)) {
              const savedValue = saved[key];
              
              // Skip undefined values - use default instead
              if (savedValue === undefined) {
                continue;
              }
              
              const defaultValue = defaults[key];
              
              // Handle nested objects (like position: {x, y}, size: {width, height})
              if (typeof savedValue === 'object' && savedValue !== null && !Array.isArray(savedValue)) {
                if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
                  // Shallow merge nested objects (they're simple objects like {x, y} or {width, height})
                  merged[key] = { ...defaultValue, ...savedValue };
                } else {
                  // If default doesn't have this nested object, use saved as-is (deep copy)
                  merged[key] = JSON.parse(JSON.stringify(savedValue));
                }
              } else {
                // For primitives, arrays, null, etc. - always use saved value
                // This preserves false, 0, '', null explicitly set values
                // CRITICAL: For textAlign, preserve 'center' and 'right' values explicitly
                if (key === 'textAlign' && (savedValue === 'center' || savedValue === 'right' || savedValue === 'left')) {
                  merged[key] = savedValue;
                } else {
                  merged[key] = savedValue;
                }
              }
            }
          }
          
          return merged;
        };
        
        const mergedDesign = {
          background: mergeElement(savedDesign.background, DEFAULT_DESIGN.background),
          logo: mergeElement(savedDesign.logo, DEFAULT_DESIGN.logo),
          tournamentName: mergeElement(savedDesign.tournamentName, DEFAULT_DESIGN.tournamentName),
          playerPhoto: mergeElement(savedDesign.playerPhoto, DEFAULT_DESIGN.playerPhoto),
          playerDetails: mergeElement(savedDesign.playerDetails, DEFAULT_DESIGN.playerDetails),
          playerName: mergeElement(savedDesign.playerName, DEFAULT_DESIGN.playerName),
          playerId: mergeElement(savedDesign.playerId, DEFAULT_DESIGN.playerId),
          cardDimensions: mergeElement(savedDesign.cardDimensions, DEFAULT_DESIGN.cardDimensions),
          shapes: savedDesign.shapes && Array.isArray(savedDesign.shapes) && savedDesign.shapes.length > 0
            ? savedDesign.shapes.map(shape => ({
                ...DEFAULT_DESIGN.shapes[0],
                ...shape
              }))
            : DEFAULT_DESIGN.shapes
        };
        
        // DEBUG: Log textAlign values after loading to verify they're preserved
        // Reuse textFields declared above
        textFields.forEach(key => {
          // CRITICAL: Explicitly preserve textAlign from saved design if it exists
          if (savedDesign[key] && savedDesign[key].textAlign && ['left', 'center', 'right'].includes(savedDesign[key].textAlign)) {
            // Force textAlign to be preserved even if merge didn't work correctly
            mergedDesign[key].textAlign = savedDesign[key].textAlign;
            console.log(`[Load] ${key}.textAlign = ${mergedDesign[key].textAlign} (preserved from saved design)`);
          } else if (mergedDesign[key] && mergedDesign[key].textAlign) {
            console.log(`[Load] ${key}.textAlign = ${mergedDesign[key].textAlign}`);
          } else {
            console.warn(`[Load] ${key}.textAlign not found in saved design, using default: left`);
          }
        });
        
        setDesign(mergedDesign);
      } else {
        // No saved design, use defaults
        console.log('No saved design found, using defaults');
        setDesign(DEFAULT_DESIGN);
      }
    } catch (error) {
      console.error('Failed to fetch tournament', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. You do not have permission to access this tournament.');
      } else if (error.response?.status === 404) {
        toast.error('Tournament not found.');
      } else {
        toast.error('Failed to load tournament data');
      }
      navigate(`/tournament/${code}/settings`);
    } finally {
      setLoading(false);
    }
  };

  const handleDesignChange = useCallback((elementKey, updates) => {
    setDesign(prev => {
      // Special handling for shapes array replacement
      if (elementKey === 'shapes' && Array.isArray(updates)) {
        return {
          ...prev,
          shapes: updates
        };
      }
      // Regular element updates
      return {
        ...prev,
        [elementKey]: {
          ...prev[elementKey],
          ...updates
        }
      };
    });
  }, []);

  const handleAddShape = useCallback(() => {
    setDesign(prev => {
      const shapes = Array.isArray(prev.shapes) ? [...prev.shapes] : [];
      const allElements = [
        ...['logo', 'tournamentName', 'playerPhoto', 'playerDetails', 'playerName', 'playerId']
          .map(key => design[key]?.zIndex || 0),
        ...(design.shapes || []).map(shape => shape.zIndex || 0)
      ];
      const maxZIndex = Math.max(...allElements, 0);
      
      const newShape = {
        type: 'rect',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 100 },
        color: 'rgba(59, 130, 246, 0.5)',
        opacity: 1,
        borderRadius: 0,
        visible: true,
        zIndex: maxZIndex + 10,
        shadowEnabled: false,
        shadowColor: 'rgba(0, 0, 0, 0.5)',
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2
      };
      shapes.push(newShape);
      setSelectedElement(`shape-${shapes.length - 1}`);
      toast.success('Shape added');
      return { ...prev, shapes };
    });
  }, []);

  const handleShapeChange = useCallback((index, updates) => {
    setDesign(prev => {
      const shapes = Array.isArray(prev.shapes) ? [...prev.shapes] : [];
      if (!shapes[index]) return prev;
      shapes[index] = { ...shapes[index], ...updates };
      return { ...prev, shapes };
    });
  }, []);

  const handleBackgroundImageUpload = useCallback((url) => {
    setDesign(prev => ({
      ...prev,
      background: {
        ...prev.background,
        type: 'image',
        imageUrl: url
      }
    }));
    toast.success('Background image uploaded');
  }, []);

  const fetchFirstPlayer = async () => {
    try {
      setPreviewPlayerLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        toast.warning('Session expired. Using sample data for preview.');
        setShowPreview(true);
        return;
      }

      const res = await axios.get(`${API_BASE_URL}/api/players/${code}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.players && res.data.players.length > 0) {
        const firstPlayer = res.data.players[0];
        const updatedPlayer = {
          name: firstPlayer.name?.trim() || 'Player Name',
          playerId: firstPlayer.playerId?.trim() || 'PL001',
          role: firstPlayer.role?.trim() || 'Player',
          city: firstPlayer.city?.trim() || 'City',
          mobile: firstPlayer.mobile?.trim() || '+91 0000000000',
          photo: firstPlayer.photo || null
        };
        setPreviewPlayer(updatedPlayer);
        setPreviewKey(prev => prev + 1); // Force re-render
        console.log('Preview player updated:', updatedPlayer);
      } else {
        // If no players, keep default preview player
        toast.info('No registered players found. Using sample data for preview.');
        setPreviewKey(prev => prev + 1); // Force re-render
      }
    } catch (error) {
      console.error('Failed to fetch first player', error);
      toast.warning('Could not load player data. Using sample data for preview.');
    } finally {
      setPreviewPlayerLoading(false);
    }
  };

  const handlePreview = async () => {
    await fetchFirstPlayer();
    setShowPreview(true);
  };


  const handleSaveDesign = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      setSaving(true);

      // Validate design structure
      if (!design || typeof design !== 'object') {
        toast.error('Invalid design data');
        return;
      }

      // CRITICAL: Use current design state directly - this ensures ALL current edits are saved
      // Deep clone the ENTIRE design object to preserve every single property and nested value
      // This is the source of truth - it contains all current user edits
      const designToSave = JSON.parse(JSON.stringify(design));
      
      // Define variables for verification
      const textFields = ['tournamentName', 'playerDetails', 'playerName', 'playerId'];
      const elements = ['logo', 'tournamentName', 'playerPhoto', 'playerDetails', 'playerName', 'playerId'];
      
      // The deep clone above already preserves ALL properties including:
      // - All background properties (type, gradient, imageUrl, opacity, backgroundSize, customWidth, customHeight, customUnit, overlay)
      // - All element properties (position, size, colors, fonts, shadows, borders, zIndex, visible, etc.)
      // - All text field properties (textAlign, width, fontSize, color, fontFamily, fontWeight, textStroke, etc.)
      // - All shapes with all their properties
      // - Card dimensions
      // - Everything else in the design object
      
      // No need to manually preserve individual properties - the deep clone does it all
      // The verification function below will only ADD missing defaults, not remove existing values
      
      // Verify and ensure all critical properties are present (same logic as export)
      // This ensures shadows, positions, colors, sizes, widths, text properties, etc. are all included
      const verifyAndCompleteDesign = (designObj) => {
        // Deep clone to preserve all properties including width, height, and all text field properties
        const verified = JSON.parse(JSON.stringify(designObj));
        
        // Define text field elements
        const textFields = ['tournamentName', 'playerDetails', 'playerName', 'playerId'];
        
        // Ensure all element properties are complete
        const elements = ['logo', 'tournamentName', 'playerPhoto', 'playerDetails', 'playerName', 'playerId'];
        elements.forEach(elementKey => {
          if (verified[elementKey]) {
            // Preserve all existing properties (they're already cloned above)
            // Only set defaults for missing properties
            
            // Ensure position object exists
            if (!verified[elementKey].position || typeof verified[elementKey].position !== 'object') {
              verified[elementKey].position = { x: 0, y: 0 };
            }
            
            // For text fields, ensure all text properties are preserved/exist
            if (textFields.includes(elementKey)) {
              // Text styling properties - preserve existing values, only set defaults if missing
              if (verified[elementKey].fontSize === undefined) verified[elementKey].fontSize = 16;
              if (!verified[elementKey].color) verified[elementKey].color = '#ffffff';
              if (!verified[elementKey].fontFamily) verified[elementKey].fontFamily = 'Arial';
              if (!verified[elementKey].fontWeight) verified[elementKey].fontWeight = 'normal';
              // CRITICAL: Always ensure textAlign is explicitly set - preserve existing value or default to 'left'
              // This ensures textAlign is ALWAYS in the saved design, even if it's the default
              if (verified[elementKey].textAlign === undefined || verified[elementKey].textAlign === null) {
                verified[elementKey].textAlign = 'left';
              }
              // Explicitly ensure textAlign is a valid value
              if (!['left', 'center', 'right'].includes(verified[elementKey].textAlign)) {
                verified[elementKey].textAlign = 'left';
              }
              if (verified[elementKey].maxLettersPerLine === undefined) verified[elementKey].maxLettersPerLine = 0;
              if (verified[elementKey].textWrap === undefined) verified[elementKey].textWrap = true;
              
              // Text stroke properties
              if (verified[elementKey].textStrokeEnabled === undefined) verified[elementKey].textStrokeEnabled = false;
              if (verified[elementKey].textStrokeWidth === undefined) verified[elementKey].textStrokeWidth = 1;
              if (!verified[elementKey].textStrokeColor) verified[elementKey].textStrokeColor = '#000000';
              
              // Border properties for text
              if (verified[elementKey].circularBorder === undefined) verified[elementKey].circularBorder = false;
              if (!verified[elementKey].borderShape) verified[elementKey].borderShape = 'circle';
              if (verified[elementKey].borderSizeMultiplier === undefined) verified[elementKey].borderSizeMultiplier = 1.8;
              if (!verified[elementKey].borderColor) verified[elementKey].borderColor = '#ffffff';
              
              // Width property (new - for text field area sizing) - preserve existing value
              // width is optional, so we don't set a default - it's only set when user draws/resizes
            }
            
            // Ensure shadow properties exist (for all elements)
            if (verified[elementKey].shadowEnabled === undefined) {
              verified[elementKey].shadowEnabled = false;
            }
            if (!verified[elementKey].shadowColor) {
              verified[elementKey].shadowColor = 'rgba(0, 0, 0, 0.5)';
            }
            if (verified[elementKey].shadowBlur === undefined) {
              verified[elementKey].shadowBlur = 4;
            }
            if (verified[elementKey].shadowOffsetX === undefined) {
              verified[elementKey].shadowOffsetX = 2;
            }
            if (verified[elementKey].shadowOffsetY === undefined) {
              verified[elementKey].shadowOffsetY = 2;
            }
            // Ensure zIndex exists
            if (verified[elementKey].zIndex === undefined) {
              verified[elementKey].zIndex = 10;
            }
            // Ensure visible exists
            if (verified[elementKey].visible === undefined) {
              verified[elementKey].visible = true;
            }
            
            // PlayerDetails specific property
            if (elementKey === 'playerDetails' && verified[elementKey].showLabels === undefined) {
              verified[elementKey].showLabels = true;
            }
          }
        });
        
        // Ensure playerPhoto has size object and all properties
        if (verified.playerPhoto) {
          if (!verified.playerPhoto.size || typeof verified.playerPhoto.size !== 'object') {
            verified.playerPhoto.size = { width: 180, height: 180 };
          }
          if (!verified.playerPhoto.shape) verified.playerPhoto.shape = 'circle';
          if (verified.playerPhoto.borderWidth === undefined) verified.playerPhoto.borderWidth = 0;
          if (!verified.playerPhoto.borderColor) verified.playerPhoto.borderColor = '#ffffff';
        }
        
        // Ensure logo has size property
        if (verified.logo && verified.logo.size === undefined) {
          verified.logo.size = 100;
        }
        
        // Ensure background properties exist - preserve all existing values, only set defaults if missing
        if (verified.background) {
          if (!verified.background.type) verified.background.type = 'gradient';
          if (verified.background.opacity === undefined) verified.background.opacity = 1;
          if (!verified.background.backgroundSize) verified.background.backgroundSize = 'cover';
          // Always preserve custom size values (even if not currently using custom size)
          if (verified.background.customWidth === undefined) verified.background.customWidth = 100;
          if (verified.background.customHeight === undefined) verified.background.customHeight = 100;
          if (!verified.background.customUnit) verified.background.customUnit = '%';
          // Preserve imageUrl and gradient if they exist
          if (designObj.background && designObj.background.imageUrl) {
            verified.background.imageUrl = designObj.background.imageUrl;
          }
          if (designObj.background && designObj.background.gradient) {
            verified.background.gradient = designObj.background.gradient;
          }
        }
        
        // Ensure cardDimensions exist
        if (!verified.cardDimensions) {
          verified.cardDimensions = { width: 600, height: 800, aspectRatio: 0.75 };
        }
        
        // Ensure shapes array exists and each shape has all properties
        if (!Array.isArray(verified.shapes)) {
          verified.shapes = [];
        } else {
          verified.shapes = verified.shapes.map(shape => ({
            ...shape,
            position: shape.position || { x: 0, y: 0 },
            size: shape.size || { width: 100, height: 100 },
            color: shape.color || 'rgba(59, 130, 246, 0.5)',
            opacity: shape.opacity !== undefined ? shape.opacity : 1,
            borderRadius: shape.borderRadius !== undefined ? shape.borderRadius : 0,
            visible: shape.visible !== undefined ? shape.visible : true,
            zIndex: shape.zIndex !== undefined ? shape.zIndex : 5,
            shadowEnabled: shape.shadowEnabled !== undefined ? shape.shadowEnabled : false,
            shadowColor: shape.shadowColor || 'rgba(0, 0, 0, 0.5)',
            shadowBlur: shape.shadowBlur !== undefined ? shape.shadowBlur : 4,
            shadowOffsetX: shape.shadowOffsetX !== undefined ? shape.shadowOffsetX : 2,
            shadowOffsetY: shape.shadowOffsetY !== undefined ? shape.shadowOffsetY : 2
          }));
        }
        
        return verified;
      };
      
      const completeDesign = verifyAndCompleteDesign(designToSave);
      
      // CRITICAL: Final pass - ensure ALL current design properties are preserved
      // This is a safety net to catch any properties that might have been lost during verification
      
      // Preserve background custom size properties from current design state
      if (design.background && completeDesign.background) {
        if (design.background.customWidth !== undefined) {
          completeDesign.background.customWidth = design.background.customWidth;
        }
        if (design.background.customHeight !== undefined) {
          completeDesign.background.customHeight = design.background.customHeight;
        }
        if (design.background.customUnit) {
          completeDesign.background.customUnit = design.background.customUnit;
        }
        if (design.background.backgroundSize) {
          completeDesign.background.backgroundSize = design.background.backgroundSize;
        }
        if (design.background.opacity !== undefined) {
          completeDesign.background.opacity = design.background.opacity;
        }
      }
      
      // Preserve text field properties
      textFields.forEach(key => {
        if (design[key] && completeDesign[key]) {
          // Ensure textAlign is explicitly set before saving
          if (design[key].textAlign) {
            completeDesign[key].textAlign = design[key].textAlign;
          } else if (!completeDesign[key].textAlign || !['left', 'center', 'right'].includes(completeDesign[key].textAlign)) {
            completeDesign[key].textAlign = 'left';
          }
          // Preserve width if set
          if (design[key].width !== undefined) {
            completeDesign[key].width = design[key].width;
          }
        }
      });
      
      // Preserve all element positions and sizes
      elements.forEach(key => {
        if (design[key] && completeDesign[key]) {
          if (design[key].position) {
            completeDesign[key].position = { ...design[key].position };
          }
          if (design[key].size !== undefined) {
            if (typeof design[key].size === 'object') {
              completeDesign[key].size = { ...design[key].size };
            } else {
              completeDesign[key].size = design[key].size;
            }
          }
        }
      });
      
      // CRITICAL: Final merge - ensure ALL current design state properties are preserved
      // This is the most important step - merge current design (source of truth) back into completeDesign
      // to catch ANY properties that might have been missed during verification
      const mergeAllProperties = (target, source) => {
        if (!source || typeof source !== 'object') {
          return target;
        }
        
        // Handle arrays separately - completely replace if source is array
        if (Array.isArray(source)) {
          return JSON.parse(JSON.stringify(source));
        }
        
        // For objects, merge recursively
        Object.keys(source).forEach(key => {
          const sourceValue = source[key];
          
          // Preserve all values including null, but skip undefined
          if (sourceValue === undefined) {
            // Only skip undefined, keep null values
            return;
          }
          
          if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue)) {
            // Nested object - merge recursively
            if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
              // Target doesn't exist or is wrong type - replace with source
              target[key] = JSON.parse(JSON.stringify(sourceValue));
            } else {
              // Both are objects - merge recursively
              target[key] = mergeAllProperties(
                JSON.parse(JSON.stringify(target[key])),
                sourceValue
              );
            }
          } else {
            // Primitive, null, or array - use source value (current state is source of truth)
            if (Array.isArray(sourceValue)) {
              target[key] = JSON.parse(JSON.stringify(sourceValue));
            } else {
              target[key] = sourceValue;
            }
          }
        });
        
        return target;
      };
      
      // Final merge: current design state (all edits) -> completeDesign (verified)
      // This ensures that even if verification missed something, we restore it from current state
      const finalDesignWithAllEdits = mergeAllProperties(
        JSON.parse(JSON.stringify(completeDesign)),
        design
      );
      
      // EXTRA SAFETY: One more pass to explicitly copy any top-level properties that might have been missed
      Object.keys(design).forEach(key => {
        if (design[key] !== undefined && !finalDesignWithAllEdits.hasOwnProperty(key)) {
          finalDesignWithAllEdits[key] = JSON.parse(JSON.stringify(design[key]));
        }
      });
      
      // FINAL VERIFICATION: Ensure all element properties from current design are preserved
      const allElements = ['logo', 'tournamentName', 'playerPhoto', 'playerDetails', 'playerName', 'playerId'];
      allElements.forEach(elementKey => {
        if (design[elementKey] && finalDesignWithAllEdits[elementKey]) {
          // Merge all properties from current design state
          Object.keys(design[elementKey]).forEach(prop => {
            if (design[elementKey][prop] !== undefined) {
              if (typeof design[elementKey][prop] === 'object' && !Array.isArray(design[elementKey][prop]) && design[elementKey][prop] !== null) {
                // Nested object - merge deeply
                finalDesignWithAllEdits[elementKey][prop] = mergeAllProperties(
                  finalDesignWithAllEdits[elementKey][prop] || {},
                  design[elementKey][prop]
                );
              } else {
                // Primitive or array - use current value
                finalDesignWithAllEdits[elementKey][prop] = Array.isArray(design[elementKey][prop])
                  ? JSON.parse(JSON.stringify(design[elementKey][prop]))
                  : design[elementKey][prop];
              }
            }
          });
        }
      });
      
      // Ensure background properties are completely preserved
      if (design.background && finalDesignWithAllEdits.background) {
        Object.keys(design.background).forEach(prop => {
          if (design.background[prop] !== undefined) {
            if (typeof design.background[prop] === 'object' && !Array.isArray(design.background[prop]) && design.background[prop] !== null) {
              finalDesignWithAllEdits.background[prop] = mergeAllProperties(
                finalDesignWithAllEdits.background[prop] || {},
                design.background[prop]
              );
            } else {
              finalDesignWithAllEdits.background[prop] = Array.isArray(design.background[prop])
                ? JSON.parse(JSON.stringify(design.background[prop]))
                : design.background[prop];
            }
          }
        });
      }
      
      // Ensure shapes array is completely preserved
      if (Array.isArray(design.shapes)) {
        finalDesignWithAllEdits.shapes = design.shapes.map(shape => {
          const savedShape = finalDesignWithAllEdits.shapes?.find(s => s.id === shape.id) || {};
          return mergeAllProperties(savedShape, shape);
        });
      }
      
      // DEBUG: Verify critical properties
      if (finalDesignWithAllEdits.background) {
        console.log('[Save] Background properties:', {
          type: finalDesignWithAllEdits.background.type,
          backgroundSize: finalDesignWithAllEdits.background.backgroundSize,
          customWidth: finalDesignWithAllEdits.background.customWidth,
          customHeight: finalDesignWithAllEdits.background.customHeight,
          customUnit: finalDesignWithAllEdits.background.customUnit,
          opacity: finalDesignWithAllEdits.background.opacity,
          hasImageUrl: !!finalDesignWithAllEdits.background.imageUrl
        });
      }

      const res = await axios.put(
        `${API_BASE_URL}/api/tournaments/${code}/player-card-design`,
        { playerCardDesign: finalDesignWithAllEdits },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        toast.success('RP Card design saved successfully! All properties including text field widths, positions, colors, and styling have been saved.');
        
        // DEBUG: Log what the server returned to verify textAlign was saved
        if (res.data.playerCardDesign) {
          console.log('[Save] Server returned saved design:', JSON.stringify(res.data.playerCardDesign, null, 2));
          const textFields = ['tournamentName', 'playerDetails', 'playerName', 'playerId'];
          textFields.forEach(key => {
            if (res.data.playerCardDesign[key] && res.data.playerCardDesign[key].textAlign) {
              console.log(`[Save] ✅ Server confirmed ${key}.textAlign = ${res.data.playerCardDesign[key].textAlign}`);
            } else {
              console.warn(`[Save] ❌ Server response missing ${key}.textAlign!`);
            }
          });
        }
        
        // Update local state with the saved design to ensure consistency
        setDesign(finalDesignWithAllEdits);
      } else {
        toast.error(res.data.message || 'Failed to save design');
      }
    } catch (error) {
      console.error('Failed to save design', error);
      if (error.response?.status === 403) {
        toast.error('Access denied. You do not have permission to save designs.');
      } else if (error.response?.status === 404) {
        toast.error('Tournament not found.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to save design. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleExportDesign = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Session expired. Please login again.');
        return;
      }

      // Use current design state to ensure ALL properties are exported
      // This includes all current changes even if not saved yet
      // Deep clone to ensure we export the complete design object with all nested properties
      const designToExport = JSON.parse(JSON.stringify(design));
      
      // Verify and ensure all critical properties are present
      // This ensures shadows, positions, colors, sizes, widths, text properties, etc. are all included
      const verifyAndCompleteDesign = (designObj) => {
        // Deep clone to preserve all properties including width, height, and all text field properties
        const verified = JSON.parse(JSON.stringify(designObj));
        
        // Define text field elements
        const textFields = ['tournamentName', 'playerDetails', 'playerName', 'playerId'];
        
        // Ensure all element properties are complete
        const elements = ['logo', 'tournamentName', 'playerPhoto', 'playerDetails', 'playerName', 'playerId'];
        elements.forEach(elementKey => {
          if (verified[elementKey]) {
            // Preserve all existing properties (they're already cloned above)
            // Only set defaults for missing properties
            
            // Ensure position object exists
            if (!verified[elementKey].position || typeof verified[elementKey].position !== 'object') {
              verified[elementKey].position = { x: 0, y: 0 };
            }
            
            // For text fields, ensure all text properties are preserved/exist
            if (textFields.includes(elementKey)) {
              // Text styling properties - preserve existing values, only set defaults if missing
              if (verified[elementKey].fontSize === undefined) verified[elementKey].fontSize = 16;
              if (!verified[elementKey].color) verified[elementKey].color = '#ffffff';
              if (!verified[elementKey].fontFamily) verified[elementKey].fontFamily = 'Arial';
              if (!verified[elementKey].fontWeight) verified[elementKey].fontWeight = 'normal';
              // CRITICAL: Always ensure textAlign is explicitly set - preserve existing value or default to 'left'
              // This ensures textAlign is ALWAYS in the saved design, even if it's the default
              if (verified[elementKey].textAlign === undefined || verified[elementKey].textAlign === null) {
                verified[elementKey].textAlign = 'left';
              }
              // Explicitly ensure textAlign is a valid value
              if (!['left', 'center', 'right'].includes(verified[elementKey].textAlign)) {
                verified[elementKey].textAlign = 'left';
              }
              if (verified[elementKey].maxLettersPerLine === undefined) verified[elementKey].maxLettersPerLine = 0;
              if (verified[elementKey].textWrap === undefined) verified[elementKey].textWrap = true;
              
              // Text stroke properties
              if (verified[elementKey].textStrokeEnabled === undefined) verified[elementKey].textStrokeEnabled = false;
              if (verified[elementKey].textStrokeWidth === undefined) verified[elementKey].textStrokeWidth = 1;
              if (!verified[elementKey].textStrokeColor) verified[elementKey].textStrokeColor = '#000000';
              
              // Border properties for text
              if (verified[elementKey].circularBorder === undefined) verified[elementKey].circularBorder = false;
              if (!verified[elementKey].borderShape) verified[elementKey].borderShape = 'circle';
              if (verified[elementKey].borderSizeMultiplier === undefined) verified[elementKey].borderSizeMultiplier = 1.8;
              if (!verified[elementKey].borderColor) verified[elementKey].borderColor = '#ffffff';
              
              // Width property (new - for text field area sizing) - preserve existing value
              // width is optional, so we don't set a default - it's only set when user draws/resizes
            }
            
            // Ensure shadow properties exist (for all elements)
            if (verified[elementKey].shadowEnabled === undefined) {
              verified[elementKey].shadowEnabled = false;
            }
            if (!verified[elementKey].shadowColor) {
              verified[elementKey].shadowColor = 'rgba(0, 0, 0, 0.5)';
            }
            if (verified[elementKey].shadowBlur === undefined) {
              verified[elementKey].shadowBlur = 4;
            }
            if (verified[elementKey].shadowOffsetX === undefined) {
              verified[elementKey].shadowOffsetX = 2;
            }
            if (verified[elementKey].shadowOffsetY === undefined) {
              verified[elementKey].shadowOffsetY = 2;
            }
            // Ensure zIndex exists
            if (verified[elementKey].zIndex === undefined) {
              verified[elementKey].zIndex = 10;
            }
            // Ensure visible exists
            if (verified[elementKey].visible === undefined) {
              verified[elementKey].visible = true;
            }
            
            // PlayerDetails specific property
            if (elementKey === 'playerDetails' && verified[elementKey].showLabels === undefined) {
              verified[elementKey].showLabels = true;
            }
          }
        });
        
        // Ensure playerPhoto has size object and all properties
        if (verified.playerPhoto) {
          if (!verified.playerPhoto.size || typeof verified.playerPhoto.size !== 'object') {
            verified.playerPhoto.size = { width: 180, height: 180 };
          }
          if (!verified.playerPhoto.shape) verified.playerPhoto.shape = 'circle';
          if (verified.playerPhoto.borderWidth === undefined) verified.playerPhoto.borderWidth = 0;
          if (!verified.playerPhoto.borderColor) verified.playerPhoto.borderColor = '#ffffff';
        }
        
        // Ensure logo has size property
        if (verified.logo && verified.logo.size === undefined) {
          verified.logo.size = 100;
        }
        
        // Ensure background properties exist - preserve all existing values, only set defaults if missing
        if (verified.background) {
          if (!verified.background.type) verified.background.type = 'gradient';
          if (verified.background.opacity === undefined) verified.background.opacity = 1;
          if (!verified.background.backgroundSize) verified.background.backgroundSize = 'cover';
          // Always preserve custom size values (even if not currently using custom size)
          if (verified.background.customWidth === undefined) verified.background.customWidth = 100;
          if (verified.background.customHeight === undefined) verified.background.customHeight = 100;
          if (!verified.background.customUnit) verified.background.customUnit = '%';
          // Preserve imageUrl and gradient if they exist
          if (designObj.background && designObj.background.imageUrl) {
            verified.background.imageUrl = designObj.background.imageUrl;
          }
          if (designObj.background && designObj.background.gradient) {
            verified.background.gradient = designObj.background.gradient;
          }
        }
        
        // Ensure cardDimensions exist
        if (!verified.cardDimensions) {
          verified.cardDimensions = { width: 600, height: 800, aspectRatio: 0.75 };
        }
        
        // Ensure shapes array exists and each shape has all properties
        if (!Array.isArray(verified.shapes)) {
          verified.shapes = [];
        } else {
          verified.shapes = verified.shapes.map(shape => ({
            ...shape,
            position: shape.position || { x: 0, y: 0 },
            size: shape.size || { width: 100, height: 100 },
            color: shape.color || 'rgba(59, 130, 246, 0.5)',
            opacity: shape.opacity !== undefined ? shape.opacity : 1,
            borderRadius: shape.borderRadius !== undefined ? shape.borderRadius : 0,
            visible: shape.visible !== undefined ? shape.visible : true,
            zIndex: shape.zIndex !== undefined ? shape.zIndex : 5,
            shadowEnabled: shape.shadowEnabled !== undefined ? shape.shadowEnabled : false,
            shadowColor: shape.shadowColor || 'rgba(0, 0, 0, 0.5)',
            shadowBlur: shape.shadowBlur !== undefined ? shape.shadowBlur : 4,
            shadowOffsetX: shape.shadowOffsetX !== undefined ? shape.shadowOffsetX : 2,
            shadowOffsetY: shape.shadowOffsetY !== undefined ? shape.shadowOffsetY : 2
          }));
        }
        
        return verified;
      };
      
      const completeDesign = verifyAndCompleteDesign(designToExport);
      
      // Create export data with metadata
      const exportData = {
        version: '1.0',
        tournamentCode: code,
        tournamentName: tournament?.name || 'Unknown Tournament',
        exportedAt: new Date().toISOString(),
        design: completeDesign
      };

      // Convert to JSON and download
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `rp-card-design-${code}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Design exported successfully! All properties including shadows, positions, colors, image styles, sizes, text field widths, and all styling properties have been exported.');
    } catch (error) {
      console.error('Failed to export design', error);
      toast.error('Failed to export design. Please try again.');
    }
  };

  const handleImportDesign = async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      // Validate file type
      if (!file.name.endsWith('.json')) {
        toast.error('Please select a valid JSON file.');
        return;
      }

      // Read file content
      const fileContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsText(file);
      });

      // Parse JSON
      const importData = JSON.parse(fileContent);

      // Validate structure
      if (!importData.design || typeof importData.design !== 'object') {
        toast.error('Invalid design file format.');
        return;
      }

      // Confirm import
      if (!window.confirm('Import this design? This will replace your current design.')) {
        event.target.value = ''; // Reset file input
        return;
      }

      // Merge imported design with defaults to ensure all properties are present
      // Use the same robust merge logic as when loading from database
      const mergeElement = (saved, defaults) => {
        if (!saved || typeof saved !== 'object') {
          // If saved is null/undefined, return deep copy of defaults
          return JSON.parse(JSON.stringify(defaults));
        }
        
        // Start with a deep copy of defaults
        const merged = JSON.parse(JSON.stringify(defaults));
        
        // Override with all saved properties (including falsy values like false, 0, '', null)
        // Skip undefined values to use defaults instead
        for (const key in saved) {
          if (saved.hasOwnProperty(key)) {
            const savedValue = saved[key];
            
            // Skip undefined values - use default instead
            if (savedValue === undefined) {
              continue;
            }
            
            const defaultValue = defaults[key];
            
            // Handle nested objects (like position: {x, y}, size: {width, height})
            if (typeof savedValue === 'object' && savedValue !== null && !Array.isArray(savedValue)) {
              if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
                // Shallow merge nested objects (they're simple objects like {x, y} or {width, height})
                merged[key] = { ...defaultValue, ...savedValue };
              } else {
                // If default doesn't have this nested object, use saved as-is (deep copy)
                merged[key] = JSON.parse(JSON.stringify(savedValue));
              }
            } else {
              // For primitives, arrays, null, etc. - always use saved value
              // This preserves false, 0, '', null explicitly set values
              merged[key] = savedValue;
            }
          }
        }
        
        return merged;
      };

      const importedDesign = importData.design;
      const mergedDesign = {
        background: mergeElement(importedDesign.background, DEFAULT_DESIGN.background),
        logo: mergeElement(importedDesign.logo, DEFAULT_DESIGN.logo),
        tournamentName: mergeElement(importedDesign.tournamentName, DEFAULT_DESIGN.tournamentName),
        playerPhoto: mergeElement(importedDesign.playerPhoto, DEFAULT_DESIGN.playerPhoto),
        playerDetails: mergeElement(importedDesign.playerDetails, DEFAULT_DESIGN.playerDetails),
        playerName: mergeElement(importedDesign.playerName, DEFAULT_DESIGN.playerName),
        playerId: mergeElement(importedDesign.playerId, DEFAULT_DESIGN.playerId),
        cardDimensions: mergeElement(importedDesign.cardDimensions, DEFAULT_DESIGN.cardDimensions),
        shapes: importedDesign.shapes && Array.isArray(importedDesign.shapes) && importedDesign.shapes.length > 0
          ? importedDesign.shapes.map(shape => ({
              ...DEFAULT_DESIGN.shapes[0],
              ...shape,
              // Ensure nested objects are properly merged
              position: {
                ...DEFAULT_DESIGN.shapes[0].position,
                ...(shape.position || {})
              },
              size: {
                ...DEFAULT_DESIGN.shapes[0].size,
                ...(shape.size || {})
              }
            }))
          : DEFAULT_DESIGN.shapes
      };

      // Set the imported design
      setDesign(mergedDesign);
      setSelectedElement(null);
      
      toast.success('Design imported successfully! Don\'t forget to save.');
      
      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Failed to import design', error);
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON file. Please check the file format.');
      } else {
        toast.error('Failed to import design. Please try again.');
      }
      event.target.value = ''; // Reset file input
    }
  };

  const handleGenerateAllCards = () => {
    navigate(`/tournament/${code}/settings/player-card-designer/all-cards`);
  };

  if (loading) {
    return (
      <div className="player-card-designer-loading">
        <div className="loading-spinner"></div>
        <p>Loading designer...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="player-card-designer-error">
        <p>Tournament not found</p>
      </div>
    );
  }

  return (
    <div className="player-card-designer">
      <div className="designer-layout">
        <div className="designer-left-panel">
          <DesignToolbox
            design={design}
            onDesignChange={handleDesignChange}
            onShapeChange={handleShapeChange}
            onAddShape={handleAddShape}
            onBackgroundImageUpload={handleBackgroundImageUpload}
            onElementSelect={setSelectedElement}
            selectedElement={selectedElement}
            tournament={tournament}
          />
        </div>

        <div className="designer-center-panel">
          <PlayerCardCanvas
            design={design}
            tournament={tournament}
            previewPlayer={previewPlayer}
            selectedElement={selectedElement}
            onElementSelect={setSelectedElement}
            onDesignChange={handleDesignChange}
            onShapeChange={handleShapeChange}
            onPreview={handlePreview}
          />
        </div>

        <div 
          className="designer-right-panel"
          style={{ width: `${rightPanelWidth}px`, minWidth: '200px', maxWidth: '500px' }}
        >
          <div 
            className="panel-resizer"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          />
          <DesignProperties
            design={design}
            selectedElement={selectedElement}
            onDesignChange={handleDesignChange}
            onShapeChange={handleShapeChange}
            onElementSelect={setSelectedElement}
            onReset={() => {
              if (window.confirm('Reset to default design? This will discard all changes.')) {
                setDesign(DEFAULT_DESIGN);
                setSelectedElement(null);
                toast.info('Design reset to default');
              }
            }}
            onSave={handleSaveDesign}
            saving={saving}
            onExport={handleExportDesign}
            onImport={handleImportDesign}
            onCreateAllCards={handleGenerateAllCards}
          />
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="card-preview-modal" onClick={() => setShowPreview(false)}>
          <div className="card-preview-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="card-preview-modal-header">
              <h2>Card Preview</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Zoom Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '4px 8px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: '10px', color: '#6b7280', marginRight: '4px', whiteSpace: 'nowrap' }}>Scroll to zoom</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewZoom(prev => Math.max(0.3, prev - 0.1));
                    }}
                    style={{
                      padding: '4px 8px',
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      color: '#374151',
                      cursor: 'pointer',
                      fontSize: '14px',
                      minWidth: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Zoom out"
                  >
                    ➖
                  </button>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: '#374151',
                    minWidth: '50px',
                    textAlign: 'center'
                  }}>
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewZoom(prev => Math.min(2, prev + 0.1));
                    }}
                    style={{
                      padding: '4px 8px',
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      color: '#374151',
                      cursor: 'pointer',
                      fontSize: '14px',
                      minWidth: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Zoom in"
                  >
                    ➕
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPreviewZoom(0.7);
                    }}
                    style={{
                      padding: '4px 8px',
                      background: '#f3f4f6',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      color: '#374151',
                      cursor: 'pointer',
                      fontSize: '12px',
                      minWidth: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Reset zoom"
                  >
                    🔍
                  </button>
                </div>
                <button 
                  className="card-preview-close-btn"
                  onClick={() => {
                    setShowPreview(false);
                    setPreviewZoom(0.7); // Reset zoom when closing
                  }}
                  aria-label="Close preview"
                >
                  ×
                </button>
              </div>
            </div>
            <div 
              className="card-preview-modal-body"
              ref={previewModalBodyRef}
              style={{ cursor: 'grab' }}
            >
              {previewPlayerLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                  <div className="loading-spinner"></div>
                  <p style={{ marginLeft: '12px' }}>Loading player data...</p>
                </div>
              ) : (
                <PlayerCardCanvas
                  key={previewKey}
                  design={design}
                  tournament={tournament}
                  previewPlayer={previewPlayer}
                  selectedElement={null}
                  onElementSelect={() => {}}
                  onDesignChange={() => {}}
                  onShapeChange={() => {}}
                  previewMode={true}
                  previewZoom={previewZoom}
                />
              )}
            </div>
            <div className="card-preview-modal-footer">
              <button 
                className="btn-preview-close"
                onClick={() => setShowPreview(false)}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayerCardDesigner;

