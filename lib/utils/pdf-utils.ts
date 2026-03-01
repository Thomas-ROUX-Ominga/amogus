import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Quest } from '@/types/quest';

// PDF Layout Constants
const PAGE_MARGIN_TOP = 40;
const QR_SIZE = 50;
const ROW_SPACING = 80;
const TEXT_SPACING_TOP = 8;
const MAX_TEXT_WIDTH = 80; // Maximum width in mm for location text (centered in column)
const QUESTS_PER_PAGE = 6;

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
  
  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    const positionOnPage = i % QUESTS_PER_PAGE;
    
    // Add new page when needed
    if (i > 0 && positionOnPage === 0) {
      doc.addPage();
    }

    try {
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
      const row = Math.floor(positionOnPage / 2);
      const col = positionOnPage % 2;
      const columnX = col === 0 ? pageWidth / 4 : (pageWidth * 3) / 4;
      const rowY = PAGE_MARGIN_TOP + row * ROW_SPACING;
      const qrX = columnX - QR_SIZE / 2;
      const qrY = rowY;

      // Add QR code image
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);

      // Add location value if provided
      if (quest.location) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const locationY = qrY + QR_SIZE + TEXT_SPACING_TOP;
        
        // Wrap text to fit width instead of truncating
        const wrappedText = doc.splitTextToSize(quest.location, MAX_TEXT_WIDTH);
        
        doc.text(wrappedText, columnX, locationY, {
          align: 'center',
        });
      }
    } catch (error) {
      console.error(`Failed to generate QR code for quest ${quest.id}:`, error);
      // We continue with other quests even if one fails
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
