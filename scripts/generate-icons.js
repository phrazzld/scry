import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple SVG icon for Scry
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="#000000"/>
  <text x="50" y="65" font-family="monospace" font-size="24" fill="#ffffff" text-anchor="middle" font-weight="bold">SCRY</text>
</svg>`;

// Icon sizes needed for PWA
const sizes = [32, 72, 96, 128, 144, 152, 192, 384, 512];

console.log('Generating PWA icons...');

// Create a simple placeholder icon file
const iconDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Write SVG file
fs.writeFileSync(path.join(iconDir, 'icon.svg'), svgIcon);

// Create placeholder PNG files (these would normally be generated from the SVG)
sizes.forEach((size) => {
  const filename = `icon-${size}x${size}.png`;
  const placeholder = `# Placeholder for ${filename}
# This would be a ${size}x${size} PNG icon generated from the SVG
# Use a tool like Inkscape or online converter to generate actual PNG files
`;
  fs.writeFileSync(path.join(iconDir, filename), placeholder);
  console.log(`Created placeholder: ${filename}`);
});

console.log('Icon generation complete!');
console.log('Note: Replace placeholder files with actual PNG icons generated from icon.svg');
