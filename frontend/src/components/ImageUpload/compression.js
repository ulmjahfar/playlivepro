import imageCompression from 'browser-image-compression';

/**
 * Advanced image compression with progress tracking
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<File>} - Compressed file
 */
export const compressImageWithProgress = async (file, options = {}, onProgress = null) => {
  const {
    maxSizeMB = 1,
    maxWidthOrHeight = 1024,
    initialQuality = 0.85,
    useWebWorker = true
  } = options;

  try {
    // First attempt with initial quality
    let compressedFile = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      initialQuality,
      useWebWorker,
      onProgress: (progress) => {
        if (onProgress) onProgress(Math.min(progress, 80));
      }
    });

    // If still too large, try with lower quality
    if (compressedFile.size > maxSizeMB * 1024 * 1024) {
      if (onProgress) onProgress(85);

      compressedFile = await imageCompression(file, {
        maxSizeMB,
        maxWidthOrHeight,
      initialQuality: 0.75,
        useWebWorker,
        onProgress: (progress) => {
          if (onProgress) onProgress(85 + progress * 0.1);
        }
      });
    }

    // Final check and further compression if needed
    if (compressedFile.size > maxSizeMB * 1024 * 1024) {
      if (onProgress) onProgress(95);

      compressedFile = await imageCompression(file, {
        maxSizeMB,
        maxWidthOrHeight,
      initialQuality: 0.7,
        useWebWorker,
      });
    }

    if (onProgress) onProgress(100);
    return compressedFile;

  } catch (error) {
    console.error('Advanced compression failed:', error);
    throw new Error('Failed to compress image to required size');
  }
};

/**
 * Aggressively optimize an image until it drops below the desired size budget.
 * Performs quality + resolution sweeps and always returns a JPG.
 *
 * @param {File} file
 * @param {Object} options
 * @param {number} options.targetSizeKB - Target size in KB (default 500)
 * @param {number} options.initialMaxDimension - Largest width/height to start from
 * @param {Function} options.onProgress - Progress callback (0-100)
 * @returns {Promise<{file: File, qualityUsed: number, dimensionUsed: number}>}
 */
export const autoOptimizeImage = async (
  file,
  {
    targetSizeKB = 500,
    initialMaxDimension = 4096,
    onProgress = null
  } = {}
) => {
  const limitBytes = targetSizeKB * 1024;

  if (file.size <= limitBytes) {
    return {
      file,
      qualityUsed: 1,
      dimensionUsed: initialMaxDimension
    };
  }

  const ensureDimension = (value) => Math.max(1000, Math.round(value));
  const baseDimension = ensureDimension(initialMaxDimension || 4096);
  const dimensionSequence = [
    baseDimension,
    3600,
    3200,
    2800,
    2400,
    2000,
    1800,
    1600,
    1400,
    1200,
    1000
  ];
  const qualitySequence = [0.92, 0.88, 0.85, 0.82, 0.8, 0.78, 0.75, 0.72, 0.7];
  const totalIterations = dimensionSequence.length * qualitySequence.length;
  let iteration = 0;
  let optimized = file;
  let qualityUsed = 0.95;
  let dimensionUsed = baseDimension;

  for (const dimension of dimensionSequence) {
    for (const quality of qualitySequence) {
      iteration += 1;
      const currentIteration = iteration;
      optimized = await imageCompression(optimized, {
        fileType: 'image/jpeg',
        initialQuality: quality,
        maxWidthOrHeight: dimension,
        useWebWorker: true,
        maxIteration: 1,
        onProgress: (progress) => {
          if (!onProgress) return;
          const sweepProgress = (currentIteration / totalIterations) * 55;
          onProgress(40 + Math.min(55, sweepProgress) + progress * 0.05);
        }
      });

      qualityUsed = quality;
      dimensionUsed = dimension;

      if (optimized.size <= limitBytes) {
        if (onProgress) onProgress(98);
        return { file: optimized, qualityUsed, dimensionUsed };
      }
    }
  }

  // Improved fallback - maintain better quality
  optimized = await imageCompression(optimized, {
    fileType: 'image/jpeg',
    initialQuality: 0.7,
    maxWidthOrHeight: 1000,
    useWebWorker: true
  });
  qualityUsed = 0.7;
  dimensionUsed = 1000;

  if (onProgress) onProgress(100);
  return { file: optimized, qualityUsed, dimensionUsed };
};

/**
 * Batch compress multiple images
 * @param {File[]} files - Array of image files
 * @param {Object} options - Compression options
 * @param {Function} onBatchProgress - Batch progress callback
 * @returns {Promise<File[]>} - Array of compressed files
 */
export const compressBatchImages = async (files, options = {}, onBatchProgress = null) => {
  const compressedFiles = [];
  const totalFiles = files.length;

  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const compressedFile = await compressImageWithProgress(
      file,
      options,
      (progress) => {
        const overallProgress = ((i * 100) + progress) / totalFiles;
        if (onBatchProgress) onBatchProgress(overallProgress);
      }
    );
    compressedFiles.push(compressedFile);
  }

  return compressedFiles;
};

/**
 * Get compression stats
 * @param {File} originalFile - Original file
 * @param {File} compressedFile - Compressed file
 * @returns {Object} - Compression statistics
 */
export const getCompressionStats = (originalFile, compressedFile) => {
  const originalSize = originalFile.size;
  const compressedSize = compressedFile.size;
  const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
  const sizeReduction = originalSize - compressedSize;

  return {
    originalSize,
    compressedSize,
    compressionRatio: Math.round(compressionRatio * 100) / 100,
    sizeReduction,
    originalSizeFormatted: formatFileSize(originalSize),
    compressedSizeFormatted: formatFileSize(compressedSize),
    sizeReductionFormatted: formatFileSize(sizeReduction)
  };
};

/**
 * Format file size in human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size string
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validate compression result
 * @param {File} file - Compressed file
 * @param {number} maxSizeMB - Maximum allowed size
 * @returns {boolean} - Whether file meets size requirements
 */
export const validateCompressionResult = (file, maxSizeMB = 1) => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

/**
 * Optimize image for different use cases
 * @param {File} file - Image file
 * @param {string} useCase - 'thumbnail', 'profile', 'logo', 'banner'
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<File>} - Optimized file
 */
export const optimizeImageForUseCase = async (file, useCase = 'general', onProgress = null) => {
  const useCaseSettings = {
    thumbnail: { maxSizeMB: 0.1, maxWidthOrHeight: 150 },
    profile: { maxSizeMB: 0.5, maxWidthOrHeight: 300 },
    logo: { maxSizeMB: 1, maxWidthOrHeight: 500 },
    banner: { maxSizeMB: 2, maxWidthOrHeight: 1200 },
    general: { maxSizeMB: 1, maxWidthOrHeight: 1024 }
  };

  const settings = useCaseSettings[useCase] || useCaseSettings.general;

  return await compressImageWithProgress(file, settings, onProgress);
};
