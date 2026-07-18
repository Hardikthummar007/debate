import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import TopNav from '@/components/TopNav';
import ThemeEffects from '@/components/ThemeEffects';
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import './App.css';
import { Swords, Crown, Flame, Shield, Skull, Coins, Sparkles, CheckCircle, Trophy, User as UserIcon } from 'lucide-react';


const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8082';

// Custom SVG Icons to avoid external dependencies
const Icons = {
  Stats: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
  ),
  Mic: ({ active }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
  ),
  Profile: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
  ),
  SignOut: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
  ),
  Loading: () => (
    <svg className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line><style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style></svg>
  )
};

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#0A0A0B' }}>
        <Icons.Loading />
      </div>
    );
  }

  return (
    <Router>
      <ThemeEffects />
      <TopNav />
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/dashboard" />} />
        
        {/* Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* Protected Battle Pages */}
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/profile" element={user ? <Profile /> : <Navigate to="/login" />} />
        <Route path="/topics" element={user ? <TopicSelection /> : <Navigate to="/login" />} />
        <Route path="/queue" element={user ? <MatchmakingQueue /> : <Navigate to="/login" />} />
        <Route path="/debate/:id" element={user ? <DebateRoom /> : <Navigate to="/login" />} />
        <Route path="/private-debate/:roomCode" element={user ? <PrivateDebateRoom /> : <Navigate to="/login" />} />
        <Route path="/results/:id" element={user ? <ResultPage /> : <Navigate to="/login" />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

// -------------------------
// PAGE COMPONENTS
// -------------------------

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '90vh', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div className="royal-card" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px' }}>
        <h2 className="heading text-gold-gradient text-3xl mb-2 text-center font-bold">Welcome Back</h2>
        <p className="medieval" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '24px', textAlign: 'center', letterSpacing: '0.1em' }}>
          ENTER THE ARENA OF TRUTH
        </p>
        
        {error && <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Your Username</label>
            <input type="text" className="input-royal" required value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Your Password</label>
            <input type="password" className="input-royal" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-royal solid w-full mt-4" disabled={submitting}>
            {submitting ? 'Entering...' : 'Enter Arena'}
          </button>
        </form>

        <p className="medieval text-center text-xs mt-6" style={{ color: 'var(--text-secondary)' }}>
          Not yet a member? <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '600' }}>Join the realm</Link>
        </p>
      </div>
    </div>
  );
}

function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await register(username, email, password);
      setSuccess('Registration successful! Entering the Throne Room...');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '90vh', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div className="royal-card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px' }}>
        <h2 className="heading text-gold-gradient text-3xl mb-2 text-center font-bold">Join the Realm</h2>
        <p className="medieval" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '24px', textAlign: 'center', letterSpacing: '0.1em' }}>
          DECLARE YOUR ALLEGIANCE
        </p>
        
        {error && <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '16px', fontSize: '0.9rem' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Chosen Username</label>
            <input type="text" className="input-royal" required value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Email Address</label>
            <input type="email" className="input-royal" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Security Password</label>
            <input type="password" className="input-royal" required value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-royal solid w-full mt-4" disabled={submitting}>
            {submitting ? 'Enrolling...' : 'Join Realm'}
          </button>
        </form>

        <p className="medieval text-center text-xs mt-6" style={{ color: 'var(--text-secondary)' }}>
          Already a warrior? <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '600' }}>Login here</Link>
        </p>
      </div>
    </div>
  );
}

function Profile() {
  const { user, updateProfile } = useAuth();
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState('');
  const [avatar, setAvatar] = useState(user.profilePicture || '');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await updateProfile({
        username,
        email,
        password: password.trim() ? password : null,
        profilePicture: avatar
      });
      setSuccess('Sigil details updated successfully!');
      setPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '600px', marginTop: '40px' }}>
      <div className="royal-card p-8">
        <h2 className="heading text-gold-gradient text-3xl mb-2 font-bold">House Settings</h2>
        <p className="medieval" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '24px' }}>
          UPDATE YOUR SIGIL AND CREDENTIALS
        </p>

        {error && <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', marginBottom: '16px', fontSize: '0.9rem' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '16px', fontSize: '0.9rem' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Champion Name</label>
            <input type="text" className="input-royal" required value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Raven Email</label>
            <input type="email" className="input-royal" required value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Custom Avatar URL (Optional)</label>
            <input type="text" className="input-royal" placeholder="https://example.com/avatar.png" value={avatar} onChange={e => setAvatar(e.target.value)} />
          </div>
          <div>
            <label className="medieval" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>New Secret Password (Leave blank to keep current)</label>
            <input type="password" className="input-royal" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="submit" className="btn-royal solid" disabled={submitting}>
              {submitting ? 'Updating...' : 'Save Settings'}
            </button>
            <Link to="/" style={{ textDecoration: 'none' }}>
              <button type="button" className="btn-royal">Cancel</button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function TopicSelection() {
  const token = localStorage.getItem('debait_token');
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [stance, setStance] = useState('FOR');
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customTopic, setCustomTopic] = useState('');
  const [difficulty, setDifficulty] = useState('medium');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/topics`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => {
        setTopics(data);
        if (data.length > 0) setSelectedTopic(data[0].title);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [token]);

  const handleStartQueue = async (e) => {
    e.preventDefault();
    const activeTopic = isCustomTopic ? customTopic.trim() : selectedTopic;
    if (isCustomTopic && (!activeTopic || activeTopic.length < 5)) {
      alert('Please enter a custom topic of at least 5 characters.');
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`${API_BASE}/api/matchmaking/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ topic: activeTopic, stance })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('debait_stance', stance);
        localStorage.setItem('debait_topic', activeTopic);
        navigate('/queue');
      }
    } catch (err) {
      alert('Failed to connect to matchmaking server.');
    } finally {
      setJoining(false);
    }
  };

  const handlePracticeInstant = async () => {
    const activeTopic = isCustomTopic ? customTopic.trim() : selectedTopic;
    if (isCustomTopic && (!activeTopic || activeTopic.length < 5)) {
      alert('Please enter a custom topic of at least 5 characters.');
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`${API_BASE}/api/matchmaking/practice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ topic: activeTopic, stance, difficulty })
      });
      const data = await res.json();
      if (res.ok && data.status === 'MATCHED') {
        localStorage.setItem('debait_stance', stance);
        localStorage.setItem('debait_topic', activeTopic);
        navigate(`/debate/${data.debateSessionId}`);
      }
    } catch (err) {
      alert('Failed to connect to matchmaking server.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '80vh', justifyContent: 'center', alignItems: 'center' }}>
        <Icons.Loading />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '650px' }}>
      <div className="glass-panel">
        <h2 className="glow-text" style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>Select Your Ground</h2>
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: '32px' }}>Choose a debate topic, pick your stance, and match with an opponent.</p>

        <form onSubmit={handleStartQueue} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Topic Mode Tabs */}
          <div className="topic-tabs">
            <button
              type="button"
              className={`topic-tab-btn ${!isCustomTopic ? 'active' : ''}`}
              onClick={() => setIsCustomTopic(false)}
            >
              Browse Predefined
            </button>
            <button
              type="button"
              className={`topic-tab-btn ${isCustomTopic ? 'active' : ''}`}
              onClick={() => setIsCustomTopic(true)}
            >
              Create Custom
            </button>
          </div>

          {!isCustomTopic ? (
            <div>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Choose Topic</label>
              <select className="form-input" style={{ background: '#1c1830', padding: '14px' }} value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)}>
                {topics.map(t => (
                  <option key={t.id} value={t.title}>{t.title}</option>
                ))}
              </select>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                {topics.find(t => t.title === selectedTopic)?.description}
              </p>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>Custom Topic Title</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Remote work increases overall productivity"
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                maxLength={200}
                style={{ background: '#1c1830', padding: '14px' }}
                required
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
                Write your own custom thesis/topic statement. Stating it clearly as a resolution (e.g. "X is better than Y" or "A should do B") makes for the best debates.
              </p>
            </div>
          )}

          <div>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '12px', fontWeight: '600' }}>Choose Stance</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div 
                onClick={() => setStance('FOR')} 
                style={{
                  flex: 1, padding: '20px', border: `2px solid ${stance === 'FOR' ? 'var(--for-color)' : 'var(--border-card)'}`,
                  borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: stance === 'FOR' ? 'rgba(16, 185, 129, 0.05)' : 'transparent', transition: 'all 0.2s'
                }}
              >
                <span style={{ color: 'var(--for-color)', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '1px' }}>FOR</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Support the resolution</span>
              </div>
              <div 
                onClick={() => setStance('AGAINST')} 
                style={{
                  flex: 1, padding: '20px', border: `2px solid ${stance === 'AGAINST' ? 'var(--against-color)' : 'var(--border-card)'}`,
                  borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: stance === 'AGAINST' ? 'rgba(239, 68, 68, 0.05)' : 'transparent', transition: 'all 0.2s'
                }}
              >
                <span style={{ color: 'var(--against-color)', fontSize: '1.4rem', fontWeight: '800', letterSpacing: '1px' }}>AGAINST</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Negate the resolution</span>
              </div>
            </div>
          </div>

          {/* AI Difficulty Selector */}
          <div>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', fontWeight: '600' }}>AI Opponent Difficulty</label>
            <div className="topic-tabs" style={{ maxWidth: '300px' }}>
              <button
                type="button"
                className={`topic-tab-btn ${difficulty === 'easy' ? 'active' : ''}`}
                onClick={() => setDifficulty('easy')}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                Easy
              </button>
              <button
                type="button"
                className={`topic-tab-btn ${difficulty === 'medium' ? 'active' : ''}`}
                onClick={() => setDifficulty('medium')}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                Medium
              </button>
              <button
                type="button"
                className={`topic-tab-btn ${difficulty === 'hard' ? 'active' : ''}`}
                onClick={() => setDifficulty('hard')}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
              >
                Hard
              </button>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
              {difficulty === 'easy' && "Easy: AI uses simple language and basic, easy-to-counter arguments."}
              {difficulty === 'medium' && "Medium: AI uses standard logic and balanced debate arguments."}
              {difficulty === 'hard' && "Hard: AI challenges you with deep analysis, facts, and counterpoints."}
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
            <button type="submit" className="glow-btn pulsing-glow" style={{ padding: '16px', fontSize: '1.1rem' }} disabled={joining}>
              {joining ? 'Entering Arena Queue...' : 'Find Opponent (Online Match)'}
            </button>
            <button 
              type="button" 
              className="secondary-btn" 
              onClick={handlePracticeInstant} 
              style={{ padding: '16px', fontSize: '1.1rem', border: '1px solid var(--accent)', color: 'var(--accent-light)' }} 
              disabled={joining}
            >
              Practice vs AI (Instant Match)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MatchmakingQueue() {
  const token = localStorage.getItem('debait_token');
  const [seconds, setSeconds] = useState(0);
  const navigate = useNavigate();
  const topic = localStorage.getItem('debait_topic') || 'AI vs Human';
  const stance = localStorage.getItem('debait_stance') || 'FOR';

  useEffect(() => {
    // Timer
    const timer = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    // Polling matchmaking status
    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/matchmaking/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok && data.status === 'MATCHED') {
          clearInterval(timer);
          clearInterval(pollInterval);
          navigate(`/debate/${data.debateSessionId}`);
        }
      } catch (err) {
        // Silent error to prevent polling UI glitches
      }
    };

    // Initial check
    checkStatus();
    
    // Poll every 2 seconds
    const pollInterval = setInterval(checkStatus, 2000);

    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [token, navigate]);

  const handleCancel = async () => {
    try {
      await fetch(`${API_BASE}/api/matchmaking/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/');
    } catch (err) {
      navigate('/');
    }
  };

  const handleStartPractice = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/matchmaking/practice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ topic, stance })
      });
      const data = await res.json();
      if (res.ok && data.status === 'MATCHED') {
        navigate(`/debate/${data.debateSessionId}`);
      }
    } catch (err) {
      console.error("Practice start failed:", err);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '500px', display: 'flex', minHeight: '80vh', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-panel" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', textAlign: 'center' }}>
        
        {/* Loading Spinner */}
        <div style={{ position: 'relative', width: '100px', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '50%', border: '4px solid rgba(139, 92, 246, 0.1)', borderTop: '4px solid var(--accent)', animation: 'spin 1.5s linear infinite' }} />
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          <div style={{ position: 'absolute', color: 'var(--accent-light)', fontWeight: 'bold' }}>{seconds}s</div>
        </div>

        <h3 className="glow-text" style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '8px' }}>Assembling the Arena</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '20px' }}>Matching you with a speaker of opposite opinion.</p>

        <div style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)', borderRadius: '10px', marginBottom: '30px', textAlign: 'left' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>TOPIC</div>
          <div style={{ fontWeight: '700', fontSize: '1rem', margin: '4px 0 12px 0' }}>{topic}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>YOUR STANCE</div>
          <div style={{ fontWeight: '800', marginTop: '4px' }} className={stance === 'FOR' ? 'stance-for' : 'stance-against'}>{stance}</div>
        </div>

        {seconds >= 5 && (
          <button 
            className="glow-btn pulsing-glow" 
            onClick={handleStartPractice} 
            style={{ width: '100%', marginBottom: '12px', fontSize: '1rem' }}
          >
            🤖 Practice with AI Opponent
          </button>
        )}
        <button className="secondary-btn" onClick={handleCancel} style={{ border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', width: '100%' }}>Cancel Queue</button>
      </div>
    </div>
  );
}

