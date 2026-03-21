"use client";

import { AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import {
    Handle,
    Position,
    ReactFlow,
    ReactFlowProvider,
    type Edge,
    type Node,
    type NodeProps,
    useUpdateNodeInternals,
} from "reactflow";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type TouchEvent as ReactTouchEvent,
} from "react";
import { FailedOverlay } from "@/components/game/failed-overlay";
import { WIRES_COUNT_BY_DURATION } from "@/lib/mini-games";
import { QuestDuration } from "@/types/quest";

const DEFAULT_BOARD_WIDTH = 1000;
const DEFAULT_BOARD_HEIGHT = 600;
const MIN_SNAP_DISTANCE = 26;
const MAX_SNAP_DISTANCE = 84;
const MOUSE_FALLBACK_POINTER_ID = -1;

type DragInput = "pointer" | "mouse" | "touch";

interface WireColor {
    id: string;
    label: string;
    hex: string;
    endpointClass: string;
}

interface BoardSize {
    width: number;
    height: number;
}

interface BoardLayout {
    leftX: number;
    rightX: number;
    nodeWidth: number;
    nodeHeight: number;
    rowCenters: number[];
}

interface DragState {
    leftIndex: number;
    input: DragInput;
    pointerId: number;
    currentX: number;
    currentY: number;
}

interface ConnectorPoint {
    x: number;
    y: number;
}

interface PointerLikeEvent {
    pointerId: number;
    clientX: number;
    clientY: number;
    target: unknown;
    preventDefault: () => void;
    stopPropagation: () => void;
    cancelable?: boolean;
}

interface MouseLikeEvent {
    button: number;
    clientX: number;
    clientY: number;
    target: unknown;
    preventDefault: () => void;
    stopPropagation: () => void;
    cancelable?: boolean;
}

interface TouchPointLike {
    identifier: number;
    clientX: number;
    clientY: number;
}

interface TouchLikeEvent {
    touches: ArrayLike<TouchPointLike>;
    changedTouches: ArrayLike<TouchPointLike>;
    target: unknown;
    preventDefault: () => void;
    stopPropagation: () => void;
    cancelable?: boolean;
}

interface ClosestCapableTarget {
    closest: (selector: string) => unknown;
}

function isClosestCapableTarget(target: unknown): target is ClosestCapableTarget {
    if (!target || typeof target !== "object") return false;
    if (!("closest" in target)) return false;
    return typeof (target as { closest?: unknown }).closest === "function";
}

interface QuestWiresProps {
    duration: QuestDuration;
    onSuccess: () => void;
    onError: () => void;
}

interface WireSocketNodeData {
    side: "left" | "right";
    index: number;
    color: WireColor;
    isConnected: boolean;
    isSelected: boolean;
    isPotentialTarget: boolean;
    showFailed: boolean;
    width: number;
    height: number;
    onLeftTap: (index: number) => void;
    onRightTap: (index: number) => void;
    onLeftPointerDown: (index: number, event: ReactPointerEvent<HTMLButtonElement>) => void;
    onLeftMouseDown: (index: number, event: ReactMouseEvent<HTMLButtonElement>) => void;
    onLeftTouchStart: (index: number, event: ReactTouchEvent<HTMLButtonElement>) => void;
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
    for (let index = copy.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function createRound(duration: QuestDuration) {
    const wireCount = WIRES_COUNT_BY_DURATION[duration];
    const selected = shuffle(COLOR_PALETTE).slice(0, wireCount);

    return {
        left: shuffle(selected),
        right: shuffle(selected),
    };
}

function computeLayout(totalWires: number, boardWidth: number, boardHeight: number): BoardLayout {
    const safeWidth = Math.max(boardWidth, 320);
    const safeHeight = Math.max(boardHeight, 320);

    const nodeWidth = clamp(safeWidth * 0.22, 112, 180);
    const nodeHeight = clamp(safeHeight * 0.13, 44, 56);
    const horizontalPadding = clamp(safeWidth * 0.03, 12, 28);
    const verticalPadding = clamp(safeHeight * 0.08, 18, 36);

    const leftX = horizontalPadding;
    const rightX = Math.max(horizontalPadding, safeWidth - horizontalPadding - nodeWidth);

    const minCenter = verticalPadding + nodeHeight / 2;
    const maxCenter = safeHeight - verticalPadding - nodeHeight / 2;

    let rowCenters: number[];
    if (totalWires <= 1) {
        rowCenters = [(minCenter + maxCenter) / 2];
    } else {
        const gap = (maxCenter - minCenter) / (totalWires - 1);
        rowCenters = Array.from({ length: totalWires }, (_, index) => minCenter + gap * index);
    }

    return {
        leftX,
        rightX,
        nodeWidth,
        nodeHeight,
        rowCenters,
    };
}

function toClientPoint(clientX: number, clientY: number, boardRect: DOMRect, fallbackSize: BoardSize): ConnectorPoint {
    if (!boardRect.width || !boardRect.height) {
        return {
            x: clamp(clientX, 0, fallbackSize.width),
            y: clamp(clientY, 0, fallbackSize.height),
        };
    }

    return {
        x: clamp(clientX - boardRect.left, 0, boardRect.width),
        y: clamp(clientY - boardRect.top, 0, boardRect.height),
    };
}

function createSocketStyle(side: "left" | "right", width: number, height: number): CSSProperties {
    return {
        width,
        height,
        minHeight: 44,
        touchAction: "none",
        justifyContent: side === "left" ? "flex-start" : "flex-end",
    };
}

function WireSocketNode({ data }: NodeProps<WireSocketNodeData>) {
    const safeData = data;
    if (!safeData) return null;

    const isLeft = safeData.side === "left";
    const color = safeData.color ?? COLOR_PALETTE[0];
    const index = safeData.index ?? 0;

    const handleClick = () => {
        if (isLeft) {
            safeData.onLeftTap(index);
            return;
        }

        safeData.onRightTap(index);
    };

    const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (!isLeft) return;
        safeData.onLeftPointerDown(index, event);
    };

    const handleMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
        if (!isLeft) return;
        safeData.onLeftMouseDown(index, event);
    };

