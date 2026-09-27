/**
 * Utility untuk cetak struk ringkasan harian / Z-Report Bengkel
 * Dioptimalkan untuk printer thermal POS 58mm & 80mm via window.print() iframe
 */

export function printBengkelThermalSummary(
  settings: any,
  reportData: any,
  startDate: string,
  endDate: string,
  printedBy?: string
) {
  const storeName = settings?.storeName || 'BENGKEL MOTOR & MOBIL';
  const address = settings?.address || '';
  const phone = settings?.phone || '';
  const summary = reportData?.summary || {};
  const mechanicPerformance = (reportData?.mechanicPerformance || []).slice(0, 3);
  const now = new Date().toLocaleString('id-ID');

  const fmtRp = (v: number | undefined | null) => `Rp ${(Number(v) || 0).toLocaleString('id-ID')}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Ringkasan Bengkel - ${storeName}</title>
      <style>
        @page {
          margin: 0;
          size: auto;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.35;
          margin: 0;
          padding: 8px;
          color: #000;
          width: 270px; /* Cocok untuk 58mm & 80mm */
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .title { font-size: 13px; font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 5px 0; }
        .double-divider { border-top: 2px solid #000; margin: 6px 0; }
        .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
        .footer { font-size: 9px; margin-top: 10px; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="title">${storeName.toUpperCase()}</div>
        ${address ? `<div>${address}</div>` : ''}
        ${phone ? `<div>Telp/WA: ${phone}</div>` : ''}
      </div>

      <div class="divider"></div>

      <div class="text-center font-bold">RINGKASAN OPERASIONAL & KEUANGAN</div>
      <div>Periode: ${startDate} s/d ${endDate}</div>
      <div>Waktu Cetak: ${now}</div>
      <div>Petugas: ${printedBy || 'Admin/Kasir'}</div>

      <div class="divider"></div>

      <div class="row font-bold">
        <span>TOTAL SPK SELESAI</span>
        <span>${summary.totalSPK || 0} Unit</span>
      </div>

      <div class="divider"></div>

      <div class="font-bold">PENDAPATAN USAHA (REVENUE)</div>
      <div class="row">
        <span>Omzet Jasa Servis</span>
        <span>${fmtRp(summary.omzetJasa)}</span>
      </div>
      <div class="row">
        <span>Omzet Sparepart</span>
        <span>${fmtRp(summary.omzetParts)}</span>
      </div>
      ${summary.totalDiscount > 0 ? `
      <div class="row">
        <span>Diskon SPK</span>
        <span>-${fmtRp(summary.totalDiscount)}</span>
      </div>` : ''}
      <div class="row font-bold">
        <span>TOTAL OMZET BERSIH</span>
        <span>${fmtRp(summary.totalOmzetBersih)}</span>
      </div>

      <div class="divider"></div>

      <div class="font-bold">HPP & BIAYA OPERASIONAL</div>
      <div class="row">
        <span>HPP Sparepart Terpasang</span>
        <span>-${fmtRp(summary.hppParts)}</span>
      </div>
      <div class="row font-bold">
        <span>Laba Kotor (Gross Profit)</span>
        <span>${fmtRp(summary.totalLabaKotor)}</span>
      </div>
      <div class="row">
        <span>Hak Komisi Mekanik</span>
        <span>-${fmtRp(summary.totalBebanKomisi)}</span>
      </div>
      <div class="row">
        <span>Beban Kas Keluar (OPEX)</span>
        <span>-${fmtRp(summary.totalBebanOpex)}</span>
      </div>

      <div class="double-divider"></div>

      <div class="row font-bold" style="font-size: 12px;">
        <span>ESTIMASI LABA BERSIH</span>
        <span>${fmtRp(summary.estimasiLabaBersih)}</span>
      </div>

      ${mechanicPerformance.length > 0 ? `
      <div class="divider"></div>
      <div class="font-bold">TOP MEKANIK PERIODE INI:</div>
      ${mechanicPerformance.map((m: any, idx: number) => `
        <div class="row">
          <span>${idx + 1}. ${m.name} (${m.spkCompleted} SPK)</span>
          <span>${fmtRp(m.totalJasaGenerated)}</span>
        </div>
      `).join('')}
      ` : ''}

      <div class="divider"></div>
      <div class="text-center footer">
        *** DOKUMEN ARSIP RESMI ***<br>
        Dicetak otomatis melalui CodePOS Bengkel
      </div>
    </body>
    </html>
  `;

  // Gunakan invisible iframe untuk eksekusi print tanpa merusak DOM utama
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '-9999px';
  iframe.style.left = '-9999px';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 250);
}
