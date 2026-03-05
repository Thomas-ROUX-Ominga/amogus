import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QuestSimon } from "@/components/game/mini-games/quest-simon";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", async () => {
    const actual = await vi.importActual("framer-motion");
    return {
        ...actual,
        useReducedMotion: () => true,
    };
});

describe("QuestSimon Logic", () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // Force Math.random to always pick colors in order: 0, 1, 2, 3, 0...
        let i = 0;
        vi.spyOn(Math, 'random').mockImplementation(() => {
            const val = (i % 4) / 4;
            i++;
            return val;
        });
    });

    it("should start in playing mode and transition to user mode after clicking GO", async () => {
        await act(async () => {
            render(<QuestSimon duration="short" onSuccess={onSuccess} onError={onError} />);
        });
        
        const goButton = screen.getByText(/GO/i);
        await act(async () => {
            fireEvent.click(goButton);
        });

        expect(screen.getByText(/OBSERVEZ/i)).toBeInTheDocument();
        
        // Stage 1 playback: 500 + 400 + 200 = 1100ms
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1200);
        });
        
        expect(screen.queryByText(/OBSERVEZ/i)).not.toBeInTheDocument();
        expect(screen.getByText(/À VOUS/i)).toBeInTheDocument();
    });

    it("should call Success when full sequence is correctly entered", async () => {
        await act(async () => {
            render(<QuestSimon duration="short" onSuccess={onSuccess} onError={onError} />);
        });
        
        const goButton = screen.getByText(/GO/i);
        await act(async () => { fireEvent.click(goButton); });

        const sequence = ["red", "green", "yellow", "blue"];

        for (let stage = 1; stage <= 4; stage++) {
            // Wait for playback to finish
            await act(async () => {
                await vi.advanceTimersByTimeAsync(500 + stage * 600 + 200);
            });
            expect(screen.queryByText(/OBSERVEZ/i)).not.toBeInTheDocument();

            // Click the sequence for this stage
            for (let step = 0; step < stage; step++) {
                const color = sequence[step];
                const button = screen.getByLabelText(`Bouton ${color}`);
                await act(async () => {
                    fireEvent.click(button);
                    vi.advanceTimersByTime(200); 
                });
            }
            
            if (stage < 4) {
                await act(async () => {
                    vi.advanceTimersByTime(600); // stage transition timeout
                });
            }
        }

        expect(onSuccess).toHaveBeenCalled();
    });

    it("should call Error when wrong color is clicked", async () => {
        await act(async () => {
            render(<QuestSimon duration="short" onSuccess={onSuccess} onError={onError} />);
        });
        
        const goButton = screen.getByText(/GO/i);
        await act(async () => { fireEvent.click(goButton); });

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1200);
        });
        
        const wrongColor = "green"; // First color is red
        const button = screen.getByLabelText(`Bouton ${wrongColor}`);
        await act(async () => {
            fireEvent.click(button);
        });

        expect(onError).toHaveBeenCalled();
    });
});




