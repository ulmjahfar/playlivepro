import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Cropper from 'react-easy-crop';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'react-toastify';
import axios from 'axios';
import 'react-easy-crop/react-easy-crop.css';

import {
  validateImageFile,
  createImagePreview,
  revokeImagePreview,
  getImageDimensions
} from './ImageUpload/imageUtils';
import { autoOptimizeImage } from './ImageUpload/compression';
import './ImageUpload/styles.css';

const TARGET_LIMIT_KB = 5000;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png'];
const MIN_DIMENSION = 100;
const MAX_DIMENSION = 10000;

const STEP_SEQUENCE = ['upload', 'crop', 'preview', 'uploading', 'uploaded'];

const qualityBadge = (qualityValue) => {
  if (qualityValue >= 0.85) return { label: 'High', level: 'high' };
  if (qualityValue >= 0.7) return { label: 'Medium', level: 'medium' };
  return { label: 'Low', level: 'low' };
};

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

const getRadianAngle = (degreeValue) => (degreeValue * Math.PI) / 180;

const rotateSize = (width, height, rotation) => {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height)
  };
};

const createCroppedCanvas = async (imageSrc, pixelCrop, rotation) => {
  const safeCrop = {
    x: Math.round(pixelCrop.x),
    y: Math.round(pixelCrop.y),
    width: Math.round(pixelCrop.width),
    height: Math.round(pixelCrop.height)
  };

  const image = await createImage(imageSrc);
  const rotRad = getRadianAngle(rotation);
  
  // Create output canvas for the cropped area
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = safeCrop.width;
  outputCanvas.height = safeCrop.height;
  const outputCtx = outputCanvas.getContext('2d');

  // If no rotation, crop directly
  if (rotation === 0) {
    outputCtx.drawImage(
      image,
      safeCrop.x,
      safeCrop.y,
      safeCrop.width,
      safeCrop.height,
      0,
      0,
      safeCrop.width,
      safeCrop.height
    );
  } else {
    // For rotation, we need to:
    // 1. Create a larger canvas that can hold the rotated image
    const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
      image.width,
      image.height,
      rotation
    );
    
    // 2. Draw the rotated image on a temporary canvas
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = bBoxWidth;
    tempCanvas.height = bBoxHeight;
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCtx.save();
    tempCtx.translate(bBoxWidth / 2, bBoxHeight / 2);
    tempCtx.rotate(rotRad);
    tempCtx.drawImage(image, -image.width / 2, -image.height / 2);
    tempCtx.restore();
    
    // 3. Extract the cropped region from the rotated image
    const imageData = tempCtx.getImageData(
      safeCrop.x,
      safeCrop.y,
      safeCrop.width,
      safeCrop.height
    );
    
    // 4. Draw the extracted region to output canvas
    outputCtx.putImageData(imageData, 0, 0);
  }

  return {
    canvas: outputCanvas,
    width: safeCrop.width,
    height: safeCrop.height
  };
};

const generateCroppedFile = async (imageSrc, pixelCrop, rotation, fileName, originalFileType) => {
  const { canvas, width, height } = await createCroppedCanvas(imageSrc, pixelCrop, rotation);

  // Detect if original file was PNG
  const isPNG = originalFileType === 'image/png';
  const mimeType = isPNG ? 'image/png' : 'image/jpeg';
  const fileExtension = isPNG ? 'png' : 'jpg';
  const quality = isPNG ? undefined : 0.95; // PNG doesn't use quality parameter

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to generate cropped image'));
          return;
        }
        const sanitized = (fileName || 'upload').replace(/\.[^/.]+$/, '');
        const croppedFile = new File([blob], `${sanitized}.${fileExtension}`, {
          type: mimeType,
          lastModified: Date.now()
        });
        resolve({
          file: croppedFile,
          width,
          height
        });
      },
      mimeType,
      quality
    );
  });
};

const getCroppedPreview = async (imageSrc, pixelCrop, rotation) => {
  const { canvas, width, height } = await createCroppedCanvas(imageSrc, pixelCrop, rotation);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { url: dataUrl, width, height };
};

