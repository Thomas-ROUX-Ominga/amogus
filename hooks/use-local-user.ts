"use client";

import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

const STORAGE_KEY = "amogus_user_id";

/**
 * Hook to manage the local user's identity via localStorage.
 * Generates a persistent UUID for the user if none exists.
 * Includes hydration protection and storage error handling.
 */
export function useLocalUser() {
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Hydration guard & Error isolation
        try {
            let id = localStorage.getItem(STORAGE_KEY);

            if (!id) {
                id = uuidv4();
                localStorage.setItem(STORAGE_KEY, id);
            }

            setUserId(id);
        } catch (error) {
            console.error("[CRITICAL] Storage access failed:", error);
            // Fallback to session-only identity if localStorage is blocked
            setUserId(prev => prev || uuidv4());
        }
    }, []);

    return { userId };
}
