"use client";

import React from "react";
import { ErrorView } from "@/components/game/error-view";

interface AdminErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

interface AdminErrorBoundaryProps {
    children: React.ReactNode;
    gameId?: string;
}

export class AdminErrorBoundary extends React.Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
    constructor(props: AdminErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): AdminErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("Admin tracker error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <main className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground font-mono p-4">
                    <ErrorView
                        title="ADMIN SYSTEM FAILURE"
                        message="The admin tracker encountered a critical error. Return to game home."
                        code="ERR_ADMIN_BOUNDARY"
                        onRetry={() => {
                            if (this.props.gameId) {
                                window.location.href = `/game/${this.props.gameId}`;
                            } else {
                                window.location.href = "/";
                            }
                        }}
                    />
                </main>
            );
        }

        return this.props.children;
    }
}
