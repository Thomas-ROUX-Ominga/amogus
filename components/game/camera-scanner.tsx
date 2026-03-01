"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, AlertCircle, Loader2 } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { EliminatedScreen } from "@/components/game/eliminated-screen";

export interface CameraScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (questId: string) => void;
    isPlayerEliminated?: boolean;
    playerRole?: string;
}

export function CameraScanner({ isOpen, onClose, onScan, isPlayerEliminated = false, playerRole }: CameraScannerProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const scannerRegionId = 'qr-scanner-region';

    useEffect(() => {
        if (!isOpen) {
            cleanupScanner();
            return;
        }

        // Initialize scanner if container is ready and no active scanner/error
        if (document.getElementById(scannerRegionId) && !html5QrCodeRef.current && !error && !isLoading) {
            initializeScanner();
        }

        return () => {
            if (!isOpen) {
                cleanupScanner();
            }
        };
    }, [isOpen, error, isLoading]);

    const initializeScanner = async () => {
        if (!document.getElementById(scannerRegionId)) return;
        
        setIsLoading(true);
        setError(null);

        try {
            // Create a new instance of Html5Qrcode
            const html5QrCode = new Html5Qrcode(scannerRegionId, {
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
                verbose: false
            });
            html5QrCodeRef.current = html5QrCode;

            // Configure scanner for mobile-first environment usage
            const config = {
                fps: 15,
                qrbox: { width: 200, height: 200 }, // Slightly smaller for better fit on some mobile screens
                aspectRatio: 1.0,
            };

            // Start scanning immediately with environment camera
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    // Extract quest ID from QR code data
                    const questId = extractQuestId(decodedText);
                    
                    if (questId) {
                        // Immediately stop/clear scanner to prevent multiple triggers
                        cleanupScanner();
                        
                        // Vibrate on successful scan
                        try {
                            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                                navigator.vibrate([50, 30, 50]);
                            }
                        } catch {
                            // Ignore haptic failures
                        }

                        // Trigger callback immediately
                        onScan(questId);
                        onClose();
                    }
                },
                undefined // Ignore constant scan errors while searching
            );

        } catch (err) {
            console.error('Camera initialization error:', err);
            setError(handleCameraError(err as Error));
            cleanupScanner();
        } finally {
            setIsLoading(false);
        }
    };

    const cleanupScanner = () => {
        if (html5QrCodeRef.current) {
            if (html5QrCodeRef.current.isScanning) {
                html5QrCodeRef.current.stop().then(() => {
                    html5QrCodeRef.current?.clear();
                    html5QrCodeRef.current = null;
                }).catch(err => {
                    console.warn('Error stopping scanner:', err);
                });
            } else {
                try {
                    html5QrCodeRef.current.clear();
                } catch (e) {
                    // Ignore clear errors if not rendered
                }
                html5QrCodeRef.current = null;
            }
        }
    };

    const extractQuestId = (qrData: string): string | null => {
        // 1. Try to parse as URL and extract from path or params
        try {
            if (qrData.startsWith('http')) {
                const url = new URL(qrData);
                const pathname = url.pathname;
                
                // Extract from path like /quest/ABC-123
                const pathMatch = pathname.match(/\/quest\/?([a-zA-Z0-9_-]+)/i);
                if (pathMatch && pathMatch[1]) return pathMatch[1];
                
                // Check for quest ID in search params
                const questParam = url.searchParams.get('questId') || url.searchParams.get('quest') || url.searchParams.get('id');
                if (questParam) return questParam;
            }
        } catch (e) {
            // Not a valid URL, ignore and fall through
        }

        // 2. Direct extraction from string (formats like "quest:ABC-123", "id=456", or just "ABC-123")
        const questMatch = qrData.match(/(?:quest|id)[\s:_-]?([a-zA-Z0-9_-]+)/i) || qrData.match(/^([a-zA-Z0-9_-]+)$/i);
        if (questMatch && questMatch[1]) {
            return questMatch[1];
        }

        // 3. Last resort: just trim and use the whole string if it looks like a code
        const trimmed = qrData.trim();
        if (trimmed && trimmed.length > 0 && trimmed.length < 64) {
            return trimmed;
        }

        return null;
    };

    const handleCameraError = (err: Error | { name: string; message?: string }): string => {
        const name = err.name || '';
        const message = (err as { message?: string }).message || '';

        if (name === 'NotAllowedError' || message.includes('Permission denied')) {
            return "Camera access denied. Please enable camera permissions in your browser settings.";
        }
        if (name === 'NotFoundError' || message.includes('No camera')) {
            return "No camera found. Please ensure your device has a working rear camera.";
        }
        if (name === 'NotSupportedError' || message.includes('not supported')) {
            return "Secure context (HTTPS) required for camera access, or browser not supported.";
        }
        if (name === 'NotReadableError' || message.includes('already in use')) {
            return "Camera is locked by another app. Please close other camera apps and retry.";
        }
        return "Failed to access camera. Please check your settings and try again.";
    };

    const handleRetry = () => {
        setError(null);
        // Reactive useEffect will trigger initializeScanner once error is null and container renders
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
                >
                    <div className="relative h-full flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 bg-black/50">
                            <div className="flex items-center gap-3">
                                <Camera className="w-6 h-6 text-primary" />
                                <h2 className="text-lg font-bold text-primary font-orbitron tracking-wider">
                                    QR SCANNER
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                                aria-label="Close scanner"
                            >
                                <X className="w-5 h-5 text-primary" />
                            </button>
                        </div>

                        {/* Scanner Area */}
                        <div className="flex-1 relative flex items-center justify-center p-4">
                            {/* Eliminated Player Overlay - Only block Impostors, allow Crewmates in Ghost Mode */}
                            {isPlayerEliminated && playerRole === "IMPOSTOR" && (
                                <EliminatedScreen onDismiss={onClose} />
                            )}

                            {/* Ghost Mode Overlay for Eliminated Crewmates */}
                            {isPlayerEliminated && playerRole === "CREWMATE" && (
                                <div className="absolute inset-0 bg-blue-500/10 backdrop-blur-sm border border-blue-500/30 rounded-lg p-4 m-4">
                                    <div className="text-center space-y-2">
                                        <h3 className="text-sm font-bold text-blue-400 font-orbitron uppercase tracking-wider">
                                            Ghost Mode Active
                                        </h3>
                                        <p className="text-xs text-blue-300 font-rajdhani">
                                            You can continue scanning QR codes to complete your remaining quests.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {isLoading && !(isPlayerEliminated && playerRole === "IMPOSTOR") && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <div className="text-center space-y-4">
                                        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
                                        <p className="text-primary font-rajdhani tracking-wider">
                                            Initializing camera...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {error && !(isPlayerEliminated && playerRole === "IMPOSTOR") && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50 p-4">
                                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-sm w-full text-center space-y-4">
                                        <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                                        <div>
                                            <h3 className="text-lg font-bold text-destructive font-orbitron mb-2">
                                                Camera Error
                                            </h3>
                                            <p className="text-sm text-muted-foreground font-rajdhani">
                                                {error}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleRetry}
                                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-orbitron tracking-wider hover:bg-primary/80 transition-colors"
                                        >
                                            Retry
                                        </button>
                                    </div>
                                </div>
                            )}

                            {!isLoading && !error && !(isPlayerEliminated && playerRole === "IMPOSTOR") && (
                                <div className="relative w-full max-w-md aspect-square">
                                        <div
                                            id={scannerRegionId}
                                            className="w-full h-full rounded-lg overflow-hidden bg-black [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
                                            aria-label="Camera view for QR code scanning"
                                            role="img"
                                        />
                                    {/* Scanning overlay */}
                                    <div className="absolute inset-0 pointer-events-none">
                                        <div className="absolute inset-4 border-2 border-primary/50 rounded-lg">
                                            <motion.div
                                                className="absolute top-0 left-0 right-0 h-0.5 bg-primary"
                                                animate={{ y: ["0%", "100%"] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Instructions */}
                        <div className="p-4 bg-black/50 text-center">
                            <p className="text-sm text-primary/80 font-rajdhani tracking-wider">
                                Position QR code within the frame to scan
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
