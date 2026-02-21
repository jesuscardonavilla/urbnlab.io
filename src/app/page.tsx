import Link from "next/link";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F6F0EA" }}>
      <Navbar />

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 py-16 md:py-24">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6" style={{ color: "#1E1E1E", lineHeight: 1.1 }}>
          Better cities, timed to perfection.
        </h1>
        <p className="text-lg md:text-xl text-[#1E1E1E] max-w-2xl mb-10">
          Join minimalist urban mobility campaigns to shape your city's future today. Simple, fast, and impactful.
        </p>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-2 px-8 py-4 bg-[#06B6D4] border-2 border-[#1E1E1E] rounded-[16px] font-bold text-[#1E1E1E] hover:bg-[#0891B2] transition-all text-lg"
        >
          EXPLORE CAMPAIGNS
          <span>→</span>
        </Link>
      </section>

      {/* Mission */}
      <section className="max-w-3xl mx-auto px-6 mb-16">
        <div className="bg-white border-2 border-[#1E1E1E] rounded-[16px] p-8 md:p-10">
          <div className="text-[#06B6D4] font-bold text-sm mb-4 tracking-wider">
            OUR MISSION
          </div>
          <p className="text-2xl md:text-3xl font-bold" style={{ color: "#1E1E1E", lineHeight: 1.3 }}>
            We believe urban mobility should be agile. We facilitate time-bound, hyper-focused improvements that transform neighborhoods in weeks.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="text-[#06B6D4] font-bold text-sm mb-8 tracking-wider">
          HOW IT WORKS
        </div>
        <div className="space-y-8">
          {[
            {
              num: "1",
              title: "Identify",
              desc: "We pinpoint critical mobility gaps in the city using real-time transit data and community feedback.",
            },
            {
              num: "2",
              title: "Campaign",
              desc: "Each project is a 30-day sprint. Support the initiatives that matter most to your daily commute.",
            },
            {
              num: "3",
              title: "Implement",
              desc: "Once a campaign reaches its goal, we work with city partners for immediate deployment.",
            },
          ].map((step) => (
            <div key={step.num} className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 border-2 border-[#1E1E1E] rounded-full flex items-center justify-center font-bold text-lg">
                {step.num}
              </div>
              <div>
                <h3 className="font-bold text-xl mb-2">{step.title}</h3>
                <p className="text-[#1E1E1E] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-[#1E1E1E] bg-white py-6 text-center text-sm text-[#6B6B6B]">
        © URBNLAB 2024
      </footer>
    </div>
  );
}
