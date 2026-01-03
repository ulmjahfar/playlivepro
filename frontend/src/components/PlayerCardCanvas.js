import React, { useRef, useCallback, useState, useEffect } from 'react';
import { buildLogoUrl, buildPhotoUrl } from '../utils/playerCardUtils';
import { API_BASE_URL } from '../utils/apiConfig';

// Helper function to remove tournament code from player ID
const getPlayerIdNumber = (playerId) => {
  if (!playerId) return 'PL001';
  // If player ID contains a dash, take the part after the last dash
  if (playerId.includes('-')) {
    return playerId.split('-').pop();
  }
  return playerId;
};

// Helper function to wrap text based on max letters per line
const wrapText = (text, maxLettersPerLine, textWrap) => {
  if (!text || typeof text !== 'string') return text;
  
  // If textWrap is false or maxLettersPerLine is 0 or less, return original text
  if (!textWrap || !maxLettersPerLine || maxLettersPerLine <= 0) {
    return text;
  }
  
  // Split text into words
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';
  
  for (const word of words) {
    // If adding this word would exceed the limit, start a new line
    if (currentLine && (currentLine + ' ' + word).length > maxLettersPerLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      // If the word itself is longer than max, split it
      if (word.length > maxLettersPerLine) {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        // Split long word into chunks
        for (let i = 0; i < word.length; i += maxLettersPerLine) {
          lines.push(word.substring(i, i + maxLettersPerLine));
        }
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
      }
    }
  }
  
  if (currentLine) {
    lines.push(currentLine);
  }
  
  return lines.join('\n');
};

