"use client";

import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { clearSession } from "@/lib/redis/auth-actions";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await clearSession();
      router.push("/login"); // Redirect to new auth path
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-black font-mono">
      {/* Organizer Header */}
      <header className="border-b border-primary/20 bg-black/80 backdrop-blur-sm relative z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded border border-primary/30 flex items-center justify-center bg-primary/10">
                <Shield className="text-primary w-4 h-4" />
              </div>
              <h1 className="text-lg font-black uppercase tracking-[0.2em] text-primary font-orbitron">
                Organizer Control
              </h1>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary border border-primary/30 hover:border-primary/50 transition-all rounded-none"
            >
              <LogOut size={14} />
              Term_Session
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {children}
      </main>
      
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)] opacity-20" />
      </div>
    </div>
  );
}