    const handleTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
        if (!isLeft) return;
        safeData.onLeftTouchStart(index, event);
    };

    const buttonClassName = [
        "group nodrag nopan cursor-pointer rounded-md border border-white/20 bg-zinc-900/80 flex items-center gap-2 px-2 transition-colors",
        safeData.isSelected ? "ring-2 ring-white/40 border-white/45" : "",
        safeData.isPotentialTarget ? "ring-2 ring-primary/55 border-primary/50" : "",
        safeData.isConnected ? "opacity-65" : "hover:bg-zinc-800/90",
    ].join(" ").trim();

    return (
        <button
            type="button"
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            className={buttonClassName}
            style={createSocketStyle(safeData.side, safeData.width, safeData.height)}
            aria-label={`${isLeft ? "Fil gauche" : "Fil droit"} ${index + 1} couleur ${color.label}`}
            data-wire-color={color.id}
            data-right-index={isLeft ? undefined : index}
            data-left-index={isLeft ? String(index) : undefined}
            data-connector={safeData.side}
            disabled={safeData.showFailed || (isLeft && safeData.isConnected)}
            draggable={false}
        >
            {isLeft ? (
                <>
                    <span className="h-6 w-2 rounded-sm bg-gradient-to-b from-zinc-200 to-zinc-500" />
                    <span className={`inline-block h-5 w-9 rounded-full border border-black/40 shadow-inner ${color.endpointClass}`} />
                    <span
                        className="ml-auto h-4 w-4 rounded-sm border border-[#7a3f1d] bg-[#b87333]"
                        data-connector-anchor="left"
                        data-anchor-index={index}
                    />
                </>
            ) : (
                <>
                    <span
                        className="mr-auto h-4 w-4 rounded-sm border border-[#7a3f1d] bg-[#b87333]"
                        data-connector-anchor="right"
                        data-anchor-index={index}
                    />
                    <span className={`inline-block h-5 w-9 rounded-full border border-black/40 shadow-inner ${color.endpointClass}`} />
                    <span className="h-6 w-2 rounded-sm bg-gradient-to-b from-zinc-200 to-zinc-500" />
                </>
            )}

            <Handle
                type={isLeft ? "source" : "target"}
                id={`${safeData.side}-${index}`}
                position={isLeft ? Position.Right : Position.Left}
                style={isLeft
                    ? {
                        width: 24,
                        height: 24,
                        right: -12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        opacity: 0,
                        pointerEvents: "none",
                    }
                    : {
                        width: 24,
                        height: 24,
                        left: -12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        opacity: 0,
                        pointerEvents: "none",
                    }}
                data-handle-side={safeData.side}
                data-handle-index={index}
            />
        </button>
    );
}

const NODE_TYPES = {
    wireSocket: WireSocketNode,
};

