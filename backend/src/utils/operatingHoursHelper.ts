/**
 * Helper Evaluasi Jam Operasional Toko & Kontrol Shift Kasir
 */

export interface DaySchedule {
  day: number; // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
  dayName: string;
  isOpen: boolean;
  openTime: string;  // "HH:mm" e.g. "08:00"
  closeTime: string; // "HH:mm" e.g. "22:00"
  is24Hours?: boolean; // Buka 24 Jam Non-stop
}

export interface OperatingStatusResult {
  isConfigured: boolean;
  todaySchedule: DaySchedule | null;
  status: 'STORE_OPEN' | 'PREPARATION_WINDOW' | 'STORE_CLOSED' | 'CLOSING_GRACE' | 'OVERDUE';
  canOpenShiftNormal: boolean;
  isLateOpening: boolean;
  lateOpenMinutes: number;
  earlyOpenMinutes: number;
  isOverdueShift: boolean;
  overdueMinutes: number;
  message: string;
}

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function getDefaultOperatingHours(): DaySchedule[] {
  return [
    { day: 1, dayName: 'Senin', isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    { day: 2, dayName: 'Selasa', isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    { day: 3, dayName: 'Rabu', isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    { day: 4, dayName: 'Kamis', isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
    { day: 5, dayName: 'Jumat', isOpen: true, openTime: '08:00', closeTime: '23:00', is24Hours: false },
    { day: 6, dayName: 'Sabtu', isOpen: true, openTime: '08:00', closeTime: '23:00', is24Hours: false },
    { day: 0, dayName: 'Minggu', isOpen: true, openTime: '08:00', closeTime: '22:00', is24Hours: false },
  ];
}

export function parseOperatingHours(raw: string | null | undefined): DaySchedule[] {
  if (!raw) return getDefaultOperatingHours();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (_) {}
  return getDefaultOperatingHours();
}

/**
 * Konversi string "HH:mm" ke total menit dari 00:00
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Evaluasi status jam operasional toko saat ini
 */
export function evaluateOperatingStatus(
  settings: {
    operatingHours?: string | null;
    earlyOpenBufferMinutes?: number | null;
    closingGraceMinutes?: number | null;
    enforceOperatingHours?: boolean | null;
  } | null,
  now: Date = new Date()
): OperatingStatusResult {
  const earlyBuffer = Number(settings?.earlyOpenBufferMinutes ?? 45);
  const closingGrace = Number(settings?.closingGraceMinutes ?? 45);
  const schedules = parseOperatingHours(settings?.operatingHours);

  const currentDay = now.getDay(); // 0 = Minggu, 1 = Senin, ...
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todaySchedule = schedules.find((s) => s.day === currentDay) || null;

  if (!todaySchedule || !todaySchedule.isOpen) {
    return {
      isConfigured: Boolean(settings?.operatingHours),
      todaySchedule,
      status: 'STORE_CLOSED',
      canOpenShiftNormal: false,
      isLateOpening: false,
      lateOpenMinutes: 0,
      earlyOpenMinutes: 0,
      isOverdueShift: true,
      overdueMinutes: 0,
      message: `Toko dijadwalkan tutup / libur pada hari ${DAY_NAMES[currentDay]}.`,
    };
  }

  // Cek apakah toko beroperasi 24 Jam
  const is24Hours = Boolean(
    todaySchedule.is24Hours ||
    (todaySchedule.openTime === '00:00' && 
      (todaySchedule.closeTime === '23:59' || todaySchedule.closeTime === '24:00' || todaySchedule.closeTime === '00:00'))
  );

  if (is24Hours) {
    return {
      isConfigured: true,
      todaySchedule: { ...todaySchedule, is24Hours: true },
      status: 'STORE_OPEN',
      canOpenShiftNormal: true,
      isLateOpening: false,
      lateOpenMinutes: 0,
      earlyOpenMinutes: 0,
      isOverdueShift: false,
      overdueMinutes: 0,
      message: `Toko beroperasi 24 Jam non-stop pada hari ${DAY_NAMES[currentDay]}.`,
    };
  }

  let openMinutes = timeToMinutes(todaySchedule.openTime);
  let closeMinutes = timeToMinutes(todaySchedule.closeTime);

  const rawCloseMinutes = timeToMinutes(todaySchedule.closeTime);
  const isOvernight = rawCloseMinutes <= openMinutes;
  if (isOvernight) {
    closeMinutes += 24 * 60;
  }

  const prepStart = openMinutes - earlyBuffer;
  const graceEnd = closeMinutes + closingGrace;

  let normalizedCurrent = currentMinutes;
  if (isOvernight) {
    // Jam dini hari setelah tengah malam s/d beberapa jam setelah closing grace
    const earlyMorningExtensionLimit = rawCloseMinutes + closingGrace + 120;
    if (normalizedCurrent <= earlyMorningExtensionLimit) {
      normalizedCurrent += 24 * 60;
    }
  }

  // 1. Sebelum jendela persiapan (Toko masih tutup lelap)
  if (normalizedCurrent < prepStart) {
    const minutesUntilPrep = prepStart - normalizedCurrent;
    return {
      isConfigured: true,
      todaySchedule,
      status: 'STORE_CLOSED',
      canOpenShiftNormal: false,
      isLateOpening: false,
      lateOpenMinutes: 0,
      earlyOpenMinutes: 0,
      isOverdueShift: false,
      overdueMinutes: 0,
      message: `Toko buka pukul ${todaySchedule.openTime}. Persiapan modal kasir baru dapat dimulai pukul ${formatMinutesToTime(prepStart)} (${minutesUntilPrep} menit lagi).`,
    };
  }

  // 2. Jendela persiapan (Boleh buka shift modal laci, belum jam transaksi utama)
  if (normalizedCurrent >= prepStart && normalizedCurrent < openMinutes) {
    return {
      isConfigured: true,
      todaySchedule,
      status: 'PREPARATION_WINDOW',
      canOpenShiftNormal: true,
      isLateOpening: false,
      lateOpenMinutes: 0,
      earlyOpenMinutes: openMinutes - normalizedCurrent,
      isOverdueShift: false,
      overdueMinutes: 0,
      message: `Jendela persiapan kasir aktif. Toko resmi beroperasi pukul ${todaySchedule.openTime}.`,
    };
  }

  // 3. Jam Operasional Buka Resmi
  if (normalizedCurrent >= openMinutes && normalizedCurrent <= closeMinutes) {
    const late = normalizedCurrent - openMinutes;
    return {
      isConfigured: true,
      todaySchedule,
      status: 'STORE_OPEN',
      canOpenShiftNormal: true,
      isLateOpening: late > 15, // Dinyatakan telat jika buka shift >15 menit dari jadwal
      lateOpenMinutes: Math.max(0, late),
      earlyOpenMinutes: 0,
      isOverdueShift: false,
      overdueMinutes: 0,
      message: `Toko sedang beroperasi normal (${todaySchedule.openTime} - ${todaySchedule.closeTime}).`,
    };
  }

  // 4. Jendela Toleransi Closing (Setelah jam tutup resmi, kasir sedang beres-beres)
  if (normalizedCurrent > closeMinutes && normalizedCurrent <= graceEnd) {
    return {
      isConfigured: true,
      todaySchedule,
      status: 'CLOSING_GRACE',
      canOpenShiftNormal: false,
      isLateOpening: false,
      lateOpenMinutes: 0,
      earlyOpenMinutes: 0,
      isOverdueShift: false,
      overdueMinutes: 0,
      message: `Jam operasional telah selesai pukul ${todaySchedule.closeTime}. Saat ini dalam batas toleransi closing kasir (s/d ${formatMinutesToTime(graceEnd)}).`,
    };
  }

  // 5. Overdue (Lewat batas toleransi closing, kasir lupa tutup shift)
  const overdueMins = normalizedCurrent - graceEnd;
  return {
    isConfigured: true,
    todaySchedule,
    status: 'OVERDUE',
    canOpenShiftNormal: false,
    isLateOpening: false,
    lateOpenMinutes: 0,
    earlyOpenMinutes: 0,
    isOverdueShift: true,
    overdueMinutes: overdueMins,
    message: `Toko sudah tutup pukul ${todaySchedule.closeTime}. Waktu closing telah melewati batas toleransi (${overdueMins} menit lalu). Segera lakukan penutupan shift.`,
  };
}

function formatMinutesToTime(mins: number): string {
  const normalized = ((mins % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
