"use client";

import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { X, AlertCircle, Loader2 } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { useTranslations } from "next-intl";
import { createPortal } from "react-dom";

export interface CameraScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (questId: string) => void | boolean | Promise<void | boolean>;
    statusMessage?: string | null;
    isSabotaged?: boolean;
}

export function CameraScanner({
    isOpen,
    onClose,
    onScan,
    statusMessage = null,
    isSabotaged = false,
}: CameraScannerProps) {
    const t = useTranslations();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const hasScannedRef = useRef(false);
    const scanCooldownUntilRef = useRef(0);
    const scannerRegionId = "qr-scanner-region";

    useEffect(() => {
        if (typeof document === "undefined" || !isOpen) {
            cleanupScanner();
            hasScannedRef.current = false;
            scanCooldownUntilRef.current = 0;
            return;
        }

        // Initialize scanner if container is ready and no active scanner/error
        if (document.getElementById(scannerRegionId) && !html5QrCodeRef.current && !error && !isLoading) {
            void initializeScanner();
        }

        return () => {
            if (!isOpen) {
                cleanupScanner();
            }
        };
    }, [isOpen, error, isLoading]);

    useEffect(() => {
        if (!isOpen || typeof document === "undefined") {
            return;
        }

        const originalBodyOverflow = document.body.style.overflow;
        const originalBodyTouchAction = document.body.style.touchAction;
        const originalHtmlOverflow = document.documentElement.style.overflow;

        // Lock page scroll so the scanner stays fixed to the visible viewport on mobile.
        document.body.style.overflow = "hidden";
        document.body.style.touchAction = "none";
        document.documentElement.style.overflow = "hidden";

        return () => {
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
                fps: 12,
                aspectRatio: 1.0,
                formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
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

            // Attempt to force the torch/flash on
            try {
                await html5QrCode.applyVideoConstraints({
                    advanced: [{ torch: true }]
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any);
            } catch (torchError) {
                console.warn("Flash not supported on this device or failed to activate.", torchError);
            }

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

    if (!isOpen || typeof document === "undefined") {
        return null;
    }

    return createPortal(
        <m.div
            key="camera-scanner-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-md"
        >
                            <button
                                type="button"
                                onMouseDown={onClose}
                                aria-hidden="true"
                                tabIndex={-1}
                                className="absolute inset-0 h-full w-full cursor-default"
                            />
                            <div className={`absolute inset-0 ${isSabotaged ? "bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.14),transparent_65%)]" : "bg-[radial-gradient(circle_at_center,rgba(88,166,255,0.14),transparent_65%)]"}`} />
                            <div className="relative z-10 flex h-full w-full items-center justify-center p-3 sm:p-6">
                                <div
                                    className={`w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] overflow-y-auto border bg-black/70 backdrop-blur-xl p-4 sm:p-5 ${isSabotaged ? "border-red-500/35" : "border-primary/35"}`}
                                >
                                    <div className="mb-4 flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className={`text-sm sm:text-base font-black uppercase tracking-[0.2em] font-orbitron ${isSabotaged ? "text-red-400" : "text-primary"}`}>
                                                {t("game.scanner.title")}
                                            </h2>
                                            <p className="mt-1 text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground font-rajdhani">
                                                {t("game.scanner.instruction")}
                                            </p>
                                        </div>
                                        <button
                                            onClick={onClose}
                                            className={`shrink-0 h-9 w-9 border bg-black/70 inline-flex items-center justify-center transition-colors ${isSabotaged ? "border-red-500/35 text-red-400 hover:bg-red-500/15" : "border-primary/35 text-primary hover:bg-primary/15"}`}
                                            aria-label={t("game.scanner.closeScannerAria")}
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>

                                {statusMessage && (
                                    <div className={`mb-4 w-full border px-3 py-2 text-center text-xs font-rajdhani tracking-wide ${isSabotaged ? "border-red-500/35 bg-red-500/10 text-red-400" : "border-primary/35 bg-primary/10 text-primary"}`}>
                                        {statusMessage}
                                    </div>
                                )}

                                <div className="relative mx-auto w-full max-w-[560px]">
                                    <div className={`relative aspect-square w-full overflow-hidden border bg-black/90 ${isSabotaged ? "border-red-500/35 shadow-[0_0_40px_rgba(239,68,68,0.15)]" : "border-primary/35 shadow-[0_0_40px_rgba(88,166,255,0.15)]"}`}>
                                        <div
                                            id={scannerRegionId}
                                            className="h-full w-full overflow-hidden bg-black [&_video]:h-full [&_video]:w-full [&_video]:object-cover [&_canvas]:hidden [&_img]:hidden"
                                            aria-label={t("game.scanner.cameraViewAria")}
                                            role="img"
                                        />

                                        <div className="pointer-events-none absolute inset-0">
                                            <div className={`absolute inset-5 border ${isSabotaged ? "border-red-500/45" : "border-primary/45"}`} />

                                            <div className="absolute left-5 top-5 h-8 w-8 border-l-2 border-t-2 border-white/80" />
                                            <div className="absolute right-5 top-5 h-8 w-8 border-r-2 border-t-2 border-white/80" />
                                            <div className="absolute left-5 bottom-5 h-8 w-8 border-l-2 border-b-2 border-white/80" />
                                            <div className="absolute right-5 bottom-5 h-8 w-8 border-r-2 border-b-2 border-white/80" />

                                            <div className="absolute inset-5">
                                                <m.div
                                                    className={`absolute left-3 right-3 h-[2px] ${isSabotaged ? "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)]" : "bg-primary shadow-[0_0_14px_rgba(88,166,255,0.9)]"}`}
                                                    animate={{ top: ["calc(100% - 2px)", "0%"] }}
                                                    transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                                                />
                                            </div>
                                        </div>

                                        {isLoading && (
                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65">
                                                <div className="space-y-3 text-center">
                                                    <Loader2 className={`mx-auto h-10 w-10 animate-spin ${isSabotaged ? "text-red-500" : "text-primary"}`} />
                                                    <p className={`text-xs uppercase tracking-wider font-rajdhani ${isSabotaged ? "text-red-400" : "text-primary"}`}>
                                                        {t("game.scanner.initializingCamera")}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {error && (
                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/65 p-4">
                                                <div className="w-full max-w-sm space-y-3 border border-destructive/35 bg-destructive/10 p-4 text-center">
                                                    <AlertCircle className="mx-auto h-9 w-9 text-destructive" />
                                                    <div>
                                                        <h3 className="mb-1 text-sm font-bold text-destructive font-orbitron uppercase tracking-wider">
                                                            {t("game.scanner.cameraErrorTitle")}
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground font-rajdhani">
                                                            {error}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={handleRetry}
                                                        className={`h-10 px-4 border text-xs uppercase tracking-widest font-orbitron hover:opacity-90 transition-opacity ${isSabotaged ? "border-red-500 bg-red-600 text-white" : "border-primary bg-primary text-primary-foreground"}`}
                                                    >
                                                        {t("game.scanner.retry")}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
        </m.div>,
        document.body,
    );
}
