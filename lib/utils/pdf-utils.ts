import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { Quest } from '@/types/quest';

/**
 * Generate a PDF containing QR codes for each quest in a batch
 * Each page contains:
 * - QR code pointing to /quest/{questId}
 * - Location label (if provided)
 * - Quest format (S/M/L based on duration)
 */
export async function generateQuestPDF(quests: Quest[]): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  for (let i = 0; i < quests.length; i++) {
    const quest = quests[i];
    
    // Add new page for each quest (except the first one)
    if (i > 0) {
      doc.addPage();
    }

    // Generate QR code as data URL
    const qrCodeUrl = `/quest/${quest.id}`;
    const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Calculate centered positions
    const qrSize = 100; // mm
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = 40;

    // Add QR code image
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Add location label if provided
    if (quest.location) {
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      const locationY = qrY + qrSize + 20;
      doc.text(`Location: ${quest.location}`, pageWidth / 2, locationY, {
        align: 'center',
      });
    }

    // Add quest format (S/M/L)
    const formatMap: Record<string, string> = {
      short: 'S',
      medium: 'M',
      long: 'L',
    };
    const format = formatMap[quest.duration] || 'M';
    
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    const formatY = quest.location ? qrY + qrSize + 35 : qrY + qrSize + 20;
    doc.text(`Format: ${format}`, pageWidth / 2, formatY, {
      align: 'center',
    });

    // Add quest ID at the bottom for reference
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Quest ID: ${quest.id}`, pageWidth / 2, pageHeight - 20, {
      align: 'center',
    });
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
