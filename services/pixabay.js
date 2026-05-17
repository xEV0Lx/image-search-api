const axios = require('axios');

// Create an isolated Axios instance for Pixabay to separate configuration from logic
const pixabayClient = axios.create({
  // Dynamically fetch the base URL from env, or fall back to the default production API endpoint
  baseURL: process.env.PIXABAY_BASE_URL || 'https://pixabay.com/api/',
  timeout: 5000 // Set a strict 5-second timeout to prevent a sluggish third-party API from hanging the server
});

/**
 * Fetches and standardizes image data from the Pixabay API.
 * @param {string} keyword - Search term requested by the client.
 * @param {number} perPage - Maximum number of results to return (defaults to 20).
 * @param {string} imageType - Type of image category to filter (defaults to 'photo').
 * @returns {Promise<Array>} A standardized image array compatible with the application schema.
 */
async function search(keyword, perPage = 20, imageType = 'photo') {
  try {
    const apiKey = process.env.PIXABAY_API_KEY;

    // Execute GET request using the pre-configured instance, passing queries cleanly via the params object
    const response = await pixabayClient.get('/', {
      params: {
        key: apiKey,
        q: keyword,
        image_type: imageType,
        per_page: perPage
      }
    });

    // Defensive check: gracefully handle scenarios where the response payload or structure is missing
    if (!response.data || !response.data.hits) {
      return [];
    }

    // Process data through a mapping pipeline to enforce schema uniformity
    return response.data.hits.map(img => ({ 
      image_ID: String(img.id), // Enforce string data type consistency for IDs across all providers
      thumbnails: img.previewURL, // Map vendor-specific thumbnail path
      preview: img.largeImageURL, // Map vendor-specific preview path
      title: img.tags, // Fallback to tags string as title since Pixabay lacks a standard title field
      source: 'Pixabay', // Content source identifier for tracking and filtering
      tags: img.tags ? img.tags.split(', ') : [] // Parse comma-separated string into a clean string array
    }));

  } catch (error) {
    // Error isolation: log network or API failure details locally without interrupting server.js
    console.error('Errors in Pixabay API:', error.message);
    return []; // Return an empty array to ensure full fault tolerance and graceful degradation
  }
}

module.exports = { search };