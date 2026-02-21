"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { createGame, CreateGameInput } from "@/lib/redis/actions";
import { getAllBatches } from "@/lib/redis/batch-actions";
import { BatchListItem } from "@/types/quest";

export default function CreateGamePage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [questsPerPlayer, setQuestsPerPlayer] = useState({
    short: 1,
    medium: 1,
    long: 1,
  });
  const totalQuests = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;
  const isValidTotal = totalQuests >= 3;
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load batches on component mount
  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    try {
      const response = await getAllBatches();
      if (response.success && response.data) {
        setBatches(response.data);
      }
    } catch (error) {
      console.error("Failed to load batches:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError("");
    setSuccess("");

    try {
      // Validate minimum quests per player
      const totalQuests = questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long;
      if (totalQuests < 3) {
        setError("Minimum 3 quests per player required (1 short + 1 medium + 1 long)");
        return;
      }

      const input: CreateGameInput = {
        batchId: selectedBatch || undefined,
        questsPerPlayer,
      };

      const response = await createGame(input);
      
      if (response.success && response.data) {
        setSuccess(`Game created successfully! Short code: ${response.data}`);
        // Redirect after a short delay
        setTimeout(() => {
          router.push("/admin/tracker");
        }, 2000);
      } else {
        setError(response.error || "Failed to create game");
      }
    } catch (error) {
      console.error("Failed to create game:", error);
      setError("An unexpected error occurred");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-primary/70 hover:text-primary transition-colors"
          >
            <ArrowLeft size={16} />
            <span className="text-xs uppercase tracking-widest">Back</span>
          </button>
          
          <div>
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              Create Game Session
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
              Generate a short code for players to join
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Batch Selection */}
          <div className="border border-primary/20 bg-black/30 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">
              Batch Selection (Optional)
            </h2>
            
            <div className="space-y-4">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full bg-black/50 border-2 border-primary/20 p-3 text-foreground focus:outline-none focus:border-primary transition-all"
              >
                <option value="">Select a batch (optional)</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    Batch {batch.id.substring(0, 8)}... - {batch.questCount} quests
                  </option>
                ))}
              </select>
              
              {selectedBatch && (
                <p className="text-[10px] text-primary/60">
                  Selected batch will provide quests for this game session
                </p>
              )}
            </div>
          </div>

          {/* Quest Distribution */}
          <div className="border border-primary/20 bg-black/30 p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">
              Quests Per Player
            </h2>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label htmlFor="short-quests" className="text-[10px] text-primary/60 uppercase tracking-widest block mb-2">
                  Short Quests
                </label>
                <input
                  id="short-quests"
                  type="number"
                  min="0"
                  max="10"
                  value={questsPerPlayer.short}
                  onChange={(e) => setQuestsPerPlayer(prev => ({
                    ...prev,
                    short: Math.max(0, Math.min(10, parseInt(e.target.value) || 0))
                  }))}
                  className="w-full bg-black/50 border-2 border-primary/20 p-3 text-center text-foreground focus:outline-none focus:border-primary transition-all"
                />
              </div>
              
              <div>
                <label htmlFor="medium-quests" className="text-[10px] text-primary/60 uppercase tracking-widest block mb-2">
                  Medium Quests
                </label>
                <input
                  id="medium-quests"
                  type="number"
                  min="0"
                  max="10"
                  value={questsPerPlayer.medium}
                  onChange={(e) => setQuestsPerPlayer(prev => ({
                    ...prev,
                    medium: Math.max(0, Math.min(10, parseInt(e.target.value) || 0))
                  }))}
                  className="w-full bg-black/50 border-2 border-primary/20 p-3 text-center text-foreground focus:outline-none focus:border-primary transition-all"
                />
              </div>
              
              <div>
                <label htmlFor="long-quests" className="text-[10px] text-primary/60 uppercase tracking-widest block mb-2">
                  Long Quests
                </label>
                <input
                  id="long-quests"
                  type="number"
                  min="0"
                  max="10"
                  value={questsPerPlayer.long}
                  onChange={(e) => setQuestsPerPlayer(prev => ({
                    ...prev,
                    long: Math.max(0, Math.min(10, parseInt(e.target.value) || 0))
                  }))}
                  className="w-full bg-black/50 border-2 border-primary/20 p-3 text-center text-foreground focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
            
            <p className="text-[10px] text-primary/60 mt-4">
              Total per player: {questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long} quests
              {questsPerPlayer.short + questsPerPlayer.medium + questsPerPlayer.long < 3 && (
                <span className="text-destructive block mt-1">
                  ⚠ Minimum 3 quests required
                </span>
              )}
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="border-2 border-destructive/20 bg-destructive/5 p-4">
              <p className="text-destructive text-xs uppercase tracking-widest">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="border-2 border-green-500/20 bg-green-500/5 p-4">
              <p className="text-green-400 text-xs uppercase tracking-widest">{success}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isCreating || !isValidTotal}
            className="w-full bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border-2 border-primary/30 hover:border-primary font-black py-4 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            <span className="tracking-[0.4em] uppercase text-sm">
              {isCreating ? "Creating Game..." : "Create Game Session"}
            </span>
          </button>
        </form>
      </div>
  );
}
