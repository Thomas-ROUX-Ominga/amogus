import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { BatchSabotages, Quest } from '@/types/quest';

// PDF Layout Constants
const PAGE_MARGIN_TOP = 40;
const QR_SIZE = 50;
const ROW_SPACING = 80;
const TEXT_SPACING_TOP = 8;
const MAX_TEXT_WIDTH = 80; // Maximum width in mm for location text (centered in column)
const QUESTS_PER_PAGE = 6;

/**
 * Generate a PDF containing QR codes (6 per page in 2x3 grid)
 * Each page contains 6 quests with:
 * - QR code pointing to /quest/{questId}
 * - Location value
 */
export async function generateQuestPDF(quests: Quest[], sabotages?: BatchSabotages): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const printables: Array<{
    qrId: string;
    location?: string;
    label?: string;
  }> = quests.map((quest) => ({
    qrId: quest.id,
    location: quest.location,
  }));

  if (sabotages) {
    printables.push(
      {
        qrId: sabotages.communications.qrId,
        location: sabotages.communications.location,
        label: "SABOTAGE • COMMUNICATIONS",
      },
      {
        qrId: sabotages.reactor[0].qrId,
        location: sabotages.reactor[0].location,
        label: "SABOTAGE • REACTOR A",
      },
      {
        qrId: sabotages.reactor[1].qrId,
        location: sabotages.reactor[1].location,
        label: "SABOTAGE • REACTOR B",
      }
    );
  }
  
  for (let i = 0; i < printables.length; i++) {
    const printable = printables[i];
    const positionOnPage = i % QUESTS_PER_PAGE;
    
    // Add new page when needed
    if (i > 0 && positionOnPage === 0) {
      doc.addPage();
    }

    try {
      // Generate QR code as data URL
      const qrCodeUrl = `${printable.qrId}`;
      const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
        width: 250,
        margin: 1,
        color: {
          dark: '#1e1e1e',
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

      // Add location value if provided (with sabotage label when relevant)
      if (printable.location || printable.label) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const locationY = qrY + QR_SIZE + TEXT_SPACING_TOP;
        const text = printable.label && printable.location
          ? `${printable.label} — ${printable.location}`
          : printable.label || printable.location || "";
        
        // Wrap text to fit width instead of truncating
        const wrappedText = doc.splitTextToSize(text, MAX_TEXT_WIDTH);
        
        doc.text(wrappedText, columnX, locationY, {
          align: 'center',
        });
      }
    } catch (error) {
      console.error(`Failed to generate QR code for entry ${printable.qrId}:`, error);
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
