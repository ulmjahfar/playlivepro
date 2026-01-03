/**
 * Safe clipboard utility that works on both HTTPS and non-HTTPS pages
 * Falls back to execCommand for older browsers or non-secure contexts
 * 
 * @param {string} text - The text to copy to clipboard
 * @returns {Promise<boolean>} - Returns true if copy was successful, false otherwise
 */
export const copyToClipboard = async (text) => {
  try {
    // Try modern Clipboard API first (works on HTTPS and localhost)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback to execCommand for non-HTTPS pages or older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      document.body.removeChild(textArea);
      console.error('execCommand copy failed:', err);
      return false;
    }
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};


