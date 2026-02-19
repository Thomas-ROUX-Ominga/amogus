"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff, ShieldPlus } from "lucide-react";
import { register } from "@/lib/redis/auth-actions";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(username, password);

      if (result.success) {
        router.push("/login?registered=true");
      } else {
        setError(result.error || "Registration failed");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 font-mono">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Terminal Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full border-2 border-primary/30 flex items-center justify-center bg-primary/5 animate-pulse">
            <ShieldPlus className="text-primary w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              Organizer Setup
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-relaxed">
              Create a new tactical operator profile.
            </p>
          </div>
        </div>

        {/* Registration Form */}
        <div className="relative p-8 border border-primary/20 bg-black/50 backdrop-blur-md overflow-hidden">
          {/* Decorative Corner */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary/40" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary/40" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">Username_</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-black border border-primary/30 p-3 pl-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder="New_ID..."
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">Secret_Phrase_</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-black border border-primary/30 p-3 pl-10 pr-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder="Secret..."
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-tighter text-primary/60 ml-1">Confirm_Secret_</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-black border border-primary/30 p-3 pl-10 text-lg tracking-[0.1em] text-foreground focus:outline-none focus:border-primary transition-all rounded-none uppercase"
                    placeholder="Repeat..."
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 p-3 text-[10px] text-destructive uppercase tracking-widest text-center">
                [SETUP_FAILED] {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !username || !password || password !== confirmPassword}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-primary/10 disabled:text-primary/30 text-primary-foreground font-black py-4 transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              {isLoading ? "INITIALIZING..." : "REGISTER OPERATOR"}
            </button>
            
            <div className="text-center pt-2">
              <button 
                type="button"
                onClick={() => router.push("/login")}
                className="text-[10px] uppercase tracking-widest text-primary/50 hover:text-primary transition-colors"
              >
                Existing account? [Go_to_Login]
              </button>
            </div>
          </form>
        </div>

        {/* Security Notice */}
        <div className="mt-6 text-[8px] text-primary/40 font-mono border-t border-primary/10 pt-4 uppercase tracking-widest">
          <div className="mb-2 text-primary/60">[SECURITY_PROTOCOL]</div>
          <div>• Passwords are hashed and never stored in plain text</div>
          <div>• Sessions expire automatically after 24 hours</div>
          <div>• Multi-operator isolation active</div>
        </div>
      </div>
    </div>
  );
}
