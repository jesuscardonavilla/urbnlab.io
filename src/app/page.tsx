import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-block bg-[#BFF3EC] border-2 border-[#1E1E1E] rounded-full px-4 py-1 text-sm font-medium mb-6">
          B2B SaaS for cities & counties
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-4" style={{ color: "#1E1E1E" }}>
          Urban issues,<br />solved together.
        </h1>
        <p className="text-lg text-[#6B6B6B] max-w-xl mx-auto mb-8">
          UrbnLab lets residents drop map pins on real issues — broken sidewalks,
          dangerous crossings, climate stressors — and lets city admins track,
          moderate, and act on them.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/o/traverse-city"
            className="px-6 py-3 bg-[#2DD4BF] border-2 border-[#1E1E1E] rounded-[22px] font-medium text-[#1E1E1E] hover:bg-[#1E1E1E] hover:text-white transition-all"
          >
            View demo → Traverse City
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-white border-2 border-[#1E1E1E] rounded-[22px] font-medium text-[#1E1E1E] hover:bg-[#F6F0EA] transition-all"
          >
            Sign in
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-4xl mx-auto px-4 pb-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: "📍",
            title: "Geo-pinned issues",
            desc: "Residents drop pins inside your defined boundary. Only valid locations accepted.",
          },
          {
            icon: "🗳️",
            title: "Upvotes & discussion",
            desc: "Community members second issues and discuss in threaded comments.",
          },
          {
            icon: "🏛️",
            title: "Admin dashboard",
            desc: "Moderate, merge duplicates, set status, and export data to CSV.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="bg-white border-2 border-[#1E1E1E] rounded-[22px] p-6"
          >
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-bold text-lg mb-1">{f.title}</h3>
            <p className="text-[#6B6B6B] text-sm">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[#1E1E1E] bg-white py-6 text-center text-sm text-[#6B6B6B]">
        UrbnLab — community-powered city improvement
      </footer>
    </div>
  );
}
