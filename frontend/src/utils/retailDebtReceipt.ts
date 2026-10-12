/**
 * Printer Slip Thermal Pembayaran / Cicilan Piutang Bon (58mm & 80mm)
 * Membuka jendela print browser siap cetak ke printer kasir thermal.
 */

export interface DebtPaymentReceiptData {
  receiptNumber: string;
  customer: {
    id: number;
    name: string;
    phone?: string;
  };
  paymentAmount: number;
  paymentMethod: string;
  paidAt: string | Date;
  previousTotalDebt: number;
  remainingTotalDebt: number;
  settledInvoices: Array<{
    debtId: number;
    orderNumber: string;
    allocatedAmount: number;
    priorRemaining: number;
    newRemaining: number;
    isFullySettled: boolean;
  }>;
}

export function printDebtPaymentThermalSlip(
  settings: any,
  receiptData: DebtPaymentReceiptData,
  cashierName: string = 'Kasir Toko'
) {
  const storeName = settings?.storeName || 'TOKO GROSIR & RETAIL';
  const storeAddress = settings?.address || '';
  const storePhone = settings?.phone || '';

  const formatRupiah = (val: number) => `Rp ${(val || 0).toLocaleString('id-ID')}`;
  const dateStr = new Date(receiptData.paidAt).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const invoiceRowsHtml = (receiptData.settledInvoices || []).map(inv => `
    <tr>
      <td style="padding: 2px 0; font-size: 11px;">${inv.orderNumber}</td>
      <td style="padding: 2px 0; text-align: right; font-size: 11px; font-weight: bold;">${formatRupiah(inv.allocatedAmount)}</td>
    </tr>
    <tr>
      <td colspan="2" style="font-size: 9px; color: #555; padding-bottom: 3px;">
        Sisa Faktur: ${formatRupiah(inv.newRemaining)} ${inv.isFullySettled ? '<b>[LUNAS]</b>' : ''}
      </td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Slip Pembayaran Piutang - ${receiptData.receiptNumber}</title>
        <style>
          @page {
            size: auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: 12px;
            color: #000;
            width: 58mm;
            max-width: 80mm;
            margin: 0 auto;
            padding: 8px 6px;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .divider {
            border-top: 1px dashed #000;
            margin: 6px 0;
          }
          .double-divider {
            border-top: 2px double #000;
            margin: 6px 0;
          }
          table { width: 100%; border-collapse: collapse; }
          @media print {
            body { width: 100%; padding: 4px; }
          }
        </style>
      </head>
      <body>
        <div class="text-center">
          <div class="bold" style="font-size: 14px; text-transform: uppercase;">${storeName}</div>
          ${storeAddress ? `<div style="font-size: 10px;">${storeAddress}</div>` : ''}
          ${storePhone ? `<div style="font-size: 10px;">Telp: ${storePhone}</div>` : ''}
        </div>

        <div class="divider"></div>

        <div class="text-center bold" style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
          TANDA TERIMA PEMBAYARAN BON
        </div>
        <div class="text-center" style="font-size: 10px; margin-top: 2px;">
          No: ${receiptData.receiptNumber}
        </div>

        <div class="divider"></div>

        <table style="font-size: 11px;">
          <tr>
            <td>Waktu</td>
            <td class="text-right">${dateStr}</td>
          </tr>
          <tr>
            <td>Kasir</td>
            <td class="text-right">${cashierName}</td>
          </tr>
          <tr>
            <td>Mitra/Mandor</td>
            <td class="text-right bold">${receiptData.customer?.name || 'Pelanggan'}</td>
          </tr>
          ${receiptData.customer?.phone ? `
          <tr>
            <td>No. Kontak</td>
            <td class="text-right">${receiptData.customer.phone}</td>
          </tr>
          ` : ''}
          <tr>
            <td>Metode Bayar</td>
            <td class="text-right bold">${receiptData.paymentMethod}</td>
          </tr>
        </table>

        <div class="divider"></div>
        <div class="bold" style="font-size: 10px; text-transform: uppercase;">Alokasi Nota Terbayar:</div>
        <table style="margin-top: 3px;">
          ${invoiceRowsHtml}
        </table>

        <div class="double-divider"></div>

        <table style="font-size: 11px;">
          <tr>
            <td class="bold">TOTAL SETORAN:</td>
            <td class="text-right bold" style="font-size: 13px;">${formatRupiah(receiptData.paymentAmount)}</td>
          </tr>
          <tr>
            <td>Piutang Awal:</td>
            <td class="text-right">${formatRupiah(receiptData.previousTotalDebt)}</td>
          </tr>
          <tr>
            <td class="bold" style="color: #c00;">SISA PIUTANG:</td>
            <td class="text-right bold" style="font-size: 12px;">${formatRupiah(receiptData.remainingTotalDebt)}</td>
          </tr>
        </table>

        <div class="divider"></div>

        <div style="font-size: 10px; text-align: center; margin-top: 8px;">
          Terima kasih atas pembayaran Anda.<br/>
          Harap simpan struk ini sebagai bukti pembayaran yang sah.
        </div>

        <div style="margin-top: 15px; display: flex; justify-content: space-between; font-size: 9px; text-align: center;">
          <div style="width: 45%;">
            Penyetor,<br/><br/><br/>
            ( ${receiptData.customer?.name || 'Pelanggan'} )
          </div>
          <div style="width: 45%;">
            Kasir Toko,<br/><br/><br/>
            ( ${cashierName} )
          </div>
        </div>

        <div style="height: 15px;"></div>

        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=450,height=600');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
