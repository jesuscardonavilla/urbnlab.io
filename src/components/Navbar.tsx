"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function init() {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      setLoading(false);

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_, session) => {
        setUser(session?.user ?? null);
      });
      unsubscribe = () => subscription.unsubscribe();
    }

    init();
    return () => unsubscribe?.();
  }, []);

  async function signOut() {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav className="w-full border-b-2 border-[#1E1E1E] bg-white">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl tracking-tight text-[#1E1E1E]">
          UrbanMaps
        </Link>
        <div className="flex items-center gap-3">
          {!loading && (
            <>
              {user ? (
                <>
                  <span className="text-sm text-[#6B6B6B] hidden sm:block truncate max-w-[180px]">
                    {user.email}
                  </span>
                  <button
                    onClick={signOut}
                    className="text-sm px-3 py-1.5 border-2 border-[#1E1E1E] rounded-[16px] hover:bg-[#F6F0EA] transition-colors cursor-pointer"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/login"
                  className="text-sm px-4 py-1.5 border-2 border-[#1E1E1E] rounded-[16px] font-medium hover:bg-[#F6F0EA] transition-colors"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