const ImageUploadCrop = ({
  label = '',
  placeholder,
  aspectRatio = 4 / 3, // Default to 4:3
  aspect,
  onUploadComplete,
  onComplete,
  onError,
  onUploadStart,
  onUploadEnd,
  uploadPath,
  uploadType,
  previewShape = 'square',
  initialImage = null,
  onImageSelect
}) => {
  const finalAspectRatio = aspect !== undefined ? aspect : aspectRatio;
  const finalLabel = placeholder || label;

  const [selectedFile, setSelectedFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [showCropModal, setShowCropModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(initialImage);
  const [optimizedFile, setOptimizedFile] = useState(null);
  const [optimizationDetails, setOptimizationDetails] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [currentStep, setCurrentStep] = useState(initialImage ? 'preview' : 'upload');
  const [activeAspect, setActiveAspect] = useState(finalAspectRatio);
  const [imageDimensions, setImageDimensions] = useState(null);
  const [originalAspectRatio, setOriginalAspectRatio] = useState(null);

  useEffect(() => {
    if (initialImage) {
      setPreviewUrl(initialImage);
      setCurrentStep('preview');
    }
  }, [initialImage]);

  useEffect(() => {
    setActiveAspect(finalAspectRatio);
  }, [finalAspectRatio]);

  useEffect(() => {
    return () => {
      if (imageSrc) revokeImagePreview(imageSrc);
      if (previewUrl && previewUrl.startsWith('blob:')) revokeImagePreview(previewUrl);
    };
  }, [imageSrc, previewUrl]);


  const resetPreviewState = useCallback(() => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      revokeImagePreview(previewUrl);
    }
    setPreviewUrl(null);
    setOptimizedFile(null);
    setOptimizationDetails(null);
  }, [previewUrl]);

  const handleFileSelected = useCallback(
    async (file) => {
      try {
        resetPreviewState();
        if (imageSrc) {
          revokeImagePreview(imageSrc);
        }

        // Validate image dimensions
        const dimensions = await getImageDimensions(file);
        if (dimensions.width < MIN_DIMENSION || dimensions.height < MIN_DIMENSION) {
          throw new Error(
            `Image too small. Minimum dimension is ${MIN_DIMENSION}px. Current: ${dimensions.width}×${dimensions.height}px`
          );
        }
        if (dimensions.width > MAX_DIMENSION || dimensions.height > MAX_DIMENSION) {
          throw new Error(
            `Image too large. Maximum dimension is ${MAX_DIMENSION}px. Current: ${dimensions.width}×${dimensions.height}px`
          );
        }

        // Store image dimensions for auto-fit calculations
        setImageDimensions(dimensions);
        // Calculate and store original aspect ratio
        if (dimensions.width && dimensions.height) {
          const originalAspect = dimensions.width / dimensions.height;
          setOriginalAspectRatio(originalAspect);
        }

        const preview = createImagePreview(file);
        setSelectedFile(file);
        setImageSrc(preview);
        setShowCropModal(true);
        setCurrentStep('crop');
        
        // Auto-adjust to 4:3 aspect ratio if that's the default
        let initialZoom = 1;
        if (finalAspectRatio === 4 / 3 || finalAspectRatio) {
          // Calculate optimal zoom to fit aspect ratio
          const targetAspect = finalAspectRatio;
          const imageAspect = dimensions.width / dimensions.height;
          
          if (Math.abs(imageAspect - targetAspect) > 0.01) {
            // Only adjust if aspect ratios are significantly different
            if (imageAspect > targetAspect) {
              // Image is wider than target, fit to height
              initialZoom = (dimensions.height * targetAspect) / dimensions.width;
            } else {
              // Image is taller than target, fit to width
              initialZoom = dimensions.width / (dimensions.height * targetAspect);
            }
            // Ensure zoom is reasonable (between 0.5 and 2)
            initialZoom = Math.max(0.5, Math.min(initialZoom * 0.95, 2));
          }
        }
        
        setCrop({ x: 0, y: 0 });
        setZoom(initialZoom);
        setRotation(0);
        setActiveAspect(finalAspectRatio);
      } catch (error) {
        console.error('File selection error:', error);
        const message = error.message || 'Failed to load image';
        if (onError) {
          onError(message);
        } else {
          toast.error(message);
        }
      }
    },
    [imageSrc, resetPreviewState, finalAspectRatio, onError]
  );

  const onDrop = useCallback(
    async (acceptedFiles) => {
      const file = acceptedFiles[0];
      if (!file) return;

      const validation = validateImageFile(file, {
        maxSizeMB: 50,
        allowedTypes: ACCEPTED_TYPES
      });
      if (!validation.isValid) {
        const message =
          validation.error === 'Invalid file type. Please upload JPG, PNG, or WEBP files.'
            ? 'Please upload PNG or JPG image.'
            : validation.error;
        if (onError) {
          onError(message);
        } else {
          toast.error(message);
        }
        return;
      }

      await handleFileSelected(file);
    },
    [handleFileSelected, onError]
  );

  const onDropRejected = useCallback(
    (rejected) => {
      rejected.forEach(({ file, errors }) => {
        errors.forEach((error) => {
          let message = `Issue with "${file.name}"`;
          if (error.code === 'file-invalid-type') {
            message = 'Please upload PNG or JPG image.';
          } else if (error.code === 'file-too-large') {
            message = 'Maximum file size is 50MB.';
          }
          if (onError) {
            onError(message);
          } else {
            toast.error(message);
          }
        });
      });
    },
    [onError]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'image/jpeg': [],
      'image/png': []
    },
    multiple: false,
    maxSize: 50 * 1024 * 1024,
    disabled: processing || uploading
  });

  const onCropComplete = useCallback((_croppedArea, pixelArea) => {
    setCroppedAreaPixels(pixelArea);
  }, []);

  const handleCropCancel = useCallback(() => {
    setShowCropModal(false);
    setSelectedFile(null);
    if (imageSrc) {
      revokeImagePreview(imageSrc);
      setImageSrc(null);
    }
    if (!previewUrl) {
      setCurrentStep('upload');
    }
  }, [imageSrc, previewUrl]);

  const handleCropConfirm = useCallback(async () => {
    if (!croppedAreaPixels || !imageSrc) {
      toast.error('Draw a crop box before applying.');
      return;
    }

    try {
      setProcessing(true);
      setStatusMessage('Processing image...');
      setUploadProgress(10);
      if (onUploadStart) onUploadStart(0);

      // Step 1: Generate cropped file
      setUploadProgress(15);
      setStatusMessage('Cropping image...');
      const { file: croppedFile, width, height } = await generateCroppedFile(
        imageSrc,
        croppedAreaPixels,
        rotation,
        selectedFile?.name,
        selectedFile?.type
      );

      // Validate minimum dimensions
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        throw new Error(
          `Image too small. Minimum dimension is ${MIN_DIMENSION}px. Current: ${width}×${height}px`
        );
      }

      // Validate maximum dimensions (safety check)
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        throw new Error(
          `Image too large. Maximum dimension is ${MAX_DIMENSION}px. Current: ${width}×${height}px`
        );
      }

      // Step 2: Optimize the cropped file
      setUploadProgress(30);
      setStatusMessage('Optimizing image...');
      
      const { file: optimized, qualityUsed } = await autoOptimizeImage(
        croppedFile,
        {
          targetSizeKB: TARGET_LIMIT_KB,
          initialMaxDimension: Math.max(width, height),
          onProgress: (progress) => {
            setUploadProgress(30 + progress * 0.5); // 30-80%
          }
        }
      );

      setUploadProgress(85);
      setStatusMessage('Finalizing...');

      // Clean up old preview if exists
      if (previewUrl && previewUrl.startsWith('blob:')) {
        revokeImagePreview(previewUrl);
      }
      const optimizedPreview = createImagePreview(optimized);
      setOptimizedFile(optimized);
      setPreviewUrl(optimizedPreview);

      // Get final dimensions and size
      const { width: optWidth, height: optHeight } = await getImageDimensions(optimized);
      const sizeKB = Math.round(optimized.size / 1024);
      setOptimizationDetails({
        sizeKB,
        limitKB: TARGET_LIMIT_KB,
        width: optWidth,
        height: optHeight,
        format: optimized.type?.split('/')[1]?.toUpperCase() || 'JPG',
        qualityValue: qualityUsed || 0.95
      });

      setShowCropModal(false);
      setCurrentStep('preview');
      setStatusMessage('');
      setUploadProgress(0);
      toast.success('Crop applied. Review preview before uploading.');
    } catch (error) {
      console.error('Processing failed:', error);
      const message = error.message || 'Failed to process image';
      if (onError) onError(message);
      toast.error(message);
      setCurrentStep('upload');
    } finally {
      setProcessing(false);
      setUploadProgress(0);
    }
  }, [
    croppedAreaPixels,
    imageSrc,
    rotation,
    selectedFile,
    previewUrl,
    onUploadStart,
    onError
  ]);

  const handleUploadImage = useCallback(async () => {
    if (!optimizedFile || !previewUrl) {
      toast.error('Please crop an image before uploading.');
      return;
    }

    try {
      setUploading(true);
      setCurrentStep('uploading');
      setStatusMessage('Uploading optimized image...');
      setUploadProgress(5);
      if (onUploadStart) onUploadStart(0);

      if (uploadPath) {
        const formData = new FormData();
        formData.append('image', optimizedFile);
        if (uploadType) {
          formData.append('uploadType', uploadType);
        }

        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'multipart/form-data' };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await axios.post(uploadPath, formData, {
          headers,
          onUploadProgress: (event) => {
            if (!event.total) return;
            const percent = Math.round((event.loaded * 100) / event.total);
            setUploadProgress(5 + percent * 0.95);
          }
        });

        const uploadedUrl = response.data.url || response.data.imageUrl;
        if (onComplete) onComplete(uploadedUrl);
        if (onUploadComplete) {
          onUploadComplete({
            file: optimizedFile,
            url: uploadedUrl,
            size: optimizedFile.size,
            name: optimizedFile.name,
            type: optimizedFile.type
          });
        }
      } else {
        if (onUploadComplete) {
          onUploadComplete({
            file: optimizedFile,
            url: previewUrl,
            size: optimizedFile.size,
            name: optimizedFile.name,
            type: optimizedFile.type
          });
        }
        if (onComplete) {
          onComplete(previewUrl);
        }
        if (onImageSelect) {
          onImageSelect(optimizedFile);
        }
      }

      toast.success('Image uploaded successfully ✓');
      setCurrentStep('uploaded');
      setUploadProgress(100);
    } catch (error) {
      console.error('Upload failed:', error);
      let message = 'Upload failed. Please try again.';
      
      if (error.response) {
        // Server responded with error
        message = error.response.data?.message || error.response.data?.error || message;
        if (error.response.status === 413) {
          message = 'File too large. Please try a smaller image.';
        } else if (error.response.status === 415) {
          message = 'Unsupported file type. Please use JPG or PNG.';
        } else if (error.response.status >= 500) {
          message = 'Server error. Please try again later.';
        }
      } else if (error.request) {
        // Request made but no response
        message = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        message = error.message;
      }
      
      if (onError) onError(message);
      toast.error(message);
      setCurrentStep('preview');
    } finally {
      if (onUploadEnd) onUploadEnd();
      setUploading(false);
      setUploadProgress(0);
      setStatusMessage('');
    }
  }, [
    optimizedFile,
    previewUrl,
    uploadPath,
    uploadType,
    onComplete,
    onUploadComplete,
    onUploadStart,
    onUploadEnd,
    onError,
    onImageSelect
  ]);

  const handleRemovePreview = useCallback(() => {
    resetPreviewState();
    setSelectedFile(null);
    setCurrentStep('upload');
    if (onComplete) onComplete('');
    if (onUploadComplete) onUploadComplete({ url: '' });
  }, [resetPreviewState, onComplete, onUploadComplete]);

  const handleRecrop = useCallback(() => {
    if (!selectedFile) {
      toast.info('Select an image first.');
      return;
    }
    setShowCropModal(true);
    setCurrentStep('crop');
  }, [selectedFile]);

  const handleFitToArea = useCallback(() => {
    if (!imageDimensions || !activeAspect) {
      toast.info('Image not loaded yet.');
      return;
    }

    // Calculate optimal zoom to fit image to aspect ratio
    const targetAspect = activeAspect;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    
    let optimalZoom = 1;
    
    if (Math.abs(imageAspect - targetAspect) > 0.01) {
      // Only adjust if aspect ratios are significantly different
      if (imageAspect > targetAspect) {
        // Image is wider than target, fit to height
        optimalZoom = (imageDimensions.height * targetAspect) / imageDimensions.width;
      } else {
        // Image is taller than target, fit to width
        optimalZoom = imageDimensions.width / (imageDimensions.height * targetAspect);
      }
      // Ensure zoom is reasonable (between 0.5 and 2)
      optimalZoom = Math.max(0.5, Math.min(optimalZoom * 0.95, 2));
    }

    // Center the image and apply optimal zoom
    setCrop({ x: 0, y: 0 });
    setZoom(optimalZoom);
  }, [imageDimensions, activeAspect]);

  const dropzoneClasses = useMemo(() => {
    let className = 'image-upload-dropzone';
    if (isDragActive) className += ' drag-active';
    if (isDragReject) className += ' drag-reject';
    if (processing || uploading) className += ' disabled';
    return className;
  }, [isDragActive, isDragReject, processing, uploading]);

  const stepChips = useMemo(
    () => [
      { key: 'upload', label: 'Upload', index: 0 },
      { key: 'crop', label: 'Crop', index: 1 },
      { key: 'preview', label: 'Preview', index: 2 },
      { key: 'submit', label: 'Upload', index: 3 }
    ],
    []
  );

  const currentStepIndex = STEP_SEQUENCE.indexOf(currentStep);
  const normalizedStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;

  const renderStepState = (chipIndex) => {
    if (normalizedStepIndex > chipIndex) return 'done';
    if (normalizedStepIndex === chipIndex) return 'active';
    if (normalizedStepIndex === STEP_SEQUENCE.length - 1 && chipIndex === 3) return 'done';
    return 'pending';
  };

  return (
    <div className="image-upload-container">
      {finalLabel && finalLabel.trim() && <label className="image-upload-label">{finalLabel}</label>}

      <div className="image-upload-steps" aria-label="Image upload stages">
        {stepChips.map((chip) => (
          <div
            key={chip.key}
            className={`step-chip ${renderStepState(chip.index)}`}
          >
            <span className="step-number">{chip.index + 1}</span>
            <span>{chip.label}</span>
          </div>
        ))}
      </div>

      <div className="image-upload-options">
        <div {...getRootProps()} className={dropzoneClasses}>
          <input {...getInputProps()} aria-label="Upload PNG or JPG image" />
          <div className="dropzone-content modern">
            <div className="upload-entry-box">
              <span className="upload-plus">+</span>
            </div>
            <p className="dropzone-headline">
              Drag & Drop or Click to Upload
            </p>
            <p className="dropzone-subtext">
              PNG or JPG • PNG format preserved
            </p>
            <p className="dropzone-subtext secondary">
              Max 50MB • crop & preview before upload
            </p>
          </div>
        </div>

        {previewUrl && !optimizationDetails && (
          <div className="image-preview-container">
            <img
              src={previewUrl}
              alt="Preview"
              className={`image-preview ${previewShape}`}
            />
            <button
              type="button"
              className="preview-remove-btn"
              onClick={handleRemovePreview}
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        )}

        {previewUrl && optimizationDetails && (
          <div className="preview-stage-card">
          <div className="preview-media">
            <img
              src={previewUrl}
              alt="Cropped preview"
              className={`preview-image ${previewShape}`}
            />
            <div className="preview-size-pill">
              File Size: {optimizationDetails.sizeKB} KB{' '}
              {optimizationDetails.sizeKB <= optimizationDetails.limitKB ? '✓' : '⚠'}
            </div>
          </div>
          <div className="preview-meta">
            <div className="preview-meta-grid">
              <div className="preview-meta-item">
                <span className="meta-label">Dimensions</span>
                <strong>{optimizationDetails.width} × {optimizationDetails.height}px</strong>
              </div>
              <div className="preview-meta-item">
                <span className="meta-label">Format</span>
                <strong>{optimizationDetails.format}</strong>
              </div>
              <div className="preview-meta-item">
                <span className="meta-label">Compression</span>
                <span className={`quality-badge ${qualityBadge(optimizationDetails.qualityValue).level}`}>
                  {qualityBadge(optimizationDetails.qualityValue).label}
                </span>
              </div>
              <div className="preview-meta-item">
                <span className="meta-label">Target</span>
                <strong>≤ {optimizationDetails.limitKB} KB</strong>
              </div>
            </div>
            <div className="preview-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleRecrop}
                disabled={processing || uploading}
              >
                Re-Crop
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleUploadImage}
                disabled={uploading || processing}
              >
                {uploading ? (
                  <>
                    <span className="loading-spinner" />
                    Uploading...
                  </>
                ) : (
                  'Upload Image'
                )}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="preview-remove-btn"
            onClick={handleRemovePreview}
            aria-label="Remove image"
          >
            ×
          </button>
        </div>
        )}
      </div>

      {(processing || uploading) && (
        <div className="upload-progress-container">
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }} />
          </div>
          <div className="upload-progress-text uploading">
            {statusMessage || `${uploading ? 'Uploading' : 'Processing'}... ${Math.round(uploadProgress)}%`}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showCropModal && imageSrc && (
          <motion.div
            className="crop-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCropCancel}
          >
            <motion.div
              className="crop-modal-container"
              initial={{ scale: 0.98, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="crop-modal-content">
                <div className="crop-header-bar">
                  <h3>Adjust Image</h3>
                  <button
                    type="button"
                    className="crop-close-btn"
                    onClick={handleCropCancel}
                    disabled={processing}
                    aria-label="Close"
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="crop-main-layout">
                  <div className="crop-image-side">
                    <div className="crop-area-wrapper">
                      <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={activeAspect || undefined}
                        zoomSpeed={0.3}
                        restrictPosition={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onRotationChange={setRotation}
                        onCropComplete={onCropComplete}
                        cropShape="rect"
                        showGrid={false}
                      />
                    </div>
                  </div>
                  <div className="crop-controls-side">
                    <div className="controls-section">
                      <div className="control-group">
                        <div className="control-label">Aspect Ratio</div>
                        <div className="aspect-ratio-group">
                          {[
                            { label: '4:3', value: 4 / 3 },
                            { label: '1:1', value: 1 },
                            ...(originalAspectRatio ? [{ label: 'Original', value: originalAspectRatio }] : [])
                          ].map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              className={`aspect-btn ${Math.abs(activeAspect - option.value) < 0.01 ? 'active' : ''}`}
                              onClick={() => setActiveAspect(option.value)}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="control-group">
                        <div className="control-label">Position</div>
                        <div className="position-buttons-group">
                          <button
                            type="button"
                            className="position-btn"
                            onClick={() => setCrop({ x: 0, y: 0 })}
                            title="Center image"
                          >
                            Center
                          </button>
                          <button
                            type="button"
                            className="position-btn"
                            onClick={handleFitToArea}
                            title="Fit image to aspect ratio"
                          >
                            Fit to Area
                          </button>
                          <button
                            type="button"
                            className="position-btn"
                            onClick={() => {
                              setZoom(1);
                              setRotation(0);
                              setCrop({ x: 0, y: 0 });
                            }}
                            title="Reset all"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="controls-actions">
                      <button
                        type="button"
                        className="btn-cancel"
                        onClick={handleCropCancel}
                        disabled={processing}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-apply"
                        onClick={handleCropConfirm}
                        disabled={!croppedAreaPixels || processing}
                      >
                        {processing ? 'Processing...' : 'Apply Crop'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ImageUploadCrop;
