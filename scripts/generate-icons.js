import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgLogo = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e66f5" />
      <stop offset="40%" stop-color="#1453e0" />
      <stop offset="100%" stop-color="#0a3bb8" />
    </linearGradient>
    <linearGradient id="gGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4ae3c4" />
      <stop offset="100%" stop-color="#1ab598" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.25" />
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bgGrad)" />

  <!-- Logo Group -->
  <g filter="url(#softGlow)" transform="translate(0, 0)">
    <!-- Text Representation with crisp geometric typography matching MrG -->
    <text
      x="512"
      y="575"
      text-anchor="middle"
      font-family="system-ui, -apple-system, 'Inter', 'SF Pro Display', 'Montserrat', 'Segoe UI', Arial, sans-serif"
      font-weight="900"
      font-size="270"
      letter-spacing="-8"
    >
      <tspan fill="#FFFFFF">Mr</tspan><tspan fill="url(#gGrad)" dx="-4">G</tspan>
    </text>
  </g>
</svg>
`;

async function generate() {
  const publicDir = path.resolve('public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  const svgBuffer = Buffer.from(svgLogo);

  // 1. Generate 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-512.png'));

  // 2. Generate 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-192.png'));

  // 3. Generate icon.png (standard)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon.png'));

  // 4. Generate apple-touch-icon.png (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));

  // 5. Generate favicon-32x32.png
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));

  // 6. Generate favicon.ico / svg
  fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgLogo.trim());

  console.log('Successfully generated all icons!');
}

generate().catch(console.error);
