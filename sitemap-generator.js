const fs = require('fs');
const path = require('path');

// Configuração do sitemap
const siteUrl = 'https://marvelmusicquizfrontend.onrender.com'; // Domínio correto no Render
const pages = [
  '/',
  '/about',
  '/game',
  '/leaderboard',
  '/settings'
];

// Gera o conteúdo do sitemap
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages.map(page => `
    <url>
      <loc>${siteUrl}${page}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>${page === '/' ? '1.0' : '0.8'}</priority>
    </url>
  `).join('')}
</urlset>`;

// Garante que a pasta public existe
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

// Escreve o arquivo sitemap.xml
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);

console.log('Sitemap gerado com sucesso em public/sitemap.xml'); 