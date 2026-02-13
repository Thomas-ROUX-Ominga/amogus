"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Key } from "lucide-react";
import { adminLogin } from "@/lib/redis/auth-actions";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/admin/batches";
  const registered = searchParams.get("registered") === "true";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || isLoading) return;

    setIsLoading(true);
    setError("");

    try {
      const result = await adminLogin(username.trim(), password.trim());
      
      if (result.success) {
        router.push(redirect);
        router.refresh();
      } else {
        setError(result.error || "Access denied");
      }
    } catch {
      setError("Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5 animate-pulse">
            <Lock className="text-primary w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              Admin Access
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed px-4">
              Secure authentication required for administrative systems.
              Verify credentials to establish secure connection.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/0 rounded-sm opacity-20 group-focus-within:opacity-100 transition duration-500 blur-sm"></div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="USERNAME..."
                autoComplete="username"
                className="relative w-full bg-black/80 border border-primary/30 p-4 font-mono text-center text-xl tracking-widest text-foreground placeholder:text-primary/20 focus:outline-none focus:border-primary transition-all rounded-sm uppercase"
              />
            </div>

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/0 rounded-sm opacity-20 group-focus-within:opacity-100 transition duration-500 blur-sm"></div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PASSWORD..."
                autoComplete="current-password"
                className="relative w-full bg-black/80 border border-primary/30 p-4 font-mono text-center text-xl tracking-widest text-foreground placeholder:text-primary/20 focus:outline-none focus:border-primary transition-all rounded-sm uppercase"
              />
            </div>
          </div>

          {registered && (
            <div className="bg-green-500/10 border border-green-500/20 p-3 text-[10px] text-green-500 uppercase tracking-widest text-center">
              [ACCOUNT CREATED] You can now log in with your credentials
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 text-[10px] text-destructive uppercase tracking-widest text-center animate-shake">
              [ACCESS DENIED] {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!username.trim() || !password.trim() || isLoading}
            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-black py-4 rounded-sm transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="relative flex items-center gap-2 tracking-[0.3em] uppercase text-sm">
              {isLoading ? "AUTHENTICATING..." : "SECURE LOGIN"}
              {!isLoading && <Key size={18} />}
            </span>
          </button>
        </form>

        <div className="pt-8 border-t border-primary/10 flex justify-between items-center opacity-30">
          <div className="text-[8px] font-mono tracking-tighter uppercase">
            Auth_Type: ADMIN_ONLY
          </div>
          <div className="text-[8px] font-mono tracking-tighter uppercase">
            Sec_Level: MAXIMUM
          </div>
        </div>
      </div>
    </div>
  );
}
