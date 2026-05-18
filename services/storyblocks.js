const axios = require('axios');
const crypto = require('crypto');
const logger = require('../logger');

// Create an isolated Axios instance for Storyblocks to separate configuration from logic
const storyblocksClient = axios.create({
  // Dynamically fetch the base URL from env, or fall back to the default production API endpoint
  baseURL: process.env.STORYBLOCKS_BASE_URL || 'https://api.storyblocks.com/',
  timeout: 5000 // Set a strict 5-second timeout to prevent a sluggish third-party API from hanging the server
});

/**
 * Fetches and standardizes image data from the Storyblocks API using HMAC authentication.
 * @param {string} keyword - Search term requested by the client.
 * @param {number} numResults - Maximum number of results to return (defaults to 10).
 * @param {string} projectId - Identifier for the client project (defaults to 'my_default_project').
 * @returns {Promise<Array>} A standardized image array compatible with the application schema.
 */
async function search(keyword, numResults = 10, projectId = 'my_default_project') {
  try {
    const publicKey = process.env.STORYBLOCKS_PUBLIC_KEY;
    const secretKey = process.env.STORYBLOCKS_PRIVATE_KEY;

    if (!publicKey || !secretKey) {
      return [];
    }

    // Set token expiration time to 1 hour (3600 seconds) from now for security verification
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const resource = '/api/v2/images/search';
    const hmacKey = secretKey + expires;

    // Generate cryptographic HMAC SHA256 signature required by Storyblocks security policy
    const hmacSignature = crypto
      .createHmac('sha256', hmacKey)
      .update(resource)
      .digest('hex');

    const userId = 'anonymous_user';

    // Execute GET request using the pre-configured instance, passing queries cleanly via the params object
    const response = await storyblocksClient.get(resource, {
      params: {
        APIKEY: publicKey,
        EXPIRES: expires,
        HMAC: hmacSignature,
        project_id: projectId,
        user_id: userId,
        num_results: numResults, // Dynamic field configuration instead of hardcoding
        keywords: keyword
      }
    });

    // Defensive check: gracefully handle scenarios where the response payload or structure is missing
    if (!response.data || !response.data.results) {
      return [];
    }

    // Process data through a mapping pipeline to enforce schema uniformity
    return response.data.results.map(img => ({
      image_ID: String(img.id), // Enforce string data type consistency for IDs across all providers
      thumbnails: img.thumbnail_url || img.preview_url, // Map vendor-specific thumbnail path
      preview: img.preview_url, // Map vendor-specific preview path
      title: img.title || 'Storyblocks Image', // Fallback cascade for missing titles
      source: 'Storyblocks', // Content source identifier for tracking and filtering
      tags: img.keywords ? img.keywords.split(', ') : [] // Parse comma-separated string into a clean string array
    }));

  } catch (error) {
    // Error isolation: log network or API failure details locally without interrupting server.js
    logger.error('Storyblocks API error occurred', {
      message: error.message,
      status: error.response ? error.response.status : null,
      stack: error.stack,
      keyword
    });
    return []; // Return an empty array to ensure full fault tolerance and graceful degradation
  }
}

module.exports = { search };