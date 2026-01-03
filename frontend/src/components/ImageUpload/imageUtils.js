import imageCompression from 'browser-image-compression';

/**
 * Validate file type and size
 * @param {File} file - The file to validate
 * @param {Object} options - Validation options
 * @returns {Object} - { isValid: boolean, error: string }
 */
export const validateImageFile = (file, options = {}) => {
  const { maxSizeMB = 5, allowedTypes = ['image/jpeg', 'image/png', 'image/webp'] } = options;

  if (!file) {
    return { isValid: false, error: 'No file selected' };
  }

  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type. Please upload JPG, PNG, or WEBP files.' };
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return { isValid: false, error: `File size must be less than ${maxSizeMB}MB` };
  }

  return { isValid: true, error: null };
};

/**
 * Compress image to specified size
 * @param {File} file - The image file to compress
 * @param {Object} options - Compression options
 * @returns {Promise<File>} - Compressed file
 */
export const compressImage = async (file, options = {}) => {
  const { maxSizeMB = 1, maxWidthOrHeight = 1024, useWebWorker = true } = options;

  try {
    const compressedFile = await imageCompression(file, {
      maxSizeMB,
      maxWidthOrHeight,
      useWebWorker,
    });
    return compressedFile;
  } catch (error) {
    console.error('Compression failed:', error);
    throw new Error('Failed to compress image');
  }
};

/**
 * Convert file to base64 string
 * @param {File} file - The file to convert
 * @returns {Promise<string>} - Base64 string
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

/**
 * Create image preview URL
 * @param {File} file - The image file
 * @returns {string} - Object URL for preview
 */
export const createImagePreview = (file) => {
  return URL.createObjectURL(file);
};

/**
 * Clean up object URL to prevent memory leaks
 * @param {string} url - The object URL to revoke
 */
export const revokeImagePreview = (url) => {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

/**
 * Get image dimensions
 * @param {File} file - The image file
 * @returns {Promise<{width: number, height: number}>} - Image dimensions
 */
export const getImageDimensions = (file) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};
