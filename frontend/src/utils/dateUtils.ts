/**
 * Utility untuk memformat dan memanipulasi tanggal lokal browser/klien
 * Menghindari bug toISOString() yang mengonversi tanggal ke UTC sehingga menjadi tanggal kemarin di pagi hari.
 */

// Format objek Date ke string YYYY-MM-DD sesuai waktu lokal pengguna
export const formatLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Dapatkan string tanggal hari ini (YYYY-MM-DD)
export const getTodayStr = (): string => {
  return formatLocalDate(new Date());
};

// Dapatkan string tanggal kemarin (YYYY-MM-DD)
export const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatLocalDate(d);
};

// Dapatkan rentang tanggal 7 hari terakhir
export const getLast7DaysRange = () => {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);
  return {
    startDate: formatLocalDate(weekAgo),
    endDate: formatLocalDate(today)
  };
};

// Dapatkan rentang tanggal 30 hari terakhir
export const getLast30DaysRange = () => {
  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(today.getDate() - 29);
  return {
    startDate: formatLocalDate(monthAgo),
    endDate: formatLocalDate(today)
  };
};

// Dapatkan rentang bulan ini (tgl 1 s/d hari ini / akhir bulan)
export const getThisMonthRange = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    startDate: formatLocalDate(startOfMonth),
    endDate: formatLocalDate(now)
  };
};

// Dapatkan rentang bulan lalu (tgl 1 s/d akhir bulan lalu)
export const getLastMonthRange = () => {
  const now = new Date();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    startDate: formatLocalDate(startOfLastMonth),
    endDate: formatLocalDate(endOfLastMonth)
  };
};

// Dapatkan rentang bulan tertentu (YYYY-MM)
export const getMonthRange = (yearMonthStr: string) => {
  if (!yearMonthStr || !yearMonthStr.includes('-')) return getThisMonthRange();
  const [yearStr, monthStr] = yearMonthStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0);
  return {
    startDate: formatLocalDate(startOfMonth),
    endDate: formatLocalDate(endOfMonth)
  };
};

// Format tanggal ramah bahasa Indonesia
export const formatDisplayDate = (isoOrDateStr: string, includeTime: boolean = false): string => {
  if (!isoOrDateStr) return '-';
  const d = new Date(isoOrDateStr);
  if (isNaN(d.getTime())) return isoOrDateStr;

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return d.toLocaleDateString('id-ID', options);
};
