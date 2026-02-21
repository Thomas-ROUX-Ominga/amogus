import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Quest } from '@/types/quest';

/**
 * Generate a PDF containing QR codes for quests (6 per page in 2x3 grid)
 * Each page contains 6 quests with:
 * - QR code pointing to /quest/{questId}
 * - Location value
 */
export async function generateQuestPDF(quests: Quest[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const questsPerPage = 6;
  
  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    const positionOnPage = i % questsPerPage;
    
    // Add new page when needed
    if (i > 0 && positionOnPage === 0) {
      doc.addPage();
    }

    // Generate QR code as data URL
    const qrCodeUrl = `/quest/${quest.id}`;
    const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 250,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Calculate positions for 2x3 grid
    const qrSize = 50; // Same size as before
    const row = Math.floor(positionOnPage / 2);
    const col = positionOnPage % 2;
    const columnX = col === 0 ? pageWidth / 4 : (pageWidth * 3) / 4;
    const rowY = 40 + row * 55; // 40mm top margin, 55mm spacing between rows
    const qrX = columnX - qrSize / 2;
    const qrY = rowY;

    // Add QR code image
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Add location value if provided
    if (quest.location) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const locationY = qrY + qrSize + 8;
      doc.text(quest.location, columnX, locationY, {
        align: 'center',
      });
    }
  }

  // Return as Blob for download
  return doc.output('blob');
}

/**
 * Trigger download of the generated PDF
 */
export function downloadPDF(blob: Blob, filename: string = 'quests.pdf'): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