function PlayerCardCanvas({
  design,
  tournament,
  previewPlayer,
  selectedElement,
  onElementSelect,
  onDesignChange,
  onShapeChange,
  onPreview,
  previewMode = false,
  previewZoom = 0.7
}) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, handle: null });
  const [zoom, setZoom] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawRect, setDrawRect] = useState(null); // { x, y, width, height }
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const canvasContainerRef = useRef(null);

  const logoUrl = buildLogoUrl(tournament?.logo);
  const photoUrl = buildPhotoUrl(previewPlayer?.photo);
  
  // Format mobile number the same way as PlayerCard.js
  const countryCode = previewPlayer?.countryCode || '+91';
  const phoneNumber = previewPlayer?.mobile ? `${countryCode} ${previewPlayer.mobile}` : 'Not provided';

  const getElementStyle = (elementKey) => {
    const element = design[elementKey];
    if (!element || !element.visible) {
      return { display: 'none' };
    }

    const style = {
      position: 'absolute',
      left: `${element.position.x}%`,
      top: `${element.position.y}%`,
      cursor: 'move',
      zIndex: element.zIndex !== undefined ? element.zIndex : 10
    };

    if (elementKey === 'logo') {
      style.width = `${element.size}px`;
      style.height = `${element.size}px`;
    } else if (elementKey === 'playerPhoto') {
      style.width = `${element.size.width}px`;
      style.height = `${element.size.height}px`;
      if (element.shape === 'circle') {
        style.borderRadius = '50%';
      } else if (element.shape === 'rounded') {
        style.borderRadius = '12px';
      }
      if (element.borderWidth > 0) {
        style.border = `${element.borderWidth}px solid ${element.borderColor}`;
      }
    } else if (elementKey === 'tournamentName' || elementKey === 'playerName' || elementKey === 'playerId' || elementKey === 'playerDetails') {
      style.fontSize = `${element.fontSize}px`;
      style.color = element.color;
      style.fontFamily = element.fontFamily;
      if (element.fontWeight) {
        style.fontWeight = element.fontWeight;
      }
      // Apply text alignment - CRITICAL: Always apply if set, this must match designer exactly
      if (element.textAlign) {
        style.textAlign = element.textAlign;
      } else {
        // Default to left if not set (explicit default for consistency)
        style.textAlign = 'left';
      }
      // Apply text wrapping
      if (element.textWrap === false) {
        style.whiteSpace = 'nowrap';
      } else {
        style.whiteSpace = 'pre-wrap';
        style.wordWrap = 'break-word';
      }
      // Apply text stroke (outside the text using text-shadow)
      if (element.textStrokeEnabled === true) {
        const strokeWidth = element.textStrokeWidth || 1;
        const strokeColor = element.textStrokeColor || '#000000';
        // Create outline effect using multiple text-shadows positioned around the text
        const shadows = [];
        const steps = Math.max(8, Math.ceil(strokeWidth * 4)); // More steps for smoother outline
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * Math.PI * 2;
          const x = Math.cos(angle) * strokeWidth;
          const y = Math.sin(angle) * strokeWidth;
          shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
        }
        // Add existing text shadow if any, otherwise just use stroke shadows
        if (element.shadowEnabled && !element.circularBorder) {
          const shadowColor = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
          const shadowBlur = element.shadowBlur !== undefined ? element.shadowBlur : 4;
          const shadowOffsetX = element.shadowOffsetX !== undefined ? element.shadowOffsetX : 2;
          const shadowOffsetY = element.shadowOffsetY !== undefined ? element.shadowOffsetY : 2;
          shadows.push(`${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`);
        }
        style.textShadow = shadows.join(', ');
      } else {
        // No stroke, but keep existing shadow if enabled
        if (element.shadowEnabled && !element.circularBorder) {
          const shadowColor = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
          const shadowBlur = element.shadowBlur !== undefined ? element.shadowBlur : 4;
          const shadowOffsetX = element.shadowOffsetX !== undefined ? element.shadowOffsetX : 2;
          const shadowOffsetY = element.shadowOffsetY !== undefined ? element.shadowOffsetY : 2;
          style.textShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
        } else {
          style.textShadow = 'none';
        }
      }
      // Ensure child elements inherit color
      if (elementKey === 'playerDetails') {
        style['--text-color'] = element.color;
      }
      // Add border for text fields if enabled
      if (element.circularBorder === true) {
        const size = Math.max(element.fontSize || 14, 20);
        const borderShape = element.borderShape || 'circle';
        const multiplier = element.borderSizeMultiplier !== undefined ? element.borderSizeMultiplier : 1.8;
        const borderSize = size * multiplier;
        const borderColor = element.borderColor || element.color || '#ffffff';
        style.width = `${borderSize}px`;
        style.height = `${borderSize}px`;
        style.borderRadius = borderShape === 'circle' ? '50%' : '4px';
        style.border = `2px solid ${borderColor}`;
        style.backgroundColor = borderColor;
        style.display = 'flex';
        style.alignItems = 'center';
        style.justifyContent = 'center';
        style.padding = '0';
        // If width is set from drawing, use it, otherwise use border size
        if (element.width) {
          style.width = `${element.width}px`;
          style.maxWidth = `${element.width}px`;
        } else {
          style.width = `${borderSize}px`;
        }
        style.minWidth = `${borderSize}px`;
        style.minHeight = `${borderSize}px`;
        
        // When border is enabled, use box-shadow on the border container
        if (element.shadowEnabled) {
          const shadowColor = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
          const shadowBlur = element.shadowBlur !== undefined ? element.shadowBlur : 4;
          const shadowOffsetX = element.shadowOffsetX !== undefined ? element.shadowOffsetX : 2;
          const shadowOffsetY = element.shadowOffsetY !== undefined ? element.shadowOffsetY : 2;
          style.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
        } else {
          style.boxShadow = 'none';
        }
        // Apply text stroke even when border is enabled (for text inside the border)
        if (element.textStrokeEnabled === true) {
          const strokeWidth = element.textStrokeWidth || 1;
          const strokeColor = element.textStrokeColor || '#000000';
          const shadows = [];
          const steps = Math.max(8, Math.ceil(strokeWidth * 4));
          for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const x = Math.cos(angle) * strokeWidth;
            const y = Math.sin(angle) * strokeWidth;
            shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
          }
          style.textShadow = shadows.join(', ');
        } else {
          style.textShadow = 'none';
        }
      } else {
        // When border is disabled, use normal text styling - remove all border-related styles
        // But respect width constraint if set (from drawing/resizing)
        
        // CRITICAL: For text alignment to work, we MUST have a defined width AND display: block
        // Text alignment (center/right) only works when element has a width constraint
        // Always ensure display: block when textAlign is set (unless circularBorder uses flex)
        if (element.width) {
          // Width is explicitly set - use it
          style.width = `${element.width}px`;
          style.maxWidth = `${element.width}px`;
          style.display = 'block'; // Required for text-align to work
          style.boxSizing = 'border-box';
          style.padding = '4px 2px';
        } else if (element.textAlign && element.textAlign !== 'left') {
          // Text alignment is center/right but no width set - provide default width
          // This ensures text alignment is visible
          const defaultWidth = design.cardDimensions.width * 0.3; // 30% of canvas width
          style.width = `${defaultWidth}px`;
          style.maxWidth = `${defaultWidth}px`;
          style.display = 'block'; // Required for text-align to work
          style.boxSizing = 'border-box';
          style.padding = '4px 8px';
        } else {
          // No width and left alignment (default) - can be auto, but still use block for consistency
          style.width = 'auto';
          style.display = 'block'; // Still use block for text alignment consistency
          style.padding = '4px 8px';
        }
        
        style.height = 'auto';
        style.minWidth = 'auto';
        style.minHeight = 'auto';
        style.border = 'none';
        style.backgroundColor = 'transparent';
        style.borderRadius = '4px';
        style.boxShadow = 'none'; // No box shadow when border is disabled
        
        // Text stroke and shadow are already applied above (lines 125-158)
        // Don't override them here - they're already set correctly
      }
    }

    // Add shadow for non-text elements (logo, photo) if enabled
    if ((elementKey === 'logo' || elementKey === 'playerPhoto') && element.shadowEnabled) {
      const shadowColor = element.shadowColor || 'rgba(0, 0, 0, 0.5)';
      const shadowBlur = element.shadowBlur !== undefined ? element.shadowBlur : 4;
      const shadowOffsetX = element.shadowOffsetX !== undefined ? element.shadowOffsetX : 2;
      const shadowOffsetY = element.shadowOffsetY !== undefined ? element.shadowOffsetY : 2;
      style.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
    } else if (elementKey === 'logo' || elementKey === 'playerPhoto') {
      // Ensure shadow is removed if not enabled
      if (!element.shadowEnabled) {
        style.boxShadow = 'none';
      }
    }

    return style;
  };

  const getBackgroundStyle = () => {
    const bg = design.background;
    if (bg.type === 'image' && bg.imageUrl) {
      const imageUrl = bg.imageUrl.startsWith('http') 
        ? bg.imageUrl 
        : `${API_BASE_URL}${bg.imageUrl.startsWith('/') ? '' : '/'}${bg.imageUrl}`;
      
      // Handle custom size
      let backgroundSize = bg.backgroundSize || 'cover';
      if (backgroundSize === 'custom') {
        const width = bg.customWidth || 100;
        const height = bg.customHeight || 100;
        const unit = bg.customUnit || '%';
        backgroundSize = `${width}${unit} ${height}${unit}`;
      }
      
      return {
        backgroundImage: `url(${imageUrl})`,
        backgroundSize: backgroundSize,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        opacity: bg.opacity || 1
      };
    } else {
      return {
        background: bg.gradient || 'linear-gradient(135deg, #1f004f 0%, #312e81 40%, #3b82f6 100%)'
      };
    }
  };

  const handleMouseDown = useCallback((e, elementKey) => {
    // Don't start dragging if clicking on a resize handle
    if (e.target.classList.contains('resize-handle')) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      elementKey
    });
    onElementSelect(elementKey);
  }, [onElementSelect]);

  // Check if selected element is a text field that should enter draw mode
  const isTextFieldSelected = selectedElement && ['tournamentName', 'playerName', 'playerId', 'playerDetails'].includes(selectedElement);

  const handleCanvasMouseDown = useCallback((e) => {
    // If clicking on an existing element (except the drawing overlay), don't enter draw mode
    const clickedElement = e.target.closest('.canvas-element');
    if (clickedElement && !e.target.closest('.draw-rectangle-overlay')) {
      return;
    }
    
    // Check if clicking on canvas background or empty space within canvas
    const isCanvasClick = e.target === canvasRef.current || 
                         (e.target.classList && e.target.classList.contains('player-card-canvas')) ||
                         (canvasRef.current && canvasRef.current.contains(e.target) && !clickedElement);
    
    if (isCanvasClick) {
      // If a text field is selected, enter drawing mode
      if (isTextFieldSelected && !previewMode) {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        setIsDrawing(true);
        setDrawStart({ x: e.clientX, y: e.clientY, startX: x, startY: y });
        setDrawRect({ x, y, width: 0, height: 0 });
        onElementSelect(selectedElement); // Keep the element selected
      } else {
        // If background image exists, select background; otherwise deselect
        if (design.background && design.background.type === 'image' && design.background.imageUrl && !previewMode) {
          onElementSelect('background');
        } else {
          // Deselect if clicking on empty canvas
          onElementSelect(null);
        }
      }
    }
  }, [isTextFieldSelected, previewMode, selectedElement, onElementSelect, design.background]);

  const handleResizeMouseDown = useCallback((e, elementKey, handle, shapeIndex = null) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    const element = shapeIndex !== null 
      ? design.shapes?.[shapeIndex]
      : design[elementKey];
    
    if (!element) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get current size and position
    let currentWidth = 0;
    let currentHeight = 0;
    let currentX = element.position?.x || 0;
    let currentY = element.position?.y || 0;
    
    if (elementKey === 'logo') {
      currentWidth = currentHeight = element.size || 50;
    } else if (elementKey === 'playerPhoto') {
      currentWidth = element.size?.width || 100;
      currentHeight = element.size?.height || 100;
    } else if (shapeIndex !== null) {
      currentWidth = element.size?.width || 50;
      currentHeight = element.size?.height || 50;
    } else {
      // For text elements, use width if set, otherwise use a default based on canvas size
      if (element.width) {
        currentWidth = element.width;
      } else {
        // Default width based on canvas (30% of canvas width)
        currentWidth = (design.cardDimensions.width * 0.3);
      }
      // Height is not stored for text fields, use a reasonable default
      currentHeight = element.fontSize ? element.fontSize * 2 : 40;
    }

    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: currentWidth,
      height: currentHeight,
      positionX: currentX,
      positionY: currentY,
      handle,
      elementKey,
      shapeIndex
    });
  }, [design]);

  const handleShapeMouseDown = useCallback((e, index) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      elementKey: `shape-${index}`,
      shapeIndex: index
    });
    onElementSelect(`shape-${index}`);
  }, [onElementSelect]);

  const handleMouseMove = useCallback((e) => {
    // Handle drawing mode
    if (isDrawing && drawStart) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const currentX = ((e.clientX - rect.left) / rect.width) * 100;
      const currentY = ((e.clientY - rect.top) / rect.height) * 100;
      
      const startX = drawStart.startX;
      const startY = drawStart.startY;
      
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      
      setDrawRect({ x, y, width, height });
      return;
    }
    
    if (isResizing && resizeStart.handle) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const deltaX = ((e.clientX - resizeStart.x) / rect.width) * design.cardDimensions.width;
      const deltaY = ((e.clientY - resizeStart.y) / rect.height) * design.cardDimensions.height;

      const { handle, elementKey, shapeIndex, width: startWidth, height: startHeight, positionX, positionY } = resizeStart;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = positionX;
      let newY = positionY;

      // Calculate new size based on handle position
      const canvasWidth = design.cardDimensions.width;
      const canvasHeight = design.cardDimensions.height;
      
      if (handle.includes('e')) {
        newWidth = Math.max(10, startWidth + deltaX);
      }
      if (handle.includes('w')) {
        const deltaXPercent = (deltaX / canvasWidth) * 100;
        newWidth = Math.max(10, startWidth - deltaX);
        newX = Math.max(0, Math.min(100, positionX + deltaXPercent));
      }
      if (handle.includes('s')) {
        newHeight = Math.max(10, startHeight + deltaY);
      }
      if (handle.includes('n')) {
        const deltaYPercent = (deltaY / canvasHeight) * 100;
        newHeight = Math.max(10, startHeight - deltaY);
        newY = Math.max(0, Math.min(100, positionY + deltaYPercent));
      }

      // For logo, keep width = height
      if (elementKey === 'logo') {
        const avgSize = (newWidth + newHeight) / 2;
        newWidth = newHeight = Math.max(10, avgSize);
      }

      // For text elements, resize the area width (in pixels)
      if (['tournamentName', 'playerName', 'playerId', 'playerDetails'].includes(elementKey)) {
        // Convert width to pixels (newWidth is already in pixels from deltaX calculation)
        const widthInPx = Math.max(50, Math.min(design.cardDimensions.width, newWidth));
        
        onDesignChange(elementKey, { 
          width: widthInPx,
          ...(handle.includes('w') || handle.includes('n') ? { position: { x: newX, y: newY } } : {})
        });
      } else if (elementKey === 'logo') {
        onDesignChange(elementKey, { 
          size: newWidth,
          ...(handle.includes('w') || handle.includes('n') ? { position: { x: newX, y: newY } } : {})
        });
      } else if (elementKey === 'playerPhoto') {
        onDesignChange(elementKey, { 
          size: { width: Math.max(10, newWidth), height: Math.max(10, newHeight) },
          ...(handle.includes('w') || handle.includes('n') ? { position: { x: newX, y: newY } } : {})
        });
      } else if (shapeIndex !== null) {
        onShapeChange(shapeIndex, {
          size: { width: Math.max(10, newWidth), height: Math.max(10, newHeight) },
          ...(handle.includes('w') || handle.includes('n') ? { position: { x: newX, y: newY } } : {})
        });
      }

      setResizeStart({
        ...resizeStart,
        x: e.clientX,
        y: e.clientY,
        width: newWidth,
        height: newHeight,
        positionX: newX,
        positionY: newY
      });
      return;
    }

    if (!isDragging || !dragStart.elementKey) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;

    // Handle shapes
    if (dragStart.elementKey.startsWith('shape-') && dragStart.shapeIndex !== undefined) {
      const shape = design.shapes?.[dragStart.shapeIndex];
      if (shape) {
        const newX = Math.max(0, Math.min(100, shape.position.x + deltaX));
        const newY = Math.max(0, Math.min(100, shape.position.y + deltaY));
        onShapeChange(dragStart.shapeIndex, {
          position: { x: newX, y: newY }
        });
      }
    } else {
      // Handle regular elements
      const element = design[dragStart.elementKey];
      if (element && element.position) {
        const newX = Math.max(0, Math.min(100, element.position.x + deltaX));
        const newY = Math.max(0, Math.min(100, element.position.y + deltaY));
        onDesignChange(dragStart.elementKey, {
          position: { x: newX, y: newY }
        });
      }
    }

    setDragStart({
      ...dragStart,
      x: e.clientX,
      y: e.clientY
    });
  }, [isDragging, isResizing, dragStart, resizeStart, design, onDesignChange, onShapeChange]);

  const handleMouseUp = useCallback(() => {
    // Finalize drawing
    if (isDrawing && drawRect && selectedElement && isTextFieldSelected) {
      const rect = drawRect;
      const minSize = 5; // Minimum 5% width/height
      
      if (rect.width >= minSize && rect.height >= minSize) {
        // Convert percentage to pixels for width
        const canvasWidth = design.cardDimensions.width;
        const widthInPx = (rect.width / 100) * canvasWidth;
        
        onDesignChange(selectedElement, {
          position: { x: rect.x, y: rect.y },
          width: widthInPx, // Store width in pixels
          height: rect.height // Store height as percentage (for reference)
        });
      }
      
      setIsDrawing(false);
      setDrawRect(null);
      setDrawStart({ x: 0, y: 0, startX: 0, startY: 0 });
    }
    
    setIsDragging(false);
    setDragStart({ x: 0, y: 0, elementKey: null });
    setIsResizing(false);
    setResizeStart({ x: 0, y: 0, width: 0, height: 0, handle: null });
  }, [isDrawing, drawRect, selectedElement, isTextFieldSelected, design.cardDimensions.width, onDesignChange]);

  React.useEffect(() => {
    if ((isDragging || isResizing || isDrawing) && !previewMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, isDrawing, previewMode, handleMouseMove, handleMouseUp]);

  // Mouse wheel zoom for live preview area
  useEffect(() => {
    if (previewMode || !canvasContainerRef.current) return;

    const handleWheel = (e) => {
      // Only zoom if Ctrl/Cmd key is pressed, or if hovering over the canvas container
      const isOverCanvas = canvasContainerRef.current?.contains(e.target);
      
      if (isOverCanvas || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        
        const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05; // Scroll down = zoom out, scroll up = zoom in
        setZoom(prev => {
          const newZoom = prev + zoomDelta;
          return Math.max(0.5, Math.min(2, newZoom)); // Clamp between 0.5 and 2
        });
      }
    };

    const container = canvasContainerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
    }

    // Also add to window for Ctrl+scroll
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      if (container) {
        container.removeEventListener('wheel', handleWheel);
      }
      window.removeEventListener('wheel', handleWheel);
    };
  }, [previewMode]);

  const renderResizeHandles = (elementKey, shapeIndex = null) => {
    if (previewMode || selectedElement !== elementKey) return null;

    const element = shapeIndex !== null 
      ? design.shapes?.[shapeIndex]
      : design[elementKey];
    
    if (!element) return null;

    // Get element dimensions
    let width = 0;
    let height = 0;
    
    if (elementKey === 'logo') {
      width = height = element.size || 50;
    } else if (elementKey === 'playerPhoto') {
      width = element.size?.width || 100;
      height = element.size?.height || 100;
    } else if (shapeIndex !== null) {
      width = element.size?.width || 50;
      height = element.size?.height || 50;
    } else {
      // For text elements, use width if set, otherwise use default
      if (element.width) {
        width = element.width;
      } else {
        // Default to 30% of canvas width
        width = design.cardDimensions.width * 0.3;
      }
      // Height is not stored separately, use fontSize * 2 or default
      height = element.fontSize ? element.fontSize * 2 : 40;
    }

    const handles = [
      { position: 'nw', cursor: 'nw-resize' },
      { position: 'n', cursor: 'n-resize' },
      { position: 'ne', cursor: 'ne-resize' },
      { position: 'e', cursor: 'e-resize' },
      { position: 'se', cursor: 'se-resize' },
      { position: 's', cursor: 's-resize' },
      { position: 'sw', cursor: 'sw-resize' },
      { position: 'w', cursor: 'w-resize' }
    ];

    return (
      <>
        {handles.map(handle => (
          <div
            key={handle.position}
            className={`resize-handle resize-handle-${handle.position}`}
            style={{ cursor: handle.cursor }}
            onMouseDown={(e) => handleResizeMouseDown(e, elementKey, handle.position, shapeIndex)}
          />
        ))}
      </>
    );
  };

  const canvasContent = (
    <>
      {!previewMode && (
        <div className="canvas-header">
          <div className="canvas-header-top">
            <h3>Live Preview</h3>
            <div className="canvas-controls">
              <button
                className="btn-zoom"
                onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))}
                title="Zoom in"
              >
                ➕
              </button>
              <span className="zoom-level">{Math.round(zoom * 100)}%</span>
              <button
                className="btn-zoom"
                onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
                title="Zoom out"
              >
                ➖
              </button>
              <button
                className="btn-zoom"
                onClick={() => setZoom(1)}
                title="Reset zoom"
              >
                🔍
              </button>
              {onPreview && (
                <button 
                  className="btn-preview"
                  onClick={onPreview}
                  title="Open full-screen preview"
                >
                  👁️ Preview
                </button>
              )}
            </div>
          </div>
          <span className="canvas-hint">
            {isTextFieldSelected && !isDrawing
              ? `Selected: ${selectedElement} - Click and drag on canvas to draw text area, or drag element to reposition`
              : isDrawing
              ? `Drawing text area... Release mouse button to finalize`
              : selectedElement 
              ? `Selected: ${selectedElement} - Drag to reposition, drag handles to resize, or use Properties panel to edit`
              : 'Click on any element to select it, then drag to reposition, use resize handles to adjust size, or edit in Properties panel'}
            {!isDrawing && !selectedElement && <span style={{ marginLeft: '8px', color: '#6b7280', fontSize: '11px' }}>• Scroll to zoom</span>}
          </span>
        </div>
      )}
      <div
        ref={canvasRef}
        className={`player-card-canvas ${previewMode ? 'preview-mode' : ''} ${!previewMode && selectedElement === 'background' ? 'background-selected' : ''}`}
        style={{
          width: `${design.cardDimensions.width}px`,
          height: `${design.cardDimensions.height}px`,
          transform: previewMode ? `scale(${previewZoom})` : `scale(${zoom})`,
          transformOrigin: 'center center',
          transition: 'transform 0.2s ease',
          ...getBackgroundStyle(),
          ...(!previewMode && selectedElement === 'background' ? {
            outline: '3px dashed #3b82f6',
            outlineOffset: '2px'
          } : {})
        }}
        onMouseDown={previewMode ? undefined : (e) => {
          // If clicking on canvas background (not an element), handle drawing or deselect
          if (e.target === canvasRef.current || (e.target.classList && e.target.classList.contains('player-card-canvas'))) {
            handleCanvasMouseDown(e);
          }
        }}
      >
        {/* Drawing Rectangle Overlay */}
        {isDrawing && drawRect && (
          <div
            className="draw-rectangle-overlay"
            style={{
              position: 'absolute',
              left: `${drawRect.x}%`,
              top: `${drawRect.y}%`,
              width: `${drawRect.width}%`,
              height: `${drawRect.height}%`,
              border: '2px dashed rgba(59, 130, 246, 0.8)',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              pointerEvents: 'none',
              zIndex: 1000,
              boxSizing: 'border-box'
            }}
          />
        )}
        {/* Logo */}
        {design.logo.visible && (
          <div
            className={`canvas-element logo ${!previewMode && selectedElement === 'logo' ? 'selected' : ''}`}
            style={getElementStyle('logo')}
            onMouseDown={previewMode ? undefined : (e) => handleMouseDown(e, 'logo')}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Tournament logo" />
            ) : (
              <span>🏆</span>
            )}
            {renderResizeHandles('logo')}
          </div>
        )}

        {/* Tournament Name */}
        {design.tournamentName.visible && (
          <div
            className={`canvas-element tournament-name ${!previewMode && selectedElement === 'tournamentName' ? 'selected' : ''}`}
            style={getElementStyle('tournamentName')}
            onMouseDown={previewMode ? undefined : (e) => handleMouseDown(e, 'tournamentName')}
          >
            {wrapText(
              tournament?.name || 'Tournament Name',
              design.tournamentName.maxLettersPerLine || 0,
              design.tournamentName.textWrap !== false
            )}
            {renderResizeHandles('tournamentName')}
          </div>
        )}

        {/* Player Photo */}
        {design.playerPhoto.visible && (
          <div
            className={`canvas-element player-photo ${!previewMode && selectedElement === 'playerPhoto' ? 'selected' : ''}`}
            style={getElementStyle('playerPhoto')}
            onMouseDown={previewMode ? undefined : (e) => handleMouseDown(e, 'playerPhoto')}
          >
            {photoUrl ? (
              <img src={photoUrl} alt="Player" />
            ) : (
              <div className="photo-placeholder">📸</div>
            )}
            {renderResizeHandles('playerPhoto')}
          </div>
        )}

        {/* Player Details */}
        {design.playerDetails.visible && (
          <div
            className={`canvas-element player-details ${!previewMode && selectedElement === 'playerDetails' ? 'selected' : ''}`}
            style={getElementStyle('playerDetails')}
            onMouseDown={previewMode ? undefined : (e) => handleMouseDown(e, 'playerDetails')}
          >
            {design.playerDetails.showLabels !== false ? (
              <>
                <div style={{ 
                  color: design.playerDetails.color,
                  textShadow: design.playerDetails.textStrokeEnabled ? (() => {
                    const strokeWidth = design.playerDetails.textStrokeWidth || 1;
                    const strokeColor = design.playerDetails.textStrokeColor || '#000000';
                    const shadows = [];
                    const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                    for (let i = 0; i < steps; i++) {
                      const angle = (i / steps) * Math.PI * 2;
                      const x = Math.cos(angle) * strokeWidth;
                      const y = Math.sin(angle) * strokeWidth;
                      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                    }
                    return shadows.join(', ');
                  })() : 'none'
                }}>{wrapText(`Role: ${previewPlayer?.role || 'Player'}`, design.playerDetails.maxLettersPerLine || 0, design.playerDetails.textWrap !== false)}</div>
                <div style={{ 
                  color: design.playerDetails.color,
                  textShadow: design.playerDetails.textStrokeEnabled ? (() => {
                    const strokeWidth = design.playerDetails.textStrokeWidth || 1;
                    const strokeColor = design.playerDetails.textStrokeColor || '#000000';
                    const shadows = [];
                    const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                    for (let i = 0; i < steps; i++) {
                      const angle = (i / steps) * Math.PI * 2;
                      const x = Math.cos(angle) * strokeWidth;
                      const y = Math.sin(angle) * strokeWidth;
                      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                    }
                    return shadows.join(', ');
                  })() : 'none'
                }}>{wrapText(`City: ${previewPlayer?.city || 'City'}`, design.playerDetails.maxLettersPerLine || 0, design.playerDetails.textWrap !== false)}</div>
                <div style={{ 
                  color: design.playerDetails.color,
                  textShadow: design.playerDetails.textStrokeEnabled ? (() => {
                    const strokeWidth = design.playerDetails.textStrokeWidth || 1;
                    const strokeColor = design.playerDetails.textStrokeColor || '#000000';
                    const shadows = [];
                    const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                    for (let i = 0; i < steps; i++) {
                      const angle = (i / steps) * Math.PI * 2;
                      const x = Math.cos(angle) * strokeWidth;
                      const y = Math.sin(angle) * strokeWidth;
                      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                    }
                    return shadows.join(', ');
                  })() : 'none'
                }}>{wrapText(`Mobile: ${phoneNumber}`, design.playerDetails.maxLettersPerLine || 0, design.playerDetails.textWrap !== false)}</div>
              </>
            ) : (
              <>
                <div style={{ 
                  color: design.playerDetails.color,
                  textShadow: design.playerDetails.textStrokeEnabled ? (() => {
                    const strokeWidth = design.playerDetails.textStrokeWidth || 1;
                    const strokeColor = design.playerDetails.textStrokeColor || '#000000';
                    const shadows = [];
                    const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                    for (let i = 0; i < steps; i++) {
                      const angle = (i / steps) * Math.PI * 2;
                      const x = Math.cos(angle) * strokeWidth;
                      const y = Math.sin(angle) * strokeWidth;
                      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                    }
                    return shadows.join(', ');
                  })() : 'none'
                }}>{wrapText(previewPlayer?.role || 'Player', design.playerDetails.maxLettersPerLine || 0, design.playerDetails.textWrap !== false)}</div>
                <div style={{ 
                  color: design.playerDetails.color,
                  textShadow: design.playerDetails.textStrokeEnabled ? (() => {
                    const strokeWidth = design.playerDetails.textStrokeWidth || 1;
                    const strokeColor = design.playerDetails.textStrokeColor || '#000000';
                    const shadows = [];
                    const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                    for (let i = 0; i < steps; i++) {
                      const angle = (i / steps) * Math.PI * 2;
                      const x = Math.cos(angle) * strokeWidth;
                      const y = Math.sin(angle) * strokeWidth;
                      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                    }
                    return shadows.join(', ');
                  })() : 'none'
                }}>{wrapText(previewPlayer?.city || 'City', design.playerDetails.maxLettersPerLine || 0, design.playerDetails.textWrap !== false)}</div>
                <div style={{ 
                  color: design.playerDetails.color,
                  textShadow: design.playerDetails.textStrokeEnabled ? (() => {
                    const strokeWidth = design.playerDetails.textStrokeWidth || 1;
                    const strokeColor = design.playerDetails.textStrokeColor || '#000000';
                    const shadows = [];
                    const steps = Math.max(8, Math.ceil(strokeWidth * 4));
                    for (let i = 0; i < steps; i++) {
                      const angle = (i / steps) * Math.PI * 2;
                      const x = Math.cos(angle) * strokeWidth;
                      const y = Math.sin(angle) * strokeWidth;
                      shadows.push(`${x}px ${y}px 0 ${strokeColor}`);
                    }
                    return shadows.join(', ');
                  })() : 'none'
                }}>{wrapText(phoneNumber, design.playerDetails.maxLettersPerLine || 0, design.playerDetails.textWrap !== false)}</div>
              </>
            )}
            {renderResizeHandles('playerDetails')}
          </div>
        )}

        {/* Player Name */}
        {design.playerName.visible && (
          <div
            className={`canvas-element player-name ${!previewMode && selectedElement === 'playerName' ? 'selected' : ''}`}
            style={getElementStyle('playerName')}
            onMouseDown={previewMode ? undefined : (e) => handleMouseDown(e, 'playerName')}
          >
            {wrapText(
              (previewPlayer?.name || 'Player Name').toUpperCase(),
              design.playerName.maxLettersPerLine || 0,
              design.playerName.textWrap !== false
            )}
            {renderResizeHandles('playerName')}
          </div>
        )}

        {/* Player ID */}
        {design.playerId.visible && (
          <div
            className={`canvas-element player-id ${!previewMode && selectedElement === 'playerId' ? 'selected' : ''}`}
            style={getElementStyle('playerId')}
            onMouseDown={previewMode ? undefined : (e) => handleMouseDown(e, 'playerId')}
          >
            {wrapText(
              getPlayerIdNumber(previewPlayer?.playerId),
              design.playerId.maxLettersPerLine || 0,
              design.playerId.textWrap !== false
            )}
            {renderResizeHandles('playerId')}
          </div>
        )}

        {/* Shapes */}
        {(design.shapes || []).map((shape, index) => {
          if (!shape.visible) return null;
          const elementKey = `shape-${index}`;
          const shapeStyle = {
            position: 'absolute',
            left: `${shape.position.x}%`,
            top: `${shape.position.y}%`,
            width: `${shape.size.width}px`,
            height: `${shape.size.height}px`,
            backgroundColor: shape.color,
            opacity: shape.opacity || 1,
            borderRadius: shape.type === 'ellipse' ? '50%' : `${shape.borderRadius || 0}px`,
            cursor: 'move',
            zIndex: shape.zIndex !== undefined ? shape.zIndex : 5
          };
          
          // Add shadow for shapes if enabled
          if (shape.shadowEnabled) {
            const shadowColor = shape.shadowColor || 'rgba(0, 0, 0, 0.5)';
            const shadowBlur = shape.shadowBlur !== undefined ? shape.shadowBlur : 4;
            const shadowOffsetX = shape.shadowOffsetX !== undefined ? shape.shadowOffsetX : 2;
            const shadowOffsetY = shape.shadowOffsetY !== undefined ? shape.shadowOffsetY : 2;
            shapeStyle.boxShadow = `${shadowOffsetX}px ${shadowOffsetY}px ${shadowBlur}px ${shadowColor}`;
          }
          
          return (
            <div
              key={elementKey}
              className={`canvas-element shape ${!previewMode && selectedElement === elementKey ? 'selected' : ''}`}
              style={shapeStyle}
              onMouseDown={previewMode ? undefined : (e) => handleShapeMouseDown(e, index)}
            >
              {renderResizeHandles(elementKey, index)}
            </div>
          );
        })}
        </div>
    </>
  );

  // In preview mode, return canvas directly without wrapper
  if (previewMode) {
    return canvasContent;
  }

  // In edit mode, wrap with container for header/controls
  return (
    <div className="player-card-canvas-container" ref={canvasContainerRef}>
      {canvasContent}
    </div>
  );
}

export default PlayerCardCanvas;

