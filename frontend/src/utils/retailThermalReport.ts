/**
 * Utilitas Pencetakan Ringkasan Laporan Shift Retail ke Printer Thermal 58mm / 80mm
 * Menggunakan teknik Invisible Iframe Print Dialog yang kompatibel di semua browser
 */

const formatCurrency = (val: number | null | undefined): string => 
  `Rp ${(val || 0).toLocaleString('id-ID')}`;

const formatDateIndo = (dateStr: string): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

export function printRetailThermalSummary(
  reportData: any,
  settings: any,
  startDate: string,
  endDate: string,
  printedBy?: string
) {
  const storeName = settings?.storeName || 'TOKO GROSIR & SEMBAKO';
  const address = settings?.address || 'Jl. Niaga Perdagangan';
  const phone = settings?.phone || '-';
  const periodText = `${formatDateIndo(startDate)} - ${formatDateIndo(endDate)}`;
  const now = new Date().toLocaleString('id-ID');

  const summary = reportData?.summary || {};
  const tierSales = reportData?.tierSales || [];
  const shiftSummary = reportData?.shiftSummary || {};

  const grossProfit = summary.grossProfit || 0;
  const totalOpex = shiftSummary.totalCashOut || 0;
  const netProfit = grossProfit - totalOpex;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ringkasan Laporan Shift Toko</title>
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          body {
            font-family: 'Courier New', Courier, monospace, monospace;
            width: 58mm;
            max-width: 58mm;
            margin: 0 auto;
            padding: 4mm 2mm;
            font-size: 11px;
            line-height: 1.25;
            color: #000;
            background: #fff;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .divider {
            border-top: 1px dashed #000;
            margin: 5px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .header-title {
            font-size: 13px;
            font-weight: bold;
            margin-bottom: 2px;
          }
          .footer-note {
            font-size: 9px;
            margin-top: 8px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="header-title">${storeName.toUpperCase()}</div>
          <div>${address}</div>
          <div>Telp: ${phone}</div>
          <div class="divider"></div>
          <div class="font-bold">RINGKASAN FINANSIAL TOKO</div>
          <div style="font-size: 10px;">${periodText}</div>
        </div>

        <div class="divider"></div>
        <div class="row">
          <span>Total Omzet:</span>
          <span class="font-bold">${formatCurrency(summary.totalSales)}</span>
        </div>
        <div class="row">
          <span>Total Transaksi:</span>
          <span>${summary.totalOrders || 0} Trx</span>
        </div>
        <div class="row">
          <span>Modal HPP Barang:</span>
          <span>${formatCurrency(summary.totalHpp)}</span>
        </div>
        <div class="row">
          <span class="font-bold">Laba Kotor Usaha:</span>
          <span class="font-bold">${formatCurrency(grossProfit)}</span>
        </div>
        <div class="row">
          <span>Kas Keluar (OPEX):</span>
          <span>-${formatCurrency(totalOpex)}</span>
        </div>
        <div class="divider"></div>
        <div class="row font-bold" style="font-size: 12px;">
          <span>LABA BERSIH:</span>
          <span>${formatCurrency(netProfit)}</span>
        </div>

        <div class="divider"></div>
        <div class="font-bold" style="font-size: 10px; margin-bottom: 3px;">BREAKDOWN PENJUALAN 3-TIER:</div>
        ${tierSales.map((t: any) => `
          <div class="row" style="font-size: 10px;">
            <span>${t.tier} (${t.count || 0}x):</span>
            <span>${formatCurrency(t.revenue)}</span>
          </div>
        `).join('')}

        <div class="divider"></div>
        <div class="row">
          <span>Piutang Bon Berjalan:</span>
          <span class="font-bold">${formatCurrency(summary.totalAR)}</span>
        </div>

        <div class="divider"></div>
        <div class="footer-note">
          <div>Dicetak: ${now}</div>
          <div>Oleh: ${printedBy || 'Kasir'}</div>
          <div>*** ARSIP LAPORAN TOKO ***</div>
        </div>
      </body>
    </html>
  `;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    throw new Error('Tidak dapat menginisialisasi printer thermal');
  }

  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  }, 400);
}
