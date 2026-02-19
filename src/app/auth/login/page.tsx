"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Link from "next/link";

type Mode = "magic" | "password";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
    setLoading(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setMessage("Account created! Check your email to confirm, or sign in directly if confirmation is disabled.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = "/";
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#F6F0EA" }}>
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[22px] p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">📬</div>
          <h1 className="text-xl font-bold mb-2">Check your email</h1>
          <p className="text-[#6B6B6B] text-sm mb-6">
            We sent a magic link to <strong>{email}</strong>. Click it to sign in.
          </p>
          <Link href="/" className="text-sm text-[#2DD4BF] hover:underline">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#F6F0EA" }}>
      <div className="bg-white border-2 border-[#1E1E1E] rounded-[22px] p-8 max-w-sm w-full">
        <div className="mb-6">
          <Link href="/" className="font-bold text-xl text-[#1E1E1E]">UrbnLab</Link>
        </div>

        <h1 className="text-2xl font-bold mb-4">Sign in</h1>

        {/* Mode toggle */}
        <div className="flex gap-1 border-2 border-[#1E1E1E] rounded-[14px] p-1 mb-6">
          <button
            onClick={() => { setMode("password"); setError(""); setMessage(""); }}
            className={`flex-1 text-sm py-1.5 rounded-[10px] transition-all font-medium ${
              mode === "password" ? "bg-[#1E1E1E] text-white" : "text-[#6B6B6B]"
            }`}
          >
            Email + password
          </button>
          <button
            onClick={() => { setMode("magic"); setError(""); setMessage(""); }}
            className={`flex-1 text-sm py-1.5 rounded-[10px] transition-all font-medium ${
              mode === "magic" ? "bg-[#1E1E1E] text-white" : "text-[#6B6B6B]"
            }`}
          >
            Magic link
          </button>
        </div>

        {/* Password form */}
        {mode === "password" && (
          <form onSubmit={handlePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}
            {message && <p className="text-green-600 text-sm">{message}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
            </Button>

            <p className="text-center text-sm text-[#6B6B6B]">
              {isSignUp ? "Already have an account?" : "No account yet?"}{" "}
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(""); setMessage(""); }}
                className="text-[#2DD4BF] hover:underline font-medium"
              >
                {isSignUp ? "Sign in" : "Sign up"}
              </button>
            </p>
          </form>
        )}

        {/* Magic link form */}
        {mode === "magic" && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <p className="text-[#6B6B6B] text-sm">
              We&apos;ll email you a one-click sign-in link.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full border-2 border-[#1E1E1E] rounded-[12px] px-3 py-2 text-sm outline-none focus:border-[#2DD4BF]"
              />
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
