import { jsPDF } from 'jspdf';

/**
 * Robust, cross-browser PDF downloader.
 * Resolves the Chromium/Chrome issue where `doc.save()` with detached <a> tags drops
 * the `download` attribute and saves files with internal UUID names (e.g. 5950dc66-1596-...) without any extension.
 */
export const savePdfDocument = (doc: jsPDF, filename: string): void => {
  // Ensure valid string and clean filename
  let cleanName = (filename || 'Dokumen_POS.pdf').trim();
  if (!cleanName.toLowerCase().endsWith('.pdf')) {
    cleanName = `${cleanName}.pdf`;
  }
  // Remove any unsafe characters
  cleanName = cleanName.replace(/[<>:"/\\|?*]/g, '_');

  try {
    const pdfBlob = doc.output('blob');
    // Wrapping in a File object with explicit name and MIME type provides the highest reliability in Chromium
    const pdfFile = new File([pdfBlob], cleanName, { type: 'application/pdf' });
    const blobUrl = URL.createObjectURL(pdfFile);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = cleanName;
    link.setAttribute('download', cleanName);
    link.style.display = 'none';
    
    // CRITICAL: Must be attached to the document DOM for Chromium to honor download attribute
    document.body.appendChild(link);
    link.click();
    
    // Clean up from DOM and revoke object URL
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(blobUrl);
    }, 5000);
  } catch (err) {
    console.warn('[pdfDownloadHelper] Falling back to blob anchor download:', err);
    try {
      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanName;
      link.setAttribute('download', cleanName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link);
        }
        URL.revokeObjectURL(blobUrl);
      }, 5000);
    } catch (fallbackErr) {
      console.error('[pdfDownloadHelper] Native save fallback:', fallbackErr);
      doc.save(cleanName);
    }
  }
};

/**
 * Patch jsPDF prototype so ANY call to doc.save(filename) throughout the entire app
 * automatically uses this robust download mechanism.
 */
if (typeof window !== 'undefined' && jsPDF && jsPDF.prototype) {
  const originalSave = jsPDF.prototype.save;
  (jsPDF.prototype as any).save = function(this: any, filename?: string, options?: any) {
    if (!filename) filename = 'Dokumen.pdf';
    savePdfDocument(this, filename);
    return this;
  };
}
