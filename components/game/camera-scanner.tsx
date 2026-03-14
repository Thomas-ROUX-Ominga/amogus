"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useTranslations } from "next-intl";
import { EliminatedScreen } from "@/components/game/eliminated-screen";

export interface CameraScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (questId: string) => void | boolean | Promise<void | boolean>;
    isPlayerEliminated?: boolean;
    playerRole?: string;
    statusMessage?: string | null;
}

export function CameraScanner({
    isOpen,
    onClose,
    onScan,
    isPlayerEliminated = false,
    playerRole,
    statusMessage = null,
}: CameraScannerProps) {
    const t = useTranslations();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const hasScannedRef = useRef(false);
    const scanCooldownUntilRef = useRef(0);
    const scannerRegionId = 'qr-scanner-region';
    const scannerReservedHeight = statusMessage ? 208 : 136;
    const scannerSquareSize = viewportHeight
        ? Math.max(220, Math.min(520, viewportHeight - scannerReservedHeight))
        : 420;

    useEffect(() => {
        if (!isOpen) {
            cleanupScanner();
            hasScannedRef.current = false;
            scanCooldownUntilRef.current = 0;
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

    useEffect(() => {
        if (!isOpen || typeof window === "undefined" || typeof document === "undefined") {
            setViewportHeight(null);
            return;
        }

        const updateViewportHeight = () => {
            const nextHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
            setViewportHeight(nextHeight);
        };

        const originalBodyOverflow = document.body.style.overflow;
        const originalBodyTouchAction = document.body.style.touchAction;
        const originalHtmlOverflow = document.documentElement.style.overflow;

        updateViewportHeight();
        window.addEventListener("resize", updateViewportHeight);
        window.visualViewport?.addEventListener("resize", updateViewportHeight);

        // Lock page scroll so the scanner stays fixed to the visible viewport on mobile.
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        document.documentElement.style.overflow = "hidden";

        return () => {
            window.removeEventListener("resize", updateViewportHeight);
            window.visualViewport?.removeEventListener("resize", updateViewportHeight);
            document.body.style.overflow = originalBodyOverflow;
            document.body.style.touchAction = originalBodyTouchAction;
            document.documentElement.style.overflow = originalHtmlOverflow;
        };
    }, [isOpen]);

    const initializeScanner = async () => {
        if (!document.getElementById(scannerRegionId)) return;
        
        setIsLoading(true);
        setError(null);

        try {
            // Create a new instance of Html5Qrcode
            // The second parameter should be a boolean (verbose) or false, not an object.
            const html5QrCode = new Html5Qrcode(scannerRegionId, false);
            html5QrCodeRef.current = html5QrCode;

            // Configure scanner for mobile-first environment usage
            const config = {
                fps: 15,
                qrbox: { width: 250, height: 250 }, // Standard box size
                aspectRatio: 1.0,
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
            };

            // Start scanning immediately with environment camera
            await html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    const now = Date.now();
                    if (hasScannedRef.current || now < scanCooldownUntilRef.current) {
                        return;
                    }

                    // Extract quest ID from QR code data
                    const questId = extractQuestId(decodedText);
                    
                    if (questId) {
                        hasScannedRef.current = true;
                        scanCooldownUntilRef.current = now + 1000;

                        void (async () => {
                            // Vibrate on successful scan
                            try {
                                if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                                    navigator.vibrate([50, 30, 50]);
                                }
                            } catch {
                                // Ignore haptic failures
                            }

                            try {
                                const shouldClose = await onScan(questId);
                                if (shouldClose !== false) {
                                    cleanupScanner();
                                    onClose();
                                    return;
                                }

                                // Keep scanner open for a quick retry (e.g. wrong QR during communications sabotage)
                                hasScannedRef.current = false;
                            } catch (scanError) {
                                console.error("Scan handler error:", scanError);
                                cleanupScanner();
                                onClose();
                            }
                        })();
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

        // 2. Direct extraction from string (formats like "quest:ABC-123", "id=456", JSON keys, or just "ABC-123")
        const questMatch =
            qrData.match(/(?:^|\b)(?:questId|quest|id)[\s:=_-]+([a-zA-Z0-9_-]+)/i) ||
            qrData.match(/^([a-zA-Z0-9_-]+)$/i);
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
            return t("game.scanner.errors.accessDenied");
        }
        if (name === 'NotFoundError' || message.includes('No camera')) {
            return t("game.scanner.errors.noCamera");
        }
        if (name === 'NotSupportedError' || message.includes('not supported')) {
            return t("game.scanner.errors.notSupported");
        }
        if (name === 'NotReadableError' || message.includes('already in use')) {
            return t("game.scanner.errors.locked");
        }
        return t("game.scanner.errors.generic");
    };

    const handleRetry = () => {
        setError(null);
        hasScannedRef.current = false;
        scanCooldownUntilRef.current = 0;
        // Reactive useEffect will trigger initializeScanner once error is null and container renders
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[120] h-screen overflow-hidden overscroll-none bg-black"
                    style={viewportHeight ? { height: `${viewportHeight}px` } : undefined}
                >
                    <div className="relative flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-6">
                        <button
                            onClick={onClose}
                            className="absolute right-4 top-4 z-30 rounded-full border border-primary/40 bg-black/80 p-2 transition-colors hover:bg-primary/20"
                            aria-label={t("game.scanner.closeScannerAria")}
                        >
                            <X className="h-5 w-5 text-primary" />
                        </button>

                        <div className="flex w-full max-w-[560px] flex-col items-center gap-4">
                            {statusMessage && (
                                <div className="w-full border border-primary/40 bg-black/85 px-4 py-3 text-center text-sm text-primary font-rajdhani tracking-wide">
                                    {statusMessage}
                                </div>
                            )}

                            <div className="relative flex w-full items-center justify-center overflow-hidden">
                                {/* Eliminated Player Overlay - Only block Impostors, allow Crewmates in Ghost Mode */}
                                {isPlayerEliminated && playerRole === "IMPOSTOR" && (
                                    <EliminatedScreen onDismiss={onClose} playerRole={playerRole} />
                                )}

                                {/* Ghost Mode Overlay for Eliminated Crewmates */}
                                {isPlayerEliminated && playerRole === "CREWMATE" && (
                                    <div className="absolute inset-0 m-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4 backdrop-blur-sm">
                                        <div className="space-y-2 text-center">
                                            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-400 font-orbitron">
                                                {t("game.scanner.ghostModeTitle")}
                                            </h3>
                                            <p className="text-xs text-blue-300 font-rajdhani">
                                                {t("game.scanner.ghostModeDescription")}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Scanner Area Container - Always rendered to keep #qr-scanner-region in DOM */}
                                {!(isPlayerEliminated && playerRole === "IMPOSTOR") && (
                                    <div
                                        className={`relative shrink-0 transition-opacity duration-300 ${isLoading || error ? 'opacity-0' : 'opacity-100'}`}
                                        style={{
                                            width: `min(100%, ${scannerSquareSize}px)`,
                                            height: `min(100%, ${scannerSquareSize}px)`,
                                        }}
                                    >
                                        <div
                                            id={scannerRegionId}
                                            className="h-full w-full overflow-hidden rounded-lg bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover"
                                            aria-label={t("game.scanner.cameraViewAria")}
                                            role="img"
                                        />
                                        {/* Scanning overlay frame */}
                                        <div className="pointer-events-none absolute inset-0">
                                            <div className="absolute inset-4 rounded-lg border-2 border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.3)]">
                                                <motion.div
                                                    className="absolute left-0 right-0 top-0 h-0.5 bg-primary shadow-[0_0_10px_rgba(var(--primary),0.8)]"
                                                    animate={{ y: ["0%", "100%"] }}
                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {isLoading && !(isPlayerEliminated && playerRole === "IMPOSTOR") && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
                                        <div className="space-y-4 text-center">
                                            <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
                                            <p className="font-rajdhani tracking-wider text-primary">
                                                {t("game.scanner.initializingCamera")}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {error && !(isPlayerEliminated && playerRole === "IMPOSTOR") && (
                                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4">
                                        <div className="w-full max-w-sm space-y-4 rounded-lg border border-destructive/20 bg-destructive/10 p-6 text-center">
                                            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                                            <div>
                                                <h3 className="mb-2 text-lg font-bold text-destructive font-orbitron">
                                                    {t("game.scanner.cameraErrorTitle")}
                                                </h3>
                                                <p className="text-sm text-muted-foreground font-rajdhani">
                                                    {error}
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleRetry}
                                                className="rounded-lg bg-primary px-4 py-2 font-orbitron tracking-wider text-primary-foreground transition-colors hover:bg-primary/80"
                                            >
                                                {t("game.scanner.retry")}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
