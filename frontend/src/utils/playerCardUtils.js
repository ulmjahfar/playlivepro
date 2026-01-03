import { API_BASE_URL } from './apiConfig';

export const buildLogoUrl = (logo) => {
  if (!logo) return null;
  if (logo.startsWith('http')) return logo;
  if (logo.startsWith('uploads')) {
    return `${API_BASE_URL}/${logo}`;
  }
  if (logo.startsWith('/')) {
    return `${API_BASE_URL}${logo}`;
  }
  return `${API_BASE_URL}/${logo}`;
};

export const buildPhotoUrl = (photo) => {
  if (!photo) return null;
  if (photo.startsWith('http')) return photo;
  if (photo.startsWith('uploads')) {
    return `${API_BASE_URL}/${photo}`;
  }
  if (photo.startsWith('/')) {
    return `${API_BASE_URL}${photo}`;
  }
  return `${API_BASE_URL}/uploads/${photo}`;
};

export const buildBackgroundImageUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('uploads')) {
    return `${API_BASE_URL}/${imageUrl}`;
  }
  if (imageUrl.startsWith('/')) {
    return `${API_BASE_URL}${imageUrl}`;
  }
  return `${API_BASE_URL}${imageUrl}`;
};

