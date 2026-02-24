import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateQuestPDF } from '@/lib/utils/pdf-utils';
import { Quest, QuestGame } from '@/types/quest';

// Mock the modules at the top level
vi.mock('jspdf');
vi.mock('qrcode');

describe('PDF Utils', () => {
  let mockQuests: Quest[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockQuests = [
      {
        id: 'quest-1',
        type: 'qcm',
        duration: 'short',
        location: 'Kitchen',
      },
      {
        id: 'quest-2',
        type: 'true-false',
        duration: 'medium',
        location: 'Living Room',
      },
      {
        id: 'quest-3',
        type: 'qcm',
        duration: 'long',
        location: 'Bedroom',
      },
      {
        id: 'quest-4',
        type: 'true-false',
        duration: 'short',
        location: 'Bathroom',
      },
      {
        id: 'quest-5',
        type: 'qcm',
        duration: 'medium',
        location: 'Garage',
      },
      {
        id: 'quest-6',
        type: 'true-false',
        duration: 'long',
        location: 'Office',
      },
    ];
  });

  describe('generateQuestPDF', () => {
    it('should attempt to generate PDF for all quests', async () => {
      // Import the mocked modules
      const { default: jsPDF } = await import('jspdf');
      const { default: QRCode } = await import('qrcode');

      // Setup mocks
      const mockDoc = {
        internal: {
          pageSize: {
            getWidth: vi.fn(() => 210),
            getHeight: vi.fn(() => 297),
          },
        },
        addPage: vi.fn(),
        addImage: vi.fn(),
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        splitTextToSize: vi.fn((text) => [text]),
        text: vi.fn(),
        output: vi.fn(() => new Blob()),
      };

      vi.mocked(jsPDF).mockImplementation(function() {
        return mockDoc;
      });
      
      vi.mocked(QRCode).toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,mockqrcode');

      await generateQuestPDF(mockQuests);

      // Should create jsPDF instance
      expect(jsPDF).toHaveBeenCalledWith({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Should generate QR code for each quest
      expect(vi.mocked(QRCode).toDataURL).toHaveBeenCalledTimes(6);
      
      // Should add image for each quest
      expect(mockDoc.addImage).toHaveBeenCalledTimes(6);

      // Should add text for each location (this is what we're testing)
      expect(mockDoc.text).toHaveBeenCalledTimes(6);
      
      // Verify the locations that were added
      const textCalls = vi.mocked(mockDoc.text).mock.calls;
      const locations = textCalls.map(call => call[0]); // First argument is the text
      
      expect(locations).toContainEqual(['Kitchen']);
      expect(locations).toContainEqual(['Living Room']);
      expect(locations).toContainEqual(['Bedroom']);
      expect(locations).toContainEqual(['Bathroom']);
      expect(locations).toContainEqual(['Garage']);
      expect(locations).toContainEqual(['Office']);
    });

    it('should handle long location names with wrapping', async () => {
      // Import mocked modules
      const { default: jsPDF } = await import('jspdf');
      const { default: QRCode } = await import('qrcode');

      // Create quests with long location names
      const questsWithLongNames: Quest[] = [
        {
          id: 'quest-1',
          type: 'qcm' as const,
          duration: 'short' as const,
          location: 'Very Long Location Name That Might Cause Issues And Should Be Wrapped',
        },
      ];

      // Setup mocks
      const mockDoc = {
        internal: {
          pageSize: {
            getWidth: vi.fn(() => 210),
            getHeight: vi.fn(() => 297),
          },
        },
        addPage: vi.fn(),
        addImage: vi.fn(),
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        splitTextToSize: vi.fn((text) => [text]), // Simulate wrapping by returning array
        text: vi.fn(),
        output: vi.fn(() => new Blob()),
      };

      vi.mocked(jsPDF).mockImplementation(function() {
        return mockDoc;
      });
      
      vi.mocked(QRCode).toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,mockqrcode');

      await generateQuestPDF(questsWithLongNames);

      // Should call splitTextToSize for the long name
      expect(mockDoc.splitTextToSize).toHaveBeenCalledWith(
        'Very Long Location Name That Might Cause Issues And Should Be Wrapped',
        80 // MAX_TEXT_WIDTH
      );
      
      // Should add text (wrapped)
      expect(mockDoc.text).toHaveBeenCalled();
    });

    it('should continue generation if one QR code fails', async () => {
      const { default: jsPDF } = await import('jspdf');
      const { default: QRCode } = await import('qrcode');

      const quests = [
        { id: 'q1', type: 'qcm' as const, duration: 'short' as const, location: 'L1' },
        { id: 'q2', type: 'qcm' as const, duration: 'short' as const, location: 'L2' },
      ];

      const mockDoc = {
        internal: { pageSize: { getWidth: vi.fn(() => 210) } },
        addPage: vi.fn(),
        addImage: vi.fn(),
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        splitTextToSize: vi.fn((text) => [text]),
        text: vi.fn(),
        output: vi.fn(() => new Blob()),
      };

      vi.mocked(jsPDF).mockImplementation(function() { return mockDoc; });
      
      // Fail the first QR code, succeed on the second
      vi.mocked(QRCode).toDataURL = vi.fn()
        .mockRejectedValueOnce(new Error('QR Failed'))
        .mockResolvedValueOnce('data:image/png;base64,mockqrcode');

      await generateQuestPDF(quests);

      // Should have attempted both
      expect(QRCode.toDataURL).toHaveBeenCalledTimes(2);
      
      // Should only have added 1 image and text (for the second quest)
      expect(mockDoc.addImage).toHaveBeenCalledTimes(1);
      expect(mockDoc.text).toHaveBeenCalledTimes(1);
    });

    it('should position text correctly for all grid positions', async () => {
      // Import mocked modules
      const { default: jsPDF } = await import('jspdf');
      const { default: QRCode } = await import('qrcode');

      // Setup mocks with coordinate tracking
      const textCalls: Array<{text: string, x: number, y: number}> = [];
      const imageCalls: Array<unknown[]> = [];
      const mockDoc = {
        internal: {
          pageSize: {
            getWidth: vi.fn(() => 210),
            getHeight: vi.fn(() => 297),
          },
        },
        addPage: vi.fn(),
        addImage: vi.fn((...args: unknown[]) => {
          imageCalls.push(args);
        }),
        setFontSize: vi.fn(),
        setFont: vi.fn(),
        splitTextToSize: vi.fn((text) => [text]),
        text: vi.fn((text: string, x: number, y: number) => {
          textCalls.push({ text, x, y });
        }),
        output: vi.fn(() => new Blob()),
      };

      vi.mocked(jsPDF).mockImplementation(function() {
        return mockDoc;
      });
      
      vi.mocked(QRCode).toDataURL = vi.fn().mockResolvedValue('data:image/png;base64,mockqrcode');

      await generateQuestPDF(mockQuests);

      // Should have 6 text calls for 6 locations and 6 images for 6 QR codes
      expect(textCalls).toHaveLength(6);
      expect(imageCalls).toHaveLength(6);
      
      // Verify X coordinates (should be centered in columns)
      const pageWidth = 210;
      const leftColumnX = pageWidth / 4; // 52.5
      const rightColumnX = (pageWidth * 3) / 4; // 157.5
      
      // Check that we have both left and right column positions
      const leftColumnCalls = textCalls.filter(call => Math.abs(call.x - leftColumnX) < 1);
      const rightColumnCalls = textCalls.filter(call => Math.abs(call.x - rightColumnX) < 1);
      
      expect(leftColumnCalls).toHaveLength(3); // 3 quests in left column
      expect(rightColumnCalls).toHaveLength(3); // 3 quests in right column
      
      // Verify Y coordinates are different (different rows)
      const yCoordinates = textCalls.map(call => call.y);
      const uniqueYCoords = [...new Set(yCoordinates)];
      expect(uniqueYCoords).toHaveLength(3); // 3 different rows
      
      // Verify no overlapping: text should be positioned below QR codes
      const qrSize = 50;
      const textOffset = 8; // Space between QR and text
      
      textCalls.forEach((textCall, index) => {
        const imageCall = imageCalls[index];
        const qrX = imageCall[2]; // X position of QR code
        const qrY = imageCall[3] as number; // Y position of QR code
        const textY = textCall.y; // Y position of text
        
        // Text should be positioned below QR code with proper spacing
        // The actual calculation from the code: locationY = qrY + qrSize + 8
        expect(textY).toBe(qrY + qrSize + 8);
      });
      
      // Verify all elements are within page bounds
      const pageHeight = 297;
      textCalls.forEach(call => {
        expect(call.x).toBeGreaterThan(0);
        expect(call.x).toBeLessThan(pageWidth);
        expect(call.y).toBeGreaterThan(0);
        expect(call.y).toBeLessThan(pageHeight);
      });
      
      imageCalls.forEach((imageCall, index) => {
        const x = imageCall[2] as number; // X position
        const y = imageCall[3] as number; // Y position
        const width = imageCall[4] as number; // Width
        const height = imageCall[5] as number; // Height
        
        expect(x).toBeGreaterThan(0);
        expect(y).toBeGreaterThan(0);
        expect(x + width).toBeLessThan(pageWidth);
        expect(y + height).toBeLessThan(pageHeight);
      });
    });
  });
});
