const express = require('express');
const https = require('https');
const router = express.Router();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const API_TIMEOUT = 10000; // 10 seconds timeout

if (!RAPIDAPI_KEY) {
  console.error('RAPIDAPI_KEY is not set in environment variables');
}

router.get('/preview', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  console.log(`Searching Shazam for: ${q}`);

  const options = {
    method: 'GET',
    hostname: 'shazam.p.rapidapi.com',
    port: null,
    path: `/search?term=${encodeURIComponent(q)}&locale=en-US&offset=0&limit=1`,
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
    }
  };

  const request = https.request(options, function (response) {
    const chunks = [];

    // Log the response status code
    console.log(`Shazam API response status: ${response.statusCode}`);

    if (response.statusCode !== 200) {
      console.error(`Shazam API error: ${response.statusCode}`);
      return res.status(response.statusCode).json({ 
        error: 'Shazam API error',
        status: response.statusCode,
        message: `Failed to fetch from Shazam API: ${response.statusCode}`
      });
    }

    response.on('data', function (chunk) {
      chunks.push(chunk);
    });

    response.on('end', function () {
      try {
        const body = Buffer.concat(chunks);
        const data = JSON.parse(body.toString());
        
        console.log('Shazam API response:', JSON.stringify(data, null, 2));
        
        const hit = data.tracks?.hits?.[0]?.track;

        if (hit && hit.hub?.actions) {
          const previewAction = hit.hub.actions.find(a => a.type === 'uri' && a.uri && a.uri.includes('audio'));
          const result = {
            title: hit.title,
            artist: hit.subtitle,
            coverart: hit.images?.coverart,
            uri: previewAction ? previewAction.uri : null
          };
          
          console.log('Found preview:', result);
          res.json(result);
        } else {
          console.log('No preview found for:', q);
          res.status(404).json({ 
            error: 'No preview found',
            message: `Could not find a preview for "${q}"`
          });
        }
      } catch (err) {
        console.error('Error parsing Shazam response:', err);
        res.status(500).json({ 
          error: 'Failed to parse Shazam response', 
          details: err.message,
          message: 'An error occurred while processing the Shazam API response'
        });
      }
    });
  });

  request.on('error', function (err) {
    console.error('Error making Shazam request:', err);
    res.status(500).json({ 
      error: 'Failed to fetch from Shazam', 
      details: err.message,
      message: 'An error occurred while connecting to the Shazam API'
    });
  });

  // Add timeout handling with increased timeout
  request.setTimeout(API_TIMEOUT, function() {
    console.error('Shazam request timeout');
    res.status(504).json({ 
      error: 'Request timeout',
      message: 'The request to Shazam API timed out'
    });
    request.abort();
  });

  request.end();
});

module.exports = router; 