const axios = require('axios');
const logger = require('../logger');

// Create an isolated Axios instance for Unsplash to separate configuration from logic
const unsplashClient = axios.create({
  // Dynamically fetch the base URL from env, or fall back to the default production API endpoint
  baseURL: process.env.UNSPLASH_BASE_URL || 'https://api.unsplash.com/',
  timeout: 5000 // Set a strict 5-second timeout to prevent a sluggish third-party API from hanging the server
});

/**
 * Fetches and standardizes image data from the Unsplash API.
 * @param {string} keyword - Search term requested by the client.
 * @param {number} perPage - Maximum number of results to return (defaults to 10).
 * @returns {Promise<Array>} A standardized image array compatible with the application schema.
 */
async function search(keyword, perPage = 10) {
  try {
    const apiKey = process.env.UNSPLASH_ACCESS_KEY;

    // Execute GET request using the pre-configured instance, passing queries and headers cleanly
    const response = await unsplashClient.get('/search/photos', {
      params: {
        query: keyword,
        per_page: perPage
      },
      headers: {
        Authorization: `Client-ID ${apiKey}`
      }
    });

    // Defensive check: gracefully handle scenarios where the response payload or structure is missing
    if (!response.data || !response.data.results) {
      return [];
    }

    // Process data through a mapping pipeline to enforce schema uniformity
    return response.data.results.map(img => ({
      image_ID: String(img.id), // Enforce string data type consistency for IDs across all providers
      thumbnails: img.urls.thumb, // Map vendor-specific thumbnail path
      preview: img.urls.regular, // Map vendor-specific preview path
      title: img.alt_description || img.description || 'Unsplash Image', // Fallback cascade for missing titles
      source: 'Unsplash', // Identifier for content source tracking
      tags: img.tags ? img.tags.map(t => t.title) : [] // Transform tags object array into a clean string array
    }));

  } catch (error) {
    // Error isolation: log network or API failure details locally without interrupting server.js
    logger.error('Unsplash API error occurred', {
      message: error.message,
      status: error.response ? error.response.status : null,
      stack: error.stack,
      keyword
    });
    return []; // Return an empty array to ensure full fault tolerance and graceful degradation
  }
}

module.exports = { search };