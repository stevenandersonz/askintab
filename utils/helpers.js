export function cleanUrl(url) {
  try {
      const urlObj = new URL(url);
      return urlObj.protocol + '//' + urlObj.hostname + urlObj.pathname;
  } catch (e) {
      console.error('Invalid URL:', url, e);
      return url; 
  }
}