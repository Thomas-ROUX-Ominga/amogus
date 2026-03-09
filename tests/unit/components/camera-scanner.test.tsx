import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CameraScanner } from '@/components/game/camera-scanner';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

// Mock html5-qrcode library
const mockStart = vi.fn().mockResolvedValue(undefined);
const mockStop = vi.fn().mockResolvedValue(undefined);
const mockClear = vi.fn();

vi.mock('html5-qrcode', () => {
  return {
    Html5Qrcode: vi.fn().mockImplementation(function(this: unknown) {
      return {
        start: mockStart,
        stop: mockStop,
        clear: mockClear,
        isScanning: false,
      };
    }),
    Html5QrcodeSupportedFormats: {
      QR_CODE: 0,
    },
  };
});

// Mock navigator.vibrate
Object.defineProperty(navigator, 'vibrate', {
  value: vi.fn(),
  writable: true,
});

describe('CameraScanner', () => {
  const mockOnScan = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStart.mockReset().mockResolvedValue(undefined);
    mockStop.mockReset().mockResolvedValue(undefined);
    mockClear.mockClear();
    vi.mocked(Html5Qrcode).mockClear();
  });

  it('renders scanner UI when isOpen is true', () => {
    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    expect(screen.getByText('SCANNER QR')).toBeInTheDocument();
    expect(screen.getByText('Positionnez le QR code dans le cadre pour scanner')).toBeInTheDocument();
  });

  it('does not render scanner when isOpen is false', () => {
    render(
      <CameraScanner
        isOpen={false}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    expect(screen.queryByText('SCANNER QR')).not.toBeInTheDocument();
  });

  it('initializes and starts scanning with environment mode on open', async () => {
    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    await waitFor(() => {
      expect(Html5Qrcode).toHaveBeenCalled();
      expect(mockStart).toHaveBeenCalledWith(
        expect.objectContaining({ facingMode: "environment" }),
        expect.any(Object),
        expect.any(Function),
        undefined
      );
    }, { timeout: 4000 });
  });

  it('extracts quest IDs from various alphanumeric formats', async () => {
    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    await waitFor(() => expect(mockStart).toHaveBeenCalled(), { timeout: 4000 });
    
    // Get the most recent success callback
    const successCallback = mockStart.mock.calls[mockStart.mock.calls.length - 1][2];

    const testCases = [
      { input: 'https://amog.us/quest/ABC-123', expected: 'ABC-123' },
      { input: 'https://amog.us/game/XY78/quest/Q-99', expected: 'Q-99' },
      { input: 'https://amog.us/quest?id=SHORTCODE123', expected: 'SHORTCODE123' },
      { input: 'quest:MY_QUEST_ID', expected: 'MY_QUEST_ID' },
      { input: 'id-45678', expected: '45678' },
      { input: 'JUST-A-CODE', expected: 'JUST-A-CODE' }
    ];

    for (const { input, expected } of testCases) {
      await act(async () => {
        successCallback(input);
      });
      expect(mockOnScan).toHaveBeenCalledWith(expected);
      mockOnScan.mockClear();
    }
  });

  it('vibrates on successful scan', async () => {
    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    await waitFor(() => expect(mockStart).toHaveBeenCalled(), { timeout: 4000 });
    const successCallback = mockStart.mock.calls[mockStart.mock.calls.length - 1][2];

    await act(async () => {
      successCallback('https://amog.us/quest/123');
    });
    
    expect(navigator.vibrate).toHaveBeenCalledWith([50, 30, 50]);
  });

  it('calls onClose when close button is clicked', () => {
    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    const closeButton = screen.getByLabelText('Fermer le scanner');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('shows eliminated screen when eliminated Impostor tries to scan', () => {
    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
        isPlayerEliminated={true}
        playerRole="IMPOSTOR"
      />
    );

    expect(screen.getByText('MISSION TERMINÉE')).toBeInTheDocument();
    expect(screen.getByText('VOUS AVEZ ÉTÉ DÉSACTIVÉ')).toBeInTheDocument();
  });

  it('shows Ghost Mode overlay when eliminated Crewmate tries to scan', () => {
    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
        isPlayerEliminated={true}
        playerRole="CREWMATE"
      />
    );

    expect(screen.getByText('Mode fantôme actif')).toBeInTheDocument();
    expect(
      screen.getByText('Vous pouvez continuer à scanner des QR codes pour terminer vos quêtes restantes.'),
    ).toBeInTheDocument();
  });

  it('handles camera initialization errors', async () => {
    const error = new Error('Camera not found');
    error.name = 'NotFoundError';
    mockStart.mockRejectedValueOnce(error);

    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Erreur caméra')).toBeInTheDocument();
      expect(screen.getByText(/Aucune caméra détectée/i)).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('handles retry functionality', async () => {
    const error = new Error('Permission denied');
    error.name = 'NotAllowedError';
    mockStart.mockRejectedValueOnce(error).mockResolvedValue(undefined);

    render(
      <CameraScanner
        isOpen={true}
        onClose={mockOnClose}
        onScan={mockOnScan}
      />
    );

    // Wait for error state
    await waitFor(() => expect(screen.getByText('Réessayer')).toBeInTheDocument(), { timeout: 5000 });
    
    const retryButton = screen.getByText('Réessayer');
    fireEvent.click(retryButton);

    // Successful initialization after retry
    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledTimes(2);
    }, { timeout: 5000 });
  });
});
