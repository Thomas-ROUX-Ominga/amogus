"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { QuestDuration } from "@/types/quest";
import { WIRES_COUNT_BY_DURATION } from "@/lib/mini-games";
import { FailedOverlay } from "@/components/game/failed-overlay";

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 600;
const LEFT_X = 140;
const RIGHT_X = 860;
const TOP_Y = 84;
const BOTTOM_Y = 516;
const RIGHT_DROP_X_THRESHOLD = RIGHT_X - 140;

interface WireColor {
    id: string;
    label: string;
    hex: string;
    endpointClass: string;
}

interface DragState {
    leftIndex: number;
    currentX: number;
    currentY: number;
}

interface AnchorPoint {
    x: number;
    y: number;
}

interface ConnectorAnchors {
    left: AnchorPoint[];
    right: AnchorPoint[];
}

const COLOR_PALETTE: WireColor[] = [
    { id: "red", label: "rouge", hex: "#ef4444", endpointClass: "bg-red-500" },
    { id: "cyan", label: "cyan", hex: "#06b6d4", endpointClass: "bg-cyan-500" },
    { id: "amber", label: "ambre", hex: "#f59e0b", endpointClass: "bg-amber-500" },
    { id: "green", label: "vert", hex: "#22c55e", endpointClass: "bg-green-500" },
    { id: "purple", label: "violet", hex: "#a855f7", endpointClass: "bg-violet-500" },
    { id: "white", label: "blanc", hex: "#f8fafc", endpointClass: "bg-slate-100" },
];

function shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function getRowY(index: number, total: number): number {
    if (total <= 1) return (TOP_Y + BOTTOM_Y) / 2;
    const gap = (BOTTOM_Y - TOP_Y) / (total - 1);
    return TOP_Y + index * gap;
}

function createRound(duration: QuestDuration) {
    const wireCount = WIRES_COUNT_BY_DURATION[duration];
    const selected = shuffle(COLOR_PALETTE).slice(0, wireCount);
    return {
        left: shuffle(selected),
        right: shuffle(selected),
    };
}

interface QuestWiresProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

