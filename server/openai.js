require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();

// POST /openai/track
router.post('/track', async (req, res) => {
  const { movie, character } = req.body;
  if (!movie) return res.status(400).json({ error: 'Missing movie' });

  const prompt = `Based on the Marvel movie "${movie}"${character ? ` and the character "${character}"` : ''}, return only the most iconic soundtrack song.
Reply strictly in this JSON format: { "track": "Song Name", "artist": "Artist Name" }.
Do not include any other text, explanations, or references to the movie or character. Only output valid JSON.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-nano', // Podes mudar se usares outro modelo
        messages: [
          {
            role: 'system',
            content: `You are a precise soundtrack assistant.
When given a Marvel movie and optionally a character, your task is to identify the most iconic soundtrack song.
Always respond strictly in JSON format: { "track": "Song Name", "artist": "Artist Name" }.
Do not add any introductions, explanations, notes, or references to movies, characters, or context. Only return clean, valid JSON.`
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: 'No response from OpenAI' });

    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'No JSON found in response' });

    const trackInfo = JSON.parse(match[0]);

    // Pequena validação extra para garantir que o JSON está correto
    if (!trackInfo.track || !trackInfo.artist) {
      return res.status(500).json({ error: 'Invalid JSON structure received' });
    }

    res.json(trackInfo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch from OpenAI' });
  }
});

module.exports = router;
