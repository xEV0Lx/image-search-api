require('dotenv').config();
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Import image integration services
const unsplashService = require('./services/unsplash');
const pixabayService = require('./services/pixabay');
const storyblocksService = require('./services/storyblocks');

app.get('/api/search', async (req, res) => {
  const { keyword } = req.query;

  // Validation: keyword query parameter is mandatory
  if (!keyword) {
    return res.status(400).json({ error: 'Please enter keyword' });
  }

  try {
    // Execute all third-party API requests concurrently in a pool
    const results = await Promise.allSettled([
      unsplashService.search(keyword),
      pixabayService.search(keyword),
      storyblocksService.search(keyword)
    ]);

    let compiledImages = [];

    // Aggregate fulfilled result arrays into a single unified dataset
    results.forEach((result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        compiledImages = compiledImages.concat(result.value);
      }
    });

    // Return the aggregated array to the client
    res.json({
      total: compiledImages.length, // Included for client-side pagination or count verification
      data: compiledImages
    });

  } catch (error) {
    // Top-level fallback error handler to prevent application crash
    console.error('Main server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`The server has been successfully started at http://localhost:${PORT}`);
});