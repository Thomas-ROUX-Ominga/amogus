"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Eye, EyeOff } from "lucide-react";
import { registerAdmin } from "@/lib/redis/admin-db-actions";

export default function AdminRegister() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Validation
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
      const result = await registerAdmin(username, password);

      if (result.success) {
        // Redirect to login after successful registration
        router.push("/admin/login?registered=true");
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
    <div className="min-h-screen bg-black text-green-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Terminal-style border */}
        <div className="border border-green-500 rounded-none p-6 bg-black">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] text-primary font-orbitron">
              ADMIN SETUP
            </h1>
            <div className="mt-2 text-sm text-green-400 font-mono">
              &gt; Create administrator account
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username */}
            <div>
              <label className="block text-sm font-mono mb-2 text-green-400">
                USERNAME:
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black border border-green-600 text-green-500 pl-10 pr-3 py-3 font-mono focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                  placeholder="admin_username..."
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-mono mb-2 text-green-400">
                PASSWORD:
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black border border-green-600 text-green-500 pl-10 pr-10 py-3 font-mono focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                  placeholder="secure_password..."
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 hover:text-green-400"
                  disabled={isLoading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-mono mb-2 text-green-400">
                CONFIRM PASSWORD:
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-black border border-green-600 text-green-500 pl-10 pr-10 py-3 font-mono focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                  placeholder="confirm_password..."
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-600 hover:text-green-400"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-red-500 text-sm font-mono bg-red-950 border border-red-900 p-3">
                [ERROR] {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !username || !password || password !== confirmPassword}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-green-900 disabled:cursor-not-allowed text-black font-black py-4 font-mono text-sm transition-all flex items-center justify-center gap-2 group relative overflow-hidden"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent animate-spin"></div>
                  CREATING ACCOUNT...
                </>
              ) : (
                <>
                  CREATE ADMIN ACCOUNT
                </>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 text-xs text-green-400 font-mono border-t border-green-800 pt-4">
            <div className="mb-2">[SECURITY NOTICE]</div>
            <div>• Use a strong password (8+ chars)</div>
            <div>• Store credentials securely</div>
            <div>• This account cannot be reset</div>
          </div>
        </div>
      </div>
    </div>
  );
}
