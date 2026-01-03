import React, { useState } from 'react';
import ImageUploadCrop from './ImageUploadCrop';
import { API_BASE_URL } from '../utils/apiConfig';

function DesignToolbox({
  design,
  onDesignChange,
  onShapeChange,
  onAddShape,
  onBackgroundImageUpload,
  onElementSelect,
  selectedElement,
  tournament
}) {
  const [showCropEditor, setShowCropEditor] = useState(false);
  const handleBackgroundTypeChange = (type) => {
    onDesignChange('background', { type });
  };

  const handleGradientChange = (e) => {
    onDesignChange('background', { gradient: e.target.value });
  };

  const handleElementToggle = (elementKey) => {
    const element = design[elementKey];
    onDesignChange(elementKey, { visible: !element.visible });
  };

  const handleElementClick = (elementKey) => {
    const element = design[elementKey];
    
    // Check if it's a text field
    const textFields = ['tournamentName', 'playerName', 'playerId', 'playerDetails'];
    const isTextField = textFields.includes(elementKey);
    
    // If it's a text field that is currently visible (eye icon shows 👁️)
    if (isTextField && element && element.visible === true) {
      // Ensure it has a valid position, if not set a default position
      if (!element.position || typeof element.position !== 'object' || 
          element.position.x === undefined || element.position.y === undefined) {
        // Set default positions for each text field type
        const defaultPositions = {
          tournamentName: { x: 30, y: 8 },
          playerName: { x: 5, y: 80 },
          playerId: { x: 5, y: 90 },
          playerDetails: { x: 5, y: 60 }
        };
        onDesignChange(elementKey, { 
          position: defaultPositions[elementKey] || { x: 5, y: 50 }
        });
      }
    }
    
    // Select the element
    onElementSelect(elementKey);
  };

  const handleShapeToggle = (index) => {
    const shape = design.shapes?.[index];
    if (!shape) return;
    onShapeChange(index, { visible: !shape.visible });
  };

  const elements = [
    { key: 'logo', label: 'Logo', icon: '🖼️' },
    { key: 'tournamentName', label: 'Tournament Name', icon: '📝' },
    { key: 'playerPhoto', label: 'Player Photo', icon: '📸' },
    { key: 'playerDetails', label: 'Player Details', icon: '📋' },
    { key: 'playerName', label: 'Player Name', icon: '👤' },
    { key: 'playerId', label: 'Player ID', icon: '🆔' }
  ];

  return (
    <div className="design-toolbox">
      <h3>Toolbox</h3>

      {/* Background Section */}
      <div className="toolbox-section">
        <h4>Background</h4>
        <div className="background-type-selector">
          <button
            className={`btn-toggle ${design.background.type === 'gradient' ? 'active' : ''}`}
            onClick={() => handleBackgroundTypeChange('gradient')}
          >
            Gradient
          </button>
          <button
            className={`btn-toggle ${design.background.type === 'image' ? 'active' : ''}`}
            onClick={() => handleBackgroundTypeChange('image')}
          >
            Image
          </button>
        </div>

        {design.background.type === 'gradient' && (
          <div className="gradient-input">
            <label>Gradient CSS</label>
            <input
              type="text"
              value={design.background.gradient || ''}
              onChange={handleGradientChange}
              placeholder="linear-gradient(...)"
            />
          </div>
        )}

        {design.background.type === 'image' && (
          <div className="background-image-upload">
            {design.background.imageUrl ? (
              <>
                <div className="background-image-preview">
                  <img 
                    src={`${API_BASE_URL}${design.background.imageUrl}`} 
                    alt="Background preview"
                    className="background-preview-image"
                  />
                  <button
                    type="button"
                    className="preview-remove-btn-small"
                    onClick={() => {
                      onDesignChange('background', { type: 'gradient', imageUrl: '' });
                    }}
                    aria-label="Remove image"
                    title="Remove background image"
                  >
                    ×
                  </button>
                </div>
                <div style={{ marginTop: '8px', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#6b7280', marginBottom: '4px', fontWeight: '500' }}>
                    Image Size
                  </label>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Width</label>
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
                        <div>
                          <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Height</label>
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
                      <div>
                        <label style={{ display: 'block', fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}>Unit</label>
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
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="btn-replace-image"
                    onClick={() => {
                      setShowCropEditor(true);
                    }}
                    style={{ flex: '1', minWidth: '80px' }}
                  >
                    ✂️ Crop
                  </button>
                  <button
                    className="btn-replace-image"
                    onClick={() => {
                      // Reset image to show upload option
                      onDesignChange('background', { imageUrl: '' });
                      setShowCropEditor(false);
                    }}
                    style={{ flex: '1', minWidth: '80px' }}
                  >
                    🔄 Replace
                  </button>
                  <button
                    className="btn-remove"
                    onClick={() => {
                      onDesignChange('background', { type: 'gradient', imageUrl: '' });
                      setShowCropEditor(false);
                    }}
                    style={{ flex: '1', minWidth: '80px' }}
                  >
                    Remove
                  </button>
                </div>
                
                {/* Crop Editor */}
                {showCropEditor && design.background.imageUrl && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: '600', color: '#374151' }}>Crop Background Image</label>
                      <button
                        onClick={() => setShowCropEditor(false)}
                        style={{
                          background: 'none',
                          border: 'none',
                          fontSize: '18px',
                          cursor: 'pointer',
                          color: '#6b7280',
                          padding: '0',
                          lineHeight: '1'
                        }}
                        title="Close crop editor"
                      >
                        ×
                      </button>
                    </div>
                    <ImageUploadCrop
                      label=""
                      aspectRatio={3 / 4}
                      uploadPath={`${API_BASE_URL}/api/tournaments/upload-player-card-background`}
                      uploadType="playerCardBackground"
                      onUploadComplete={(data) => {
                        if (data.url) {
                          onBackgroundImageUpload(data.url);
                          setShowCropEditor(false);
                        }
                      }}
                      initialImage={design.background.imageUrl.startsWith('http') 
                        ? design.background.imageUrl 
                        : `${API_BASE_URL}${design.background.imageUrl.startsWith('/') ? '' : '/'}${design.background.imageUrl}`}
                    />
                  </div>
                )}
              </>
            ) : (
              <ImageUploadCrop
                label="Upload Background Image"
                aspectRatio={3 / 4}
                uploadPath={`${API_BASE_URL}/api/tournaments/upload-player-card-background`}
                uploadType="playerCardBackground"
                onUploadComplete={(data) => {
                  if (data.url) {
                    onBackgroundImageUpload(data.url);
                  }
                }}
                initialImage={null}
              />
            )}
          </div>
        )}
      </div>

      {/* Elements Section */}
      <div className="toolbox-section">
        <h4>Elements</h4>
        <div className="elements-list">
          {elements.map(element => (
            <div
              key={element.key}
              className={`element-item ${selectedElement === element.key ? 'selected' : ''} ${!design[element.key]?.visible ? 'hidden' : ''}`}
              onClick={() => handleElementClick(element.key)}
            >
              <span className="element-icon">{element.icon}</span>
              <span className="element-label">{element.label}</span>
              <button
                className={`toggle-visibility ${design[element.key]?.visible ? 'visible' : 'hidden'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleElementToggle(element.key);
                }}
                title={design[element.key]?.visible ? 'Hide' : 'Show'}
              >
                {design[element.key]?.visible ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Shapes Section */}
      <div className="toolbox-section">
        <h4>Shapes</h4>
        <div className="elements-list">
          {(design.shapes || []).map((shape, index) => {
            const elementKey = `shape-${index}`;
            return (
              <div
                key={elementKey}
                className={`element-item ${selectedElement === elementKey ? 'selected' : ''} ${shape.visible === false ? 'hidden' : ''}`}
                onClick={() => onElementSelect(elementKey)}
              >
                <span className="element-icon">{shape.type === 'ellipse' ? '⭕' : '▭'}</span>
                <span className="element-label">Shape {index + 1}</span>
                <button
                  className={`toggle-visibility ${shape.visible !== false ? 'visible' : 'hidden'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShapeToggle(index);
                  }}
                  title={shape.visible !== false ? 'Hide' : 'Show'}
                >
                  {shape.visible !== false ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn-card-generator" style={{ marginTop: '12px' }} onClick={onAddShape}>
          ➕ Add Shape
        </button>
      </div>
    </div>
  );
}

export default DesignToolbox;

