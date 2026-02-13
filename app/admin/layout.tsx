"use client";

import { useRouter } from "next/navigation";
import { LogOut, Shield } from "lucide-react";
import { clearAdminSession } from "@/lib/redis/auth-actions";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await clearAdminSession();
      router.push("/admin/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed:", error);
      // Force redirect even if session clearing fails
      router.push("/admin/login");
    }
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Admin Header */}
      <header className="border-b border-primary/20 bg-black/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded border border-primary/30 flex items-center justify-center bg-primary/10">
                <Shield className="text-primary w-4 h-4" />
              </div>
              <h1 className="text-lg font-black uppercase tracking-[0.2em] text-primary font-orbitron">
                Admin Control
              </h1>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest text-primary/70 hover:text-primary border border-primary/30 hover:border-primary/50 transition-all rounded-sm"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
