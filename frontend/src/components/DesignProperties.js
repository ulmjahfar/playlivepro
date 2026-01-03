import React from 'react';

// Helper function to convert rgba to hex (ignoring alpha)
function rgbaToHex(rgba) {
  if (!rgba || typeof rgba !== 'string') return '#000000';
  
  // If already hex, return it
  if (rgba.startsWith('#')) {
    return rgba.length === 7 ? rgba : '#000000';
  }
  
  // Parse rgba string
  const rgbaMatch = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    return `#${[r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('')}`;
  }
  
  return '#000000';
}

// Helper function to convert hex to rgba (with default alpha)
function hexToRgba(hex, alpha = 0.5) {
  if (!hex || typeof hex !== 'string') return `rgba(0, 0, 0, ${alpha})`;
  
  // If already rgba, return it
  if (hex.startsWith('rgba')) return hex;
  
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse hex
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  
  // Try to preserve existing alpha if it was rgba
  if (hex.includes('rgba')) {
    const alphaMatch = hex.match(/[\d.]+\)$/);
    if (alphaMatch) {
      alpha = parseFloat(alphaMatch[0].replace(')', ''));
    }
  }
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function DesignProperties({ design, selectedElement, onDesignChange, onShapeChange, onElementSelect, onReset, onSave, saving, onExport, onImport, onCreateAllCards }) {

  // Check if selected element is a shape
  const isShape = selectedElement && selectedElement.startsWith('shape-');
  const shapeIndex = isShape ? parseInt(selectedElement.replace('shape-', ''), 10) : null;
  const shape = isShape && design.shapes ? design.shapes[shapeIndex] : null;
  const element = !isShape && selectedElement ? design[selectedElement] : null;

  // Get all elements to calculate z-index
  const getAllElements = () => {
    const elements = [];
    // Add regular elements
    ['logo', 'tournamentName', 'playerPhoto', 'playerDetails', 'playerName', 'playerId'].forEach(key => {
      if (design[key]) {
        const zIndex = design[key].zIndex !== undefined ? design[key].zIndex : 
          (key === 'logo' ? 10 : key === 'tournamentName' ? 20 : key === 'playerPhoto' ? 30 : 
           key === 'playerDetails' ? 40 : key === 'playerName' ? 50 : 60);
        elements.push({ key, zIndex, type: 'element' });
      }
    });
    // Add shapes
    if (design.shapes) {
      design.shapes.forEach((shape, index) => {
        const zIndex = shape.zIndex !== undefined ? shape.zIndex : 5;
        elements.push({ key: `shape-${index}`, zIndex, type: 'shape', index });
      });
    }
    return elements.sort((a, b) => a.zIndex - b.zIndex);
  };

  const handleBringForward = () => {
    const allElements = getAllElements();
    const currentIndex = allElements.findIndex(el => 
      el.key === selectedElement || (isShape && el.index === shapeIndex)
    );
    
    if (currentIndex < allElements.length - 1) {
      const currentElement = allElements[currentIndex];
      const nextElement = allElements[currentIndex + 1];
      // Swap z-index with next element, or go one above if they're the same
      const currentZIndex = currentElement.zIndex || 0;
      const nextZIndex = nextElement.zIndex || 0;
      const newZIndex = currentZIndex < nextZIndex ? nextZIndex : nextZIndex + 1;
      
      if (isShape && shapeIndex !== null) {
        onShapeChange(shapeIndex, { zIndex: newZIndex });
      } else {
        onDesignChange(selectedElement, { zIndex: newZIndex });
      }
    }
  };

  const handleSendBackward = () => {
    const allElements = getAllElements();
    const currentIndex = allElements.findIndex(el => 
      el.key === selectedElement || (isShape && el.index === shapeIndex)
    );
    
    if (currentIndex > 0) {
      const currentElement = allElements[currentIndex];
      const prevElement = allElements[currentIndex - 1];
      // Swap z-index with previous element, or go one below if they're the same
      const currentZIndex = currentElement.zIndex || 0;
      const prevZIndex = prevElement.zIndex || 0;
      const newZIndex = currentZIndex > prevZIndex ? prevZIndex : Math.max(0, prevZIndex - 1);
      
      if (isShape && shapeIndex !== null) {
        onShapeChange(shapeIndex, { zIndex: newZIndex });
      } else {
        onDesignChange(selectedElement, { zIndex: newZIndex });
      }
    }
  };

  const handleBringToFront = () => {
    const allElements = getAllElements();
    const maxZIndex = Math.max(...allElements.map(el => el.zIndex || 0), 0);
    const newZIndex = maxZIndex + 10;
    
    if (isShape && shapeIndex !== null) {
      onShapeChange(shapeIndex, { zIndex: newZIndex });
    } else {
      onDesignChange(selectedElement, { zIndex: newZIndex });
    }
  };

  const handleSendToBack = () => {
    const allElements = getAllElements();
    const minZIndex = Math.min(...allElements.map(el => el.zIndex || 0), 0);
    const newZIndex = Math.max(0, minZIndex - 10);
    
    if (isShape && shapeIndex !== null) {
      onShapeChange(shapeIndex, { zIndex: newZIndex });
    } else {
      onDesignChange(selectedElement, { zIndex: newZIndex });
    }
  };

  // Check if selected element is valid
  const hasValidSelection = selectedElement && (element || shape);
  
  // Check if background is selected or if background image is set and should show properties
  const isBackgroundSelected = selectedElement === 'background';
  const showBackgroundProperties = isBackgroundSelected || (!hasValidSelection && design.background && design.background.type === 'image' && design.background.imageUrl);
  
  if (!hasValidSelection && !showBackgroundProperties) {
    return (
      <div className="design-properties">
        <div className="properties-header">
          <h3>⚙️ Properties</h3>
        </div>
        
        {/* Action Buttons - Always visible */}
        <div className="properties-actions">
          <button
            className="btn-save"
            onClick={onSave}
            disabled={saving}
            title="Save design"
          >
            {saving ? '⏳' : '💾'}
          </button>
          <button
            className="btn-reset"
            onClick={onReset}
            title="Reset to default"
          >
            🔄
          </button>
          <button
            className="btn-export"
            onClick={onExport}
            title="Export design"
          >
            📤
          </button>
          <label className="btn-import" title="Import design">
            <input
              type="file"
              accept=".json"
              onChange={onImport}
              style={{ display: 'none' }}
            />
            📥
          </label>
          {onCreateAllCards && (
            <button
              className="btn-create-all-cards"
              onClick={onCreateAllCards}
              title="Generate all Player Cards"
            >
              🎴
            </button>
          )}
        </div>

        <div className="properties-empty">
          <p>Select an element to edit</p>
          {design.background && design.background.type === 'image' && !design.background.imageUrl && (
            <p style={{ fontSize: '10px', color: '#9ca3af', marginTop: '8px' }}>
              Upload a background image to adjust its size
            </p>
          )}
        </div>
      </div>
    );
  }
  
  // Show background properties when no element is selected but background image exists
  if (showBackgroundProperties) {
    return (
      <div className="design-properties">
        <div className="properties-header">
          <h3>⚙️ Properties</h3>
          <div className="element-badge">Background</div>
        </div>
        
        {/* Action Buttons - Always visible */}
        <div className="properties-actions">
          <button
            className="btn-save"
            onClick={onSave}
            disabled={saving}
            title="Save design"
          >
            {saving ? '⏳' : '💾'}
          </button>
          <button
            className="btn-reset"
            onClick={onReset}
            title="Reset to default"
          >
            🔄
          </button>
          <button
            className="btn-export"
            onClick={onExport}
            title="Export design"
          >
            📤
          </button>
          <label className="btn-import" title="Import design">
            <input
              type="file"
              accept=".json"
              onChange={onImport}
              style={{ display: 'none' }}
            />
            📥
          </label>
          {onCreateAllCards && (
            <button
              className="btn-create-all-cards"
              onClick={onCreateAllCards}
              title="Generate all Player Cards"
            >
              🎴
            </button>
          )}
        </div>

        <div className="properties-content">
          {/* Background Image Size */}
          <div className="property-group">
            <label className="property-label">Image Size</label>
            <select
              value={design.background.backgroundSize || 'cover'}
              onChange={(e) => {
                const newSize = e.target.value;
                onDesignChange('background', { 
                  backgroundSize: newSize,
                  // Reset custom size when switching away from custom
                  ...(newSize !== 'custom' ? {} : {
                    customWidth: design.background.customWidth || 100,
                    customHeight: design.background.customHeight || 100,
                    customUnit: design.background.customUnit || '%'
                  })
                });
              }}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                color: '#1f2937',
                fontSize: '11px',
                cursor: 'pointer',
                marginBottom: design.background.backgroundSize === 'custom' ? '8px' : '0'
              }}
            >
              <option value="cover">Cover (Fill entire area)</option>
              <option value="contain">Contain (Fit entire image)</option>
              <option value="100% 100%">Stretch (Fill exactly)</option>
              <option value="auto">Auto (Original size)</option>
              <option value="custom">Custom Size</option>
            </select>
            
            {/* Custom Size Inputs */}
            {design.background.backgroundSize === 'custom' && (
              <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="property-row">
                  <div className="property-input-group">
                    <label>Width</label>
                    <input
                      type="number"
                      value={design.background.customWidth || 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        onDesignChange('background', { customWidth: value });
                      }}
                      min="1"
                      max={design.background.customUnit === '%' ? '500' : '10000'}
                      step="1"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        color: '#1f2937',
                        fontSize: '11px'
                      }}
                    />
                  </div>
                  <div className="property-input-group">
                    <label>Height</label>
                    <input
                      type="number"
                      value={design.background.customHeight || 100}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        onDesignChange('background', { customHeight: value });
                      }}
                      min="1"
                      max={design.background.customUnit === '%' ? '500' : '10000'}
                      step="1"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        color: '#1f2937',
                        fontSize: '11px'
                      }}
                    />
                  </div>
                </div>
                <div className="property-input-group">
                  <label>Unit</label>
                  <select
                    value={design.background.customUnit || '%'}
                    onChange={(e) => onDesignChange('background', { customUnit: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: '#ffffff',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      color: '#1f2937',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="%">Percentage (%)</option>
                    <option value="px">Pixels (px)</option>
                  </select>
                </div>
              </div>
            )}
            
            <p className="property-help">
              {design.background.backgroundSize === 'custom' 
                ? 'Set custom width and height for the background image'
                : 'Controls how the background image is sized and positioned'}
            </p>
          </div>

          {/* Background Opacity */}
          <div className="property-group">
            <label className="property-label">Opacity</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={design.background.opacity || 1}
                onChange={(e) => onDesignChange('background', { opacity: parseFloat(e.target.value) })}
                className="range-input"
                style={{ flex: 1 }}
              />
              <span className="range-value">
                {Math.round((design.background.opacity || 1) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentElement = isShape ? shape : element;

  const handlePositionChange = (axis, value) => {
    const numValue = parseFloat(value) || 0;
    onDesignChange(selectedElement, {
      position: {
        ...element.position,
        [axis]: Math.max(0, Math.min(100, numValue))
      }
    });
  };

  const handleSizeChange = (dimension, value) => {
    const numValue = parseFloat(value) || 0;
    if (selectedElement === 'playerPhoto') {
      onDesignChange(selectedElement, {
        size: {
          ...currentElement.size,
          [dimension]: Math.max(50, Math.min(500, numValue))
        }
      });
    } else if (selectedElement === 'logo') {
      onDesignChange(selectedElement, {
        size: Math.max(50, Math.min(200, numValue))
      });
    }
  };

  const handleFontSizeChange = (value) => {
    const numValue = parseFloat(value) || 12;
    onDesignChange(selectedElement, {
      fontSize: Math.max(8, Math.min(72, numValue))
    });
  };

  const handleColorChange = (value) => {
    onDesignChange(selectedElement, { color: value });
  };

  const handleFontFamilyChange = (value) => {
    onDesignChange(selectedElement, { fontFamily: value });
  };

  const handleFontWeightChange = (value) => {
    onDesignChange(selectedElement, { fontWeight: value });
  };

  const handleShapeChange = (value) => {
    onDesignChange(selectedElement, { shape: value });
  };

  const handleBorderWidthChange = (value) => {
    const numValue = parseFloat(value) || 0;
    onDesignChange(selectedElement, {
      borderWidth: Math.max(0, Math.min(20, numValue))
    });
  };

  const handleBorderColorChange = (value) => {
    onDesignChange(selectedElement, { borderColor: value });
  };


  return (
    <div className="design-properties">
      <div className="properties-header">
        <h3>⚙️ Properties</h3>
        <div className="element-badge">{isShape ? `Shape ${shapeIndex + 1}` : selectedElement}</div>
      </div>
      
      {/* Action Buttons - Compact */}
      <div className="properties-actions">
        <button
          className="btn-save"
          onClick={onSave}
          disabled={saving}
          title="Save design"
        >
          {saving ? '⏳' : '💾'}
        </button>
        <button
          className="btn-reset"
          onClick={onReset}
          title="Reset to default"
        >
          🔄
        </button>
        <button
          className="btn-export"
          onClick={onExport}
          title="Export design"
        >
          📤
        </button>
        <label className="btn-import" title="Import design">
          <input
            type="file"
            accept=".json"
            onChange={onImport}
            style={{ display: 'none' }}
          />
          📥
        </label>
        {onCreateAllCards && (
          <button
            className="btn-create-all-cards"
            onClick={onCreateAllCards}
            title="Create all player cards"
          >
            🎴
          </button>
        )}
      </div>

      <div className="properties-content">
        {/* Layout Section */}
        <div className="property-group">
          <label className="property-label">Position</label>
          <div className="property-row">
            <div className="property-input-group">
              <label>X (%)</label>
              <input
                type="number"
                value={currentElement.position?.x || 0}
                onChange={(e) => handlePositionChange('x', e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
            <div className="property-input-group">
              <label>Y (%)</label>
              <input
                type="number"
                value={currentElement.position?.y || 0}
                onChange={(e) => handlePositionChange('y', e.target.value)}
                min="0"
                max="100"
                step="0.1"
              />
            </div>
          </div>
        </div>

        {/* Size - for logo and photo (not shapes) */}
        {!isShape && (selectedElement === 'logo' || selectedElement === 'playerPhoto') && (
          <div className="property-group">
            <label className="property-label">Size</label>
            {selectedElement === 'logo' ? (
              <div className="property-input-group">
                <label>Size (px)</label>
                <input
                  type="number"
                  value={currentElement.size}
                  onChange={(e) => handleSizeChange('size', e.target.value)}
                  min="50"
                  max="200"
                />
              </div>
            ) : (
              <div className="property-row">
                <div className="property-input-group">
                  <label>Width (px)</label>
                  <input
                    type="number"
                    value={currentElement.size.width}
                    onChange={(e) => handleSizeChange('width', e.target.value)}
                    min="50"
                    max="500"
                  />
                </div>
                <div className="property-input-group">
                  <label>Height (px)</label>
                  <input
                    type="number"
                    value={currentElement.size.height}
                    onChange={(e) => handleSizeChange('height', e.target.value)}
                    min="50"
                    max="500"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shape - for photo (not shape elements) */}
        {!isShape && selectedElement === 'playerPhoto' && (
          <div className="property-group">
            <label className="property-label">Shape</label>
            <select
              value={currentElement.shape}
              onChange={(e) => handleShapeChange(e.target.value)}
            >
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="rounded">Rounded</option>
            </select>
          </div>
        )}

        {/* Border - for photo (not shape elements) */}
        {!isShape && selectedElement === 'playerPhoto' && (
          <>
            <div className="property-group">
              <label className="property-label">Border Width</label>
              <input
                type="number"
                value={currentElement.borderWidth}
                onChange={(e) => handleBorderWidthChange(e.target.value)}
                min="0"
                max="20"
              />
            </div>
            <div className="property-group">
              <label className="property-label">Border Color</label>
              <input
                type="color"
                value={currentElement.borderColor}
                onChange={(e) => handleBorderColorChange(e.target.value)}
              />
            </div>
          </>
        )}

        {/* Draw Area Button for Text Fields */}
        {!isShape && (selectedElement === 'tournamentName' || selectedElement === 'playerName' || selectedElement === 'playerId' || selectedElement === 'playerDetails') && (
          <div className="property-group">
            <button
              className="btn-draw-area"
              onClick={() => {
                // Scroll canvas into view
                const canvas = document.querySelector('.player-card-canvas');
                if (canvas) {
                  canvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Flash the canvas to draw attention
                  canvas.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.8)';
                  setTimeout(() => {
                    canvas.style.boxShadow = '';
                  }, 1000);
                }
              }}
              title="Click and drag on the canvas to draw/redraw the text area"
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '2px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '8px',
                color: '#3b82f6',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                e.target.style.borderColor = 'rgba(59, 130, 246, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                e.target.style.borderColor = 'rgba(59, 130, 246, 0.5)';
              }}
            >
              ✏️ Draw/Redraw Text Area
            </button>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '8px', marginBottom: '0' }}>
              Select this field, then click and drag on the canvas to draw the text area
            </p>
          </div>
        )}

        {/* Typography Section */}
        {!isShape && (selectedElement === 'tournamentName' || selectedElement === 'playerName' || selectedElement === 'playerId' || selectedElement === 'playerDetails') && (
          <>
            <div className="property-group">
              <label className="property-label">Font Size</label>
              <input
                type="number"
                value={currentElement.fontSize}
                onChange={(e) => handleFontSizeChange(e.target.value)}
                min="8"
                max="72"
              />
            </div>

            <div className="property-group">
              <label className="property-label">Text Color</label>
              <div className="property-row">
                <input
                  type="color"
                  value={currentElement.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                />
                <input
                  type="text"
                  value={currentElement.color}
                  onChange={(e) => handleColorChange(e.target.value)}
                  placeholder="#ffffff"
                  style={{ flex: 1 }}
                />
              </div>
            </div>

            <div className="property-group">
              <label className="property-label">Font Family</label>
              <select
                value={currentElement.fontFamily}
                onChange={(e) => handleFontFamilyChange(e.target.value)}
                style={{ fontFamily: currentElement.fontFamily || 'Arial' }}
              >
              {/* Sans-Serif Fonts */}
              <optgroup label="Sans-Serif">
                <option value="Arial" style={{ fontFamily: 'Arial' }}>Arial</option>
                <option value="Helvetica" style={{ fontFamily: 'Helvetica' }}>Helvetica</option>
                <option value="Verdana" style={{ fontFamily: 'Verdana' }}>Verdana</option>
                <option value="Tahoma" style={{ fontFamily: 'Tahoma' }}>Tahoma</option>
                <option value="Trebuchet MS" style={{ fontFamily: 'Trebuchet MS' }}>Trebuchet MS</option>
                <option value="Lucida Grande" style={{ fontFamily: 'Lucida Grande' }}>Lucida Grande</option>
                <option value="Poppins" style={{ fontFamily: 'Poppins' }}>Poppins</option>
                <option value="Inter" style={{ fontFamily: 'Inter' }}>Inter</option>
                <option value="Roboto" style={{ fontFamily: 'Roboto' }}>Roboto</option>
                <option value="Open Sans" style={{ fontFamily: 'Open Sans' }}>Open Sans</option>
                <option value="Lato" style={{ fontFamily: 'Lato' }}>Lato</option>
                <option value="Montserrat" style={{ fontFamily: 'Montserrat' }}>Montserrat</option>
                <option value="Raleway" style={{ fontFamily: 'Raleway' }}>Raleway</option>
                <option value="Ubuntu" style={{ fontFamily: 'Ubuntu' }}>Ubuntu</option>
                <option value="Nunito" style={{ fontFamily: 'Nunito' }}>Nunito</option>
                <option value="Source Sans Pro" style={{ fontFamily: 'Source Sans Pro' }}>Source Sans Pro</option>
                <option value="PT Sans" style={{ fontFamily: 'PT Sans' }}>PT Sans</option>
                <option value="Oswald" style={{ fontFamily: 'Oswald' }}>Oswald</option>
                <option value="Playfair Display" style={{ fontFamily: 'Playfair Display' }}>Playfair Display</option>
              </optgroup>
              {/* Serif Fonts */}
              <optgroup label="Serif">
                <option value="Times New Roman" style={{ fontFamily: 'Times New Roman' }}>Times New Roman</option>
                <option value="Georgia" style={{ fontFamily: 'Georgia' }}>Georgia</option>
                <option value="Palatino" style={{ fontFamily: 'Palatino' }}>Palatino</option>
                <option value="Garamond" style={{ fontFamily: 'Garamond' }}>Garamond</option>
                <option value="Book Antiqua" style={{ fontFamily: 'Book Antiqua' }}>Book Antiqua</option>
                <option value="Baskerville" style={{ fontFamily: 'Baskerville' }}>Baskerville</option>
                <option value="Merriweather" style={{ fontFamily: 'Merriweather' }}>Merriweather</option>
                <option value="Lora" style={{ fontFamily: 'Lora' }}>Lora</option>
                <option value="Crimson Text" style={{ fontFamily: 'Crimson Text' }}>Crimson Text</option>
                <option value="PT Serif" style={{ fontFamily: 'PT Serif' }}>PT Serif</option>
              </optgroup>
              {/* Monospace Fonts */}
              <optgroup label="Monospace">
                <option value="Courier New" style={{ fontFamily: 'Courier New' }}>Courier New</option>
                <option value="Monaco" style={{ fontFamily: 'Monaco' }}>Monaco</option>
                <option value="Consolas" style={{ fontFamily: 'Consolas' }}>Consolas</option>
                <option value="Courier" style={{ fontFamily: 'Courier' }}>Courier</option>
                <option value="Lucida Console" style={{ fontFamily: 'Lucida Console' }}>Lucida Console</option>
                <option value="Roboto Mono" style={{ fontFamily: 'Roboto Mono' }}>Roboto Mono</option>
                <option value="Source Code Pro" style={{ fontFamily: 'Source Code Pro' }}>Source Code Pro</option>
                <option value="Fira Code" style={{ fontFamily: 'Fira Code' }}>Fira Code</option>
              </optgroup>
              {/* Display/Decorative Fonts */}
              <optgroup label="Display">
                <option value="Impact" style={{ fontFamily: 'Impact' }}>Impact</option>
                <option value="Comic Sans MS" style={{ fontFamily: 'Comic Sans MS' }}>Comic Sans MS</option>
                <option value="Brush Script MT" style={{ fontFamily: 'Brush Script MT' }}>Brush Script MT</option>
                <option value="Bebas Neue" style={{ fontFamily: 'Bebas Neue' }}>Bebas Neue</option>
                <option value="Anton" style={{ fontFamily: 'Anton' }}>Anton</option>
                <option value="Righteous" style={{ fontFamily: 'Righteous' }}>Righteous</option>
                <option value="Lobster" style={{ fontFamily: 'Lobster' }}>Lobster</option>
                <option value="Pacifico" style={{ fontFamily: 'Pacifico' }}>Pacifico</option>
              </optgroup>
              </select>
            </div>

            <div className="property-group">
              <label className="property-label">Font Weight</label>
              <select
                value={currentElement.fontWeight || 'normal'}
                onChange={(e) => handleFontWeightChange(e.target.value)}
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="600">Semi-Bold</option>
                <option value="700">Bold</option>
                <option value="800">Extra Bold</option>
              </select>
            </div>

            {/* Show Labels - only for player details */}
            {selectedElement === 'playerDetails' && (
              <div className="property-group">
                <label className="property-label checkbox-label">
                  <input
                    type="checkbox"
                    checked={currentElement.showLabels !== false}
                    onChange={(e) => onDesignChange(selectedElement, { showLabels: e.target.checked })}
                  />
                  <span>Show Labels</span>
                </label>
              </div>
            )}

            {/* Text Alignment */}
            <div className="property-group">
              <label className="property-label">Text Alignment</label>
              <select
                value={currentElement.textAlign || 'left'}
                onChange={(e) => onDesignChange(selectedElement, { textAlign: e.target.value })}
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>

            {/* Text Wrap */}
            <div className="property-group">
              <label className="property-label checkbox-label">
                <input
                  type="checkbox"
                  checked={currentElement.textWrap !== false}
                  onChange={(e) => onDesignChange(selectedElement, { textWrap: e.target.checked })}
                />
                <span>Text Wrap</span>
              </label>
            </div>

            {/* Max Letters Per Line */}
            <div className="property-group">
              <label className="property-label">Max Letters/Line</label>
              <input
                type="number"
                value={currentElement.maxLettersPerLine || 0}
                onChange={(e) => onDesignChange(selectedElement, { maxLettersPerLine: Math.max(0, parseInt(e.target.value) || 0) })}
                min="0"
                placeholder="0=unlimited"
              />
            </div>

            {/* Text Stroke */}
            <div className="property-group">
              <label className="property-label checkbox-label">
                <input
                  type="checkbox"
                  checked={currentElement.textStrokeEnabled === true}
                  onChange={(e) => onDesignChange(selectedElement, { textStrokeEnabled: e.target.checked })}
                />
                <span>Text Stroke</span>
              </label>
              {currentElement.textStrokeEnabled && (
                <div className="property-subgroup">
                  <div className="property-group">
                    <label className="property-label">Stroke Width</label>
                    <input
                      type="number"
                      value={currentElement.textStrokeWidth || 1}
                      onChange={(e) => onDesignChange(selectedElement, { textStrokeWidth: Math.max(0, Math.min(10, parseFloat(e.target.value) || 1)) })}
                      min="0"
                      max="10"
                      step="0.1"
                    />
                  </div>
                  <div className="property-group">
                    <label className="property-label">Stroke Color</label>
                    <div className="property-row">
                      <input
                        type="color"
                        value={currentElement.textStrokeColor || '#000000'}
                        onChange={(e) => onDesignChange(selectedElement, { textStrokeColor: e.target.value })}
                      />
                      <input
                        type="text"
                        value={currentElement.textStrokeColor || '#000000'}
                        onChange={(e) => onDesignChange(selectedElement, { textStrokeColor: e.target.value })}
                        placeholder="#000000"
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Effects Section */}
        <>
          {/* Shadow - for all elements */}
          <div className="property-group">
            <label className="property-label checkbox-label">
              <input
                type="checkbox"
                checked={currentElement.shadowEnabled === true}
                onChange={(e) => onDesignChange(selectedElement, { shadowEnabled: e.target.checked })}
              />
              <span>Shadow</span>
            </label>
            {currentElement.shadowEnabled && (
              <div className="property-subgroup">
                <div className="property-group">
                  <label className="property-label">Shadow Color</label>
                  <div className="property-row">
                    <input
                      type="color"
                      value={rgbaToHex(currentElement.shadowColor || 'rgba(0, 0, 0, 0.5)')}
                      onChange={(e) => {
                        const currentColor = currentElement.shadowColor || 'rgba(0, 0, 0, 0.5)';
                        let alpha = 0.5;
                        if (currentColor.startsWith('rgba')) {
                          const alphaMatch = currentColor.match(/[\d.]+\)$/);
                          if (alphaMatch) {
                            alpha = parseFloat(alphaMatch[0].replace(')', ''));
                          }
                        }
                        onDesignChange(selectedElement, { shadowColor: hexToRgba(e.target.value, alpha) });
                      }}
                    />
                    <input
                      type="text"
                      value={currentElement.shadowColor || 'rgba(0, 0, 0, 0.5)'}
                      onChange={(e) => onDesignChange(selectedElement, { shadowColor: e.target.value })}
                      placeholder="rgba(0, 0, 0, 0.5)"
                    />
                  </div>
                </div>
                <div className="property-group">
                  <label className="property-label">Blur (px)</label>
                  <input
                    type="number"
                    value={currentElement.shadowBlur || 4}
                    onChange={(e) => onDesignChange(selectedElement, { shadowBlur: Math.max(0, Math.min(50, parseFloat(e.target.value) || 4)) })}
                    min="0"
                    max="50"
                  />
                </div>
                <div className="property-row">
                  <div className="property-input-group">
                    <label>Offset X (px)</label>
                    <input
                      type="number"
                      value={currentElement.shadowOffsetX || 2}
                      onChange={(e) => onDesignChange(selectedElement, { shadowOffsetX: parseFloat(e.target.value) || 0 })}
                      min="-50"
                      max="50"
                    />
                  </div>
                  <div className="property-input-group">
                    <label>Offset Y (px)</label>
                    <input
                      type="number"
                      value={currentElement.shadowOffsetY || 2}
                      onChange={(e) => onDesignChange(selectedElement, { shadowOffsetY: parseFloat(e.target.value) || 0 })}
                      min="-50"
                      max="50"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Border - for all text fields */}
          {!isShape && (selectedElement === 'tournamentName' || selectedElement === 'playerName' || selectedElement === 'playerId' || selectedElement === 'playerDetails') && (
            <div className="property-group">
              <label className="property-label checkbox-label">
                <input
                  type="checkbox"
                  checked={currentElement.circularBorder === true}
                  onChange={(e) => onDesignChange(selectedElement, { circularBorder: e.target.checked })}
                />
                <span>Text Border</span>
              </label>
              {currentElement.circularBorder === true && (
                <div className="property-subgroup">
                  <div className="property-group">
                    <label className="property-label">Border Shape</label>
                    <select
                      value={currentElement.borderShape || 'circle'}
                      onChange={(e) => onDesignChange(selectedElement, { borderShape: e.target.value })}
                    >
                      <option value="circle">Circle</option>
                      <option value="box">Box</option>
                    </select>
                  </div>
                  <div className="property-group">
                    <label className="property-label">Border Size</label>
                    <div className="property-row">
                      <input
                        type="range"
                        min="1.0"
                        max="10.0"
                        step="0.1"
                        value={currentElement.borderSizeMultiplier || 1.8}
                        onChange={(e) => onDesignChange(selectedElement, { borderSizeMultiplier: parseFloat(e.target.value) })}
                        className="range-input"
                      />
                      <span className="range-value">
                        {(currentElement.borderSizeMultiplier || 1.8).toFixed(1)}x
                      </span>
                    </div>
                    <div className="property-help">
                      Size multiplier relative to font size (1.0x - 10.0x)
                    </div>
                  </div>
                  <div className="property-group">
                    <label className="property-label">Border Color</label>
                    <div className="property-row">
                      <input
                        type="color"
                        value={currentElement.borderColor || currentElement.color || '#ffffff'}
                        onChange={(e) => onDesignChange(selectedElement, { borderColor: e.target.value })}
                      />
                      <input
                        type="text"
                        value={currentElement.borderColor || currentElement.color || '#ffffff'}
                        onChange={(e) => onDesignChange(selectedElement, { borderColor: e.target.value })}
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Layer Order */}
          <div className="property-group">
            <label className="property-label">Layer Order</label>
            <div className="layer-controls">
              <button
                type="button"
                className="btn-layer-control"
                onClick={handleSendToBack}
                title="Send to Back"
              >
                ⬇️ Back
              </button>
              <button
                type="button"
                className="btn-layer-control"
                onClick={handleSendBackward}
                title="Send Backward"
              >
                ⬇️
              </button>
              <button
                type="button"
                className="btn-layer-control"
                onClick={handleBringForward}
                title="Bring Forward"
              >
                ⬆️
              </button>
              <button
                type="button"
                className="btn-layer-control"
                onClick={handleBringToFront}
                title="Bring to Front"
              >
                ⬆️ Front
              </button>
            </div>
          </div>
        </>

        {/* Shape-specific properties */}
        {isShape && (
          <>
            <div className="property-group">
              <label className="property-label">Shape Type</label>
              <select
                value={currentElement.type}
                onChange={(e) => onShapeChange(shapeIndex, { type: e.target.value })}
              >
                <option value="rect">Rectangle</option>
                <option value="ellipse">Ellipse/Circle</option>
              </select>
            </div>

            <div className="property-group">
              <label className="property-label">Size</label>
              <div className="property-row">
                <div className="property-input-group">
                  <label>Width (px)</label>
                  <input
                    type="number"
                    value={currentElement.size.width}
                    onChange={(e) => onShapeChange(shapeIndex, {
                      size: {
                        ...currentElement.size,
                        width: Math.max(10, Math.min(500, parseFloat(e.target.value) || 100))
                      }
                    })}
                    min="10"
                    max="500"
                  />
                </div>
                <div className="property-input-group">
                  <label>Height (px)</label>
                  <input
                    type="number"
                    value={currentElement.size.height}
                    onChange={(e) => onShapeChange(shapeIndex, {
                      size: {
                        ...currentElement.size,
                        height: Math.max(10, Math.min(500, parseFloat(e.target.value) || 100))
                      }
                    })}
                    min="10"
                    max="500"
                  />
                </div>
              </div>
            </div>

            <div className="property-group">
              <label className="property-label">Color</label>
              <div className="property-row">
                <input
                  type="color"
                  value={currentElement.color}
                  onChange={(e) => onShapeChange(shapeIndex, { color: e.target.value })}
                />
                <input
                  type="text"
                  value={currentElement.color}
                  onChange={(e) => onShapeChange(shapeIndex, { color: e.target.value })}
                  placeholder="rgba(255,255,255,0.5)"
                />
              </div>
            </div>

            <div className="property-group">
              <label className="property-label">Opacity</label>
              <input
                type="number"
                value={currentElement.opacity || 1}
                onChange={(e) => onShapeChange(shapeIndex, {
                  opacity: Math.max(0, Math.min(1, parseFloat(e.target.value) || 1))
                })}
                min="0"
                max="1"
                step="0.1"
              />
            </div>

            {currentElement.type === 'rect' && (
              <div className="property-group">
                <label className="property-label">Border Radius (px)</label>
                <input
                  type="number"
                  value={currentElement.borderRadius || 0}
                  onChange={(e) => onShapeChange(shapeIndex, {
                    borderRadius: Math.max(0, Math.min(100, parseFloat(e.target.value) || 0))
                  })}
                  min="0"
                  max="100"
                />
              </div>
            )}

            {/* Shadow - for shapes */}
            <div className="property-group">
              <label className="property-label checkbox-label">
                <input
                  type="checkbox"
                  checked={currentElement.shadowEnabled === true}
                  onChange={(e) => onShapeChange(shapeIndex, { shadowEnabled: e.target.checked })}
                />
                <span>Shadow</span>
              </label>
              {currentElement.shadowEnabled && (
                <div className="property-subgroup">
                  <div className="property-group">
                    <label className="property-label">Shadow Color</label>
                    <div className="property-row">
                      <input
                        type="color"
                        value={rgbaToHex(currentElement.shadowColor || 'rgba(0, 0, 0, 0.5)')}
                        onChange={(e) => {
                          const currentColor = currentElement.shadowColor || 'rgba(0, 0, 0, 0.5)';
                          let alpha = 0.5;
                          if (currentColor.startsWith('rgba')) {
                            const alphaMatch = currentColor.match(/[\d.]+\)$/);
                            if (alphaMatch) {
                              alpha = parseFloat(alphaMatch[0].replace(')', ''));
                            }
                          }
                          onShapeChange(shapeIndex, { shadowColor: hexToRgba(e.target.value, alpha) });
                        }}
                      />
                      <input
                        type="text"
                        value={currentElement.shadowColor || 'rgba(0, 0, 0, 0.5)'}
                        onChange={(e) => onShapeChange(shapeIndex, { shadowColor: e.target.value })}
                        placeholder="rgba(0, 0, 0, 0.5)"
                      />
                    </div>
                  </div>
                  <div className="property-group">
                    <label className="property-label">Blur (px)</label>
                    <input
                      type="number"
                      value={currentElement.shadowBlur || 4}
                      onChange={(e) => onShapeChange(shapeIndex, { shadowBlur: Math.max(0, Math.min(50, parseFloat(e.target.value) || 4)) })}
                      min="0"
                      max="50"
                    />
                  </div>
                  <div className="property-row">
                    <div className="property-input-group">
                      <label>Offset X (px)</label>
                      <input
                        type="number"
                        value={currentElement.shadowOffsetX || 2}
                        onChange={(e) => onShapeChange(shapeIndex, { shadowOffsetX: parseFloat(e.target.value) || 0 })}
                        min="-50"
                        max="50"
                      />
                    </div>
                    <div className="property-input-group">
                      <label>Offset Y (px)</label>
                      <input
                        type="number"
                        value={currentElement.shadowOffsetY || 2}
                        onChange={(e) => onShapeChange(shapeIndex, { shadowOffsetY: parseFloat(e.target.value) || 0 })}
                        min="-50"
                        max="50"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="property-group">
              <label className="property-label">Actions</label>
              <button
                className="btn-remove"
                onClick={() => {
                  if (window.confirm('Delete this shape?')) {
                    const newShapes = [...(design.shapes || [])];
                    newShapes.splice(shapeIndex, 1);
                    // Update the entire design with new shapes array
                    onDesignChange('shapes', newShapes);
                    // Clear selection after deletion
                    if (onElementSelect) {
                      onElementSelect(null);
                    }
                  }
                }}
                style={{ width: '100%', marginTop: '8px' }}
              >
                🗑️ Delete Shape
              </button>
            </div>
          </>
        )}

        {/* Visibility */}
        <div className="property-group">
          <label className="property-label">Visibility</label>
          <button
            className={`btn-toggle-visibility ${currentElement.visible !== false ? 'visible' : 'hidden'}`}
            onClick={() => {
              if (isShape && shapeIndex !== null) {
                onShapeChange(shapeIndex, { visible: !currentElement.visible });
              } else {
                onDesignChange(selectedElement, { visible: !currentElement.visible });
              }
            }}
          >
            {currentElement.visible !== false ? '👁️ Visible' : '👁️‍🗨️ Hidden'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DesignProperties;

