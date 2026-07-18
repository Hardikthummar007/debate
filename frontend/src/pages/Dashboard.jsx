import { useEffect, useState } from "react";
import { api, CHARACTER_IMAGES, THEMES, wagerApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { 
  Trophy, 
  Swords, 
  Shield, 
  ScrollText, 
  Skull, 
  Crown, 
  Coins, 
  Sparkles, 
  Lock, 
  CheckCircle,
  User,
  Users,
  Home,
  Settings,
  Bell,  ChevronDown,  Search,
  Dices,
  Eye
} from "lucide-react";
import bgStone from "@/assets/bg-stone.jpg";
import heroThrone from "@/assets/hero-throne.jpg";
import sigilStark from "@/assets/sigil-stark.png";
import sigilLannister from "@/assets/sigil-lannister.png";
import sigilTargaryen from "@/assets/sigil-targaryen.png";
import sigilMartell from "@/assets/sigil-martell.png";
import sigilGreyjoy from "@/assets/sigil-greyjoy.png";
import avatarJon from "@/assets/avatar-jon.jpg";
import iconSwords from "@/assets/icon-swords.png";
import iconCrown from "@/assets/icon-crown.png";
import iconCastle from "@/assets/icon-castle.jpg";
import iconRavenSwords from "@/assets/icon-raven-swords.png";
import iconRaven from "@/assets/icon-raven.png";

const RESULT_STYLES = {
  won: { label: "VICTORY", cls: "text-green-400", Icon: Crown },
  lost: { label: "DEFEAT", cls: "text-red-400", Icon: Skull },
  draw: { label: "STALEMATE", cls: "text-yellow-300", Icon: Shield },
  in_progress: { label: "ONGOING", cls: "text-white/70", Icon: Swords },
};

function Corners() {
  return (
    <>
      <span className="fc fc-tl" /><span className="fc fc-tr" />
      <span className="fc fc-bl" /><span className="fc fc-br" />
    </>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="flex items-center justify-center gap-3 mb-3">
      <span className="h-px w-8 bg-gradient-to-r from-transparent to-gold/60" />
      <h3 className="font-display text-[10px] tracking-[0.3em] text-gold-grad uppercase">{children}</h3>
      <span className="h-px w-8 bg-gradient-to-l from-transparent to-gold/60" />
    </div>
  );
}

export default function Dashboard() {
  const { user, refresh } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); // home, avatars, shop, stats
  const [purchasing, setPurchasing] = useState(false);  const nav = useNavigate();
  const location = useLocation();

  // Custom Battle Room states
  const [joinRoomCode, setJoinRoomCode] = useState('');
  const [privateRoomError, setPrivateRoomError] = useState('');
  const [privateRounds, setPrivateRounds] = useState(3);

  // Setup Battle Modal states
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [modalMode, setModalMode] = useState("matchmaking"); // matchmaking, practice
  const [modalTopic, setModalTopic] = useState("");
  const [modalStance, setModalStance] = useState("FOR");
  const [modalRounds, setModalRounds] = useState(3);
  const [modalDifficulty, setModalDifficulty] = useState("medium");
  const [customTopicActive, setCustomTopicActive] = useState(false);
  const [customTopicText, setCustomTopicText] = useState("");  const [predefinedTopics, setPredefinedTopics] = useState([]);

  // Wager Hall States
  const [activeWagers, setActiveWagers] = useState([]);
  const [wagersLoading, setWagersLoading] = useState(false);
  const [bettingError, setBettingError] = useState("");
  const [bettingSuccess, setBettingSuccess] = useState("");
  const [showBetModal, setShowBetModal] = useState(false);
  const [selectedWager, setSelectedWager] = useState(null);
  const [betSide, setBetSide] = useState("A");
  const [betAmount, setBetAmount] = useState(10);

  const fetchWagers = async () => {
    try {
      const res = await wagerApi.getActiveWagers();
      setActiveWagers(res);
    } catch (err) {
      console.error("Failed to load live wagers", err);
    }
  };

  useEffect(() => {
    if (activeTab === "wager") {
      setWagersLoading(true);
      fetchWagers().finally(() => setWagersLoading(false));
      const interval = setInterval(fetchWagers, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  const handlePlaceBet = async () => {
    setBettingError("");
    setBettingSuccess("");
    if (!selectedWager) return;
    try {
      const res = await wagerApi.placeBet(selectedWager.id, betSide, betAmount);
      setBettingSuccess(res.message);
      fetchWagers();
      refresh();
      setTimeout(() => {
        setShowBetModal(false);
        setBettingSuccess("");
      }, 2000);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Citadel ledger rejected your wager.";
      setBettingError(errMsg);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const { data } = await api.get("/dashboard");
      setData(data);
    } catch (err) {
      console.error("Unable to load the archives.", err);
    } finally {
      setLoading(false);
    }
  };

  const loadPredefinedTopics = async () => {
    try {
      const res = await api.get("/topics");
      setPredefinedTopics(res.data);
      if (res.data.length > 0) {
        setModalTopic(res.data[0].title);
      }
    } catch (err) {
      console.error("Failed to load topics", err);
    }
  };  useEffect(() => {
    fetchDashboardData();
    loadPredefinedTopics();
  }, []);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  useEffect(() => {
    const handleTabChange = (e) => {
      if (e.detail) {
        setActiveTab(e.detail);
      }
    };
    window.addEventListener("changeDashboardTab", handleTabChange);
    return () => {
      window.removeEventListener("changeDashboardTab", handleTabChange);
    };
  }, []);

  const handleCreatePrivateRoom = async () => {
    setPrivateRoomError('');
    try {
      const res = await fetch('http://localhost:8000/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUserId: String(data.user.id),
          hostUsername: data.user.username,
          rounds: privateRounds
        })
      });
      if (res.ok) {
        const roomData = await res.json();
        nav(`/private-debate/${roomData.roomCode}`);
      } else {
        setPrivateRoomError('Failed to create private room.');
      }
    } catch (e) {
      setPrivateRoomError('Could not connect to multiplayer server.');
    }
  };

  const handleJoinPrivateRoom = async (e) => {
    e.preventDefault();
    if (joinRoomCode.trim().length !== 6) {
      setPrivateRoomError('Please enter a 6-character room code.');
      return;
    }
    setPrivateRoomError('');
    try {
      const res = await fetch('http://localhost:8000/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: joinRoomCode.trim().toUpperCase(),
          userId: String(data.user.id),
          username: data.user.username
        })
      });
      if (res.ok) {
        const roomData = await res.json();
        nav(`/private-debate/${roomData.roomCode}`);
      } else {
        const err = await res.json();
        setPrivateRoomError(err.detail || 'Failed to join room.');
      }
    } catch (err) {
      setPrivateRoomError('Connection to Python server (port 8000) failed.');
    }
  };

  const handleSelectAvatar = async (avatar) => {
    try {
      await api.post("/profile/select-avatar", { avatar });
      refresh();
      fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to equip avatar.");
    }
  };

  const handleUnlockAvatar = async (avatar) => {
    if (!window.confirm(`Unlock champion ${avatar} for 50 gold coins?`)) return;
    setPurchasing(true);
    try {
      await api.post("/profile/unlock-avatar", { avatar });
      refresh();
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to unlock avatar.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleUnlockTheme = async (themeId, name) => {
    if (!window.confirm(`Unlock theme "${name}" for 100 gold coins?`)) return;
    setPurchasing(true);
    try {
      await api.post("/profile/unlock-theme", { theme: themeId });
      refresh();
      await fetchDashboardData();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to unlock theme.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleCommenceBattle = async () => {
    const topic = customTopicActive ? customTopicText.trim() : modalTopic;
    if (customTopicActive && (!topic || topic.length < 5)) {
      alert("Please enter a custom topic of at least 5 characters.");
      return;
    }
    setShowSetupModal(false);

    if (modalMode === "matchmaking") {
      try {
        await api.post("/matchmaking/join", { topic, stance: modalStance, rounds: modalRounds });
        localStorage.setItem('debait_stance', modalStance);
        localStorage.setItem('debait_topic', topic);
        nav("/queue");
      } catch (err) {
        alert("Failed to join matchmaking queue. Please try again.");
      }
    } else {
      try {
        const res = await api.post("/matchmaking/practice", { 
          topic, 
          stance: modalStance, 
          difficulty: modalDifficulty,
          rounds: modalRounds 
        });
        if (res.data && res.data.status === 'MATCHED') {
          localStorage.setItem('debait_stance', modalStance);
          localStorage.setItem('debait_topic', topic);
          nav(`/debate/${res.data.debateSessionId}`);
        } else {
          alert("Match failed or incorrect response from practice server.");
        }
      } catch (err) {
        alert("Failed to start AI practice session. Make sure contestService is running.");
      }
    }
  };

  const triggerMatchmakingSetup = () => {
    setModalMode("matchmaking");
    setShowSetupModal(true);
  };

  const triggerPracticeSetup = () => {
    setModalMode("practice");
    setShowSetupModal(true);
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-white/60 medieval h-screen flex items-center justify-center bg-stone-texture noise-overlay">
        <div className="animate-pulse">Summoning the archives...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-10 text-center text-white/60 h-screen flex items-center justify-center bg-stone-texture noise-overlay">
        <div>Unable to reach the Citadel's maester. Please make sure the server is running.</div>
      </div>
    );
  }

  const { stats, recent_debates, daily_challenges, leaderboard: leaderboardData } = data;
  const currentUser = data.user;

  // Calculate user level based on XP (500 XP per level)
  const xpLevel = Math.floor(currentUser.xp / 500) + 1;
  const currentXpInLevel = currentUser.xp % 500;
  const xpPercent = Math.min((currentXpInLevel / 500) * 100, 100);

  // Get unlocked lists
  const unlockedAvatarsList = currentUser.unlockedAvatars ? currentUser.unlockedAvatars.split(",") : ["knight"];
  const unlockedThemesList = currentUser.unlockedThemes ? currentUser.unlockedThemes.split(",") : ["royal"];

  // Sigil mapping for players in leaderboard
  const getSigilForAvatar = (avatarKey) => {
    if (avatarKey === "stark" || avatarKey === "commander") return sigilStark;
    if (avatarKey === "lannister" || avatarKey === "lord") return sigilLannister;
    if (avatarKey === "targaryen" || avatarKey === "queen") return sigilTargaryen;
    if (avatarKey === "greyjoy" || avatarKey === "rebel") return sigilGreyjoy;
    return sigilMartell;
  };

  // Nav Items config
  const sidebarNavItems = [
    { id: "home", label: "Home", icon: Home, action: () => setActiveTab("home") },
    { id: "debate", label: "Debate", icon: Swords, action: triggerMatchmakingSetup },    { id: "avatars", label: "Court", icon: User, action: () => setActiveTab("avatars") },
    { id: "shop", label: "Shop", icon: Coins, action: () => setActiveTab("shop") },
    { id: "wager", label: "Wager", icon: Dices, action: () => setActiveTab("wager") },
  ];

  return (
    <div
      className="min-h-screen text-foreground relative font-body"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.88)), url(${bgStone})`,
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
      }}
      data-testid="dashboard-page"
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />

      <div className="relative max-w-[1400px] mx-auto px-6 py-5">        {/* MAIN BODY GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 mt-5">
          
          {/* SIDEBAR */}
          <aside className="space-y-5">
            {/* Banner / Profile Info */}
            <div className="relative flex flex-col items-center pt-4 frame-corners p-4 rounded-sm">
              <Corners />
              <div className="relative">
                <div className="w-[180px] h-[220px] relative" style={{
                  background: "linear-gradient(180deg, #1a1310 0%, #0d0906 100%)",
                  clipPath: "polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)",
                  boxShadow: "inset 0 0 30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(200,160,90,0.15)",
                  border: "1px solid rgba(180,140,80,0.25)",
                }}>
                  <div className="absolute inset-x-0 top-3 text-center"><div className="mx-auto w-[75%] h-px bg-gold/20" /></div>
                  <div 
                    className="absolute inset-0 bg-cover bg-center opacity-85" 
                    style={{ backgroundImage: `url(${CHARACTER_IMAGES[currentUser.selectedAvatar] || avatarJon})` }}
                  />
                  <div className="absolute inset-x-0 bottom-8 text-center"><div className="mx-auto w-[75%] h-px bg-gold/20" /></div>
                </div>
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-[200px] h-1.5 bg-gradient-to-b from-[#5a4020] to-[#2a1c0e] rounded-sm shadow-md" />
              </div>

              <div className="mt-4 text-center">
                <div className="font-display text-base tracking-[0.25em] text-gold-grad truncate max-w-[220px]">{currentUser.username}</div>
                <div className="font-display text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">{currentUser.title || "Lord of Winterfell"}</div>
              </div>

              <div className="mt-3 flex items-center gap-3 w-full px-1">
                <div className="relative w-10 h-10 border border-gold/40 rotate-45 bg-black/70 grid place-items-center shrink-0">
                  <span className="font-display text-[11px] text-gold-bright -rotate-45 font-bold">{xpLevel}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 bg-black/70 border border-border relative overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-gold/80 to-gold-bright" style={{ width: `${xpPercent}%` }} />
                  </div>
                  <div className="font-display text-[8px] tracking-widest text-muted-foreground mt-1">{currentXpInLevel} / 500 XP</div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="frame-corners frame-ornate p-1.5 rounded-sm">
              <Corners />
              {sidebarNavItems.map((n) => {
                const Icon = n.icon;
                const active = activeTab === n.id;
                return (
                  <button 
                    key={n.id}
                    onClick={n.action}
                    className={`w-full flex items-center gap-3 px-4 py-2 font-display text-[10px] tracking-[0.25em] uppercase transition group relative
                      ${active ? "text-gold-bright bg-gradient-to-r from-gold/10 to-transparent border-l border-gold"
                               : "text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span className="flex-1 text-left">{n.label}</span>
                    <span className={`text-gold/60 text-[9px] ${active ? "opacity-100" : "opacity-40"}`}>❯</span>
                  </button>
                );
              })}
            </div>

            {/* Daily Quests block */}
            <div className="frame-corners frame-ornate p-4 rounded-sm text-center">
              <Corners />
              <div className="flex flex-col items-center">
                <img src={iconRaven} alt="" className="w-16 h-16 object-contain -mb-1 opacity-95" />
                <div className="font-display text-xs tracking-[0.25em] text-gold-grad">DAILY QUESTS</div>
                
                <div className="w-full mt-3 space-y-3">
                  {daily_challenges.slice(0, 2).map((q) => (
                    <div key={q.id} className="text-left border-t border-white/5 pt-2.5">
                      <div className="font-display text-[9px] text-white tracking-wider truncate uppercase">{q.title}</div>
                      <div className="text-[9px] text-white/50 leading-tight mt-0.5">{q.desc}</div>
                      <div className="mt-2 w-full flex items-center gap-2">
                        <div className="flex-1 h-1 bg-black/70 border border-white/5">
                          <div className="h-full bg-gradient-to-r from-gold/70 to-gold-bright" style={{ width: `${(q.progress / q.target) * 100}%` }} />
                        </div>
                        <span className="font-display text-[8px] tracking-widest text-muted-foreground">{q.progress}/{q.target}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN PANELS CONTAINER */}
          <main className="space-y-5">

            {/* TAB CONTENT: HOME */}
            {activeTab === "home" && (
              <>
                {/* HERO BANNER */}
                <section className="frame-corners frame-ornate relative overflow-hidden rounded-sm h-[260px]">
                  <Corners />
                  <img src={heroThrone} alt="The Iron Throne" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-black/80" />
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/90" />
                  <img src={sigilStark} alt="" className="absolute top-5 left-5 w-12 opacity-50" />
                  <img src={sigilTargaryen} alt="" className="absolute top-5 right-6 w-14 opacity-70 drop-shadow-[0_0_15px_rgba(180,40,30,0.4)]" />
                  <img src={iconRaven} alt="" className="absolute bottom-4 right-6 w-20 opacity-80" />
                  
                  <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
                    <h1 className="font-display text-3xl md:text-4xl tracking-[0.2em] text-gold-grad leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      SPEAK YOUR TRUTH.<br />WIN THE THRONE.
                    </h1>
                    <p className="mt-3 font-body italic text-sm text-foreground/80">
                      Enter the realm of debate. Convince. Conquer. Rule.
                    </p>
                  </div>
                </section>

                {/* QUICK ACTIONS ROW */}
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Action 1: Random matchmaking */}
                  <div className="frame-corners frame-ornate p-4 rounded-sm flex flex-col items-center text-center">
                    <Corners />
                    <SectionTitle>Random Battle</SectionTitle>
                    <img src={iconSwords} alt="" className="w-16 h-16 object-contain my-2.5 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" />
                    <p className="font-body italic text-[11px] text-white/50 mt-1 mb-4 leading-normal">Get matched with a<br />random opponent</p>
                    <button onClick={triggerMatchmakingSetup} className="btn-gold w-full mt-auto">Join Random</button>
                  </div>

                  {/* Action 2: Practice AI */}
                  <div className="frame-corners frame-ornate p-4 rounded-sm flex flex-col items-center text-center">
                    <Corners />
                    <SectionTitle>Debate with AI</SectionTitle>
                    <img src={iconCrown} alt="" className="w-16 h-12 object-contain my-2.5 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" />
                    
                    {/* Interactive difficulty shields */}
                    <div className="flex items-center justify-center gap-1.5 my-3">
                      {[
                        { label: "easy", color: "oklch(0.5 0.1 145)" },
                        { label: "medium", color: "oklch(0.5 0.15 250)" },
                        { label: "hard", color: "oklch(0.5 0.18 25)" },
                      ].map((d) => (
                        <div 
                          key={d.label} 
                          onClick={() => setModalDifficulty(d.label)}
                          className="flex flex-col items-center gap-0.5 cursor-pointer hover:scale-110 transition-transform"
                        >
                          <Shield 
                            className="w-4 h-4" 
                            style={{ 
                              color: d.color, 
                              fill: modalDifficulty === d.label ? d.color : "transparent",
                              opacity: modalDifficulty === d.label ? 1.0 : 0.4 
                            }} 
                          />
                          <span className="font-display text-[7px] tracking-wider text-muted-foreground uppercase">{d.label}</span>
                        </div>
                      ))}
                    </div>

                    <button onClick={triggerPracticeSetup} className="btn-gold w-full mt-auto">Practice AI</button>
                  </div>

                  {/* Action 3: Create Room */}
                  <div className="frame-corners frame-ornate p-4 rounded-sm flex flex-col items-center text-center">
                    <Corners />
                    <SectionTitle>Create Room</SectionTitle>
                    <div className="relative w-full h-16 my-2.5 overflow-hidden border border-border/60">
                      <img src={iconCastle} alt="" className="w-full h-full object-cover opacity-80" />
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
                    </div>
                    
                    <div className="w-full mb-3">
                      <select 
                        value={privateRounds} 
                        onChange={e => setPrivateRounds(Number(e.target.value))}
                        className="bg-black/80 border border-border text-[9px] font-display uppercase tracking-widest text-gold w-full py-1 text-center focus:outline-none"
                      >
                        <option value="2">2 Rounds</option>
                        <option value="3">3 Rounds</option>
                        <option value="4">4 Rounds</option>
                        <option value="5">5 Rounds</option>
                      </select>
                    </div>

                    <button onClick={handleCreatePrivateRoom} className="btn-gold w-full mt-auto">Create Room</button>
                  </div>

                  {/* Action 4: Join Room */}
                  <div className="frame-corners frame-ornate p-4 rounded-sm flex flex-col items-center text-center">
                    <Corners />
                    <SectionTitle>Join Room</SectionTitle>
                    <img src={iconRavenSwords} alt="" className="w-16 h-16 object-contain my-2 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]" />
                    
                    {privateRoomError && (
                      <div className="text-[8px] text-red-400 mb-1 leading-tight">{privateRoomError}</div>
                    )}

                    <form onSubmit={handleJoinPrivateRoom} className="w-full flex flex-col gap-2 mt-auto">
                      <div className="w-full flex items-center gap-1.5">
                        <input 
                          type="text"
                          className="flex-1 bg-black/60 border border-border px-2 py-1 text-xs font-display text-center uppercase tracking-widest text-foreground focus:outline-none focus:border-gold/60" 
                          placeholder="ROOM CODE" 
                          value={joinRoomCode}
                          onChange={e => setJoinRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                        />
                        <button type="submit" className="w-7 h-7 border border-border bg-black/60 grid place-items-center hover:border-gold/60">
                          <Search className="w-3.5 h-3.5 text-gold" />
                        </button>
                      </div>
                      <button type="submit" className="btn-gold w-full">Join Room</button>
                    </form>
                  </div>
                </section>

                {/* BOTTOM DETAILS SECTION (3 Columns Layout) */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  
                  {/* Column 1: Ongoing/Recent Debates */}
                  <div className="frame-corners frame-ornate p-4 rounded-sm">
                    <Corners />
                    <SectionTitle>Ongoing Debates</SectionTitle>
                    
                    {recent_debates.length === 0 ? (
                      <div className="text-white/40 text-center py-8 font-body italic text-xs">
                        No battle chronicles found. Match to begin your legend.
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5 max-h-[220px] overflow-y-auto pr-1.5 custom-scrollbar">
                        {recent_debates.map((d) => {
                          const s = RESULT_STYLES[d.result] || RESULT_STYLES.in_progress;
                          return (
                            <div key={d.id} className="flex items-center gap-3 py-2">
                              <s.Icon className={`w-3.5 h-3.5 ${s.cls} shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <div className="text-white text-xs font-semibold truncate leading-tight">{d.topic}</div>
                                <div className="text-[9px] text-white/50 mt-0.5 truncate">
                                  vs <span className="text-gold">{d.opponent}</span> • <span className="uppercase">{d.my_side}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className={`font-display text-[9px] tracking-wider ${s.cls}`}>{s.label}</div>
                                <div className="font-display text-[10px] text-gold-bright">{d.my_score.toFixed(0)}-{d.opp_score.toFixed(0)}</div>
                              </div>
                              <Link 
                                to={d.result === "in_progress" ? `/debate/${d.id}` : `/debate/${d.id}/result`}
                                className="btn-gold !py-1 !px-2.5 !text-[9px] shrink-0">
                                View
                              </Link>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Column 2: Leaderboard */}
                  <div className="frame-corners frame-ornate p-4 rounded-sm">
                    <Corners />
                    <SectionTitle>Citadel Rankings</SectionTitle>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {leaderboardData.map((l) => {
                        const isSelf = l.username === currentUser.username;
                        return (
                          <div key={l.username} className={`flex items-center gap-3 py-1.5 px-2 rounded-sm border ${
                            isSelf ? "border-gold/30 bg-gold/5" : "border-transparent"
                          }`}>
                            <span className="font-display text-xs text-gold-bright w-3 text-center font-bold">{l.rank}</span>
                            <img src={getSigilForAvatar(l.selectedAvatar)} alt="" className="w-6 h-6 object-contain opacity-85 shrink-0" />
                            <span className={`flex-1 font-body text-xs truncate ${isSelf ? "text-gold-bright font-bold" : "text-white"}`}>
                              {l.username}
                            </span>
                            <span className="font-display text-xs text-gold-grad tracking-wider shrink-0">⚔ {l.rating}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Column 3: Stats */}
                  <div className="frame-corners frame-ornate p-4 rounded-sm flex flex-col justify-between">
                    <Corners />
                    <SectionTitle>Your Stats</SectionTitle>
                    <img src={getSigilForAvatar(currentUser.selectedAvatar)} alt="" className="w-14 h-14 mx-auto object-contain opacity-70 my-1" />
                    
                    <div className="grid grid-cols-4 gap-1.5 mt-2 border-t border-white/5 pt-3">
                      {[
                        { l: "Fought", v: stats.participated },
                        { l: "Wins", v: stats.won },
                        { l: "Win Rate", v: `${stats.win_rate}%` },
                        { l: "Streak", v: currentUser.streak },
                      ].map((s) => (
                        <div key={s.l} className="text-center">
                          <div className="font-display text-base text-gold-grad leading-none">{s.v}</div>
                          <div className="font-display text-[7px] tracking-widest text-muted-foreground mt-1.5 uppercase">{s.l}</div>
                        </div>
                      ))}
                    </div>

                    <button onClick={() => setActiveTab("stats")} className="btn-gold mt-4 w-full">Detailed Records</button>
                  </div>

                </section>
              </>
            )}

            {/* TAB CONTENT: COURT / AVATARS */}
            {activeTab === "avatars" && (
              <div className="frame-corners p-6 rounded-sm">
                <Corners />
                <div className="flex items-center gap-3 mb-6">
                  <User className="w-5 h-5 text-gold-bright" />
                  <h2 className="font-display text-xl text-white uppercase tracking-wider">Summon Your Court Champion</h2>
                </div>
                <p className="text-xs text-white/50 mb-6 leading-relaxed font-body">
                  Select a champion avatar to represent your banner on the battlefield. Summon new characters in the Treasury Shop.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Object.entries(CHARACTER_IMAGES).map(([key, img]) => {
                    const isUnlocked = unlockedAvatarsList.includes(key);
                    const isEquipped = currentUser.selectedAvatar === key;

                    return (
                      <div 
                        key={key} 
                        className={`flex flex-col items-center bg-black/40 border p-3.5 transition-all rounded-sm ${
                          isEquipped ? "border-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]" : "border-white/5"
                        }`}
                      >
                        <div 
                          className={`w-20 h-28 bg-cover bg-center mb-3 border rounded-sm ${
                            isEquipped ? "border-gold scale-105" : "border-white/10"
                          }`}
                          style={{ backgroundImage: `url(${img})` }}
                        />
                        <div className="font-display text-xs uppercase text-white font-semibold mb-2">{key}</div>
                        
                        {isEquipped ? (
                          <span className="text-[10px] text-gold-bright font-bold uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Equipped
                          </span>
                        ) : isUnlocked ? (
                          <button
                            onClick={() => handleSelectAvatar(key)}
                            className="btn-gold !py-1 !px-3 !text-[9px]"
                          >
                            Equip
                          </button>
                        ) : (
                          <span className="text-[9px] text-white/30 uppercase flex items-center gap-1 font-display">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT: SHOP */}
            {activeTab === "shop" && (
              <div className="space-y-6">
                
                {/* Avatars purchase */}
                <div className="frame-corners p-6 rounded-sm">
                  <Corners />
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2.5">
                      <User className="w-5 h-5 text-gold-bright" />
                      <h2 className="font-display text-lg text-white uppercase tracking-wider">Treasury Champions (50 Gold each)</h2>
                    </div>
                    <div className="flex items-center gap-1.5 text-gold-bright font-bold text-xs font-display">
                      <Coins className="w-4 h-4" /> {currentUser.coins} GOLD
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {Object.entries(CHARACTER_IMAGES).map(([key, img]) => {
                      const isUnlocked = unlockedAvatarsList.includes(key);
                      if (isUnlocked) return null;

                      return (
                        <div key={key} className="flex flex-col items-center bg-black/40 border border-white/5 p-3.5 hover-lift rounded-sm">
                          <div 
                            className="w-20 h-28 bg-cover bg-center mb-3 border border-white/10"
                            style={{ backgroundImage: `url(${img})` }}
                          />
                          <div className="font-display text-xs uppercase text-white mb-2">{key}</div>
                          <button
                            disabled={purchasing || currentUser.coins < 50}
                            onClick={() => handleUnlockAvatar(key)}
                            className="btn-gold !py-1.5 !px-3 !text-[9px] w-full"
                          >
                            Unlock: 50
                          </button>
                        </div>
                      );
                    })}
                    {Object.keys(CHARACTER_IMAGES).filter(key => !unlockedAvatarsList.includes(key)).length === 0 && (
                      <div className="text-white/40 col-span-4 text-center py-6 text-xs font-semibold font-display">
                        You have summoned all available champions in the realm!
                      </div>
                    )}
                  </div>
                </div>

                {/* Themes purchase */}
                <div className="frame-corners p-6 rounded-sm">
                  <Corners />
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2.5">
                      <Shield className="w-5 h-5 text-gold-bright" />
                      <h2 className="font-display text-lg text-white uppercase tracking-wider">Unlock Sigil Themes (100 Gold each)</h2>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    {THEMES.map((theme) => {
                      const isUnlocked = theme.id === "royal" || unlockedThemesList.includes(theme.id);
                      if (isUnlocked) return null;

                      return (
                        <div key={theme.id} className="p-4 border border-white/5 bg-black/40 flex justify-between items-center hover-lift rounded-sm">
                          <div>
                            <div className="font-display text-xs text-white uppercase tracking-wider">{theme.name}</div>
                            <div className="text-[10px] text-white/50 mt-1 font-body">{theme.desc}</div>
                          </div>
                          <button
                            disabled={purchasing || currentUser.coins < 100}
                            onClick={() => handleUnlockTheme(theme.id, theme.name)}
                            className="btn-gold !py-1.5 !px-3 !text-[9px]"
                          >
                            Unlock: 100
                          </button>
                        </div>
                      );
                    })}
                    {THEMES.filter(t => t.id !== "royal" && !unlockedThemesList.includes(t.id)).length === 0 && (
                      <div className="text-white/40 col-span-2 text-center py-6 text-xs font-semibold font-display">
                        You have unlocked all available sigil themes in the realm!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}            {/* TAB CONTENT: WAGER HALL */}
            {activeTab === "wager" && (
              <div className="frame-corners p-6 rounded-sm">
                <Corners />
                <div className="flex items-center gap-3 mb-6">
                  <Dices className="w-5 h-5 text-gold-bright" />
                  <h2 className="font-display text-xl text-white uppercase tracking-wider">Citadel Wager Hall</h2>
                </div>
                <p className="text-xs text-white/50 mb-6 leading-relaxed font-body">
                  Back the realm's finest champions in active combat. Wagers close once the first round of arguments begins. Parimutuel payouts distribute the losing stakes to the winners minus a 10% Citadel tax.
                </p>                {wagersLoading && activeWagers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <div className="animate-pulse font-display text-[10px] text-gold-grad tracking-widest uppercase">Consulting Citadel scrolls...</div>
                  </div>
                ) : activeWagers.length === 0 ? (
                  <div className="p-8 border border-white/5 bg-white/[0.01] rounded-sm text-center">
                    <p className="font-display text-[10px] text-muted-foreground uppercase">
                      The arena is silent. No active debates are currently contested at the Citadel.
                    </p>
                    <p className="text-[9px] text-white/30 mt-2 font-body">
                      Enter matchmaking or initiate a trial by combat against the AI to open a new wagering pool.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {activeWagers.map((wager) => {
                      const totalPool = wager.sideAPool + wager.sideBPool;
                      const pctA = totalPool > 0 ? Math.round((wager.sideAPool / totalPool) * 100) : 50;
                      const pctB = totalPool > 0 ? 100 - pctA : 50;
                      const isParticipant = user.username === wager.participantA || user.username === wager.participantB;

                      return (
                        <div key={wager.id} className="frame-corners p-5 bg-black/40 hover-lift rounded-sm relative">
                          <Corners />
                          
                          {/* Top Row: Topic and status */}
                          <div className="flex justify-between items-start gap-4 mb-4 border-b border-white/5 pb-3">
                            <div>
                              <span className="font-display text-[8px] bg-gold/15 text-gold-bright border border-gold/30 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">
                                Debate #{wager.id}
                              </span>
                              <h3 className="font-display text-sm text-white mt-1.5 uppercase tracking-wide leading-tight">
                                {wager.topic}
                              </h3>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`font-display text-[9px] px-2 py-0.5 rounded-sm uppercase tracking-widest ${
                                wager.isLocked 
                                  ? "bg-red-950/40 text-red-400 border border-red-800/30" 
                                  : "bg-emerald-950/40 text-emerald-400 border border-emerald-800/30 animate-pulse"
                              }`}>
                                {wager.isLocked ? "Betting Locked" : `Round ${wager.currentRound} open`}
                              </span>
                            </div>
                          </div>

                          {/* Champions Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                            {/* Participant A */}
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-full border border-gold/30 bg-cover bg-center shrink-0"
                                style={{ backgroundImage: `url(${CHARACTER_IMAGES[wager.participantAAvatar] || avatarJon})` }}
                              />
                              <div>
                                <div className="font-display text-xs text-white font-semibold">
                                  {wager.participantA}
                                </div>
                                <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest">
                                  Side A: {wager.userAStance} · {Math.round(wager.participantARating)} Elo
                                </div>
                              </div>
                            </div>

                            {/* Participant B */}
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-10 h-10 rounded-full border border-gold/30 bg-cover bg-center shrink-0"
                                style={{ backgroundImage: `url(${CHARACTER_IMAGES[wager.participantBAvatar] || avatarJon})` }}
                              />
                              <div>
                                <div className="font-display text-xs text-white font-semibold">
                                  {wager.participantB}
                                </div>
                                <div className="font-body text-[9px] text-muted-foreground uppercase tracking-widest">
                                  Side B: {wager.userBStance} · {Math.round(wager.participantBRating)} Elo
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Odds Percentage Bar */}
                          <div className="mb-5 space-y-1.5">
                            <div className="flex justify-between text-[8px] font-display uppercase tracking-wider text-muted-foreground">
                              <span>House {wager.participantA}: {wager.sideAPool}G ({wager.sideABettors} bet)</span>
                              <span>House {wager.participantB}: {wager.sideBPool}G ({wager.sideBBettors} bet)</span>
                            </div>
                            <div className="h-2 bg-black/80 border border-white/5 rounded-full overflow-hidden flex">
                              <div 
                                className="h-full bg-gradient-to-r from-gold/80 to-gold-bright transition-all duration-500 border-r border-black/50" 
                                style={{ width: `${pctA}%` }} 
                              />
                              <div 
                                className="h-full bg-white/10 transition-all duration-500" 
                                style={{ width: `${pctB}%` }} 
                              />
                            </div>
                            <div className="flex justify-between text-[9px] font-display text-gold-grad">
                              <span>{pctA}% backing</span>
                              <span>{pctB}% backing</span>
                            </div>
                          </div>                           {/* Action Row */}
                          <div className="flex justify-end gap-3 border-t border-white/5 pt-3 mt-1">
                            <button
                              onClick={() => {
                                if (wager.roomCode) {
                                  nav(`/private-debate/${wager.roomCode}`);
                                } else {
                                  nav(`/debate/${wager.id}`);
                                }
                              }}
                              className="btn-gold outline !py-1 !px-4 !text-[9px] flex items-center gap-1.5"
                            >
                              <Eye className="w-3 h-3 text-gold" /> Spectate Live
                            </button>
                            {isParticipant ? (
                              <span className="font-display text-[9px] text-muted-foreground italic uppercase tracking-wider flex items-center">
                                Citadel Laws forbid wagering on your own battle
                              </span>
                            ) : wager.isLocked ? (
                              <span className="font-display text-[9px] text-red-500/60 uppercase tracking-wider flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Wagers closed for this round
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setSelectedWager(wager);
                                  setBetSide("A");
                                  setBetAmount(10);
                                  setBettingError("");
                                  setBettingSuccess("");
                                  setShowBetModal(true);
                                }}
                                className="btn-gold solid !py-1 !px-4 !text-[9px]"
                              >
                                ⚔️ Place Wager
                              </button>
                            )}
                          </div>
</div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: STATS */}
            {activeTab === "stats" && (
              <div className="frame-corners p-6 rounded-sm">
                <Corners />
                <div className="flex items-center gap-3 mb-6">
                  <Trophy className="w-5 h-5 text-gold-bright" />
                  <h2 className="font-display text-xl text-white uppercase tracking-wider">Hall of Records</h2>
                </div>
                <p className="text-xs text-white/50 mb-6 leading-relaxed font-body">
                  Review your achievements, ratings, win streaks, and triumphs recorded in the Citadel's grand archives.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-testid="stats-grid">
                  {[
                    { label: "Battles Fought", value: stats.participated, Icon: Swords, testid: "stat-participated" },
                    { label: "Triumphs", value: stats.won, Icon: Trophy, testid: "stat-won" },
                    { label: "Defeats", value: stats.lost, Icon: Skull, testid: "stat-lost" },
                    { label: "Stalemates", value: stats.drawn, Icon: Shield, testid: "stat-drawn" },
                    { label: "Win Rate", value: `${stats.win_rate}%`, Icon: Crown, testid: "stat-winrate" },
                    { label: "Level Progression", value: `LVL ${xpLevel}`, Icon: Sparkles, testid: "stat-level" },
                  ].map(({ label, value, Icon, testid }) => (
                    <div key={label} className="frame-corners p-6 text-center hover-lift rounded-sm" data-testid={testid}>
                      <Corners />
                      <Icon className="w-5 h-5 mx-auto text-gold-bright mb-2.5 animate-pulse" />
                      <div className="font-display text-2xl text-white font-bold">{value}</div>
                      <div className="font-display text-[9px] text-white/50 mt-1 tracking-wider uppercase">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </main>
        </div>

        {/* FOOTER SIGILS */}
        <section className="relative mt-5 pt-6">
          <div className="divider-ornate" />
          <div className="flex items-center justify-center gap-8 md:gap-12 mt-4 opacity-55">
            {[sigilStark, sigilLannister, sigilTargaryen, sigilMartell, sigilGreyjoy].map((s, i) => (
              <img key={i} src={s} alt="" className="w-8 h-8 object-contain grayscale hover:grayscale-0 transition duration-300" />
            ))}
          </div>
          <div className="text-center font-display text-[8px] tracking-[0.4em] text-muted-foreground/60 mt-4 uppercase">
            WINTER IS COMING · DEBATE. CONQUER. RULE.
          </div>
        </section>
      </div>

      {/* PLACE WAGER MODAL */}
      {showBetModal && selectedWager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4">
          <div className="frame-corners frame-ornate p-6 max-w-sm w-full relative bg-black/95">
            <Corners />
            <h3 className="font-display text-base text-gold-grad text-center mb-1 uppercase">
              REGISTER WAGER
            </h3>
            <p className="font-body italic text-center text-[10px] text-white/40 mb-4 leading-normal">
              Enter your gold stake and pick which House will dominate the scrolls.
            </p>

            {bettingError && <div className="bg-red-500/10 border border-red-500/35 text-red-400 text-xs p-3 mb-4 rounded-sm text-center">{bettingError}</div>}
            {bettingSuccess && <div className="bg-emerald-500/10 border border-emerald-500/35 text-emerald-400 text-xs p-3 mb-4 rounded-sm text-center">{bettingSuccess}</div>}

            <div className="space-y-3.5">
              {/* Topic display */}
              <div className="p-2 border border-white/5 bg-black/50 text-[10px] text-white/80 rounded-sm">
                <span className="font-display text-[8px] text-muted-foreground uppercase block mb-1">Debate Topic</span>
                {selectedWager.topic}
              </div>

              {/* Side pick */}
              <div>
                <label className="text-[8px] text-white/50 block mb-1 font-semibold tracking-wider font-sans uppercase">Select Champion Side</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBetSide("A")}
                    className={`flex-1 py-1.5 px-2 border rounded-sm font-display text-[10px] tracking-widest text-center transition-all ${
                      betSide === "A" 
                        ? "border-gold bg-gold/10 text-gold-bright font-bold" 
                        : "border-white/5 bg-black/30 text-white/30"
                    }`}
                  >
                    Side A: {selectedWager.participantA} ({selectedWager.userAStance})
                  </button>
                  <button
                    type="button"
                    onClick={() => setBetSide("B")}
                    className={`flex-1 py-1.5 px-2 border rounded-sm font-display text-[10px] tracking-widest text-center transition-all ${
                      betSide === "B" 
                        ? "border-gold bg-gold/10 text-gold-bright font-bold" 
                        : "border-white/5 bg-black/30 text-white/30"
                    }`}
                  >
                    Side B: {selectedWager.participantB} ({selectedWager.userBStance})
                  </button>
                </div>
              </div>

              {/* Stake input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[8px] text-white/50 font-semibold tracking-wider font-sans uppercase">Gold Coins Stake</label>
                  <span className="text-[8px] text-muted-foreground font-sans uppercase">Balance: {user.coins} GOLD</span>
                </div>
                <div className="relative">
                  <input 
                    type="number"
                    min="10"
                    value={betAmount}
                    onChange={e => setBetAmount(Math.max(1, Number(e.target.value)))}
                    className="bg-black border border-border text-xs text-white w-full py-1.5 pl-2 pr-8 focus:outline-none"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-display text-muted-foreground">GOLD</span>
                </div>

                {/* Quick bets */}
                <div className="flex gap-1.5 mt-2">
                  {[10, 25, 50].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBetAmount(val)}
                      className="flex-1 py-0.5 border border-white/10 hover:border-gold/30 bg-black/40 text-[9px] text-white/70 hover:text-white rounded-sm transition-colors uppercase font-display"
                    >
                      {val}G
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBetAmount(Math.floor(user.coins * 0.5))}
                    className="flex-1 py-0.5 border border-white/10 hover:border-gold/30 bg-black/40 text-[9px] text-gold-bright hover:text-white rounded-sm transition-colors uppercase font-display"
                  >
                    Max (50%)
                  </button>
                </div>
              </div>

            </div>

            <div className="flex gap-3.5 mt-5">
              <button 
                onClick={() => setShowBetModal(false)}
                className="btn-gold flex-1 !py-1.5"
                style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
              >
                Cancel
              </button>
              <button 
                onClick={handlePlaceBet}
                className="btn-gold solid flex-1 !py-1.5"
                disabled={bettingSuccess !== ""}
              >
                ⚔️ REGISTER WAGER
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHOOSE BATTLE SETTINGS MODAL */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4">
          <div className="frame-corners frame-ornate p-6 max-w-sm w-full relative bg-black/95">
            <Corners />
            <h3 className="font-display text-base text-gold-grad text-center mb-1 uppercase">
              {modalMode === "matchmaking" ? "COMMENCE MATCHMAKING" : "TRIAL BY AI COMBAT"}
            </h3>
            <p className="font-body italic text-center text-[10px] text-white/40 mb-4 leading-normal">
              Declare your thesis and pick your side before taking the field.
            </p>

            <div className="space-y-3.5">
              {/* Predefined / Custom selector */}
              <div>
                <label className="text-[8px] text-white/50 block mb-1 font-semibold tracking-wider font-sans uppercase">Topic Source</label>
                <div className="flex gap-1.5">
                  <button 
                    type="button"
                    onClick={() => setCustomTopicActive(false)}
                    className={`flex-1 btn-gold !py-1 !px-2 !text-[9px] uppercase ${!customTopicActive ? 'solid' : ''}`}
                  >
                    Citadel Scrolls
                  </button>
                  <button 
                    type="button"
                    onClick={() => setCustomTopicActive(true)}
                    className={`flex-1 btn-gold !py-1 !px-2 !text-[9px] uppercase ${customTopicActive ? 'solid' : ''}`}
                  >
                    Custom Thesis
                  </button>
                </div>
              </div>

              {/* Topic Select Input */}
              <div>
                <label className="text-[8px] text-white/50 block mb-1 font-semibold tracking-wider font-sans uppercase">Resolution Statement</label>
                {!customTopicActive ? (
                  <select 
                    value={modalTopic}
                    onChange={e => setModalTopic(e.target.value)}
                    className="bg-black border border-border text-[11px] text-white w-full py-1.5 px-2 focus:outline-none"
                  >
                    {predefinedTopics.map(t => (
                      <option key={t.id} value={t.title}>{t.title}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text"
                    placeholder="e.g. Honor is more important than power"
                    value={customTopicText}
                    onChange={e => setCustomTopicText(e.target.value)}
                    className="bg-black border border-border text-[11px] text-white w-full py-1.5 px-2 focus:outline-none placeholder:text-white/20"
                  />
                )}
              </div>

              {/* Stance Toggle */}
              <div>
                <label className="text-[8px] text-white/50 block mb-1 font-semibold tracking-wider font-sans uppercase">Select Stance</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalStance("FOR")}
                    className={`flex-1 py-1.5 px-2 border rounded-sm font-display text-[10px] tracking-widest text-center transition-all ${
                      modalStance === "FOR" 
                        ? "border-green-500 bg-green-950/20 text-green-400 font-bold" 
                        : "border-white/5 bg-black/30 text-white/30"
                    }`}
                  >
                    FOR
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalStance("AGAINST")}
                    className={`flex-1 py-1.5 px-2 border rounded-sm font-display text-[10px] tracking-widest text-center transition-all ${
                      modalStance === "AGAINST" 
                        ? "border-red-500 bg-red-950/20 text-red-400 font-bold" 
                        : "border-white/5 bg-black/30 text-white/30"
                    }`}
                  >
                    AGAINST
                  </button>
                </div>
              </div>

              {/* Rounds count */}
              <div>
                <label className="text-[8px] text-white/50 block mb-1 font-semibold tracking-wider font-sans uppercase">Debate Rounds</label>
                <select 
                  value={modalRounds}
                  onChange={e => setModalRounds(Number(e.target.value))}
                  className="bg-black border border-border text-[11px] text-white w-full py-1.5 px-2 focus:outline-none"
                >
                  <option value="1">1 Round</option>
                  <option value="2">2 Rounds</option>
                  <option value="3">3 Rounds</option>
                  <option value="4">4 Rounds</option>
                  <option value="5">5 Rounds</option>
                </select>
              </div>

              {/* Difficulty selector (AI mode only) */}
              {modalMode === "practice" && (
                <div>
                  <label className="text-[8px] text-white/50 block mb-1 font-semibold tracking-wider font-sans uppercase">AI Difficulty</label>
                  <div className="flex gap-1.5">
                    {["easy", "medium", "hard"].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setModalDifficulty(d)}
                        className={`flex-1 btn-gold !py-1 !px-1.5 !text-[8px] uppercase ${modalDifficulty === d ? 'solid' : ''}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3.5 mt-5">
              <button 
                onClick={() => setShowSetupModal(false)}
                className="btn-gold flex-1 !py-1.5"
                style={{ borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}
              >
                Retreat
              </button>
              <button 
                onClick={handleCommenceBattle}
                className="btn-gold solid flex-1 !py-1.5"
              >
                ⚔️ COMMENCE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
