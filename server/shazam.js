const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY; // Coloque sua chave no .env

router.get('/preview', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query' });

  try {
    const response = await fetch(
      `https://shazam.p.rapidapi.com/search?term=${encodeURIComponent(q)}&locale=en-US&offset=0&limit=1`,
      {
        method: 'GET',
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'shazam.p.rapidapi.com'
        }
      }
    );
    const data = await response.json();
    const hit = data.tracks?.hits?.[0]?.track;
    if (hit && hit.hub?.actions) {
      const previewAction = hit.hub.actions.find(a => a.type === 'uri' && a.uri && a.uri.endsWith('.m4a'));
      res.json({
        title: hit.title,
        artist: hit.subtitle,
        coverart: hit.images?.coverart,
        uri: previewAction ? previewAction.uri : null
      });
    } else {
      res.status(404).json({ error: 'No preview found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from Shazam', details: err.message });
  }
});

module.exports = router; 