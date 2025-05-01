const http = require('http');

const server = http.createServer((req, res) => {
  console.log('Received request:', req.url);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Socket.IO Test Server is working!' }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Test server listening on port ${PORT}`);
}); 