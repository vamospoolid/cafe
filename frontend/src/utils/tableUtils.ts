/**
 * Utility functions for formatting Table Numbers and Badges
 * Handles Cafe / Dining Tables & Pool / Billiard Tables cleanly
 * Prevents redundant "Meja Meja 04" and oversized text in badges
 */

export const formatTableTitle = (tableNo?: string): string => {
  if (!tableNo) return 'Tanpa Meja';
  const clean = tableNo.trim();
  if (clean.toLowerCase().startsWith('meja')) {
    return clean;
  }
  if (
    clean.toLowerCase().startsWith('pool') ||
    clean.toLowerCase().startsWith('biliar') ||
    clean.toLowerCase().startsWith('vip') ||
    clean.toLowerCase().startsWith('bar') ||
    clean.toLowerCase().startsWith('outdoor') ||
    clean.toLowerCase().startsWith('indoor')
  ) {
    return clean;
  }
  return `Meja ${clean}`;
};

export const formatTableBadge = (tableNo?: string): string => {
  if (!tableNo) return '-';
  const clean = tableNo.trim();

  // Check if Pool/Billiard table: e.g. "Pool 01 (Regular)", "Pool VIP 01"
  const poolMatch = clean.match(/pool\s*(vip)?\s*(\d+)?/i);
  if (poolMatch) {
    const isVip = clean.toLowerCase().includes('vip');
    const num = clean.match(/\d+/)?.[0] || '1';
    return isVip ? `VIP${num}` : `P${num.padStart(2, '0')}`;
  }

  // Check if regular "Meja XX" e.g. "Meja 04" -> "04"
  const mejaMatch = clean.match(/meja\s*([a-zA-Z0-9]+)/i);
  if (mejaMatch) {
    return mejaMatch[1];
  }

  // If short <= 4 characters, return as is
  if (clean.length <= 4) return clean;

  // If contains digits, return digits
  const digits = clean.match(/\d+/)?.[0];
  if (digits) return digits;

  return clean.substring(0, 3).toUpperCase();
};
