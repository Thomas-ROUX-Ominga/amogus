"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ErrorView } from "@/components/game/error-view";

interface AdminErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface AdminErrorBoundaryProps {
  children: React.ReactNode;
  gameId?: string;
}

interface AdminErrorBoundaryInnerProps extends AdminErrorBoundaryProps {
  fallbackTitle: string;
  fallbackMessage: string;
}

class AdminErrorBoundaryInner extends React.Component<
  AdminErrorBoundaryInnerProps,
  AdminErrorBoundaryState
> {
  constructor(props: AdminErrorBoundaryInnerProps) {
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
            title={this.props.fallbackTitle}
            message={this.props.fallbackMessage}
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

export function AdminErrorBoundary(props: AdminErrorBoundaryProps) {
  const t = useTranslations();

  return (
    <AdminErrorBoundaryInner
      {...props}
      fallbackTitle={t("admin.errorBoundary.title")}
      fallbackMessage={t("admin.errorBoundary.message")}
    />
  );
}
