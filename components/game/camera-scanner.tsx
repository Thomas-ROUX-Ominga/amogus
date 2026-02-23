"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, AlertCircle } from "lucide-react";
import QrScanner from "qr-scanner";
import { EliminatedScreen } from "@/components/game/eliminated-screen";

export interface CameraScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (questId: string) => void;
    isPlayerEliminated?: boolean;
}

export function CameraScanner({ isOpen, onClose, onScan, isPlayerEliminated = false }: CameraScannerProps) {
    const videoRef = useRef(null);
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const qrScannerRef = useRef<QrScanner | null>(null);

    useEffect(() => {
        if (!isOpen) {
            cleanupScanner();
            return;
        }

        initializeScanner();
        return cleanupScanner;
    }, [isOpen]);

    const initializeScanner = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Check camera permission first
            const permission = await navigator.permissions.query({ name: 'camera' });
            setHasPermission(permission.state === 'granted' || permission.state === 'prompt');

            // Initialize QR Scanner
            if (!videoRef.current) return;

            const qrScanner = new QrScanner(
                videoRef.current,
                (result) => {
                    // Vibrate on successful scan
                    try {
                        if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                            navigator.vibrate([50, 30, 50]);
                        }
                    } catch {
                        // Ignore haptic failures silently
                    }

                    // Extract quest ID from QR code data
                    const questId = extractQuestId(result.data);
                    if (questId) {
                        onScan(questId);
                        onClose();
                    }
                },
                {
                    highlightScanRegion: true,
                    highlightCodeOutline: true,
                }
            );

            qrScannerRef.current = qrScanner;
            await qrScanner.start();
            setHasPermission(true);
        } catch (err) {
            console.error('Camera initialization error:', err);
            setError(handleCameraError(err as Error | { name: string }));
            setHasPermission(false);
        } finally {
            setIsLoading(false);
        }
    };

    const cleanupScanner = () => {
        if (qrScannerRef.current) {
            try {
                qrScannerRef.current.stop();
                qrScannerRef.current.destroy();
            } catch (error) {
                console.warn('Error during scanner cleanup:', error);
            } finally {
                qrScannerRef.current = null;
            }
        }
    };

    const extractQuestId = (qrData: string): string | null => {
        try {
            // Try to parse as URL first
            const url = new URL(qrData);
            const pathname = url.pathname;
            
            // Extract quest ID from patterns like /game/123/quest or /quest/123
            const questMatch = pathname.match(/\/(?:game\/\d+\/)?quest\/?(\d+)?/);
            if (questMatch && questMatch[1]) {
                return questMatch[1];
            }
            
            // Check for quest ID in search params
            const questParam = url.searchParams.get('questId') || url.searchParams.get('quest');
            if (questParam) {
                return questParam;
            }
            
            return null;
        } catch {
            // If not a URL, try to extract quest ID directly from string
            const questMatch = qrData.match(/quest[_-]?(\d+)/i);
            return questMatch ? questMatch[1] : null;
        }
    };

    const handleCameraError = (err: Error | { name: string }): string => {
        if (err.name === 'NotAllowedError') {
            return "Camera access denied. Please enable camera permissions in your browser settings.";
        }
        if (err.name === 'NotFoundError') {
            return "No camera found. Please ensure your device has a working camera.";
        }
        if (err.name === 'NotSupportedError') {
            return "Camera not supported on this device or browser.";
        }
        if (err.name === 'NotReadableError') {
            return "Camera is already in use by another application.";
        }
        return "Failed to access camera. Please try again.";
    };

    const handleRetry = () => {
        setError(null);
        initializeScanner();
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
                            {/* Eliminated Player Overlay */}
                            {isPlayerEliminated && (
                                <EliminatedScreen onDismiss={onClose} />
                            )}

                            {isLoading && !isPlayerEliminated && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                    <div className="text-center space-y-4">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                            className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto"
                                        />
                                        <p className="text-primary font-rajdhani tracking-wider">
                                            Initializing camera...
                                        </p>
                                    </div>
                                </div>
                            )}

                            {error && !isPlayerEliminated && (
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

                            {!isLoading && !error && !isPlayerEliminated && (
                                <div className="relative w-full max-w-md aspect-square">
                                    <video
                                        ref={videoRef}
                                        className="w-full h-full object-cover rounded-lg"
                                        playsInline
                                        muted
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
