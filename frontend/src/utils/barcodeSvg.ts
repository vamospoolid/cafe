/**
 * Generator Barcode Code 128 Standar (Sub-table B)
 * Menghasilkan data bar visual SVG murni tanpa dependensi eksternal.
 * Ringan, kompatibel dengan semua browser dan tajam saat dicetak printer thermal/laser.
 */

// Pola Code 128 Sub-table B (ASCII 32 s/d 127)
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (Start B = 104, Stop = 106)
];

const START_CODE_B = 104;
const STOP_CODE = 106;

/**
 * Encode string teks ke dalam deretan lebar bar hitam/putih Code 128
 */
export function encodeCode128(text: string): string {
  if (!text) text = '000000';

  // Sanitasi hanya karakter ASCII yang didukung Code 128B (32..126)
  const cleanText = text.replace(/[^\x20-\x7E]/g, '');
  const chars = cleanText.length > 0 ? cleanText : '000000';

  let checksum = START_CODE_B;
  const patternParts: string[] = [CODE128_PATTERNS[START_CODE_B]];

  for (let i = 0; i < chars.length; i++) {
    const code = chars.charCodeAt(i) - 32;
    checksum += code * (i + 1);
    patternParts.push(CODE128_PATTERNS[code]);
  }

  const checkDigit = checksum % 103;
  patternParts.push(CODE128_PATTERNS[checkDigit]);
  patternParts.push(CODE128_PATTERNS[STOP_CODE]);

  return patternParts.join('');
}

/**
 * Render Barcode sebagai SVG Element siap pakai
 */
export function renderBarcodeSVG(
  text: string,
  options: {
    height?: number;
    moduleWidth?: number;
    showText?: boolean;
    textColor?: string;
    barColor?: string;
  } = {}
): string {
  const {
    height = 50,
    moduleWidth = 2,
    showText = true,
    textColor = '#0f172a',
    barColor = '#000000'
  } = options;

  const rawPattern = encodeCode128(text);
  let totalModules = 0;
  for (let i = 0; i < rawPattern.length; i++) {
    totalModules += parseInt(rawPattern[i], 10);
  }

  const quietZone = 10;
  const svgWidth = (totalModules + quietZone * 2) * moduleWidth;
  const svgHeight = height + (showText ? 18 : 0);

  let currentX = quietZone * moduleWidth;
  let isBar = true;
  const rects: string[] = [];

  for (let i = 0; i < rawPattern.length; i++) {
    const width = parseInt(rawPattern[i], 10) * moduleWidth;
    if (isBar) {
      rects.push(`<rect x="${currentX}" y="0" width="${width}" height="${height}" fill="${barColor}" />`);
    }
    currentX += width;
    isBar = !isBar;
  }

  const textElement = showText
    ? `<text x="${svgWidth / 2}" y="${height + 14}" font-family="monospace, monospace" font-size="12" font-weight="bold" text-anchor="middle" fill="${textColor}">${text}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
    <rect width="100%" height="100%" fill="transparent" />
    ${rects.join('')}
    ${textElement}
  </svg>`;
}
