// API handler for Socket.IO proxying
export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  },
};

export default async function handler(req, res) {
  // Log the request for debugging
  console.log('Socket.IO API request:', {
    url: req.url,
    method: req.method,
    headers: req.headers
  });

  // Extract the path from the URL
  const path = req.url.replace(/^\/api\/socket/, '');
  
  // Build the target URL
  const targetUrl = `https://marvelmusicquiz-production.up.railway.app/socket.io${path}`;
  
  try {
    // Forward the request to the Railway server using native Node.js
    const https = require('https');
    const options = {
      hostname: 'marvelmusicquiz-production.up.railway.app',
      path: `/socket.io${path}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: 'marvelmusicquiz-production.up.railway.app',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // Copy status code
      res.statusCode = proxyRes.statusCode;
      
      // Copy headers
      Object.keys(proxyRes.headers).forEach(key => {
        res.setHeader(key, proxyRes.headers[key]);
      });
      
      // Stream the response
      proxyRes.pipe(res);
    });

    // Handle errors
    proxyReq.on('error', (error) => {
      console.error('Socket.IO proxy error:', error);
      res.status(500).json({ error: 'Failed to proxy request' });
    });

    // Pipe the request body to the proxy request
    if (req.body) {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } catch (error) {
    console.error('Socket.IO API proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy request' });
  }
} 