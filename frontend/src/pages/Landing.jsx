import { Link } from "react-router-dom";
import { Swords, Crown, Flame, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="relative min-h-screen bg-stone-texture noise-overlay overflow-hidden" data-testid="landing-page">
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/60 to-black" />

      <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16">
        <div className="text-center">
          <div className="medieval text-[color:var(--accent)] tracking-[0.5em] text-xs mb-6" data-testid="hero-tag">
            ⚔ A GAME OF WORDS ⚔
          </div>
          <h1
            className="fraktur text-7xl md:text-9xl leading-none text-gold-gradient"
            style={{ textShadow: "0 6px 40px rgba(0,0,0,0.9)" }}
            data-testid="hero-title"
          >
            Debait
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-white/70 text-lg font-light" data-testid="hero-subtitle">
            The realm's most cunning minds meet on the field of ideas. Choose your side, wield your words,
            and let the six judges decide who claims the throne of reason.
          </p>

          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to={user ? "/topics" : "/register"} className="btn-royal solid animate-pulse" data-testid="cta-begin">
              <Swords className="w-4 h-4" /> Take the Field
            </Link>
            <Link to={user ? "/dashboard" : "/login"} className="btn-royal" data-testid="cta-secondary">
              {user ? "Return to Throne" : "Enter the Realm"}
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { icon: Swords, title: "Trial by Argument", desc: "Three rounds. Two minds. One victor. Every word is a strike on the HP bar." },
            { icon: Shield, title: "Six Ancient Judges", desc: "Topic, Stance, Logic, Rebuttal, Novelty, Delivery — the old ways of judging." },
            { icon: Crown,  title: "Claim the Throne", desc: "Win ELO points, earn gold coins, unlock legendary titles, and claim the leaderboard." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="royal-card p-8 hover-lift" data-testid={`feature-${i}`}>
              <Icon className="w-8 h-8 text-[color:var(--accent)] mb-4" />
              <div className="heading text-xl mb-2 text-white">{title}</div>
              <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="mt-24">
          <div className="divider-royal mb-10">
            <Flame className="w-5 h-5" /> <span className="medieval tracking-widest">The Path to Glory</span> <Flame className="w-5 h-5" />
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {["Choose a Cause", "Select a Champion", "Face the Enemy", "Claim Victory"].map((s, i) => (
              <div key={s} className="glass-panel p-6" data-testid={`step-${i}`}>
                <div className="fraktur text-4xl text-[color:var(--accent)]">{i + 1}</div>
                <div className="heading mt-2 text-white">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
