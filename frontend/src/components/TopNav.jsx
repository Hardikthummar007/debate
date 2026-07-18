import { useState, useEffect } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { THEMES, CHARACTER_IMAGES, wagerApi } from "@/lib/api";
import { 
  Crown, Flame, Snowflake, Moon, Swords, LogOut, User, 
  LayoutDashboard, Coins, Bell, ChevronDown
} from "lucide-react";
import sigilStark from "@/assets/sigil-stark.png";
import sigilLannister from "@/assets/sigil-lannister.png";
import sigilTargaryen from "@/assets/sigil-targaryen.png";
import sigilMartell from "@/assets/sigil-martell.png";
import sigilGreyjoy from "@/assets/sigil-greyjoy.png";
import avatarJon from "@/assets/avatar-jon.jpg";

const ICONS = { Crown, Flame, Snowflake, Moon };

function Corners() {
  return (
    <>
      <span className="fc fc-tl" /><span className="fc fc-tr" />
      <span className="fc fc-bl" /><span className="fc fc-br" />
    </>
  );
}

export default function TopNav() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const nav = useNavigate();  const location = useLocation();  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const data = await wagerApi.getNotifications();
        setNotifications(data);
      } catch (err) {
        console.error("Failed to fetch raven scrolls", err);
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [user]);

  const handleToggleNotifications = async () => {
    const nextShow = !showNotifications;
    setShowNotifications(nextShow);
    setShowProfileMenu(false);
    if (nextShow && user) {
      try {
        await wagerApi.markNotificationsAsRead();
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      } catch (err) {
        console.error("Failed to acknowledge notifications", err);
      }
    }
  };

  const getSigilForAvatar = (avatarKey) => {
    if (avatarKey === "stark" || avatarKey === "commander") return sigilStark;
    if (avatarKey === "lannister" || avatarKey === "lord") return sigilLannister;
    if (avatarKey === "targaryen" || avatarKey === "queen") return sigilTargaryen;
    if (avatarKey === "greyjoy" || avatarKey === "rebel") return sigilGreyjoy;
    return sigilMartell;
  };

  const navigateToDashboardTab = (tabId) => {
    if (location.pathname === "/dashboard") {
      // If already on dashboard, trigger tab change by posting an event or if handled by window state
      const event = new CustomEvent("changeDashboardTab", { detail: tabId });
      window.dispatchEvent(event);
    } else {
      nav("/dashboard", { state: { tab: tabId } });    }
  };

  const getDynamicNotifications = () => {
    const list = [];
    if (!user) return list;

    // 1. Victory & gold coins notification
    if (user.debatesWon > 0) {
      list.push({
        title: "🪙 spoils of victory",
        desc: `You earned +${user.debatesWon * 20} gold coins from your ${user.debatesWon} arena conquests.`,
        time: "Recent"
      });
    } else {
      list.push({
        title: "🛡️ recruit training",
        desc: "Speak in the Arena, secure a victory, and claim +20 gold coins spoils.",
        time: "Active"
      });
    }

    // 2. Streaks / Defeats
    if (user.streak > 0) {
      list.push({
        title: "🔥 consecutive triumph",
        desc: `House Stark honors your ${user.streak}-match debate winning streak!`,
        time: "Just now"
      });
    } else if (user.debatesLost > 0) {
      list.push({
        title: "🩹 tactical recovery",
        desc: "Defeat is the mother of logic. Enter the arena to redeem your honor.",
        time: "10m ago"
      });
    }

    // 3. ELO / Title rank up
    if (user.rating > 1000) {
      list.push({
        title: "👑 rank elevation",
        desc: `Your eloquence stands at ${Math.round(user.rating)} ELO. Ranked as a ${user.title || 'Peasant'}.`,
        time: "Updated"
      });
    } else {
      list.push({
        title: "⚔️ citadel summons",
        desc: `Advance beyond ${Math.round(user.rating)} ELO to rise in status at the Citadel.`,
        time: "Active"
      });
    }

    return list;
  };

  return (
    <header className="sticky top-0 z-40 frame-corners frame-ornate bg-black/85 backdrop-blur-md border-b border-gold/15 py-2 px-6 rounded-none">
      <Corners />
      <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
        
        {/* LOGO */}
        <div onClick={() => nav("/")} className="flex items-center gap-3 shrink-0 cursor-pointer">
          <div className="relative w-10 h-10 rounded-full border border-gold/40 grid place-items-center bg-black/60 shadow-[inset_0_0_10px_rgba(0,0,0,0.9)]">
            <img 
              src={user ? getSigilForAvatar(user.selectedAvatar) : sigilStark} 
              alt="House Sigil" 
              className="w-7 h-7 object-contain opacity-90" 
            />
          </div>
          <div className="min-w-0">
            <div className="font-display text-base tracking-[0.18em] text-gold-grad leading-none">
              GAME <span className="italic font-normal text-foreground/70 text-xs">of</span> THORNE
            </div>
            <div className="font-display text-[8px] tracking-[0.4em] text-muted-foreground mt-0.5">
              DEBATE · CONQUER · RULE
            </div>
          </div>
        </div>

        {/* NAVIGATION LINKS */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            <button 
              onClick={() => navigateToDashboardTab("home")}
              className={`px-3 py-1.5 font-display text-[10px] tracking-[0.25em] uppercase transition-colors ${
                location.pathname === "/dashboard" && !location.state?.tab
                  ? "text-gold-bright font-bold" : "text-muted-foreground hover:text-white"
              }`}
            >
              Throne
            </button>
            <NavLink 
              to="/topics" 
              className={({ isActive }) => `px-3 py-1.5 font-display text-[10px] tracking-[0.25em] uppercase transition-colors ${
                isActive ? "text-gold-bright font-bold" : "text-muted-foreground hover:text-white"
              }`}
            >
              Battle
            </NavLink>
            <button 
              onClick={() => navigateToDashboardTab("avatars")}
              className={`px-3 py-1.5 font-display text-[10px] tracking-[0.25em] uppercase transition-colors ${
                location.pathname === "/dashboard" && location.state?.tab === "avatars"
                  ? "text-gold-bright font-bold" : "text-muted-foreground hover:text-white"
              }`}
            >
              Court
            </button>            <button 
              onClick={() => navigateToDashboardTab("shop")}
              className={`px-3 py-1.5 font-display text-[10px] tracking-[0.25em] uppercase transition-colors ${
                location.pathname === "/dashboard" && location.state?.tab === "shop"
                  ? "text-gold-bright font-bold" : "text-muted-foreground hover:text-white"
              }`}
            >
              Shop
            </button>
            <button 
              onClick={() => navigateToDashboardTab("wager")}
              className={`px-3 py-1.5 font-display text-[10px] tracking-[0.25em] uppercase transition-colors ${
                location.pathname === "/dashboard" && location.state?.tab === "wager"
                  ? "text-gold-bright font-bold" : "text-muted-foreground hover:text-white"
              }`}
            >
              Wager
            </button>
          </nav>
        )}        {/* RIGHT ACTIONS */}
        <div className="flex items-center gap-3.5 shrink-0 pr-4">
          {/* Theme switcher */}
          <div className="hidden sm:flex items-center gap-1 border border-gold/15 p-0.5 bg-black/40">
            {THEMES.map((t) => {
              const Icon = ICONS[t.icon];
              const active = theme === t.id;
              const unlockedThemes = user?.unlockedThemes ? user.unlockedThemes.split(",") : ["royal"];
              const isUnlocked = t.id === "royal" || unlockedThemes.includes(t.id);

              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (isUnlocked) {
                      setTheme(t.id);
                    } else {
                      alert(`Theme is locked! Unlock "${t.name}" in the Throne Room using 100 gold coins.`);
                    }
                  }}
                  title={isUnlocked ? t.name : `${t.name} (LOCKED)`}
                  className={`w-7 h-7 flex items-center justify-center transition-all ${
                    active 
                      ? "bg-gold-bright text-black font-bold" 
                      : isUnlocked 
                        ? "text-white/60 hover:text-white hover:bg-white/5" 
                        : "text-white/20 cursor-not-allowed"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>

          {user ? (
            <>
              {/* ELO Rating Badge */}
              <div className="frame-corners flex items-center gap-1.5 px-3 py-1 border border-gold/20 bg-black/50 rounded-sm hover:border-gold/40 transition">
                <Corners />
                <Crown className="w-3.5 h-3.5 text-gold-bright" />
                <span className="font-display text-[10px] md:text-xs font-semibold tracking-wider text-gold-grad">
                  {Math.round(user.rating || 1000)}<span className="text-[8px] md:text-[9px] text-muted-foreground ml-0.5">ELO</span>
                </span>
              </div>

              {/* Coins Gold Badge */}
              <div className="frame-corners flex items-center gap-1.5 px-3 py-1 border border-gold/20 bg-black/50 rounded-sm hover:border-gold/40 transition">
                <Corners />
                <Coins className="w-3.5 h-3.5 text-gold-bright" />
                <span className="font-display text-[10px] md:text-xs font-semibold tracking-wider text-gold-grad">
                  {user.coins || 0}<span className="text-[8px] md:text-[9px] text-muted-foreground ml-0.5">GOLD</span>
                </span>
              </div>              {/* Notification Bell */}
              <div className="relative flex items-center">
                <button 
                  onClick={handleToggleNotifications}
                  className="relative w-8 h-8 border border-border bg-black/50 grid place-items-center hover:border-gold/60 transition"
                >
                  <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                  {notifications.some(n => !n.isRead) && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
                  )}
                </button>
                {showNotifications && (
                  <div className="!absolute right-0 top-full mt-2 w-80 frame-corners frame-ornate p-4 z-50 animate-fade-in shadow-2xl bg-black/95 border border-gold/20">
                    <Corners />
                    <div className="font-display text-[10px] tracking-wider text-gold-grad border-b border-white/10 pb-2 mb-2 uppercase flex justify-between items-center">
                      <span>Citadel Ravens</span>
                      <span className="text-[8px] text-muted-foreground font-body font-normal normal-case">
                        {notifications.length + getDynamicNotifications().length} scrolls
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-1">
                      {[
                        ...notifications.map(n => ({
                          title: "✉️ raven scroll",
                          desc: n.message,
                          time: "Raven",
                          isRead: n.isRead
                        })),
                        ...getDynamicNotifications().map(n => ({
                          ...n,
                          isRead: true
                        }))
                      ].map((n, idx) => (
                        <div key={idx} className={`border-b border-white/5 pb-2 last:border-0 hover:bg-white/5 p-1.5 transition-colors cursor-pointer rounded-sm ${!n.isRead ? 'bg-gold/5 border-l-2 border-l-gold' : ''}`}>
                          <div className="font-display text-[9px] text-gold-bright flex justify-between items-center">
                            <span>{n.title}</span>
                            <span className="font-body text-[8px] text-muted-foreground">{n.time}</span>
                          </div>
                          <p className="font-body text-[10px] text-white/70 leading-relaxed mt-1">{n.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* User Dropdown */}
              <div className="relative flex items-center">
                <div 
                  className="flex items-center gap-2 pl-2 pr-3 py-0.5 border border-border bg-black/50 cursor-pointer hover:border-gold/60 transition" 
                  onClick={() => { setShowProfileMenu(!showProfileMenu); setShowNotifications(false); }}
                >
                  <div 
                    className="w-7 h-7 rounded-full border border-gold/40 bg-cover bg-center" 
                    style={{ backgroundImage: `url(${CHARACTER_IMAGES[user.selectedAvatar] || avatarJon})` }}
                  />
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </div>                {showProfileMenu && (
                  <div className="!absolute right-0 top-full mt-2 w-48 frame-corners frame-ornate p-3 z-50 animate-fade-in shadow-2xl bg-black/95 border border-gold/20">
                    <Corners />
                    <div className="font-display text-[8px] text-muted-foreground tracking-[0.2em] uppercase border-b border-white/10 pb-1.5 mb-2 px-1">
                      Champion Menu
                    </div>
                    <div className="flex flex-col gap-1">
                      <button 
                        onClick={() => { setShowProfileMenu(false); nav("/profile"); }}
                        className="w-full text-left px-2 py-1.5 font-display text-[9px] tracking-wider text-white hover:bg-gold/10 hover:text-gold-bright transition-colors uppercase rounded-sm"
                      >
                        👤 House Settings
                      </button>
                      <button 
                        onClick={() => { setShowProfileMenu(false); navigateToDashboardTab("stats"); }}
                        className="w-full text-left px-2 py-1.5 font-display text-[9px] tracking-wider text-white hover:bg-gold/10 hover:text-gold-bright transition-colors uppercase rounded-sm"
                      >
                        📜 Detailed Records
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <button 
                        onClick={() => { logout(); nav("/login"); }}
                        className="w-full text-left px-2 py-1.5 font-display text-[9px] tracking-wider text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors uppercase rounded-sm"
                      >
                        🚪 Exile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <NavLink to="/login" className="btn-royal !py-1.5 !px-3 !text-[9px]">Enter</NavLink>
              <NavLink to="/register" className="btn-royal solid !py-1.5 !px-3 !text-[9px]">Join</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