const renderSpeechBubbleContent = (arg) => {
  if (!arg.rawTranscript) return arg.content;
  try {
    const parsed = JSON.parse(arg.rawTranscript);
    if (!parsed.segments || parsed.segments.length === 0) {
      return arg.content;
    }
    
    let formattedText = '';
    parsed.segments.forEach(seg => {
      formattedText += seg.text + ' ';
      if (seg.pause_after && seg.pause_after >= 1.0) {
        formattedText += `[pause:${seg.pause_after}s] `;
      }
    });
    return formattedText.trim();
  } catch (e) {
    return arg.rawTranscript || arg.content;
  }
};

function DebateRoom() {
  const { user } = useAuth();
  const token = localStorage.getItem('debait_token');
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [showClash, setShowClash] = useState(false);
  const [argumentText, setArgumentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [streamingProgress, setStreamingProgress] = useState(null);
  const [aiDraftArgument, setAiDraftArgument] = useState('');
  const [aiStreamingProgress, setAiStreamingProgress] = useState(null);
  const [aiSubmitting, setAiSubmitting] = useState(false);
  const aiTurnTriggeredRef = useRef('');
  
  // Speech Recognition state variables (pause-resilient)
  const [isListening, setIsListening] = useState(false);
  const [shouldBeListening, setShouldBeListening] = useState(false);
  const recognitionRef = useRef(null);

  const shouldBeListeningRef = useRef(shouldBeListening);
  useEffect(() => {
    shouldBeListeningRef.current = shouldBeListening;
  }, [shouldBeListening]);

  const argumentTextRef = useRef(argumentText);
  useEffect(() => {
    argumentTextRef.current = argumentText;
  }, [argumentText]);

  // Speech timing and disfluency tracking references
  const recordedWordsRef = useRef([]);
  const lastProcessedIndexRef = useRef(0);

  const compileStructuredTranscript = (wordsList) => {
    if (wordsList.length === 0) {
      return JSON.stringify({ text: "", segments: [] });
    }

    const segments = [];
    const startTime = wordsList[0].time;
    const text = wordsList.map(w => w.word).join(" ");

    for (let i = 0; i < wordsList.length; i++) {
      const current = wordsList[i];
      const word = current.word;
      const time = current.time;
      
      const relStart = (time - startTime) / 1000;
      const duration = 0.3;
      const relEnd = relStart + duration;

      let pauseAfter = 0.0;
      if (i < wordsList.length - 1) {
        const nextTime = wordsList[i+1].time;
        const timeDiff = (nextTime - time) / 1000;
        if (timeDiff > duration) {
          pauseAfter = parseFloat((timeDiff - duration).toFixed(2));
        }
      }

      segments.push({
        text: word,
        start: parseFloat(relStart.toFixed(2)),
        end: parseFloat(relEnd.toFixed(2)),
        pause_after: pauseAfter
      });
    }

    return JSON.stringify({
      text: text,
      segments: segments
    }, null, 2);
  };

  // renderSpeechBubbleContent moved to module scope

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/debates/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        if (data.status === 'COMPLETED') {
          navigate(`/results/${id}`);
        }
      }
    } catch (err) {
      // Polling failure fallback
    }
  }, [id, token, navigate]);

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 3000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  const triggerAiTurnStream = useCallback(async () => {
    setAiSubmitting(true);
    setAiDraftArgument('');
    setAiStreamingProgress({
      ddg: { status: 'pending' },
      judge3: { status: 'pending' },
      judge1: { status: 'pending' },
      judge2: { status: 'pending' },
      judge4: { status: 'pending' },
      judge5: { status: 'pending' },
      final: { status: 'pending' }
    });

    try {
      const res = await fetch(`${API_BASE}/api/debates/${id}/ai-turn`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        setAiSubmitting(false);
        setAiStreamingProgress(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleSseEvent = (event, data) => {
        if (event === 'ai_argument') {
          setAiDraftArgument(data.argument);
          return;
        }

        setAiStreamingProgress(prev => {
          if (!prev) return prev;
          const next = { ...prev };
          
          switch (event) {
            case 'ddg_start':
              next.ddg = { status: 'running', detail: data.message };
              break;
            case 'ddg_complete':
              next.ddg = { status: 'completed', detail: data.message };
              break;
            case 'judge3_start':
              next.judge3 = { ...next.judge3, status: 'running', reasoning: data.message };
              break;
            case 'judge3_complete':
              next.judge3 = {
                status: 'completed',
                score: data.topic_score,
                novelty: data.novelty_score,
                reasoning: data.reasoning
              };
              break;
            case 'judge1_start':
              next.judge1 = { ...next.judge1, status: 'running', reasoning: data.message };
              break;
            case 'judge1_complete':
              next.judge1 = {
                status: 'completed',
                score: data.fact_score,
                reasoning: data.reasoning,
                facts: data.retrieved_facts
              };
              break;
            case 'judge2_start':
              next.judge2 = { ...next.judge2, status: 'running', reasoning: data.message };
              break;
            case 'judge2_complete':
              next.judge2 = {
                status: 'completed',
                score: data.related_score,
                reasoning: data.reasoning
              };
              break;
            case 'judge4_start':
              next.judge4 = { ...next.judge4, status: 'running', reasoning: data.message };
              break;
            case 'judge4_complete':
              next.judge4 = {
                status: 'completed',
                score: data.stance_score,
                reasoning: data.reasoning
              };
              break;
            case 'judge5_start':
              next.judge5 = { ...next.judge5, status: 'running', reasoning: data.message };
              break;
            case 'judge5_complete':
              next.judge5 = {
                status: 'completed',
                score: data.delivery_score,
                reasoning: data.reasoning
              };
              break;
            case 'final_result_start':
              next.final = { status: 'running', score: null };
              break;
            case 'final_result':
              next.final = {
                status: 'completed',
                score: data.final_score
              };
              break;
            case 'done':
              fetchSession();
              setTimeout(() => {
                setAiSubmitting(false);
                setAiDraftArgument('');
                setAiStreamingProgress(null);
              }, 2500);
              break;
            case 'error':
              setAiSubmitting(false);
              setAiDraftArgument('');
              setAiStreamingProgress(null);
              break;
            default:
              break;
          }
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const lines = block.split('\n');
          let eventName = null;
          let dataVal = null;

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              dataVal = line.substring(5).trim();
            }
          }

          if (dataVal) {
            try {
              const parsed = JSON.parse(dataVal);
              handleSseEvent(eventName, parsed);
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setAiSubmitting(false);
      setAiDraftArgument('');
      setAiStreamingProgress(null);
    }
  }, [id, token, fetchSession]);

  useEffect(() => {
    if (!session || session.status !== 'ACTIVE' || !session.currentUser) {
      return;
    }
    const isAiTurn = session.currentUser.username === 'AI_Opponent';
    if (isAiTurn && aiTurnTriggeredRef.current !== session.id + "_" + session.currentRound) {
      aiTurnTriggeredRef.current = session.id + "_" + session.currentRound;
      triggerAiTurnStream();
    }
  }, [session, triggerAiTurnStream]);

  // Pause-Resilient Speech Recognition initialization
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let textBeforeThisTurn = '';

    rec.onstart = () => {
      setIsListening(true);
      // Capture current text to append to it
      textBeforeThisTurn = argumentTextRef.current;
      lastProcessedIndexRef.current = 0;
    };

    rec.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Track newly finalized words and timestamps
      let newFinalWords = [];
      for (let i = lastProcessedIndexRef.current; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const trans = event.results[i][0].transcript.trim();
          const words = trans.split(/\s+/).filter(Boolean);
          words.forEach(w => {
            newFinalWords.push({ word: w, time: Date.now() });
          });
          lastProcessedIndexRef.current = i + 1;
        }
      }
      if (newFinalWords.length > 0) {
        recordedWordsRef.current = [...recordedWordsRef.current, ...newFinalWords];
      }

      const fullTranscribedText = (finalTranscript + interimTranscript).trim();
      if (fullTranscribedText) {
        // Append to existing text nicely
        const cleanPrefix = textBeforeThisTurn ? textBeforeThisTurn.trim() + ' ' : '';
        setArgumentText(cleanPrefix + fullTranscribedText);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      // 🔥 If the dictation is explicitly active, auto-restart the speech API
      if (shouldBeListeningRef.current) {
        setTimeout(() => {
          try {
            if (shouldBeListeningRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (e) {
            // Speech engine restart glitch handled gracefully
          }
        }, 150);
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') {
        // Fail-silent, let onend handle the auto-restart block
        return;
      }
      setIsListening(false);
      setShouldBeListening(false);
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported or not enabled in your browser. Try Google Chrome.');
      return;
    }

    if (shouldBeListening) {
      // User requested stop
      setShouldBeListening(false);
      recognitionRef.current.stop();
    } else {
      // User requested start
      setShouldBeListening(true);
      recordedWordsRef.current = [];
      lastProcessedIndexRef.current = 0;
      try {
        recognitionRef.current.start();
      } catch (err) {
        // Already active
      }
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!argumentText.trim()) return;

    setError('');
    setSubmitting(true);
    setShowClash(true);
    setTimeout(() => setShowClash(false), 900);
    setStreamingProgress({
      ddg: { status: 'pending', detail: '' },
      judge3: { status: 'pending', score: null, novelty: null, reasoning: '' },
      judge1: { status: 'pending', score: null, reasoning: '', facts: '' },
      judge2: { status: 'pending', score: null, reasoning: '' },
      judge4: { status: 'pending', score: null, reasoning: '' },
      judge5: { status: 'pending', score: null, reasoning: '' },
      final: { status: 'pending', score: null }
    });

    // Unconditionally stop dictation on submission
    setShouldBeListening(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    // Generate the structured JSON transcript
    let finalRawTranscript = '';
    if (recordedWordsRef.current.length > 0) {
      finalRawTranscript = compileStructuredTranscript(recordedWordsRef.current);
    } else {
      finalRawTranscript = JSON.stringify({
        text: argumentText,
        segments: argumentText.split(/\s+/).filter(Boolean).map((w, idx) => ({
          text: w,
          start: idx * 0.4,
          end: idx * 0.4 + 0.3,
          pause_after: 0.0
        }))
      }, null, 2);
    }

    try {
      const res = await fetch(`${API_BASE}/api/debates/${id}/argument`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          content: argumentText,
          rawTranscript: finalRawTranscript || argumentText
        })
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit argument');
        setSubmitting(false);
        setStreamingProgress(null);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const handleSseEvent = (event, data) => {
        setStreamingProgress(prev => {
          if (!prev) return prev;
          const next = { ...prev };
          
          switch (event) {
            case 'ddg_start':
              next.ddg = { status: 'running', detail: data.message };
              break;
            case 'ddg_complete':
              next.ddg = { status: 'completed', detail: data.message };
              break;
            case 'judge3_start':
              next.judge3 = { ...next.judge3, status: 'running', reasoning: data.message };
              break;
            case 'judge3_complete':
              next.judge3 = {
                status: 'completed',
                score: data.topic_score,
                novelty: data.novelty_score,
                reasoning: data.reasoning
              };
              break;
            case 'judge1_start':
              next.judge1 = { ...next.judge1, status: 'running', reasoning: data.message };
              break;
            case 'judge1_complete':
              next.judge1 = {
                status: 'completed',
                score: data.fact_score,
                reasoning: data.reasoning,
                facts: data.retrieved_facts
              };
              break;
            case 'judge2_start':
              next.judge2 = { ...next.judge2, status: 'running', reasoning: data.message };
              break;
            case 'judge2_complete':
              next.judge2 = {
                status: 'completed',
                score: data.related_score,
                reasoning: data.reasoning
              };
              break;
            case 'judge4_start':
              next.judge4 = { ...next.judge4, status: 'running', reasoning: data.message };
              break;
            case 'judge4_complete':
              next.judge4 = {
                status: 'completed',
                score: data.stance_score,
                reasoning: data.reasoning
              };
              break;
            case 'judge5_start':
              next.judge5 = { ...next.judge5, status: 'running', reasoning: data.message };
              break;
            case 'judge5_complete':
              next.judge5 = {
                status: 'completed',
                score: data.delivery_score,
                reasoning: data.reasoning
              };
              break;
            case 'final_result_start':
              next.final = { status: 'running', score: null };
              break;
            case 'final_result':
              next.final = {
                status: 'completed',
                score: data.final_score
              };
              break;
            case 'done':
              setArgumentText('');
              recordedWordsRef.current = [];
              fetchSession();
              setTimeout(() => {
                setSubmitting(false);
                setStreamingProgress(null);
              }, 2500);
              break;
            case 'error':
              setError(data.error || 'AI Evaluation encountered an error');
              setSubmitting(false);
              setStreamingProgress(null);
              break;
            default:
              break;
          }
          return next;
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          const lines = block.split('\n');
          let eventName = '';
          let dataStr = '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              eventName = line.substring(6).trim();
            } else if (line.startsWith('data:')) {
              dataStr = line.substring(5).trim();
            }
          }

          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              handleSseEvent(eventName, data);
            } catch (e) {
              console.error('Error parsing SSE event data:', e);
            }
          }
        }
      }
    } catch (err) {
      setError('Connection to server failed.');
      setSubmitting(false);
      setStreamingProgress(null);
    }
  };

  if (!session) {
    return (
      <div style={{ display: 'flex', height: '80vh', justifyContent: 'center', alignItems: 'center' }}>
        <Icons.Loading />
      </div>
    );
  }

  const isMyTurn = session.currentUser && session.currentUser.id === user.id;
  const myStance = session.participantA.id === user.id ? session.userAStance : session.userBStance;
  const opponentName = session.participantA.id === user.id ? session.participantB.username : session.participantA.username;
  const opponentStance = session.participantA.id === user.id ? session.userBStance : session.userAStance;

  // Calculate dynamic combat HP based on round margins
  let userHP = 100;
  let oppHP = 100;
  if (session && session.rounds) {
    session.rounds.forEach(r => {
      if (r.arguments && r.arguments.length === 2) {
        let scoreA = 0;
        let scoreB = 0;
        r.arguments.forEach(arg => {
          if (arg.userId === user.id) scoreA = arg.score;
          else scoreB = arg.score;
        });
        if (scoreA > scoreB) {
          oppHP -= (scoreA - scoreB);
        } else {
          userHP -= (scoreB - scoreA);
        }
      }
    });
  }
  userHP = Math.max(20, Math.min(100, userHP));
  oppHP = Math.max(20, Math.min(100, oppHP));

  return (
    <div className="bg-stone-texture noise-overlay min-h-screen relative" style={{ paddingBottom: '60px' }}>
      {showClash && <div className="clash-fx">⚔</div>}

      {/* ── ARENA HEADER ── */}
      <div style={{ background: 'linear-gradient(180deg, rgba(10,10,11,0.98) 0%, rgba(10,10,11,0.85) 100%)', borderBottom: '1px solid rgba(212,175,55,0.2)', padding: '20px 0 16px' }}>
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div className="medieval" style={{ fontSize: '0.7rem', letterSpacing: '0.25em', color: 'var(--accent)', opacity: 0.75, marginBottom: '6px' }}>⚔ DEBATE ARENA — ROUND {session.currentRound} OF 3 ⚔</div>
            <h1 className="heading text-gold-gradient" style={{ fontSize: 'clamp(1.1rem, 3vw, 1.6rem)', lineHeight: 1.3 }}>{session.topic}</h1>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center', maxWidth: '900px', margin: '0 auto' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.78rem' }}>
                <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '700', color: 'var(--accent)' }}>You</span>
                <span className={`stance-${myStance.toLowerCase()}`} style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }}>{myStance}</span>
                <span className="medieval" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{Math.round(userHP)} HP</span>
              </div>
              <div className="hp-bar"><div className="hp-bar-fill" style={{ width: `${userHP}%` }} /></div>
            </div>
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              <div className="fraktur" style={{ fontSize: '1.5rem', color: 'var(--accent)', lineHeight: 1, textShadow: '0 0 20px var(--accent-glow)' }}>VS</div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.78rem' }}>
                <span className="medieval" style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{Math.round(oppHP)} HP</span>
                <span className={`stance-${opponentStance.toLowerCase()}`} style={{ fontSize: '0.7rem', letterSpacing: '0.1em' }}>{opponentStance}</span>
                <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '700', color: 'var(--text-secondary)' }}>{opponentName}</span>
              </div>
              <div className="hp-bar" style={{ transform: 'scaleX(-1)' }}>
                <div className="hp-bar-fill" style={{ width: `${oppHP}%`, background: 'linear-gradient(90deg, #ef4444, rgba(255,100,100,0.5))' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN ARENA GRID ── */}
      <div className="container" style={{ maxWidth: '1200px', paddingTop: '28px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>

          {/* LEFT: DEBATE LOG + INPUT */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Debate Log */}
            <div className="royal-card" style={{ padding: '24px' }}>
              <h2 className="heading" style={{ fontSize: '1rem', letterSpacing: '0.15em', color: 'var(--accent)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>📜</span> Debate Chronicle
              </h2>
              <div className="divider-royal" style={{ marginBottom: '20px' }}><span className="medieval" style={{ fontSize: '0.65rem', letterSpacing: '0.2em' }}>ARGUMENTS</span></div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '500px', overflowY: 'auto' }} className="no-scrollbar">
                {session.rounds.length === 0 || session.rounds[0].arguments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚔</div>
                    <div className="medieval" style={{ letterSpacing: '0.1em', fontSize: '0.85rem' }}>The arena awaits. Let the debate begin!</div>
                  </div>
                ) : (
                  session.rounds.map((r) => (
                    <div key={r.roundNumber}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <div className="medieval" style={{ fontSize: '0.7rem', letterSpacing: '0.2em', color: 'var(--accent)', whiteSpace: 'nowrap' }}>ROUND {r.roundNumber}</div>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, var(--accent), transparent)' }} />
                        {r.winnerId && (
                          <div style={{ fontSize: '0.7rem', fontFamily: 'Cinzel, serif', color: r.winnerId === user.id ? 'var(--for-color)' : 'var(--against-color)', background: r.winnerId === user.id ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${r.winnerId === user.id ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, padding: '2px 8px', borderRadius: '2px' }}>
                            {r.winnerId === user.id ? '👑 You won this round' : `${opponentName} won this round`}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {r.arguments.map((arg, idx) => {
                          const isMe = arg.userId === user.id;
                          const stance = isMe ? myStance : opponentStance;
                          return (
                            <div key={idx} className={`glass-panel card-${stance.toLowerCase()}`} style={{ padding: '16px', background: isMe ? 'rgba(212,175,55,0.03)' : 'rgba(255,255,255,0.01)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '1rem' }}>{isMe ? '🧑‍⚖️' : '🤺'}</span>
                                  <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '700', fontSize: '0.85rem' }}>{isMe ? 'You' : arg.username}</span>
                                  <span className={`stance-${stance.toLowerCase()}`} style={{ fontSize: '0.7rem' }}>({stance})</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '900', fontSize: '1.1rem', color: 'var(--accent)', textShadow: '0 0 10px var(--accent-glow)' }}>{typeof arg.score === 'number' ? arg.score.toFixed(1) : arg.score}</span>
                                  <span className="medieval" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>pts</span>
                                </div>
                              </div>
                              <p style={{ fontSize: '0.92rem', lineHeight: '1.65', color: 'var(--text-primary)', marginBottom: '12px', whiteSpace: 'pre-wrap' }}>{renderSpeechBubbleContent(arg)}</p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '12px' }}>
                                {[
                                  { label: 'Topic',    val: arg.topicScore },
                                  { label: 'Logic',    val: arg.factScore },
                                  { label: 'Rebuttal', val: arg.relatedScore },
                                  { label: 'Novelty',  val: arg.noveltyScore },
                                  { label: 'Stance',   val: arg.stanceScore },
                                  { label: 'Delivery', val: arg.deliveryScore || 0 },
                                ].map(({ label, val }) => (
                                  <div key={label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '3px', letterSpacing: '0.05em' }}>{label}</div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: '800', color: val >= 70 ? 'var(--for-color)' : val >= 40 ? 'var(--accent)' : 'var(--against-color)' }}>{typeof val === 'number' ? val.toFixed(0) : val}</div>
                                  </div>
                                ))}
                              </div>
                              <details style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
                                <summary className="medieval" style={{ fontSize: '0.7rem', letterSpacing: '0.12em', color: 'var(--accent)', cursor: 'pointer', userSelect: 'none', outline: 'none' }}>▶ View Judge Notes & Web Evidence</summary>
                                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.5', whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '4px' }}>{arg.reasoning}</div>
                                  {arg.retrievedFacts && arg.retrievedFacts.trim() && (
                                    <div style={{ fontSize: '0.7rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto', color: '#9ca3af', border: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'pre-wrap' }}>🔍 {arg.retrievedFacts}</div>
                                  )}
                                </div>
                              </details>
                            </div>
                          );
                        })}
                        {r.roundNumber === session.currentRound && aiDraftArgument && (
                          <div className={`glass-panel card-${opponentStance.toLowerCase()}`} style={{ padding: '16px', borderStyle: 'dashed', borderColor: 'var(--accent)', opacity: 0.85 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '700', fontSize: '0.85rem' }}>🤖 {opponentName}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'Cinzel, serif' }}>Drafting argument...</span>
                            </div>
                            <p style={{ fontSize: '0.92rem', lineHeight: '1.65', whiteSpace: 'pre-wrap' }}>{aiDraftArgument}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ARGUMENT INPUT PANEL */}
            {session.status === 'ACTIVE' && (
              <div className="royal-card" style={{ padding: '24px' }}>
                {isMyTurn ? (
                  streamingProgress ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h3 className="heading" style={{ fontSize: '1rem', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.1em' }}>
                        <span style={{ width: '14px', height: '14px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                        ⚖ Jury Room — Live Evaluation
                      </h3>
                      <div className="divider-royal"><span className="medieval" style={{ fontSize: '0.6rem', letterSpacing: '0.2em' }}>JUDGES DELIBERATING</span></div>
                      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { key: 'ddg',    icon: '🔍', label: 'Web Context (RAG)' },
                          { key: 'judge3', icon: '⚖️', label: 'Judge III — Topicality & Novelty' },
                          { key: 'judge1', icon: '🧠', label: 'Judge I — Logic & Facts' },
                          { key: 'judge2', icon: '💥', label: 'Judge II — Rebuttal' },
                          { key: 'judge4', icon: '🎯', label: 'Judge IV — Stance' },
                          { key: 'judge5', icon: '🎙️', label: 'Judge V — Delivery' },
                          { key: 'final',  icon: '🏆', label: 'Final Compiled Score' },
                        ].map(({ key, icon, label }) => {
                          const s = streamingProgress[key];
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '4px', border: `1px solid ${s.status === 'running' ? 'var(--accent)' : s.status === 'completed' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.05)'}`, background: s.status === 'running' ? 'rgba(212,175,55,0.05)' : s.status === 'completed' ? 'rgba(16,185,129,0.03)' : 'transparent', transition: 'all 0.3s ease' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem', fontWeight: '600' }}>{label}</span>
                              </div>
                              <div style={{ minWidth: '70px', textAlign: 'right' }}>
                                {s.status === 'pending'   && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Queued</span>}
                                {s.status === 'running'   && <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>●</span>}
                                {s.status === 'completed' && <span style={{ color: 'var(--for-color)', fontWeight: '800', fontSize: '0.85rem' }}>{key === 'final' ? `${s.score}` : key === 'judge3' ? `${s.score} / ${s.novelty}` : `${s.score}`} ✓</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="heading" style={{ fontSize: '1rem', letterSpacing: '0.1em', color: 'var(--accent)' }}>⚔ Your Turn to Speak</h3>
                        <button type="button" onClick={toggleSpeech} className="secondary-btn" style={{ borderColor: shouldBeListening ? '#ef4444' : undefined, color: shouldBeListening ? '#ef4444' : undefined, background: shouldBeListening ? 'rgba(239,68,68,0.08)' : undefined }}>
                          <Icons.Mic active={shouldBeListening} />
                          {shouldBeListening ? '● Listening...' : 'Dictate'}
                        </button>
                      </div>
                      <div className="divider-royal" />
                      {error && <div style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '10px 14px', fontSize: '0.85rem', borderRadius: '4px' }}>{error}</div>}
                      <textarea className="input-royal" rows={5} placeholder="Write your argument here. Present evidence, rebut your opponent's logic, and hold your stance with conviction..." required value={argumentText} onChange={e => setArgumentText(e.target.value)} />
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn-royal solid pulsing-glow" disabled={submitting || !argumentText.trim()}>
                          {submitting ? '⚖ Evaluating...' : '⚔ Submit Argument'}
                        </button>
                      </div>
                    </form>
                  )
                ) : (
                  aiStreamingProgress ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h3 className="heading" style={{ fontSize: '1rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '0.1em' }}>
                        <span style={{ width: '14px', height: '14px', border: '2px solid var(--text-secondary)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                        🤖 AI Opponent Being Evaluated...
                      </h3>
                      <div className="divider-royal" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { key: 'ddg', icon: '🔍', label: 'Web Context' },
                          { key: 'judge3', icon: '⚖️', label: 'Topicality & Novelty' },
                          { key: 'judge1', icon: '🧠', label: 'Logic & Facts' },
                          { key: 'judge2', icon: '💥', label: 'Rebuttal Quality' },
                          { key: 'judge4', icon: '🎯', label: 'Stance Consistency' },
                          { key: 'judge5', icon: '🎙️', label: 'Delivery & Eloquence' },
                          { key: 'final', icon: '🏆', label: 'Final Score' },
                        ].map(({ key, icon, label }) => {
                          const s = aiStreamingProgress[key];
                          return (
                            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '4px', border: `1px solid ${s.status === 'running' ? 'rgba(255,255,255,0.15)' : s.status === 'completed' ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.04)'}`, background: s.status === 'running' ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '1.1rem' }}>{icon}</span>
                                <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.78rem' }}>{label}</span>
                              </div>
                              <div>
                                {s.status === 'pending'   && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Queued</span>}
                                {s.status === 'running'   && <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Running...</span>}
                                {s.status === 'completed' && <span style={{ color: 'var(--for-color)', fontWeight: '800' }}>✓ {key === 'final' ? s.score : ''}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 20px' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: '14px', opacity: 0.6 }}>⏳</div>
                      <h3 className="heading" style={{ fontSize: '1rem', color: 'var(--text-secondary)', letterSpacing: '0.12em', marginBottom: '8px' }}>Awaiting {opponentName}</h3>
                      <p className="medieval" style={{ color: 'var(--text-muted)', fontSize: '0.78rem', letterSpacing: '0.08em' }}>The arena holds its breath... this page updates automatically.</p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Leaderboard */}
            <div className="royal-card" style={{ padding: '20px' }}>
              <h3 className="heading" style={{ fontSize: '0.85rem', letterSpacing: '0.2em', color: 'var(--accent)', marginBottom: '16px' }}>👑 LEADERBOARD</h3>
              <div className="divider-royal" style={{ marginBottom: '16px' }} />
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '700', fontSize: '0.9rem' }}>You</span>
                    <span className={`stance-${myStance.toLowerCase()}`} style={{ marginLeft: '8px', fontSize: '0.68rem' }}>{myStance}</span>
                  </div>
                  <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '900', fontSize: '1.3rem', color: 'var(--accent)', textShadow: '0 0 12px var(--accent-glow)' }}>
                    {(session.participantA.id === user.id ? session.userATotal : session.userBTotal).toFixed(1)}
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-light))', width: `${Math.min(100, (session.participantA.id === user.id ? session.userATotal : session.userBTotal) / 3)}%`, transition: 'width 0.8s ease' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '700', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{opponentName}</span>
                    <span className={`stance-${opponentStance.toLowerCase()}`} style={{ marginLeft: '8px', fontSize: '0.68rem' }}>{opponentStance}</span>
                  </div>
                  <span style={{ fontFamily: 'Cinzel, serif', fontWeight: '900', fontSize: '1.3rem', color: 'var(--text-secondary)' }}>
                    {(session.participantA.id === user.id ? session.userBTotal : session.userATotal).toFixed(1)}
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #ef4444, rgba(239,68,68,0.5))', width: `${Math.min(100, (session.participantA.id === user.id ? session.userBTotal : session.userATotal) / 3)}%`, transition: 'width 0.8s ease' }} />
                </div>
              </div>
            </div>

            {/* Round Tracker */}
            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center' }}>
              <div className="medieval" style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: 'var(--text-muted)', marginBottom: '12px' }}>ROUND PROGRESS</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cinzel, serif', fontWeight: '800', fontSize: '0.9rem', border: `1px solid ${n < session.currentRound ? 'var(--for-color)' : n === session.currentRound ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`, color: n < session.currentRound ? 'var(--for-color)' : n === session.currentRound ? 'var(--accent)' : 'var(--text-muted)', background: n === session.currentRound ? 'rgba(212,175,55,0.1)' : 'transparent', boxShadow: n === session.currentRound ? '0 0 14px var(--accent-glow)' : 'none' }}>
                    {n < session.currentRound ? '✓' : n}
                  </div>
                ))}
              </div>
            </div>

            {/* Scoring Guide */}
            <div className="glass-panel" style={{ padding: '20px' }}>
              <h3 className="heading" style={{ fontSize: '0.8rem', letterSpacing: '0.18em', color: 'var(--accent)', marginBottom: '14px' }}>⚖ SCORING GUIDE</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: '⚖️', label: 'Topicality',   weight: '10%', desc: 'Stay on the topic.' },
                  { icon: '🎯', label: 'Stance',        weight: '25%', desc: 'Hold your FOR/AGAINST. Violations cap score!' },
                  { icon: '🧠', label: 'Logic & Facts', weight: '25%', desc: 'Verifiable claims via web search.' },
                  { icon: '💥', label: 'Rebuttal',      weight: '20%', desc: 'Counter opponent points directly.' },
                  { icon: '✨', label: 'Novelty',       weight: '10%', desc: 'Fresh arguments score higher.' },
                  { icon: '🎙️', label: 'Delivery',      weight: '10%', desc: 'Clarity and flow of speech.' },
                ].map(({ icon, label, weight, desc }) => (
                  <div key={label} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.95rem', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'Cinzel, serif', fontSize: '0.72rem', fontWeight: '700' }}>{label}</span>
                        <span style={{ fontSize: '0.62rem', color: 'var(--accent)', background: 'rgba(212,175,55,0.12)', padding: '1px 5px', borderRadius: '2px', fontWeight: '700' }}>{weight}</span>
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.4 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultPage() {
  const { id } = useParams();
  // ✅ Hooks must be at the top — token and user were incorrectly declared after useEffect
  const { user } = useAuth();
  const token = localStorage.getItem('debait_token');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/debates/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setSession(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id, token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '80vh', justifyContent: 'center', alignItems: 'center' }}>
        <Icons.Loading />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container" style={{ textAlign: 'center' }}>
        <h3>Debate session not found.</h3>
        <Link to="/"><button className="glow-btn" style={{ marginTop: '20px' }}>Back to Dashboard</button></Link>
      </div>
    );
  }

  const isMeParticipantA = session.participantA.id === user.id;
  const myTotal = isMeParticipantA ? session.userATotal : session.userBTotal;
  const opponentTotal = isMeParticipantA ? session.userBTotal : session.userATotal;
  const opponentName = isMeParticipantA ? session.participantB.username : session.participantA.username;
  const myStance = isMeParticipantA ? session.userAStance : session.userBStance;
  const opponentStance = isMeParticipantA ? session.userBStance : session.userAStance;

  let outcome = 'DRAW';

  let outcomeSub = 'An even intellectual match!';
  let outcomeStyle = { color: '#fbbf24' };

  if (session.winner) {
    if (session.winner.id === user.id) {
      outcome = 'VICTORY';
      outcomeSub = 'Congratulations, your logic prevailed!';
      outcomeStyle = { color: 'var(--for-color)' };
    } else {
      outcome = 'DEFEAT';
      outcomeSub = 'Your opponent had a stronger argument structured.';
      outcomeStyle = { color: 'var(--against-color)' };
    }
  }

  // Calculate battle progression rewards for display
  let eloChange = 0;
  let xpEarned = 50;
  let coinsEarned = 10;
  let streakBonus = false;

  const ratingA = user ? user.rating : 1000;
  const opponentUser = isMeParticipantA ? session.participantB : session.participantA;
  const ratingB = opponentUser ? opponentUser.rating : 1000;
  const expected = 1.0 / (1.0 + Math.pow(10, (ratingB - ratingA) / 400.0));

  if (outcome === 'VICTORY') {
    eloChange = Math.round(32 * (1.0 - expected));
    xpEarned = 100;
    coinsEarned = 20;
    if (user && user.streak >= 2) {
      xpEarned += 50;
      coinsEarned += 10;
      streakBonus = true;
    }
  } else if (outcome === 'DEFEAT') {
    eloChange = Math.round(32 * (0.0 - expected));
    xpEarned = 25;
    coinsEarned = 5;
  } else {
    eloChange = Math.round(32 * (0.5 - expected));
    xpEarned = 50;
    coinsEarned = 10;
  }

  return (
    <div className="container" style={{ maxWidth: '800px', marginTop: '40px' }}>
      <div className="royal-card animate-fade-in" style={{ textAlign: 'center', padding: '40px 20px', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '3.5rem', fontWeight: '900', ...outcomeStyle, letterSpacing: '3px' }} className="heading text-gold-gradient">{outcome}</h1>
        <p className="medieval" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px', letterSpacing: '0.1em' }}>{outcomeSub}</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', margin: '30px 0', flexWrap: 'wrap' }}>
          <div>
            <div className="medieval" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>YOUR BATTLE SCORE</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', ...outcomeStyle }}>{myTotal.toFixed(1)}</div>
          </div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}></div>
          <div>
            <div className="medieval" style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', letterSpacing: '0.05em' }}>OPPONENT ({opponentName})</div>
            <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-muted)' }}>{opponentTotal.toFixed(1)}</div>
          </div>
        </div>

        {/* Rewards and Rank Shifts */}
        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="medieval text-[color:var(--accent)] tracking-[0.2em] text-xs uppercase mb-3">Rewards & Rank Shifts</div>
          <div className="flex justify-center gap-6 items-center flex-wrap">
            <div className="bg-black/35 border border-white/5 px-4 py-2 flex items-center gap-2">
              <span className="text-yellow-500 font-bold">🪙 +{coinsEarned} Gold</span>
            </div>
            <div className="bg-black/35 border border-white/5 px-4 py-2 flex items-center gap-2">
              <span className="text-blue-400 font-bold">⭐ +{xpEarned} XP {streakBonus && "(Streak Bonus!)"}</span>
            </div>
            <div className="bg-black/35 border border-white/5 px-4 py-2 flex items-center gap-2">
              <span className={eloChange >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                {eloChange >= 0 ? `📈 +${eloChange}` : `📉 ${eloChange}`} ELO
              </span>
            </div>
          </div>
        </div>

        <p className="medieval" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '24px', fontStyle: 'italic' }}>
          Clashed on the field of: <strong>{session.topic}</strong>
        </p>
      </div>

      {/* Round by Round Details */}
      <div className="glass-panel" style={{ marginBottom: '30px' }}>
        <h3 className="glow-text" style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '20px' }}>Round-by-Round Breakdown</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {session.rounds.map((r) => {
            let rWinner = 'Draw';
            if (r.winnerId) {
              rWinner = r.winnerId === user.id ? 'You' : opponentName;
            }
            return (
              <div key={r.roundNumber} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-card)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: 'var(--accent-light)', marginBottom: '10px' }}>
                  <span>ROUND {r.roundNumber}</span>
                  <span style={{ color: r.winnerId ? 'var(--for-color)' : '#fbbf24' }}>Winner: {rWinner}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {r.arguments.map((arg, idx) => {
                    const isMe = arg.userId === user.id;
                    const stance = isMe ? myStance : opponentStance;
                    return (
                      <div 
                        key={idx} 
                        className={`glass-panel ${stance.toLowerCase() === 'for' ? 'card-for' : 'card-against'}`}
                        style={{ 
                          padding: '16px', 
                          background: isMe ? 'rgba(139, 92, 246, 0.03)' : 'rgba(255,255,255,0.01)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: '700' }}>{isMe ? 'You' : arg.username} (<span className={stance.toLowerCase() === 'for' ? 'stance-for' : 'stance-against'}>{stance}</span>)</span>
                          <span style={{ fontWeight: '800', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>Score: {arg.score}</span>
                        </div>
                        <p style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap', marginBottom: '12px' }}>{renderSpeechBubbleContent(arg)}</p>
                        
                        {/* Expandable Judge breakdown details */}
                        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', fontSize: '0.75rem', textAlign: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                            <div>
                              <div style={{ color: 'var(--text-muted)' }}>Topicality</div>
                              <div style={{ fontWeight: '700', marginTop: '2px' }}>{arg.topicScore}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)' }}>Logic</div>
                              <div style={{ fontWeight: '700', marginTop: '2px' }}>{arg.factScore}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)' }}>Rebuttal</div>
                              <div style={{ fontWeight: '700', marginTop: '2px' }}>{arg.relatedScore}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)' }}>Novelty</div>
                              <div style={{ fontWeight: '700', marginTop: '2px' }}>{arg.noveltyScore}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)' }}>Stance</div>
                              <div style={{ fontWeight: '700', marginTop: '2px' }}>{arg.stanceScore}</div>
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-muted)' }}>Delivery</div>
                              <div style={{ fontWeight: '700', marginTop: '2px' }}>{arg.deliveryScore || 0}</div>
                            </div>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <div style={{ fontWeight: '600', color: 'var(--accent-light)', marginBottom: '4px' }}>Judges' Explanations:</div>
                            <div style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', fontSize: '0.75rem' }}>{arg.reasoning}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
        <Link to="/" style={{ textDecoration: 'none' }}>
          <button className="glow-btn pulsing-glow" style={{ padding: '14px 28px' }}>Back to Dashboard</button>
        </Link>
        <Link to="/topics" style={{ textDecoration: 'none' }}>
          <button className="secondary-btn" style={{ padding: '14px 28px' }}>Start Another Debate</button>
        </Link>
      </div>
    </div>
  );
}

// -------------------------
// PRIVATE MULTIPLAYER DEBATE ROOM
// -------------------------
export function PrivateDebateRoom() {
  const { user } = useAuth();
  const token = localStorage.getItem('debait_token');
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const wsRef = useRef(null);
  
  const [room, setRoom] = useState(null);
  const [topicInput, setTopicInput] = useState('');
  const [wsConnected, setWsConnected] = useState(false);
  const [evalProgress, setEvalProgress] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState(null);
  
  const [argumentText, setArgumentText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [shouldBeListening, setShouldBeListening] = useState(false);
  const recognitionRef = useRef(null);

  const shouldBeListeningRef = useRef(shouldBeListening);
  useEffect(() => {
    shouldBeListeningRef.current = shouldBeListening;
  }, [shouldBeListening]);

  const argumentTextRef = useRef(argumentText);
  useEffect(() => {
    argumentTextRef.current = argumentText;
  }, [argumentText]);

  // Connect WebSocket
  const connectWs = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent triggering the feedback loop!
      wsRef.current.close();
    }
    const wsUrl = `ws://localhost:8000/ws/room/${roomCode}/${user.id}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setError('');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'room_state_update') {
          setRoom(data.room);
          setTopicInput(data.room.topic);
          // Restore / sync streaming progress on reconnect or refresh
          if (data.room.current_evaluation) {
            setStreamingProgress(data.room.current_evaluation);
            setSubmitting(true);
          }
        } else if (data.type === 'evaluation_started') {
          setEvalProgress(data.message);
          setSubmitting(true);
          setStreamingProgress({
            ddg: { status: 'pending', detail: '' },
            judge3: { status: 'pending', score: null, novelty: null, reasoning: '' },
            judge1: { status: 'pending', score: null, reasoning: '', facts: '' },
            judge2: { status: 'pending', score: null, reasoning: '' },
            judge4: { status: 'pending', score: null, reasoning: '' },
            judge5: { status: 'pending', score: null, reasoning: '' },
            final: { status: 'pending', score: null }
          });
        } else if (data.type === 'eval_event') {
          const ev = data.event;
          const payload = data.data;
          setStreamingProgress(prev => {
            // If prev was null (e.g. state batching delay or refresh), initialize it
            const next = prev ? { ...prev } : {
              ddg: { status: 'pending', detail: '' },
              judge3: { status: 'pending', score: null, novelty: null, reasoning: '' },
              judge1: { status: 'pending', score: null, reasoning: '', facts: '' },
              judge2: { status: 'pending', score: null, reasoning: '' },
              judge4: { status: 'pending', score: null, reasoning: '' },
              judge5: { status: 'pending', score: null, reasoning: '' },
              final: { status: 'pending', score: null }
            };
            switch (ev) {
              case 'ddg_start':
                next.ddg = { status: 'running', detail: payload.message };
                break;
              case 'ddg_complete':
                next.ddg = { status: 'completed', detail: payload.message };
                break;
              case 'judge3_start':
                next.judge3 = { ...next.judge3, status: 'running', reasoning: payload.message };
                break;
              case 'judge3_complete':
                next.judge3 = {
                  status: 'completed',
                  score: payload.topic_score,
                  novelty: payload.novelty_score,
                  reasoning: payload.reasoning
                };
                break;
              case 'judge1_start':
                next.judge1 = { ...next.judge1, status: 'running', reasoning: payload.message };
                break;
              case 'judge1_complete':
                next.judge1 = {
                  status: 'completed',
                  score: payload.fact_score,
                  reasoning: payload.reasoning,
                  facts: payload.retrieved_facts
                };
                break;
              case 'judge2_start':
                next.judge2 = { ...next.judge2, status: 'running', reasoning: payload.message };
                break;
              case 'judge2_complete':
                next.judge2 = {
                  status: 'completed',
                  score: payload.related_score,
                  reasoning: payload.reasoning
                };
                break;
              case 'judge4_start':
                next.judge4 = { ...next.judge4, status: 'running', reasoning: payload.message };
                break;
              case 'judge4_complete':
                next.judge4 = {
                  status: 'completed',
                  score: payload.stance_score,
                  reasoning: payload.reasoning
                };
                break;
              case 'judge5_start':
                next.judge5 = { ...next.judge5, status: 'running', reasoning: payload.message };
                break;
              case 'judge5_complete':
                next.judge5 = {
                  status: 'completed',
                  score: payload.delivery_score,
                  reasoning: payload.reasoning
                };
                break;
              case 'final_result_start':
                next.final = { status: 'running', score: null };
                break;
              case 'final_result':
                next.final = {
                  status: 'completed',
                  score: payload.final_score
                };
                break;
              case 'done':
                setArgumentText('');
                setTimeout(() => {
                  setSubmitting(false);
                  setStreamingProgress(null);
                  setEvalProgress(null);
                }, 3000);
                break;
              case 'error':
                setError(payload.error || 'AI Evaluation encountered an error');
                setSubmitting(false);
                setStreamingProgress(null);
                setEvalProgress(null);
                break;
              default:
                break;
            }
            return next;
          });
        } else if (data.type === 'error') {
          setError(data.message);
          setSubmitting(false);
          setStreamingProgress(null);
          setEvalProgress(null);
        }
      } catch (err) {
        console.error("WS error parsing message:", err);
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      // Auto reconnect after 3 seconds if not completed
      setTimeout(() => {
        connectWs();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [roomCode, user.id]);

  useEffect(() => {
    connectWs();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWs]);

  // Speech Recognition (native)
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    let textBeforeThisTurn = '';

    rec.onstart = () => {
      setIsListening(true);
      textBeforeThisTurn = argumentTextRef.current;
    };

    rec.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = 0; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const fullTranscribedText = (finalTranscript + interimTranscript).trim();
      if (fullTranscribedText) {
        const cleanPrefix = textBeforeThisTurn ? textBeforeThisTurn.trim() + ' ' : '';
        setArgumentText(cleanPrefix + fullTranscribedText);
      }
    };

    rec.onend = () => {
      setIsListening(false);
      if (shouldBeListeningRef.current) {
        setTimeout(() => {
          try {
            if (shouldBeListeningRef.current && recognitionRef.current) {
              recognitionRef.current.start();
            }
          } catch (e) {}
        }, 150);
      }
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech') return;
      setIsListening(false);
      setShouldBeListening(false);
    };

    recognitionRef.current = rec;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleSpeech = () => {
    if (!recognitionRef.current) {
      alert('Speech Recognition is not supported or not enabled in your browser. Try Google Chrome.');
      return;
    }

    if (shouldBeListening) {
      setShouldBeListening(false);
      recognitionRef.current.stop();
    } else {
      setShouldBeListening(true);
      try {
        recognitionRef.current.start();
      } catch (err) {}
    }
  };

  const sendAction = (action, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action, ...payload }));
    }
  };

  if (!room) {
    return (
      <div style={{ display: 'flex', height: '80vh', justifyContent: 'center', alignItems: 'center' }}>
        <Icons.Loading />
      </div>
    );
  }

  // Determine roles and stances
  const isHost = String(user.id) === room.hostUserId;
  const isGuest = String(user.id) === room.guestUserId;
  
  const myStance = room.user_sides[user.id] || null;
  const opponentId = isHost ? room.guestUserId : room.hostUserId;
  const opponentName = isHost ? room.guestUsername : room.hostUsername;
  const opponentStance = opponentId ? room.user_sides[opponentId] : null;

  const isMyTurn = room.status === 'ACTIVE' && room.current_turn_userId === String(user.id);

  // Render Waiting Screen
  if (room.status === 'WAITING') {
    return (
      <div className="container" style={{ maxWidth: '600px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px', border: '1px solid rgba(212,175,55,0.2)' }}>
          <h2 className="glow-text" style={{ fontSize: '2rem', marginBottom: '8px', color: 'var(--accent)' }}>Private Debate Arena</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Share this code with your opponent to invite them to this room.</p>
          
          <div style={{ background: 'rgba(0,0,0,0.3)', border: '1px dashed var(--accent)', borderRadius: '12px', padding: '24px', marginBottom: '30px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '8px', letterSpacing: '1px' }}>ROOM CODE</span>
            <span style={{ fontSize: '3rem', fontWeight: '900', letterSpacing: '4px', color: '#fff' }}>{room.roomCode}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '20px' }}>
            <button 
              className="secondary-btn" 
              onClick={() => {
                navigator.clipboard.writeText(room.roomCode);
                alert('Room code copied to clipboard!');
              }}
            >
              Copy Code
            </button>
            <button className="secondary-btn" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => navigate('/')}>
              Leave Room
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            <Icons.Loading />
            <span>Waiting for friend to join...</span>
          </div>
        </div>
      </div>
    );
  }

  // Render Setup/Ready State (Choose topic & Side)
  if (room.status === 'READY') {
    return (
      <div className="container" style={{ maxWidth: '700px' }}>
        <div className="glass-panel" style={{ border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <h2 className="glow-text" style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '6px' }}>Configure Arena</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Opponent Connected: <strong>{opponentName}</strong></p>
          </div>

          {/* Topic selection */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase' }}>Debate Topic</label>
            {isHost ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Enter custom debate topic..." 
                  value={topicInput} 
                  onChange={e => {
                    setTopicInput(e.target.value);
                    sendAction('set_topic', { topic: e.target.value });
                  }} 
                  style={{ flex: 1 }}
                />
                <button 
                  className="secondary-btn" 
                  onClick={() => sendAction('confirm_topic')}
                  style={{ borderColor: room.hostConfirmedTopic ? '#10b981' : 'var(--accent)', color: room.hostConfirmedTopic ? '#10b981' : 'var(--text-main)' }}
                >
                  {room.hostConfirmedTopic ? 'Confirmed ✓' : 'Confirm'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1, padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', color: room.topic ? '#fff' : 'var(--text-muted)', fontStyle: room.topic ? 'normal' : 'italic' }}>
                  {room.topic || 'Waiting for host to set custom topic...'}
                </div>
                <button 
                  className="secondary-btn" 
                  disabled={!room.topic}
                  onClick={() => sendAction('confirm_topic')}
                  style={{ borderColor: room.guestConfirmedTopic ? '#10b981' : 'var(--accent)', color: room.guestConfirmedTopic ? '#10b981' : 'var(--text-main)', opacity: room.topic ? 1 : 0.5 }}
                >
                  {room.guestConfirmedTopic ? 'Confirmed ✓' : 'Confirm'}
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>Host Confirmed: <strong style={{ color: room.hostConfirmedTopic ? '#10b981' : '#f59e0b' }}>{room.hostConfirmedTopic ? 'YES' : 'NO'}</strong></span>
              <span>Guest Confirmed: <strong style={{ color: room.guestConfirmedTopic ? '#10b981' : '#f59e0b' }}>{room.guestConfirmedTopic ? 'YES' : 'NO'}</strong></span>
            </div>
          </div>

          {/* Side selection */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '14px', textTransform: 'uppercase' }}>Choose Stance</label>
            <div style={{ display: 'flex', gap: '16px' }}>
              <button 
                type="button" 
                className={`round-btn ${myStance === 'FOR' ? 'active' : ''}`}
                onClick={() => sendAction('choose_side', { side: 'FOR' })}
                style={{ flex: 1, padding: '16px', background: myStance === 'FOR' ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255,255,255,0.02)', borderColor: myStance === 'FOR' ? 'var(--primary)' : 'var(--border-color)', color: myStance === 'FOR' ? 'var(--primary)' : 'var(--text-main)' }}
              >
                FOR (House Stark)
              </button>
              <button 
                type="button" 
                className={`round-btn ${myStance === 'AGAINST' ? 'active' : ''}`}
                onClick={() => sendAction('choose_side', { side: 'AGAINST' })}
                style={{ flex: 1, padding: '16px', background: myStance === 'AGAINST' ? 'rgba(255, 85, 0, 0.1)' : 'rgba(255,255,255,0.02)', borderColor: myStance === 'AGAINST' ? 'var(--secondary)' : 'var(--border-color)', color: myStance === 'AGAINST' ? 'var(--secondary)' : 'var(--text-main)' }}
              >
                AGAINST (House Targaryen)
              </button>
            </div>
            {room.user_sides[opponentId] && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '12px', textAlign: 'center' }}>
                Opponent ({opponentName}) assigned stance: <strong style={{ color: room.user_sides[opponentId] === 'FOR' ? 'var(--primary)' : 'var(--secondary)' }}>{room.user_sides[opponentId]}</strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
            <button className="secondary-btn" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', width: '100%' }} onClick={() => navigate('/')}>
              Abandon Arena
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render Active / Turn-Based Debate State (or if evaluation is still streaming)
  if (room.status === 'ACTIVE' || streamingProgress) {
    return (
      <div className="container">
        {/* Topic Banner */}
        <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>DEBATE TOPIC</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{room.topic}</h2>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Your Stance: </span>
              <span className={myStance === 'FOR' ? 'stance-for' : 'stance-against'}>{myStance}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Opponent: </span>
              <span>{opponentName} (<span className={opponentStance === 'FOR' ? 'stance-for' : 'stance-against'}>{opponentStance}</span>)</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Round: </span>
              <span style={{ fontWeight: '700', color: 'var(--accent-light)' }}>{room.current_round} / {room.rounds}</span>
            </div>
          </div>
        </div>

        {/* Board layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px', alignItems: 'start', flexWrap: 'wrap' }}>
          
          {/* Main Speeches timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ minHeight: '350px', maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '10px' }}>Debate Log</h3>
              
              {room.arguments.length === 0 ? (
                <div style={{ display: 'flex', flex: 1, justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', fontStyle: 'italic', minHeight: '200px' }}>
                  No speeches submitted yet. The host speaking FOR starts!
                </div>
              ) : (
                room.arguments.map((arg, idx) => {
                  const isMe = String(arg.userId) === String(user.id);
                  const stance = isMe ? myStance : opponentStance;
                  return (
                    <div 
                      key={idx} 
                      className={`glass-panel ${stance === 'FOR' ? 'card-for' : 'card-against'}`}
                      style={{ padding: '16px', background: isMe ? 'rgba(139, 92, 246, 0.03)' : 'rgba(255,255,255,0.01)' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: '700' }}>{isMe ? 'You' : arg.username} (<span className={stance === 'FOR' ? 'stance-for' : 'stance-against'}>{stance}</span>)</span>
                        <span style={{ fontWeight: '800', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>Score: {arg.score != null ? Number(arg.score).toFixed(1) : '...'}</span>
                      </div>
                      <p style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap', color: 'var(--text-main)', marginBottom: '12px' }}>{arg.argumentText}</p>
                      
                      {arg.score !== undefined && (
                        <details style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)', overflow: 'hidden' }}>
                          <summary style={{ padding: '10px 14px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--accent-light)', cursor: 'pointer', outline: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}>
                            <span>View Evaluation Details & Web Context</span>
                            <span style={{ fontSize: '0.72rem', opacity: '0.7', color: 'var(--accent)' }}>▶ Click to Toggle</span>
                          </summary>
                          <div style={{ padding: '14px', paddingTop: '0px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', fontSize: '0.72rem', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Topicality</div>
                                <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.topicScore}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Logic</div>
                                <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.factScore}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Rebuttal</div>
                                <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.relatedScore}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Novelty</div>
                                <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.noveltyScore}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Stance</div>
                                <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.stanceScore}</div>
                              </div>
                              <div>
                                <div style={{ color: 'var(--text-muted)' }}>Delivery</div>
                                <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.deliveryScore || 0}</div>
                              </div>
                            </div>
                            
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              <div style={{ fontWeight: '600', color: 'var(--accent-light)', marginBottom: '4px' }}>Judges' Explanations:</div>
                              <div style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', fontSize: '0.75rem', lineHeight: '1.4' }}>{arg.reasoning}</div>
                            </div>

                            {arg.retrievedFacts && arg.retrievedFacts.trim() && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                                <div style={{ fontWeight: '600', color: 'var(--accent-light)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  Retrieved Web Facts (DuckDuckGo Context):
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.72rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.25)', padding: '8px', borderRadius: '6px', maxHeight: '120px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.03)', color: '#d1d5db', textAlign: 'left' }}>
                                  {arg.retrievedFacts}
                                </div>
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Speech area */}
            <div className="glass-panel" style={{ border: (isMyTurn && !streamingProgress) ? '1px solid var(--accent)' : '1px solid var(--border-card)' }}>
              {streamingProgress ? (
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="spinner-border text-primary" role="status" style={{ width: '1.2rem', height: '1.2rem', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }}></span>
                    Jury Room: Live AI Scoring & Fact-Checking...
                  </h3>
                  
                  <style>{`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    .progress-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px; borderRadius: 8px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s ease; }
                    .progress-item.running { border-color: var(--accent); background: rgba(139, 92, 246, 0.05); box-shadow: 0 0 10px rgba(139, 92, 246, 0.1); }
                    .progress-item.completed { border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.02); }
                    .status-dot { width: 8px; height: 8px; borderRadius: 50%; background: #6b7280; }
                    .status-dot.running { background: var(--accent); animation: pulse 1.5s infinite; }
                    .status-dot.completed { background: #10b981; }
                    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
                  `}</style>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 1. DuckDuckGo / Web Context */}
                    <div className={`progress-item ${streamingProgress.ddg.status}`}>
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.2rem' }}>🔍</span>
                          <div>
                            <div style={{ fontWeight: '700' }}>Web Context Retrieval (DuckDuckGo RAG)</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{streamingProgress.ddg.detail || 'Waiting to query web context...'}</div>
                          </div>
                        </div>
                        <div>
                          {streamingProgress.ddg.status === 'completed' && <span style={{ color: '#10b981', fontWeight: '800', fontSize: '0.85rem' }}>✓ Loaded</span>}
                          {streamingProgress.ddg.status === 'running' && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Searching...</span>}
                          {streamingProgress.ddg.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Queued</span>}
                        </div>
                      </div>
                    </div>

                    {/* 2. Judge 3: Topicality Auditor */}
                    <div className={`progress-item ${streamingProgress.judge3.status}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>⚖️</span>
                            <div>
                              <div style={{ fontWeight: '700' }}>Judge 3: Topicality & Novelty Auditor</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {streamingProgress.judge3.status === 'running' ? 'Analyzing topical focus...' : 
                                 streamingProgress.judge3.status === 'completed' ? 'Evaluation complete.' : 'Waiting...'}
                              </div>
                            </div>
                          </div>
                          <div>
                            {streamingProgress.judge3.status === 'completed' && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>Topic: {streamingProgress.judge3.score}</span>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>Novelty: {streamingProgress.judge3.novelty}</span>
                                <span style={{ color: '#10b981', fontWeight: '800' }}>✓</span>
                              </div>
                            )}
                            {streamingProgress.judge3.status === 'running' && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Auditing...</span>}
                            {streamingProgress.judge3.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Queued</span>}
                          </div>
                        </div>
                        {streamingProgress.judge3.status === 'completed' && streamingProgress.judge3.reasoning && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                            {streamingProgress.judge3.reasoning}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 3. Judge 1: Logical Analyst */}
                    <div className={`progress-item ${streamingProgress.judge1.status}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🧠</span>
                            <div>
                              <div style={{ fontWeight: '700' }}>Judge 1: Logical Analyst & Fact Checker</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {streamingProgress.judge1.status === 'running' ? 'Cross-referencing logic and facts...' : 
                                 streamingProgress.judge1.status === 'completed' ? 'Evaluation complete.' : 'Waiting...'}
                              </div>
                            </div>
                          </div>
                          <div>
                            {streamingProgress.judge1.status === 'completed' && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>Logic: {streamingProgress.judge1.score}</span>
                                <span style={{ color: '#10b981', fontWeight: '800' }}>✓</span>
                              </div>
                            )}
                            {streamingProgress.judge1.status === 'running' && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Verifying...</span>}
                            {streamingProgress.judge1.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Queued</span>}
                          </div>
                        </div>
                        {streamingProgress.judge1.status === 'completed' && streamingProgress.judge1.reasoning && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                            {streamingProgress.judge1.reasoning}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 4. Judge 2: Rebuttal Evaluator */}
                    <div className={`progress-item ${streamingProgress.judge2.status}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>💥</span>
                            <div>
                              <div style={{ fontWeight: '700' }}>Judge 2: Rebuttal & Opponent Counter</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {streamingProgress.judge2.status === 'running' ? 'Assessing responsiveness to opponent...' : 
                                 streamingProgress.judge2.status === 'completed' ? 'Evaluation complete.' : 'Waiting...'}
                              </div>
                            </div>
                          </div>
                          <div>
                            {streamingProgress.judge2.status === 'completed' && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>Rebuttal: {streamingProgress.judge2.score}</span>
                                <span style={{ color: '#10b981', fontWeight: '800' }}>✓</span>
                              </div>
                            )}
                            {streamingProgress.judge2.status === 'running' && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Assessing...</span>}
                            {streamingProgress.judge2.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Queued</span>}
                          </div>
                        </div>
                        {streamingProgress.judge2.status === 'completed' && streamingProgress.judge2.reasoning && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                            {streamingProgress.judge2.reasoning}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 5. Judge 4: Stance Auditor */}
                    <div className={`progress-item ${streamingProgress.judge4.status}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🎯</span>
                            <div>
                              <div style={{ fontWeight: '700' }}>Judge 4: Stance Consistency Auditor</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {streamingProgress.judge4.status === 'running' ? 'Checking for stance violations...' : 
                                 streamingProgress.judge4.status === 'completed' ? 'Evaluation complete.' : 'Waiting...'}
                              </div>
                            </div>
                          </div>
                          <div>
                            {streamingProgress.judge4.status === 'completed' && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>Stance: {streamingProgress.judge4.score}</span>
                                <span style={{ color: '#10b981', fontWeight: '800' }}>✓</span>
                              </div>
                            )}
                            {streamingProgress.judge4.status === 'running' && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Checking...</span>}
                            {streamingProgress.judge4.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Queued</span>}
                          </div>
                        </div>
                        {streamingProgress.judge4.status === 'completed' && streamingProgress.judge4.reasoning && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                            {streamingProgress.judge4.reasoning}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 6. Judge 5: Delivery Judge */}
                    <div className={`progress-item ${streamingProgress.judge5.status}`}>
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.2rem' }}>🗣️</span>
                            <div>
                              <div style={{ fontWeight: '700' }}>Judge 5: Delivery & Tone Auditor</div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                {streamingProgress.judge5.status === 'running' ? 'Assessing delivery dynamics...' : 
                                 streamingProgress.judge5.status === 'completed' ? 'Evaluation complete.' : 'Waiting...'}
                              </div>
                            </div>
                          </div>
                          <div>
                            {streamingProgress.judge5.status === 'completed' && (
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '800' }}>Tone: {streamingProgress.judge5.score}</span>
                                <span style={{ color: '#10b981', fontWeight: '800' }}>✓</span>
                              </div>
                            )}
                            {streamingProgress.judge5.status === 'running' && <span style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Assessing...</span>}
                            {streamingProgress.judge5.status === 'pending' && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Queued</span>}
                          </div>
                        </div>
                        {streamingProgress.judge5.status === 'completed' && streamingProgress.judge5.reasoning && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '8px', borderRadius: '4px', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                            {streamingProgress.judge5.reasoning}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 7. Final Compiled Score */}
                    <div className={`progress-item ${streamingProgress.final.status}`} style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '1.4rem' }}>🏆</span>
                          <div>
                            <div style={{ fontWeight: '800', fontSize: '1.1rem' }}>Final Score Output</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              {streamingProgress.final.status === 'completed' ? 'All scores aggregated!' : 'Waiting for final calculations...'}
                            </div>
                          </div>
                        </div>
                        <div>
                          {streamingProgress.final.status === 'completed' ? (
                            <span style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-light)', background: 'rgba(139, 92, 246, 0.15)', padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--accent)' }}>
                              {streamingProgress.final.score}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>Pending</span>
                          )}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : isMyTurn ? (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  if (!argumentText.trim() || submitting) return;
                  setSubmitting(true);
                  setStreamingProgress({
                    ddg: { status: 'pending', detail: '' },
                    judge3: { status: 'pending', score: null, novelty: null, reasoning: '' },
                    judge1: { status: 'pending', score: null, reasoning: '', facts: '' },
                    judge2: { status: 'pending', score: null, reasoning: '' },
                    judge4: { status: 'pending', score: null, reasoning: '' },
                    judge5: { status: 'pending', score: null, reasoning: '' },
                    final: { status: 'pending', score: null }
                  });
                  // Clear dictation states
                  setShouldBeListening(false);
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.abort();
                    } catch (err) {}
                  }
                  sendAction('submit_argument', { argumentText });
                  setArgumentText('');
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h3 className="glow-text" style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--accent-light)' }}>
                      It's Your Turn to Speak ({myStance})
                    </h3>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        type="button" 
                        id="mic-btn"
                        className={`secondary-btn ${isListening ? 'listening' : ''}`}
                        onClick={toggleSpeech}
                        disabled={submitting}
                        style={{ padding: '8px 12px', background: isListening ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: isListening ? '#ef4444' : 'var(--text-main)', borderColor: isListening ? '#ef4444' : 'var(--border-card)', opacity: submitting ? 0.5 : 1 }}
                      >
                        <Icons.Mic active={isListening} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    id="argument-textarea"
                    className="form-input"
                    rows="6"
                    placeholder={`Compose your speech defending the '${myStance}' position...`}
                    style={{ resize: 'vertical', width: '100%', marginBottom: '14px', fontSize: '0.95rem', lineHeight: '1.5' }}
                    value={argumentText}
                    onChange={(e) => setArgumentText(e.target.value)}
                    disabled={submitting}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {argumentText.length} characters | Word Count: {argumentText.split(/\s+/).filter(Boolean).length}
                    </span>
                    <button 
                      type="submit" 
                      className="secondary-btn" 
                      disabled={submitting || !argumentText.trim()}
                      style={{ padding: '10px 24px', opacity: (submitting || !argumentText.trim()) ? 0.5 : 1 }}
                    >
                      {submitting ? 'Submitting...' : 'Submit Speech'}
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', color: 'var(--text-muted)', gap: '12px' }}>
                  <Icons.Loading />
                  <span style={{ fontSize: '0.95rem', textAlign: 'center' }}>
                    Waiting for <strong>{opponentName}</strong> to submit their argument...
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar stats/scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '16px', letterSpacing: '1px', textTransform: 'uppercase' }}>Fighters Summary</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(0, 229, 255, 0.03)', border: '1px solid rgba(0, 229, 255, 0.1)', borderRadius: '10px' }}>
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{room.hostUsername}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '2px' }}>Stance: {room.user_sides[room.hostUserId]}</span>
                  </div>
                  {room.current_turn_userId === room.hostUserId && <span style={{ background: 'var(--primary)', color: '#000', fontSize: '0.7rem', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>SPEAKING</span>}
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255, 85, 0, 0.03)', border: '1px solid rgba(255, 85, 0, 0.1)', borderRadius: '10px' }}>
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{room.guestUsername}</span>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--secondary)', marginTop: '2px' }}>Stance: {room.user_sides[room.guestUserId]}</span>
                  </div>
                  {room.current_turn_userId === room.guestUserId && <span style={{ background: 'var(--secondary)', color: '#000', fontSize: '0.7rem', fontWeight: '800', padding: '2px 6px', borderRadius: '4px' }}>SPEAKING</span>}
                </div>
              </div>
            </div>

            <button className="secondary-btn" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => {
              if (window.confirm("Abandoning the debate will disconnect you. Proceed?")) {
                navigate('/');
              }
            }}>
              Abandon Arena
            </button>
          </div>
          
        </div>
      </div>
    );
  }

  // Render Evaluation Progress Screen
  if (evalProgress || (room.status === 'COMPLETED' && !room.evaluation_result)) {
    return (
      <div className="container" style={{ maxWidth: '600px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '50px 30px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <Icons.Loading />
          <h2 className="glow-text" style={{ fontSize: '1.8rem', fontWeight: '900', color: 'var(--accent)' }}>AI Jury deliberating</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            {evalProgress || "AI Judges are scoring the debate round. Evaluating facts, logic, and delivery..."}
          </p>
        </div>
      </div>
    );
  }

  // Render Completed / Results Screen
  if (room.status === 'COMPLETED' && room.evaluation_result) {
    const results = room.evaluation_result;
    const isDraw = results.winnerId === 'draw';
    const isMeWinner = results.winnerId === String(user.id);
    
    let outcome = 'IT\'S A DRAW!';
    let outcomeSub = 'Both debaters demonstrated equal command of rhetoric.';
    let outcomeStyle = { color: '#fbbf24' };
    
    if (!isDraw) {
      if (isMeWinner) {
        outcome = 'VICTORY SECURED!';
        outcomeSub = 'Your arguments successfully swayed the AI Jury.';
        outcomeStyle = { color: 'var(--for-color)' };
      } else {
        outcome = 'DEFEAT IN ARENA';
        outcomeSub = `House ${results.winnerUsername} claimed the throne this time.`;
        outcomeStyle = { color: 'var(--against-color)' };
      }
    }
    
    const myTotal = String(user.id) === room.hostUserId ? results.hostTotalScore : results.guestTotalScore;
    const opponentTotal = String(user.id) === room.hostUserId ? results.guestTotalScore : results.hostTotalScore;

    return (
      <div className="container" style={{ maxWidth: '800px' }}>
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: '900', ...outcomeStyle, letterSpacing: '2px' }} className="glow-text">{outcome}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '4px' }}>{outcomeSub}</p>
          
          <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', margin: '30px 0', flexWrap: 'wrap' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>YOUR TOTAL SCORE</div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', ...outcomeStyle }}>{myTotal != null ? Number(myTotal).toFixed(2) : '0.00'}</div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}></div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>OPPONENT ({opponentName})</div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-muted)' }}>{opponentTotal != null ? Number(opponentTotal).toFixed(2) : '0.00'}</div>
            </div>
          </div>

          <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', fontStyle: 'italic', maxWidth: '600px', margin: '0 auto' }}>
            Topic: <strong>{room.topic}</strong>
          </p>
        </div>

        {/* Round breakdown */}
        <div className="glass-panel" style={{ marginBottom: '30px' }}>
          <h3 className="glow-text" style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '20px' }}>Speeches Evaluation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {results.arguments.map((arg, idx) => {
              const isMe = String(arg.userId) === String(user.id);
              const stance = isMe ? myStance : opponentStance;
              return (
                <div 
                  key={idx} 
                  className={`glass-panel ${stance === 'FOR' ? 'card-for' : 'card-against'}`}
                  style={{ 
                    padding: '16px', 
                    background: isMe ? 'rgba(139, 92, 246, 0.03)' : 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '700' }}>{isMe ? 'You' : arg.username} (<span className={stance === 'FOR' ? 'stance-for' : 'stance-against'}>{stance}</span>)</span>
                    <span style={{ fontWeight: '800', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>Score: {arg.score != null ? Number(arg.score).toFixed(1) : '0.0'}</span>
                  </div>
                  <p style={{ fontSize: '0.95rem', whiteSpace: 'pre-wrap', marginBottom: '12px', color: 'var(--text-main)' }}>{arg.argumentText}</p>
                  
                  {/* Metric grids */}
                  <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.02)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', fontSize: '0.72rem', textAlign: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Topicality</div>
                        <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.topicScore != null ? Number(arg.topicScore).toFixed(0) : '0'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Logic</div>
                        <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.factScore != null ? Number(arg.factScore).toFixed(0) : '0'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Rebuttal</div>
                        <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.relatedScore != null ? Number(arg.relatedScore).toFixed(0) : '0'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Novelty</div>
                        <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.noveltyScore != null ? Number(arg.noveltyScore).toFixed(0) : '0'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Stance</div>
                        <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.stanceScore != null ? Number(arg.stanceScore).toFixed(0) : '0'}</div>
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-muted)' }}>Delivery</div>
                        <div style={{ fontWeight: '700', marginTop: '2px', color: '#fff' }}>{arg.deliveryScore != null ? Number(arg.deliveryScore).toFixed(0) : '0'}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontWeight: '600', color: 'var(--accent-light)', marginBottom: '4px' }}>Judges' Explanations:</div>
                      <div style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', fontSize: '0.75rem', lineHeight: '1.4' }}>{arg.reasoning}</div>
                    </div>
                    {arg.retrievedFacts && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', marginTop: '8px' }}>
                        <div style={{ fontWeight: '600', color: 'var(--accent-light)', marginBottom: '4px' }}>Retrieved Facts Context:</div>
                        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.72rem', background: 'rgba(0,0,0,0.25)', padding: '6px', borderRadius: '4px', maxHeight: '100px', overflowY: 'auto' }}>{arg.retrievedFacts}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', justify: 'center' }}>
          <button className="secondary-btn" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