function QuestWiresScene({ duration, onSuccess, onError }: QuestWiresProps) {
    const t = useTranslations();
    const boardRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef<DragState | null>(null);
    const boardSizeRef = useRef<BoardSize>({
        width: DEFAULT_BOARD_WIDTH,
        height: DEFAULT_BOARD_HEIGHT,
    });
    const showFailedRef = useRef(false);
    const dragCaptureRef = useRef<{ pointerId: number; element: HTMLElement } | null>(null);
    const updateNodeInternals = useUpdateNodeInternals();

    const [round, setRound] = useState(() => createRound(duration));
    const [connections, setConnections] = useState<Record<number, number>>({});
    const [selectedLeftIndex, setSelectedLeftIndex] = useState<number | null>(null);
    const [dragging, setDragging] = useState<DragState | null>(null);
    const [showFailed, setShowFailed] = useState(false);
    const [boardSize, setBoardSize] = useState<BoardSize>({
        width: DEFAULT_BOARD_WIDTH,
        height: DEFAULT_BOARD_HEIGHT,
    });

    useEffect(() => {
        draggingRef.current = dragging;
    }, [dragging]);

    useEffect(() => {
        boardSizeRef.current = boardSize;
    }, [boardSize]);

    useEffect(() => {
        showFailedRef.current = showFailed;
    }, [showFailed]);

    const totalWires = WIRES_COUNT_BY_DURATION[duration];
    const connectedCount = Object.keys(connections).length;

    const rightToLeft = useMemo(() => {
        const map = new Map<number, number>();
        for (const [leftIndex, rightIndex] of Object.entries(connections)) {
            map.set(rightIndex, Number(leftIndex));
        }
        return map;
    }, [connections]);

    const layout = useMemo(
        () => computeLayout(totalWires, boardSize.width, boardSize.height),
        [totalWires, boardSize.width, boardSize.height]
    );
    const nodeTypes = useMemo(() => NODE_TYPES, []);

    const measureBoard = useCallback(() => {
        const board = boardRef.current;
        if (!board) return;

        const rect = board.getBoundingClientRect();
        const width = rect.width || DEFAULT_BOARD_WIDTH;
        const height = rect.height || DEFAULT_BOARD_HEIGHT;

        setBoardSize((prev) => {
            if (Math.abs(prev.width - width) < 0.5 && Math.abs(prev.height - height) < 0.5) {
                return prev;
            }

            return { width, height };
        });
    }, []);

    useEffect(() => {
        const board = boardRef.current;
        const raf = requestAnimationFrame(measureBoard);

        const onResize = () => measureBoard();
        const onScroll = () => measureBoard();

        const resizeObserverCtor = typeof window !== "undefined" ? window.ResizeObserver : undefined;
        const resizeObserver = resizeObserverCtor && board
            ? new resizeObserverCtor(() => measureBoard())
            : null;

        if (resizeObserver && board) {
            resizeObserver.observe(board);
        }

        window.addEventListener("resize", onResize);
        window.addEventListener("scroll", onScroll, { capture: true, passive: true });
        window.visualViewport?.addEventListener("resize", onResize);
        window.visualViewport?.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            cancelAnimationFrame(raf);
            resizeObserver?.disconnect();
            window.removeEventListener("resize", onResize);
            window.removeEventListener("scroll", onScroll, true);
            window.visualViewport?.removeEventListener("resize", onResize);
            window.visualViewport?.removeEventListener("scroll", onScroll);
        };
    }, [measureBoard]);

    const releasePointerCapture = useCallback((pointerId?: number) => {
        const captured = dragCaptureRef.current;
        if (!captured) return;
        if (pointerId !== undefined && captured.pointerId !== pointerId) return;

        try {
            if (captured.element.hasPointerCapture(captured.pointerId)) {
                captured.element.releasePointerCapture(captured.pointerId);
            }
        } catch {
            // Ignore browsers that throw when capture has already been released.
            dragCaptureRef.current = null;
        }

        dragCaptureRef.current = null;
    }, []);

    const clearDragging = useCallback((pointerId?: number) => {
        releasePointerCapture(pointerId);
        draggingRef.current = null;
        setDragging(null);
    }, [releasePointerCapture]);

    const failRound = useCallback(() => {
        if (showFailedRef.current) return;
        clearDragging();
        setSelectedLeftIndex(null);
        setShowFailed(true);
        onError();
    }, [onError, clearDragging]);

    const resetRound = useCallback(() => {
        setConnections({});
        clearDragging();
        setSelectedLeftIndex(null);
        setShowFailed(false);
        setRound(createRound(duration));
    }, [clearDragging, duration]);

    useEffect(() => {
        resetRound();
    }, [duration, resetRound]);

    const connectLeftToRight = useCallback((leftIndex: number, rightIndex: number): boolean => {
        if (showFailed) return false;

        const leftColorId = round.left[leftIndex]?.id;
        const rightColorId = round.right[rightIndex]?.id;

        if (!leftColorId || !rightColorId) {
            clearDragging();
            return false;
        }

        if (leftColorId !== rightColorId) {
            failRound();
            return false;
        }

        if (connections[leftIndex] !== undefined) {
            clearDragging();
            setSelectedLeftIndex(null);
            return false;
        }

        if (rightToLeft.has(rightIndex)) {
            clearDragging();
            setSelectedLeftIndex(null);
            failRound();
            return false;
        }

        const nextConnections = { ...connections, [leftIndex]: rightIndex };
        setConnections(nextConnections);
        clearDragging();
        setSelectedLeftIndex(null);

        if (Object.keys(nextConnections).length === totalWires) {
            onSuccess();
        }

        return true;
    }, [showFailed, round.left, round.right, connections, rightToLeft, totalWires, onSuccess, failRound, clearDragging]);

    const getSnapDistanceThreshold = useCallback(() => {
        if (layout.rowCenters.length < 2) {
            return MIN_SNAP_DISTANCE;
        }

        const gaps = layout.rowCenters
            .slice(1)
            .map((center, index) => center - layout.rowCenters[index]);

        const averageGap = gaps.reduce((sum, value) => sum + value, 0) / gaps.length;
        return clamp(averageGap * 0.5, MIN_SNAP_DISTANCE, MAX_SNAP_DISTANCE);
    }, [layout.rowCenters]);

    const maybeSnapToRightTarget = useCallback((leftIndex: number, point: ConnectorPoint) => {
        if (!layout.rowCenters.length) {
            clearDragging();
            return;
        }

        const rightDropXThreshold = layout.rightX - layout.nodeWidth * 0.45;
        if (point.x < rightDropXThreshold) {
            clearDragging();
            return;
        }

        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (let index = 0; index < layout.rowCenters.length; index++) {
            const distance = Math.abs(point.y - layout.rowCenters[index]);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        }

        if (closestDistance <= getSnapDistanceThreshold()) {
            connectLeftToRight(leftIndex, closestIndex);
            return;
        }

        clearDragging();
    }, [connectLeftToRight, getSnapDistanceThreshold, layout.rowCenters, layout.rightX, layout.nodeWidth, clearDragging]);

    const onLeftTap = useCallback((leftIndex: number) => {
        if (showFailed || connections[leftIndex] !== undefined) return;
        setSelectedLeftIndex(leftIndex);
    }, [showFailed, connections]);

    const onRightTap = useCallback((rightIndex: number) => {
        if (showFailed || selectedLeftIndex === null) return;
        connectLeftToRight(selectedLeftIndex, rightIndex);
    }, [showFailed, selectedLeftIndex, connectLeftToRight]);

    const startDrag = useCallback((leftIndex: number, input: DragInput, pointerId: number, clientX: number, clientY: number) => {
        if (draggingRef.current) return false;
        if (showFailed || connections[leftIndex] !== undefined) return false;

        const board = boardRef.current;
        if (!board) return false;

        const boardRect = board.getBoundingClientRect();
        const point = toClientPoint(clientX, clientY, boardRect, boardSizeRef.current);

        const nextDragging: DragState = {
            leftIndex,
            input,
            pointerId,
            currentX: point.x,
            currentY: point.y,
        };

        setSelectedLeftIndex(leftIndex);
        setDragging(nextDragging);
        draggingRef.current = nextDragging;
        return true;
    }, [showFailed, connections]);

    const onLeftPointerDown = useCallback((leftIndex: number, event: ReactPointerEvent<HTMLButtonElement>) => {
        const started = startDrag(leftIndex, "pointer", event.pointerId, event.clientX, event.clientY);
        if (!started) return;

        try {
            event.currentTarget.setPointerCapture(event.pointerId);
            dragCaptureRef.current = {
                pointerId: event.pointerId,
                element: event.currentTarget,
            };
        } catch {
            dragCaptureRef.current = null;
        }

        event.preventDefault();
        event.stopPropagation();
    }, [startDrag]);

    const onLeftMouseDown = useCallback((leftIndex: number, event: ReactMouseEvent<HTMLButtonElement>) => {
        if (event.button !== 0) return;
        if (draggingRef.current) return;

        const started = startDrag(leftIndex, "mouse", MOUSE_FALLBACK_POINTER_ID, event.clientX, event.clientY);
        if (!started) return;

        event.preventDefault();
        event.stopPropagation();
    }, [startDrag]);

    const onLeftTouchStart = useCallback((leftIndex: number, event: ReactTouchEvent<HTMLButtonElement>) => {
        if (draggingRef.current) return;

        const touch = event.changedTouches[0] ?? event.touches[0];
        if (!touch) return;

        const started = startDrag(leftIndex, "touch", touch.identifier, touch.clientX, touch.clientY);
        if (!started) return;

        event.preventDefault();
        event.stopPropagation();
    }, [startDrag]);

    const getLeftIndexFromEventTarget = useCallback((target: unknown): number | null => {
        if (!isClosestCapableTarget(target)) return null;

        const button = target.closest("button[data-connector='left'][data-left-index]");
        if (button instanceof HTMLButtonElement) {
            if (button.disabled) return null;
            const leftIndex = Number(button.dataset.leftIndex);
            return Number.isFinite(leftIndex) ? leftIndex : null;
        }

        const handle = target.closest("[data-handle-side='left'][data-handle-index]");
        if (handle instanceof HTMLElement) {
            const leftIndex = Number(handle.dataset.handleIndex);
            return Number.isFinite(leftIndex) ? leftIndex : null;
        }

        const node = target.closest(".react-flow__node[data-id^='left-']");
        if (node instanceof HTMLElement) {
            const nodeId = node.getAttribute("data-id");
            if (!nodeId) return null;
            const match = /^left-(\d+)$/.exec(nodeId);
            if (!match) return null;
            const leftIndex = Number(match[1]);
            return Number.isFinite(leftIndex) ? leftIndex : null;
        }

        return null;
    }, []);

    const getLeftIndexFromPoint = useCallback((point: ConnectorPoint): number | null => {
        const horizontalPadding = Math.max(layout.nodeWidth * 0.12, 16);
        const minX = layout.leftX - horizontalPadding;
        const maxX = layout.leftX + layout.nodeWidth + horizontalPadding;
        if (point.x < minX || point.x > maxX) return null;

        const verticalThreshold = Math.max(layout.nodeHeight * 0.68, 26);
        let closestIndex: number | null = null;
        let closestDistance = Number.POSITIVE_INFINITY;

        for (let index = 0; index < layout.rowCenters.length; index++) {
            const distance = Math.abs(point.y - layout.rowCenters[index]);
            if (distance <= verticalThreshold && distance < closestDistance) {
                closestDistance = distance;
                closestIndex = index;
            }
        }

        return closestIndex;
    }, [layout.leftX, layout.nodeHeight, layout.nodeWidth, layout.rowCenters]);

    const startDragFromTarget = useCallback((
        input: DragInput,
        pointerId: number,
        clientX: number,
        clientY: number,
        target: unknown
    ): boolean => {
        let leftIndex = getLeftIndexFromEventTarget(target);
        const board = boardRef.current;

        if (leftIndex === null && board) {
            const point = toClientPoint(clientX, clientY, board.getBoundingClientRect(), boardSizeRef.current);
            leftIndex = getLeftIndexFromPoint(point);
        }

        if (leftIndex === null) {
            return false;
        }

        return startDrag(leftIndex, input, pointerId, clientX, clientY);
    }, [getLeftIndexFromEventTarget, getLeftIndexFromPoint, startDrag]);

    const onBoardPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const started = startDragFromTarget(
            "pointer",
            event.pointerId,
            event.clientX,
            event.clientY,
            event.target
        );
        if (!started) return;

        const board = boardRef.current;
        if (board) {
            try {
                board.setPointerCapture(event.pointerId);
                dragCaptureRef.current = {
                    pointerId: event.pointerId,
                    element: board,
                };
            } catch {
                dragCaptureRef.current = null;
            }
        }

        event.preventDefault();
        event.stopPropagation();
    }, [startDragFromTarget]);

    const onBoardMouseDownCapture = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.button !== 0 || draggingRef.current) return;

        const started = startDragFromTarget(
            "mouse",
            MOUSE_FALLBACK_POINTER_ID,
            event.clientX,
            event.clientY,
            event.target
        );
        if (!started) return;

        event.preventDefault();
        event.stopPropagation();
    }, [startDragFromTarget]);

    const onBoardTouchStartCapture = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
        if (draggingRef.current) return;

        const touch = event.changedTouches[0] ?? event.touches[0];
        if (!touch) return;

        const started = startDragFromTarget(
            "touch",
            touch.identifier,
            touch.clientX,
            touch.clientY,
            event.target
        );
        if (!started) return;

        event.preventDefault();
        event.stopPropagation();
    }, [startDragFromTarget]);

    useEffect(() => {
        const board = boardRef.current;
        if (!board) return;

        const onNativePointerDownCapture = (event: PointerLikeEvent) => {
            const started = startDragFromTarget(
                "pointer",
                event.pointerId,
                event.clientX,
                event.clientY,
                event.target
            );
            if (!started) return;

            try {
                board.setPointerCapture(event.pointerId);
                dragCaptureRef.current = {
                    pointerId: event.pointerId,
                    element: board,
                };
            } catch {
                dragCaptureRef.current = null;
            }

            event.preventDefault();
            event.stopPropagation();
        };

        const onNativeMouseDownCapture = (event: MouseLikeEvent) => {
            if (event.button !== 0 || draggingRef.current) return;

            const started = startDragFromTarget(
                "mouse",
                MOUSE_FALLBACK_POINTER_ID,
                event.clientX,
                event.clientY,
                event.target
            );
            if (!started) return;

            event.preventDefault();
            event.stopPropagation();
        };

        const onNativeTouchStartCapture = (event: TouchLikeEvent) => {
            if (draggingRef.current) return;

            const touch = event.changedTouches[0] ?? event.touches[0];
            if (!touch) return;

            const started = startDragFromTarget(
                "touch",
                touch.identifier,
                touch.clientX,
                touch.clientY,
                event.target
            );
            if (!started) return;

            if (event.cancelable) {
                event.preventDefault();
            }
            event.stopPropagation();
        };

        board.addEventListener("pointerdown", onNativePointerDownCapture, true);
        board.addEventListener("mousedown", onNativeMouseDownCapture, true);
        board.addEventListener("touchstart", onNativeTouchStartCapture, { capture: true, passive: false });

        return () => {
            board.removeEventListener("pointerdown", onNativePointerDownCapture, true);
            board.removeEventListener("mousedown", onNativeMouseDownCapture, true);
            board.removeEventListener("touchstart", onNativeTouchStartCapture, true);
        };
    }, [startDragFromTarget]);

    const handleWindowPointerMove = useCallback((event: PointerLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "pointer" || showFailedRef.current || event.pointerId !== activeDrag.pointerId) return;

        const board = boardRef.current;
        if (!board) return;

        const point = toClientPoint(event.clientX, event.clientY, board.getBoundingClientRect(), boardSizeRef.current);
        setDragging((prev) => {
            if (!prev || prev.input !== "pointer" || prev.pointerId !== event.pointerId) return prev;

            const next = {
                ...prev,
                currentX: point.x,
                currentY: point.y,
            };
            draggingRef.current = next;
            return next;
        });
    }, []);

    const handleWindowPointerUp = useCallback((event: PointerLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "pointer" || showFailedRef.current || event.pointerId !== activeDrag.pointerId) return;

        const board = boardRef.current;
        if (!board) {
            clearDragging(event.pointerId);
            return;
        }

        const point = toClientPoint(event.clientX, event.clientY, board.getBoundingClientRect(), boardSizeRef.current);
        releasePointerCapture(event.pointerId);
        maybeSnapToRightTarget(activeDrag.leftIndex, point);
    }, [clearDragging, maybeSnapToRightTarget, releasePointerCapture]);

    const handleWindowPointerCancel = useCallback((event: PointerLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "pointer" || event.pointerId !== activeDrag.pointerId) return;
        clearDragging(event.pointerId);
    }, [clearDragging]);

    const handleWindowMouseMove = useCallback((event: MouseLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "mouse" || showFailedRef.current) return;

        const board = boardRef.current;
        if (!board) return;

        const point = toClientPoint(event.clientX, event.clientY, board.getBoundingClientRect(), boardSizeRef.current);
        setDragging((prev) => {
            if (!prev || prev.input !== "mouse") return prev;

            const next = {
                ...prev,
                currentX: point.x,
                currentY: point.y,
            };
            draggingRef.current = next;
            return next;
        });
    }, []);

    const handleWindowMouseUp = useCallback((event: MouseLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "mouse" || showFailedRef.current) return;

        const board = boardRef.current;
        if (!board) {
            clearDragging();
            return;
        }

        const point = toClientPoint(event.clientX, event.clientY, board.getBoundingClientRect(), boardSizeRef.current);
        maybeSnapToRightTarget(activeDrag.leftIndex, point);
    }, [clearDragging, maybeSnapToRightTarget]);

    const handleWindowTouchMove = useCallback((event: TouchLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "touch" || showFailedRef.current) return;

        const touch = Array.from(event.touches).find((item) => item.identifier === activeDrag.pointerId);
        if (!touch) return;

        if (event.cancelable) {
            event.preventDefault();
        }

        const board = boardRef.current;
        if (!board) return;

        const point = toClientPoint(touch.clientX, touch.clientY, board.getBoundingClientRect(), boardSizeRef.current);
        setDragging((prev) => {
            if (!prev || prev.input !== "touch" || prev.pointerId !== activeDrag.pointerId) return prev;

            const next = {
                ...prev,
                currentX: point.x,
                currentY: point.y,
            };
            draggingRef.current = next;
            return next;
        });
    }, []);

    const handleWindowTouchEnd = useCallback((event: TouchLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "touch" || showFailedRef.current) return;

        const endedTouch = Array.from(event.changedTouches).find((item) => item.identifier === activeDrag.pointerId);
        if (!endedTouch) return;

        if (event.cancelable) {
            event.preventDefault();
        }

        const board = boardRef.current;
        if (!board) {
            clearDragging();
            return;
        }

        const point = toClientPoint(endedTouch.clientX, endedTouch.clientY, board.getBoundingClientRect(), boardSizeRef.current);
        maybeSnapToRightTarget(activeDrag.leftIndex, point);
    }, [clearDragging, maybeSnapToRightTarget]);

    const handleWindowTouchCancel = useCallback((event: TouchLikeEvent) => {
        const activeDrag = draggingRef.current;
        if (!activeDrag || activeDrag.input !== "touch") return;

        const canceledTouch = Array.from(event.changedTouches).find((item) => item.identifier === activeDrag.pointerId);
        if (!canceledTouch) return;

        clearDragging();
    }, [clearDragging]);

    useEffect(() => {
        window.addEventListener("pointermove", handleWindowPointerMove, true);
        window.addEventListener("pointerup", handleWindowPointerUp, true);
        window.addEventListener("pointercancel", handleWindowPointerCancel, true);
        window.addEventListener("mousemove", handleWindowMouseMove, true);
        window.addEventListener("mouseup", handleWindowMouseUp, true);
        window.addEventListener("touchmove", handleWindowTouchMove, { capture: true, passive: false });
        window.addEventListener("touchend", handleWindowTouchEnd, true);
        window.addEventListener("touchcancel", handleWindowTouchCancel, true);

        return () => {
            window.removeEventListener("pointermove", handleWindowPointerMove, true);
            window.removeEventListener("pointerup", handleWindowPointerUp, true);
            window.removeEventListener("pointercancel", handleWindowPointerCancel, true);
            window.removeEventListener("mousemove", handleWindowMouseMove, true);
            window.removeEventListener("mouseup", handleWindowMouseUp, true);
            window.removeEventListener("touchmove", handleWindowTouchMove, true);
            window.removeEventListener("touchend", handleWindowTouchEnd, true);
            window.removeEventListener("touchcancel", handleWindowTouchCancel, true);
        };
    }, [
        handleWindowMouseMove,
        handleWindowMouseUp,
        handleWindowPointerCancel,
        handleWindowPointerMove,
        handleWindowPointerUp,
        handleWindowTouchCancel,
        handleWindowTouchEnd,
        handleWindowTouchMove,
    ]);

    const activeLeftIndex = dragging?.leftIndex ?? selectedLeftIndex;
    const activeColorId = activeLeftIndex !== null ? (round.left[activeLeftIndex]?.id ?? null) : null;
    const previewColor = dragging ? (round.left[dragging.leftIndex]?.hex ?? "#ffffff") : "#ffffff";
    const previewSourceX = dragging ? layout.leftX + layout.nodeWidth : 0;
    const previewSourceY = dragging
        ? (layout.rowCenters[dragging.leftIndex] ?? boardSize.height / 2)
        : 0;

    const nodes = useMemo<Array<Node<WireSocketNodeData>>>(() => {
        const nextNodes: Array<Node<WireSocketNodeData>> = [];

        for (let index = 0; index < totalWires; index++) {
            const centerY = layout.rowCenters[index] ?? layout.rowCenters[layout.rowCenters.length - 1] ?? boardSize.height / 2;
            const top = centerY - layout.nodeHeight / 2;

            const leftColor = round.left[index] ?? COLOR_PALETTE[index % COLOR_PALETTE.length];
            const rightColor = round.right[index] ?? COLOR_PALETTE[(index + 1) % COLOR_PALETTE.length];

            nextNodes.push({
                id: `left-${index}`,
                type: "wireSocket",
                draggable: false,
                selectable: false,
                position: {
                    x: layout.leftX,
                    y: top,
                },
                data: {
                    side: "left",
                    index,
                    color: leftColor,
                    isConnected: connections[index] !== undefined,
                    isSelected: activeLeftIndex === index,
                    isPotentialTarget: false,
                    showFailed,
                    width: layout.nodeWidth,
                    height: layout.nodeHeight,
                    onLeftTap,
                    onRightTap,
                    onLeftPointerDown,
                    onLeftMouseDown,
                    onLeftTouchStart,
                },
            });

            nextNodes.push({
                id: `right-${index}`,
                type: "wireSocket",
                draggable: false,
                selectable: false,
                position: {
                    x: layout.rightX,
                    y: top,
                },
                data: {
                    side: "right",
                    index,
                    color: rightColor,
                    isConnected: rightToLeft.has(index),
                    isSelected: false,
                    isPotentialTarget:
                        !!activeColorId &&
                        !rightToLeft.has(index) &&
                        rightColor.id === activeColorId,
                    showFailed,
                    width: layout.nodeWidth,
                    height: layout.nodeHeight,
                    onLeftTap,
                    onRightTap,
                    onLeftPointerDown,
                    onLeftMouseDown,
                    onLeftTouchStart,
                },
            });
        }

        return nextNodes;
    }, [
        activeColorId,
        activeLeftIndex,
        boardSize.height,
        connections,
        dragging,
        layout.leftX,
        layout.nodeHeight,
        layout.nodeWidth,
        layout.rightX,
        layout.rowCenters,
        onLeftMouseDown,
        onLeftPointerDown,
        onLeftTap,
        onLeftTouchStart,
        onRightTap,
        rightToLeft,
        round.left,
        round.right,
        showFailed,
        totalWires,
    ]);

    const edges = useMemo<Array<Edge>>(() => {
        const nextEdges: Array<Edge> = [];

        for (const [leftIndexRaw, rightIndex] of Object.entries(connections)) {
            const leftIndex = Number(leftIndexRaw);
            const color = round.left[leftIndex];

            nextEdges.push({
                id: `wire-${leftIndex}-${rightIndex}`,
                source: `left-${leftIndex}`,
                sourceHandle: `left-${leftIndex}`,
                target: `right-${rightIndex}`,
                targetHandle: `right-${rightIndex}`,
                type: "straight",
                style: {
                    stroke: color.hex,
                    strokeWidth: 8,
                    strokeLinecap: "round",
                },
            });
        }

        return nextEdges;
    }, [connections, round.left]);

    useEffect(() => {
        for (let index = 0; index < totalWires; index++) {
            updateNodeInternals(`left-${index}`);
            updateNodeInternals(`right-${index}`);
        }

    }, [
        dragging,
        layout.leftX,
        layout.nodeHeight,
        layout.nodeWidth,
        layout.rightX,
        layout.rowCenters,
        totalWires,
        updateNodeInternals,
    ]);

    return (
        <div className="space-y-4">
            <div className="space-y-1 text-center">
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
                className="relative h-[360px] w-full select-none touch-none overflow-hidden border border-primary/20 sm:h-[420px]"
                data-testid="wires-board"
                ref={boardRef}
                onPointerDownCapture={onBoardPointerDownCapture}
                onMouseDownCapture={onBoardMouseDownCapture}
                onTouchStartCapture={onBoardTouchStartCapture}
            >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(255,255,255,0.06),transparent_30%),linear-gradient(90deg,#0c0f14,#161a22_45%,#0f131a)]" />
                <div
                    className="absolute inset-0 mix-blend-soft-light opacity-20"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0px, rgba(255,255,255,0.08) 2px, transparent 2px, transparent 8px)",
                    }}
                    data-testid="wires-texture"
                />

                {dragging && (
                    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
                        <line
                            x1={previewSourceX}
                            y1={previewSourceY}
                            x2={dragging.currentX}
                            y2={dragging.currentY}
                            stroke={previewColor}
                            strokeWidth={3}
                            strokeDasharray="10 6"
                            strokeLinecap="round"
                        />
                    </svg>
                )}

                <ReactFlow
                    className="relative z-10 h-full w-full"
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    fitView={false}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    minZoom={1}
                    maxZoom={1}
                    panOnDrag={false}
                    panOnScroll={false}
                    zoomOnDoubleClick={false}
                    zoomOnPinch={false}
                    zoomOnScroll={false}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    nodesFocusable={false}
                    elementsSelectable={false}
                    selectionOnDrag={false}
                    proOptions={{ hideAttribution: true }}
                />
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

export function QuestWires(props: QuestWiresProps) {
    return (
        <ReactFlowProvider>
            <QuestWiresScene {...props} />
        </ReactFlowProvider>
    );
}