export function QuestWires({ duration, onSuccess, onError }: QuestWiresProps) {
    const t = useTranslations();
    const [round, setRound] = useState(() => createRound(duration));
    const [connections, setConnections] = useState<Record<number, number>>({});
    const [dragging, setDragging] = useState<DragState | null>(null);
    const [showFailed, setShowFailed] = useState(false);
    const [anchors, setAnchors] = useState<ConnectorAnchors>({ left: [], right: [] });
    const anchorsRef = useRef<ConnectorAnchors>({ left: [], right: [] });
    const boardRef = useRef<HTMLDivElement | null>(null);
    const leftConnectorRefs = useRef<Array<HTMLElement | null>>([]);
    const rightConnectorRefs = useRef<Array<HTMLElement | null>>([]);

    const totalWires = WIRES_COUNT_BY_DURATION[duration];
    const connectedCount = Object.keys(connections).length;

    const getFallbackLeftAnchor = useCallback((index: number): AnchorPoint => ({
        x: LEFT_X,
        y: getRowY(index, totalWires),
    }), [totalWires]);

    const getFallbackRightAnchor = useCallback((index: number): AnchorPoint => ({
        x: RIGHT_X,
        y: getRowY(index, totalWires),
    }), [totalWires]);

    const getLeftAnchor = useCallback((index: number): AnchorPoint => {
        return anchorsRef.current.left[index] ?? anchors.left[index] ?? getFallbackLeftAnchor(index);
    }, [anchors.left, getFallbackLeftAnchor]);

    const getRightAnchor = useCallback((index: number): AnchorPoint => {
        return anchorsRef.current.right[index] ?? anchors.right[index] ?? getFallbackRightAnchor(index);
    }, [anchors.right, getFallbackRightAnchor]);

    const measureAnchors = useCallback(() => {
        const board = boardRef.current;
        if (!board) return;

        const boardRect = board.getBoundingClientRect();
        if (!boardRect.width || !boardRect.height) return;

        const toViewBoxX = (clientX: number) => ((clientX - boardRect.left) / boardRect.width) * VIEWBOX_WIDTH;
        const toViewBoxY = (clientY: number) => ((clientY - boardRect.top) / boardRect.height) * VIEWBOX_HEIGHT;

        const nextLeft: AnchorPoint[] = [];
        const nextRight: AnchorPoint[] = [];

        for (let index = 0; index < totalWires; index++) {
            const leftConnector = leftConnectorRefs.current[index];
            const rightConnector = rightConnectorRefs.current[index];

            if (leftConnector) {
                const rect = leftConnector.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    nextLeft[index] = {
                        x: toViewBoxX((rect.left + rect.right) / 2),
                        y: toViewBoxY((rect.top + rect.bottom) / 2),
                    };
                } else {
                    nextLeft[index] = getFallbackLeftAnchor(index);
                }
            } else {
                nextLeft[index] = getFallbackLeftAnchor(index);
            }

            if (rightConnector) {
                const rect = rightConnector.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                    nextRight[index] = {
                        x: toViewBoxX((rect.left + rect.right) / 2),
                        y: toViewBoxY((rect.top + rect.bottom) / 2),
                    };
                } else {
                    nextRight[index] = getFallbackRightAnchor(index);
                }
            } else {
                nextRight[index] = getFallbackRightAnchor(index);
            }
        }

        const nextAnchors = { left: nextLeft, right: nextRight };
        anchorsRef.current = nextAnchors;
        setAnchors(nextAnchors);
    }, [totalWires, getFallbackLeftAnchor, getFallbackRightAnchor]);

    const rightToLeft = useMemo(() => {
        const used = new Map<number, number>();
        for (const [leftIndex, rightIndex] of Object.entries(connections)) {
            used.set(rightIndex, Number(leftIndex));
        }
        return used;
    }, [connections]);

    const resetRound = useCallback(() => {
        setShowFailed(false);
        setConnections({});
        setDragging(null);
        setRound(createRound(duration));
    }, [duration]);

    useEffect(() => {
        resetRound();
    }, [duration, resetRound]);

    useEffect(() => {
        const raf = requestAnimationFrame(measureAnchors);
        const onResize = () => measureAnchors();
        const onScroll = () => measureAnchors();
        const scrollOptions = { capture: true, passive: true };
        const viewportScrollOptions = { passive: true };
        const board = boardRef.current;
        const resizeObserverCtor = typeof window !== "undefined" ? window.ResizeObserver : undefined;
        const resizeObserver = resizeObserverCtor && board
            ? new resizeObserverCtor(() => measureAnchors())
            : null;

        if (resizeObserver && board) {
            resizeObserver.observe(board);
        }

        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, scrollOptions);
        window.visualViewport?.addEventListener("resize", onResize);
        window.visualViewport?.addEventListener("scroll", onScroll, viewportScrollOptions);

        return () => {
            cancelAnimationFrame(raf);
            resizeObserver?.disconnect();
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll, true);
            window.visualViewport?.removeEventListener("resize", onResize);
            window.visualViewport?.removeEventListener("scroll", onScroll);
        };
    }, [measureAnchors, round]);

    const failRound = useCallback(() => {
        if (showFailed) return;
        setDragging(null);
        setShowFailed(true);
        onError();
    }, [onError, showFailed]);

    const connectWireToRightIndex = useCallback((rightIndex: number) => {
        if (!dragging || showFailed) return;

        const leftIndex = dragging.leftIndex;
        const isRightAlreadyUsed = rightToLeft.has(rightIndex);
        const isColorMatch = round.left[leftIndex].id === round.right[rightIndex].id;

        if (isRightAlreadyUsed || !isColorMatch) {
            failRound();
            return;
        }

        const nextConnections = { ...connections, [leftIndex]: rightIndex };
        setConnections(nextConnections);
        setDragging(null);

        if (Object.keys(nextConnections).length === totalWires) {
            onSuccess();
        }
    }, [dragging, showFailed, rightToLeft, round.left, round.right, failRound, connections, totalWires, onSuccess]);

    const handleLeftPointerDown = useCallback((leftIndex: number) => {
        if (showFailed || connections[leftIndex] !== undefined) return;

        measureAnchors();
        const startAnchor = anchorsRef.current.left[leftIndex] ?? getLeftAnchor(leftIndex);
        setDragging({
            leftIndex,
            currentX: startAnchor.x,
            currentY: startAnchor.y,
        });
    }, [showFailed, connections, getLeftAnchor, measureAnchors]);

    const handleBoardPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!dragging || showFailed) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
        const y = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
        setDragging((prev) => prev ? { ...prev, currentX: x, currentY: y } : prev);
    }, [dragging, showFailed]);

    const handleBoardPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
        if (!dragging || showFailed) return;

        measureAnchors();

        const rect = event.currentTarget.getBoundingClientRect();
        if (rect.width && rect.height) {
            const x = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
            const y = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
            const rightAnchors = Array.from({ length: totalWires }, (_, index) =>
                anchorsRef.current.right[index] ?? getRightAnchor(index)
            );
            const rightDropThreshold = rightAnchors.length
                ? Math.min(...rightAnchors.map((point) => point.x)) - 120
                : RIGHT_DROP_X_THRESHOLD;

            if (x >= rightDropThreshold) {
                let closestRightIndex = 0;
                let closestDistance = Number.POSITIVE_INFINITY;

                for (let index = 0; index < totalWires; index++) {
                    const distance = Math.abs(y - rightAnchors[index].y);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestRightIndex = index;
                    }
                }

                const sortedY = rightAnchors.map((point) => point.y).sort((a, b) => a - b);
                const rowGaps = sortedY.slice(1).map((value, index) => value - sortedY[index]);
                const averageGap = rowGaps.length
                    ? rowGaps.reduce((sum, gap) => sum + gap, 0) / rowGaps.length
                    : VIEWBOX_HEIGHT;
                const maxDistance = Math.max(30, averageGap * 0.5);

                if (closestDistance <= maxDistance) {
                    connectWireToRightIndex(closestRightIndex);
                    return;
                }
            }
        }

        setDragging(null);
    }, [dragging, showFailed, totalWires, connectWireToRightIndex, getRightAnchor, measureAnchors]);

    const handleRightPointerUp = useCallback((rightIndex: number, event: PointerEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        connectWireToRightIndex(rightIndex);
    }, [connectWireToRightIndex]);

    const draggingStartAnchor = dragging ? getLeftAnchor(dragging.leftIndex) : null;

    return (
        <div className="space-y-4">
            <div className="text-center space-y-1">
                <p className="font-rajdhani text-sm uppercase tracking-[0.2em] text-primary/70">
                    {t("game.miniGames.wiresInstruction")}
                </p>
                <p className="font-rajdhani text-xs text-foreground/70" aria-live="polite">
                    {t("game.miniGames.wiresConnected", {
                        connected: String(connectedCount),
                        total: String(totalWires),
                    })}
                </p>
            </div>

            <div
                className="relative w-full h-[360px] sm:h-[420px] border border-primary/20 select-none touch-none overflow-hidden"
                onPointerMove={handleBoardPointerMove}
                onPointerUp={handleBoardPointerUp}
                data-testid="wires-board"
                ref={boardRef}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(90deg,#0c0f14,#161a22_45%,#0f131a)]" />
                <div
                    className="absolute inset-0 opacity-20 mix-blend-soft-light"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 8px)",
                    }}
                    data-testid="wires-texture"
                />
                <div className="absolute inset-y-0 left-[23%] w-px bg-white/15" />
                <div className="absolute inset-y-0 right-[23%] w-px bg-white/15" />

                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    aria-hidden="true"
                >
                    {Object.entries(connections).map(([leftIndexStr, rightIndex]) => {
                        const leftIndex = Number(leftIndexStr);
                        const color = round.left[leftIndex];
                        const leftAnchor = getLeftAnchor(leftIndex);
                        const rightAnchor = getRightAnchor(rightIndex);
                        return (
                            <g key={`${leftIndex}-${rightIndex}`}>
                                <line
                                    x1={leftAnchor.x}
                                    y1={leftAnchor.y}
                                    x2={rightAnchor.x}
                                    y2={rightAnchor.y}
                                    stroke="rgba(0,0,0,0.65)"
                                    strokeWidth="18"
                                    strokeLinecap="round"
                                />
                                <line
                                    x1={leftAnchor.x}
                                    y1={leftAnchor.y}
                                    x2={rightAnchor.x}
                                    y2={rightAnchor.y}
                                    stroke={color.hex}
                                    strokeWidth="13"
                                    strokeLinecap="round"
                                />
                                <line
                                    x1={leftAnchor.x}
                                    y1={leftAnchor.y - 2}
                                    x2={rightAnchor.x}
                                    y2={rightAnchor.y - 2}
                                    stroke="rgba(255,255,255,0.35)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                />
                            </g>
                        );
                    })}

                    {dragging && (
                        <g>
                            <line
                                x1={draggingStartAnchor?.x ?? LEFT_X}
                                y1={draggingStartAnchor?.y ?? getRowY(dragging.leftIndex, totalWires)}
                                x2={dragging.currentX}
                                y2={dragging.currentY}
                                stroke="rgba(0,0,0,0.65)"
                                strokeWidth="14"
                                strokeLinecap="round"
                                strokeDasharray="20 10"
                            />
                            <line
                                x1={draggingStartAnchor?.x ?? LEFT_X}
                                y1={draggingStartAnchor?.y ?? getRowY(dragging.leftIndex, totalWires)}
                                x2={dragging.currentX}
                                y2={dragging.currentY}
                                stroke={round.left[dragging.leftIndex].hex}
                                strokeWidth="10"
                                strokeLinecap="round"
                                strokeDasharray="20 10"
                            />
                            <line
                                x1={draggingStartAnchor?.x ?? LEFT_X}
                                y1={(draggingStartAnchor?.y ?? getRowY(dragging.leftIndex, totalWires)) - 1}
                                x2={dragging.currentX}
                                y2={dragging.currentY - 1}
                                stroke="rgba(255,255,255,0.4)"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeDasharray="20 10"
                            />
                        </g>
                    )}
                </svg>

                <div className="absolute inset-y-0 left-0 w-[26%] flex flex-col justify-between py-6 sm:py-8 px-3 sm:px-4">
                    {round.left.map((color, index) => {
                        const isConnected = connections[index] !== undefined;
                        const isDragging = dragging?.leftIndex === index;
                        return (
                            <button
                                key={`left-${color.id}`}
                                type="button"
                                onPointerDown={() => handleLeftPointerDown(index)}
                                className={`group h-11 sm:h-12 rounded-r-md border border-white/20 bg-zinc-900/80 flex items-center px-2 gap-2 touch-none transition-all ${
                                    isDragging ? "ring-2 ring-white/40 border-white/40" : ""
                                } ${isConnected ? "opacity-60" : "hover:bg-zinc-800/90"}`}
                                aria-label={`Fil gauche ${index + 1} couleur ${color.label}`}
                                data-wire-color={color.id}
                                data-connector="left"
                                disabled={showFailed || isConnected}
                            >
                                <span className="h-6 w-2 rounded-sm bg-gradient-to-b from-zinc-200 to-zinc-500" />
                                <span className={`inline-block w-9 sm:w-10 h-5 rounded-full border border-black/40 shadow-inner ${color.endpointClass}`} />
                                <span
                                    className="ml-auto h-4 w-4 rounded-sm bg-[#b87333] border border-[#7a3f1d]"
                                    ref={(node) => {
                                        leftConnectorRefs.current[index] = node;
                                    }}
                                    data-connector-anchor="left"
                                    data-anchor-index={index}
                                />
                            </button>
                        );
                    })}
                </div>

                <div className="absolute inset-y-0 right-0 w-[26%] flex flex-col justify-between py-6 sm:py-8 px-3 sm:px-4">
                    {round.right.map((color, index) => {
                        const isConnected = rightToLeft.has(index);
                        const isPotentialTarget =
                            dragging && !isConnected && round.left[dragging.leftIndex].id === color.id;

                        return (
                            <button
                                key={`right-${color.id}`}
                                type="button"
                                onPointerUp={(event) => handleRightPointerUp(index, event)}
                                className={`group h-11 sm:h-12 rounded-l-md border border-white/20 bg-zinc-900/80 flex items-center justify-end px-2 gap-2 touch-none transition-all ${
                                    isPotentialTarget ? "ring-2 ring-white/40 border-white/40" : ""
                                } ${isConnected ? "opacity-60" : "hover:bg-zinc-800/90"}`}
                                aria-label={`Fil droit ${index + 1} couleur ${color.label}`}
                                data-wire-color={color.id}
                                data-right-index={index}
                                data-connector="right"
                                disabled={showFailed || isConnected}
                            >
                                <span
                                    className="h-4 w-4 rounded-sm bg-[#b87333] border border-[#7a3f1d]"
                                    ref={(node) => {
                                        rightConnectorRefs.current[index] = node;
                                    }}
                                    data-connector-anchor="right"
                                    data-anchor-index={index}
                                />
                                <span className={`inline-block w-9 sm:w-10 h-5 rounded-full border border-black/40 shadow-inner ${color.endpointClass}`} />
                                <span className="h-6 w-2 rounded-sm bg-gradient-to-b from-zinc-200 to-zinc-500" />
                            </button>
                        );
                    })}
                </div>
            </div>

            <AnimatePresence>
                {showFailed && (
                    <FailedOverlay
                        onAutoExit={resetRound}
                        reducedMotion={false}
                        duration={2000}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
