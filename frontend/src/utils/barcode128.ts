/**
 * Utility: Pure Code 128 (Subset B) SVG Vector Generator
 * Generates crisp, pixel-perfect 1D barcodes for thermal printers and displays.
 * No external dependencies required.
 */

// Code 128 patterns (index 0 to 106)
// Each pattern is a sequence of 6 bar/space widths (sum = 11 modules), Stop is 7 widths (sum = 13)
const CODE128_PATTERNS: number[][] = [
  [2,1,2,2,2,2], [2,2,2,1,2,2], [2,2,2,2,2,1], [1,2,1,2,2,3], [1,2,1,3,2,2], // 0-4
  [1,3,1,2,2,2], [1,2,2,2,1,3], [1,2,2,3,1,2], [1,3,2,2,1,2], [2,2,1,2,1,3], // 5-9
  [2,2,1,3,1,2], [2,3,1,2,1,2], [1,1,2,2,3,2], [1,2,2,1,3,2], [1,2,2,2,3,1], // 10-14
  [1,1,3,2,2,2], [1,2,3,1,2,2], [1,2,3,2,2,1], [2,2,3,2,1,1], [2,2,1,1,3,2], // 15-19
  [2,2,1,2,3,1], [2,1,3,2,1,2], [2,2,3,1,1,2], [3,1,2,1,3,1], [3,1,1,2,2,2], // 20-24
  [3,2,1,1,2,2], [3,2,1,2,2,1], [3,1,2,2,1,2], [3,2,2,1,1,2], [3,2,2,2,1,1], // 25-29
  [2,1,2,1,2,3], [2,1,2,3,2,1], [2,3,2,1,2,1], [1,1,1,3,2,3], [1,3,1,1,2,3], // 30-34
  [1,3,1,3,2,1], [1,1,2,3,1,3], [1,3,2,1,1,3], [1,3,2,3,1,1], [2,1,1,3,1,3], // 35-39
  [2,3,1,1,1,3], [2,3,1,3,1,1], [1,1,2,1,3,3], [1,1,2,3,3,1], [1,3,2,1,3,1], // 40-44
  [1,1,3,1,2,3], [1,1,3,3,2,1], [1,3,3,1,2,1], [3,1,3,1,2,1], [2,1,1,3,3,1], // 45-49
  [2,3,1,1,3,1], [2,1,3,1,1,3], [2,1,3,3,1,1], [2,1,3,1,3,1], [3,1,1,1,2,3], // 50-54
  [3,1,1,3,2,1], [3,3,1,1,2,1], [3,1,2,1,1,3], [3,1,2,3,1,1], [3,3,2,1,1,1], // 55-59
  [3,1,4,1,1,1], [2,2,1,4,1,1], [4,3,1,1,1,1], [1,1,1,2,2,4], [1,1,1,4,2,2], // 60-64
  [1,2,1,1,2,4], [1,2,1,4,2,1], [1,4,1,1,2,2], [1,4,1,2,2,1], [1,1,2,2,1,4], // 65-69
  [1,1,2,4,1,2], [1,2,2,1,1,4], [1,2,2,4,1,1], [1,4,2,1,1,2], [1,4,2,2,1,1], // 70-74
  [2,4,1,2,1,1], [2,2,1,1,1,4], [4,1,3,1,1,1], [2,4,1,1,1,2], [1,3,4,1,1,1], // 75-79
  [1,1,1,2,4,2], [1,2,1,1,4,2], [1,2,1,2,4,1], [1,1,4,2,1,2], [1,2,4,1,1,2], // 80-84
  [1,2,4,2,1,1], [4,1,1,2,1,2], [4,2,1,1,1,2], [4,2,1,2,1,1], [2,1,2,1,4,1], // 85-89
  [2,1,4,1,2,1], [4,1,2,1,2,1], [1,1,1,1,4,3], [1,1,1,3,4,1], [1,3,1,1,4,1], // 90-94
  [1,1,4,1,1,3], [1,1,4,3,1,1], [4,1,1,1,1,3], [4,1,1,3,1,1], [1,1,3,1,4,1], // 95-99
  [1,1,4,1,3,1], [3,1,1,1,4,1], [4,1,1,1,3,1], [2,1,1,4,1,2], [2,1,1,2,1,4], // 100-104
  [2,1,1,2,3,2], [2,3,3,1,1,1,2] // 105 (Start B), 106 (Stop)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encodes an ASCII string to an SVG rect array representing Code 128 B
 */
export function generateBarcodeSvgPath(text: string, height: number = 50, barWidth: number = 2): {
  svgRects: { x: number; y: number; width: number; height: number }[];
  totalWidth: number;
  totalHeight: number;
} {
  const clean = text.trim() || '000000';
  const codes: number[] = [START_CODE_B];
  let checkSum = START_CODE_B;

  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    // ASCII 32 to 126 maps to Code 128 index 0 to 94
    let val = charCode - 32;
    if (val < 0 || val > 94) val = 0; // Fallback for invalid chars
    codes.push(val);
    checkSum += val * (i + 1);
  }

  // Checksum modulo 103
  codes.push(checkSum % 103);
  // Stop Code
  codes.push(STOP_CODE);

  // Convert codes to widths
  const widths: number[] = [];
  codes.forEach(code => {
    const pattern = CODE128_PATTERNS[code];
    if (pattern) {
      widths.push(...pattern);
    }
  });

  const svgRects: { x: number; y: number; width: number; height: number }[] = [];
  let currentX = 10; // Quiet zone left

  // Even index = bar (black), Odd index = space (white)
  for (let i = 0; i < widths.length; i++) {
    const w = widths[i] * barWidth;
    if (i % 2 === 0) {
      svgRects.push({
        x: currentX,
        y: 0,
        width: w,
        height
      });
    }
    currentX += w;
  }

  currentX += 10; // Quiet zone right

  return {
    svgRects,
    totalWidth: currentX,
    totalHeight: height
  };
}

/**
 * Returns complete SVG string for easy printing/embedding
 */
export function generateBarcodeSvgString(
  text: string, 
  height: number = 40, 
  barWidth: number = 1.5,
  showText: boolean = true
): string {
  const { svgRects, totalWidth, totalHeight } = generateBarcodeSvgPath(text, height, barWidth);
  const extraBottom = showText ? 14 : 0;
  const viewBoxHeight = totalHeight + extraBottom;

  const rectsXml = svgRects
    .map(r => `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="#000" />`)
    .join('');

  const textXml = showText 
    ? `<text x="${totalWidth / 2}" y="${totalHeight + 11}" font-family="monospace, monospace" font-size="10" font-weight="bold" text-anchor="middle" fill="#000">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${viewBoxHeight}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${rectsXml}${textXml}</svg>`;
}
