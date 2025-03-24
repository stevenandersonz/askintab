export function cleanUrl(url) {
  try {
      const urlObj = new URL(url);
      return urlObj.protocol + '//' + urlObj.hostname + urlObj.pathname;
  } catch (e) {
      console.error('Invalid URL:', url, e);
      return url; 
  }
}

export function decodeJWT(token) {
  try {
    const base64Url = token.split(".")[1]; // Get payload part
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/"); // Convert base64url to base64
    const jsonPayload = atob(base64); // Decode base64 to string
    return JSON.parse(jsonPayload); // Parse JSON
  } catch (e) {
    console.error("Error decoding JWT:", e);
    return null;
  }
}