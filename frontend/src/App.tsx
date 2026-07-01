import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from './hooks/useSession';
import { InputForm } from './components/InputForm';
import { CheckpointRail } from './components/CheckpointRail';
import { CheckpointApprovalPanel } from './components/CheckpointApprovalPanel';
import { DiagnosticReport } from './components/DiagnosticReport';
import { SessionHistory } from './components/SessionHistory';
import { PlaybookGraph } from './components/PlaybookGraph';
import { Badge, Spinner, SeverityBadge, Button } from './components/ui';
import { JOKES } from './utils/jokes';
import { ChatWidget } from './components/ChatWidget';
import { AboutView } from './components/AboutView';

type ActiveView = 'diagnose' | 'history' | 'about';

// ── Elapsed timer hook ────────────────────────────────────────────────────────
function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const reset = () => setElapsed(0);
  return { elapsed, reset };
}

function formatElapsed(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── Phase label ───────────────────────────────────────────────────────────────
function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    classifying: 'Classifying intent...',
    executing: 'Running step...',
    evaluating: 'Claude evaluating...',
    pending_approval: 'Awaiting your decision',
    analyzing: 'Generating analysis...',
  };
  return map[phase] || phase;
}

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button onClick={copy} title="Copy to clipboard" style={{
      fontSize: 11, padding: '3px 8px',
      background: copied ? 'var(--success-light)' : 'var(--surface-2)',
      border: `1px solid ${copied ? 'var(--success-border)' : 'var(--border)'}`,
      borderRadius: 'var(--radius-sm)', cursor: 'pointer',
      color: copied ? 'var(--success)' : 'var(--text-muted)',
      fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
    }}>
      {copied ? '✓ Copied' : '⧉ Copy'}
    </button>
  );
}

// ── Help overlay ──────────────────────────────────────────────────────────────
function HelpOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        className="fade-in"
        onClick={e => e.stopPropagation()}
        style={{
          margin: '56px 20px 0 0', width: 340,
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '12px 16px', background: 'var(--accent-light)',
          borderBottom: '1px solid var(--accent-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 16 }}>❓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>How to use DBAtlas</span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--text-muted)', lineHeight: 1,
          }}>✕</button>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { icon: '🖥', label: 'Server name', desc: 'Enter the database server hostname. The system auto-detects the DBMS from the prefix — e.g. SQLPROD-02 → SQL Server, ORA-PROD → Oracle, PG-DB-01 → PostgreSQL.' },
            { icon: '🎫', label: 'ServiceNow ticket', desc: 'Enter the incident or change ticket number in format INC0000000 or CHG0000000. This links the diagnostic session to your ITSM record.' },
            { icon: '💬', label: 'Diagnostic question', desc: 'Describe the issue in plain language — e.g. "this query suddenly got slow after last night\'s maintenance". AI classifies the intent and selects the right playbook.' },
            { icon: '⚙️', label: 'Operating mode', desc: 'Interactive: you review and approve each step before it runs. Auto: AI runs the full diagnostic automatically without pausing.' },
          ].map(({ icon, label, desc }) => (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
          <div style={{
            padding: '8px 11px', background: 'var(--surface-2)',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6,
          }}>
            💡 <strong>Tip:</strong> In Interactive mode, press <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px' }}>↵ Enter</kbd> to approve a checkpoint instantly.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tic-Tac-Toe Waiting Game ──────────────────────────────────────────────────
const WIN_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]            // diagonals
];

function checkWin(board: (string | null)[]) {
  for (const combo of WIN_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(cell => cell !== null)) {
    return 'draw';
  }
  return null;
}

const getAiMove = (board: (string | null)[]): number => {
  const emptyIndices = board.map((val, idx) => val === null ? idx : null).filter((v): v is number => v !== null);
  if (emptyIndices.length === 0) return -1;

  // 1. Find winning move for AI (always take the win if available)
  for (const idx of emptyIndices) {
    const testBoard = [...board];
    testBoard[idx] = 'ai';
    if (checkWin(testBoard) === 'ai') {
      return idx;
    }
  }

  // 2. Find block move for AI (always block if the user is about to win)
  for (const idx of emptyIndices) {
    const testBoard = [...board];
    testBoard[idx] = 'user';
    if (checkWin(testBoard) === 'user') {
      return idx;
    }
  }

  // 3. Prefer center if available
  if (board[4] === null) {
    return 4;
  }

  // 4. Otherwise, random empty cell
  const randomIdx = Math.floor(Math.random() * emptyIndices.length);
  return emptyIndices[randomIdx];
};

function TicTacToeWidget({ disabled = false }: { disabled?: boolean }) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [turn, setTurn] = useState<'user' | 'ai'>('user');
  const [winner, setWinner] = useState<string | null>(null);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setTurn('user');
    setWinner(null);
  };

  const handleCellClick = (index: number) => {
    if (board[index] || winner || turn !== 'user') return;

    const newBoard = [...board];
    newBoard[index] = 'user';
    setBoard(newBoard);

    const winStatus = checkWin(newBoard);
    if (winStatus) {
      setWinner(winStatus);
      return;
    }

    setTurn('ai');
  };

  useEffect(() => {
    if (turn === 'ai' && !winner) {
      const timer = setTimeout(() => {
        const aiMove = getAiMove(board);
        if (aiMove !== -1) {
          const newBoard = [...board];
          newBoard[aiMove] = 'ai';
          setBoard(newBoard);

          const winStatus = checkWin(newBoard);
          if (winStatus) {
            setWinner(winStatus);
          } else {
            setTurn('user');
          }
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [turn, board, winner]);

  // Cylinder render helper (smaller to fit 14px cell)
  const renderCylinder = () => (
    <div style={{
      width: 9, height: 11,
      border: '1.2px solid var(--accent)',
      borderRadius: '50% / 2px',
      background: 'var(--accent-light)',
      position: 'relative',
      boxSizing: 'border-box',
    }}>
      <div style={{ position: 'absolute', top: 2, left: 0, right: 0, height: 2, borderBottom: '1px solid var(--accent)', borderRadius: '50% / 1px' }} />
      <div style={{ position: 'absolute', top: 4, left: 0, right: 0, height: 2, borderBottom: '1px solid var(--accent)', borderRadius: '50% / 1px' }} />
    </div>
  );

  return (
    <div className="fade-in" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'var(--surface-2)', padding: '3px 8px',
      borderRadius: 'var(--radius)', border: '1px solid var(--border)',
      height: 48, boxSizing: 'border-box',
      opacity: disabled ? 0.5 : 1,
      pointerEvents: disabled ? 'none' : 'auto',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginRight: 2 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Waiting Game
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, color: winner ? 'var(--accent)' : 'var(--text-secondary)', minWidth: 65 }}>
          {winner === 'user' && 'You win! 🎉'}
          {winner === 'ai' && 'AI wins! 🤖'}
          {winner === 'draw' && 'Draw! 🤝'}
          {!winner && (turn === 'user' ? 'Your turn...' : 'AI thinking...')}
        </span>
      </div>

      {/* Grid Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 14px)',
        gridTemplateRows: 'repeat(3, 14px)',
        gap: '1px',
        background: 'var(--border)',
        padding: '1px',
        borderRadius: 'var(--radius-sm)',
      }}>
        {board.map((cell, idx) => (
          <button
            key={idx}
            onClick={() => handleCellClick(idx)}
            disabled={!!winner || turn !== 'user'}
            style={{
              width: 14, height: 14,
              background: 'var(--surface-1)',
              border: 'none',
              cursor: board[idx] || winner ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
              outline: 'none',
            }}
          >
            {cell === 'user' && renderCylinder()}
            {cell === 'ai' && <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--danger)', lineHeight: 1 }}>✕</span>}
          </button>
        ))}
      </div>

      {/* Reset */}
      <button
        onClick={resetGame}
        title="Reset Game"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, padding: 2, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: 'var(--text-muted)',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        🔄
      </button>
    </div>
  );
}

// ── Jokes widget ─────────────────────────────────────────────────────────────
function JokesWidget({ dbms }: { dbms: string }) {
  const filteredJokes = JOKES.filter(j => j.dbms === dbms);
  const [clickCount, setClickCount] = useState(0);
  const [jokeIndex, setJokeIndex] = useState(() => Math.floor(Math.random() * (filteredJokes.length || 1)));

  const handleNextJoke = () => {
    if (clickCount >= 2) {
      alert("Sorry but Pablo says you need to get back to work 😏");
      return;
    }
    setClickCount(prev => prev + 1);
    if (filteredJokes.length > 0) {
      setJokeIndex(prev => (prev + 1) % filteredJokes.length);
    }
  };

  const joke = filteredJokes[jokeIndex] || filteredJokes[0];

  return (
    <div className="fade-in" style={{
      width: 360, background: 'var(--surface-1)',
      border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '20px 24px 16px', textAlign: 'center',
        borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
          Did you know...
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 180, justifyContent: 'space-between' }}>
        {joke ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
              "{joke.text}"
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No database jokes available for this platform.
          </div>
        )}

        <button
          onClick={handleNextJoke}
          style={{
            width: '100%', padding: '9px',
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer',
            color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
            fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
            outline: 'none',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
        >
          One more
        </button>
      </div>
    </div>
  );
}

// ── Login screen ──────────────────────────────────────────────────────────────
function LoginScreen({ onCancel, dbms }: { onCancel: () => void; dbms: string }) {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'row',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--surface-0)', gap: 40, padding: '0 40px',
      flexWrap: 'wrap',
    }}>
      <div className="fade-in" style={{
        width: 360, background: 'var(--surface-1)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px', textAlign: 'center',
          borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
            <img src="/DBAtlas-horizontal.svg" alt="DBAtlas" style={{ height: 40 }} />
          </div>
          <div style={{ fontSize: 8, color: 'var(--text-faint)', letterSpacing: '0.04em' }}>
            <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>D</span>ata<span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>b</span>ase <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>A</span>gentic <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>T</span>roub<span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>l</span>eshooting <span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>A</span>dvi<span style={{ color: 'var(--brand-teal)', fontWeight: 700 }}>s</span>or
          </div>
        </div>

        {/* Form */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{
            padding: '8px 11px', background: 'var(--warning-light)',
            border: '1px solid var(--warning-border)', borderRadius: 'var(--radius)',
            fontSize: 11, color: 'var(--warning)', textAlign: 'center',
          }}>
            🔒 Authentication is currently disabled in demo mode
          </div>

          {/* Username */}
          <div style={{ opacity: 0.4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Username
            </div>
            <input
              disabled
              placeholder="Enter your username"
              style={{
                width: '100%', padding: '9px 11px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: 13,
                color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                cursor: 'not-allowed',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ opacity: 0.4 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              Password
            </div>
            <input
              disabled
              type="password"
              placeholder="Enter your password"
              style={{
                width: '100%', padding: '9px 11px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: 13,
                color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                cursor: 'not-allowed',
              }}
            />
          </div>

          {/* Login button — bright and active */}
          <button
            onClick={onCancel}
            style={{
              width: '100%', padding: '11px',
              background: 'var(--accent)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius)',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              boxShadow: '0 2px 8px rgba(37,99,235,0.35)',
              marginTop: 4,
            }}
          >
            Log in
          </button>

          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
            Click Log in to return to the demo
          </div>
        </div>
      </div>

      {/* Right column: Jokes widget */}
      <JokesWidget dbms={dbms} />
    </div>
  );
}

// ── Left sidebar nav ──────────────────────────────────────────────────────────
function SideNav({
  activeView, setActiveView, onToggleChat
}: {
  activeView: ActiveView;
  setActiveView: (v: ActiveView) => void;
  onToggleChat: () => void;
}) {
  return (
    <nav style={{
      width: 56, flexShrink: 0,
      background: 'var(--surface-1)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 4,
    }}>
      <div style={{ flex: 1 }} />
      
      {/* Diagnostic button */}
      <button
        onClick={() => setActiveView('diagnose')}
        title="Diagnostic"
        style={{
          width: 40, height: 40, borderRadius: 'var(--radius)',
          border: 'none', cursor: 'pointer', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, background: activeView === 'diagnose' ? 'var(--accent-light)' : 'transparent',
          color: activeView === 'diagnose' ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>🧰</span>
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
          Diagnostic
        </span>
      </button>

      {/* Chat button */}
      <button
        onClick={onToggleChat}
        title="Knowledge Base Chat"
        style={{
          width: 40, height: 40, borderRadius: 'var(--radius)',
          border: '1px solid var(--border)', cursor: 'pointer', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, background: 'var(--surface-2)',
          color: 'var(--text-muted)', transition: 'all 0.15s',
          marginTop: 10,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-border)'; e.currentTarget.style.color = 'var(--accent)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>💬</span>
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
          Chat
        </span>
      </button>

      {/* History button */}
      <button
        onClick={() => setActiveView('history')}
        title="History"
        style={{
          width: 40, height: 40, borderRadius: 'var(--radius)',
          border: 'none', cursor: 'pointer', display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, background: activeView === 'history' ? 'var(--accent-light)' : 'transparent',
          color: activeView === 'history' ? 'var(--accent)' : 'var(--text-muted)',
          transition: 'all 0.15s',
          marginTop: 10,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>⏱️</span>
        <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1 }}>
          History
        </span>
      </button>

      <div style={{ flex: 1 }} />

      {/* Mock data indicator */}
      <div
        title="Running against mock data"
        style={{
          width: 40, marginBottom: 10,
          padding: '5px 2px', borderRadius: 'var(--radius)',
          background: 'var(--warning-light)', border: '1px solid var(--warning-border)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        }}
      >
        <span style={{ fontSize: 14 }}>🗄</span>
        <span style={{
          fontSize: 7, fontWeight: 700, color: 'var(--warning)',
          textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.2,
        }}>
          Mock data in use
        </span>
      </div>
    </nav>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────
export default function App() {
  const { state, run, submitDecision, reset, load } = useSession();
  const { phase } = state;
  const [activeView, setActiveView] = useState<ActiveView>('diagnose');
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => 
    (localStorage.getItem('theme') as any) || 'light'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowHelp(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const isIdle = phase === 'idle';
  const isRunning = ['classifying', 'executing', 'evaluating', 'pending_approval', 'analyzing'].includes(phase);
  const isComplete = phase === 'complete';
  const isError = phase === 'error';
  const hasSession = !isIdle;

  // Elapsed timer — runs during execution/evaluation, pauses at pending_approval
  const stepRunning = phase === 'executing' || phase === 'evaluating' || phase === 'classifying' || phase === 'analyzing';
  const { elapsed, reset: resetElapsed } = useElapsedTimer(stepRunning);

  // Track per-step timing
  const [stepElapsed, setStepElapsed] = useState<Record<string, { active: number; wait: number }>>({});
  const lastStateRef = useRef<{ phase: string; stepId: string | null; time: number }>({
    phase: 'idle',
    stepId: null,
    time: Date.now(),
  });

  useEffect(() => {
    const prev = lastStateRef.current;
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((now - prev.time) / 1000));

    if (prev.stepId) {
      const isPrevActive = ['executing', 'evaluating'].includes(prev.phase);
      const isPrevWait = prev.phase === 'pending_approval';

      if (isPrevActive || isPrevWait) {
        setStepElapsed(existing => {
          const current = existing[prev.stepId!] || { active: 0, wait: 0 };
          return {
            ...existing,
            [prev.stepId!]: {
              active: current.active + (isPrevActive ? elapsedSeconds : 0),
              wait: current.wait + (isPrevWait ? elapsedSeconds : 0),
            }
          };
        });
      }
    }

    lastStateRef.current = {
      phase: phase,
      stepId: state.currentStep,
      time: now,
    };
  }, [phase, state.currentStep]);

  // Real-time ticking for the current active/waiting step
  useEffect(() => {
    if (phase === 'idle') {
      setStepElapsed({});
      lastStateRef.current = { phase: 'idle', stepId: null, time: Date.now() };
      return;
    }

    const interval = setInterval(() => {
      const prev = lastStateRef.current;
      const now = Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((now - prev.time) / 1000));

      if (prev.stepId && elapsedSeconds > 0) {
        const isPrevActive = ['executing', 'evaluating'].includes(prev.phase);
        const isPrevWait = prev.phase === 'pending_approval';

        if (isPrevActive || isPrevWait) {
          setStepElapsed(existing => {
            const current = existing[prev.stepId!] || { active: 0, wait: 0 };
            return {
              ...existing,
              [prev.stepId!]: {
                active: current.active + (isPrevActive ? 1 : 0),
                wait: current.wait + (isPrevWait ? 1 : 0),
              }
            };
          });
        }
        lastStateRef.current.time = now;
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  const handleReset = useCallback(() => {
    reset();
    setActiveView('diagnose');
    setHistoryRefresh(n => n + 1);
    resetElapsed();
  }, [reset, resetElapsed]);

  if (showLogin) {
    return <LoginScreen onCancel={() => setShowLogin(false)} dbms={state.dbms || 'oracle'} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--surface-0)' }}>

      {/* Topbar */}
      <header style={{
        height: 70, display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 16px', background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
        boxShadow: 'var(--shadow-sm)',
      }}>

        {/* Logo / Banner */}
        <button
          onClick={handleReset}
          title="Go to homepage"
          style={{
            display: 'flex', alignItems: 'center', gap: 4, marginRight: 4,
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
            borderRadius: 'var(--radius)', transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          {/* If on homepage (activeView is 'diagnose' and isIdle) */}
          {(activeView === 'diagnose' && isIdle) ? (
            <img src="/DBAtlas-mark.svg" alt="DBAtlas" style={{ height: 28, width: 28, flexShrink: 0 }} />
          ) : (
            /* If on active diagnostic page */
            (activeView === 'diagnose' && !isIdle) ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <img src="/DBAtlas-horizontal.svg" alt="DBAtlas" style={{ height: 26, width: 'auto', flexShrink: 0 }} />
                <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', letterSpacing: '0.02em', marginTop: -1 }}>
                  <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--brand-teal)' }}>D</span>ata<span style={{ textDecoration: 'underline', textDecorationColor: 'var(--brand-teal)' }}>b</span>ase{' '}
                  <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--brand-teal)' }}>A</span>gentic{' '}
                  <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--brand-teal)' }}>T</span>roub<span style={{ textDecoration: 'underline', textDecorationColor: 'var(--brand-teal)' }}>l</span>eshooting{' '}
                  <span style={{ textDecoration: 'underline', textDecorationColor: 'var(--brand-teal)' }}>A</span>dvi<span style={{ textDecoration: 'underline', textDecorationColor: 'var(--brand-teal)' }}>s</span>or
                </span>
              </div>
            ) : (
              /* For other views (e.g. History) */
              <>
                <img src="/DBAtlas-mark.svg" alt="DBAtlas" style={{ height: 28, width: 28, flexShrink: 0 }} />
                <img src="/DBAtlas-horizontal.svg" alt="DBAtlas" style={{ height: 22, width: 'auto' }} />
              </>
            )
          )}
        </button>

        <div style={{ flex: 1 }} />

        {/* Tic-Tac-Toe Wait Game (Repurposed Space) - moved to the right end */}
        {hasSession && activeView === 'diagnose' && (
          <div style={{ marginRight: 8 }}>
            <TicTacToeWidget disabled={phase === 'pending_approval'} />
          </div>
        )}

        <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          style={{
            display: 'flex', alignItems: 'center', position: 'relative',
            width: 52, height: 26, borderRadius: 13, padding: 2,
            border: '1px solid var(--border)', background: 'var(--surface-2)',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          <div style={{
            position: 'absolute',
            left: theme === 'light' ? 2 : 26,
            width: 22, height: 20, borderRadius: 10,
            background: 'var(--surface-0)', boxShadow: 'var(--shadow-sm)',
            transition: 'left 0.2s ease',
          }} />
          <div style={{ zIndex: 1, display: 'flex', width: '100%', justifyContent: 'space-between', padding: '0 4px', alignItems: 'center' }}>
            {/* Sun SVG */}
            <svg 
              viewBox="0 0 24 24" 
              width="12" 
              height="12" 
              stroke="#D97706" 
              fill="#F59E0B" 
              strokeWidth="2"
              style={{ opacity: theme === 'light' ? 1 : 0.4, transition: 'opacity 0.15s' }}
            >
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            {/* Moon SVG */}
            <svg 
              viewBox="0 0 24 24" 
              width="12" 
              height="12" 
              stroke="#4338CA" 
              fill="#6366F1" 
              strokeWidth="2"
              style={{ opacity: theme === 'dark' ? 1 : 0.4, transition: 'opacity 0.15s' }}
            >
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </div>
        </button>

        {/* Quick start */}
        <button
          onClick={() => setShowHelp(v => !v)}
          title="Quick start — how to use DBAtlas"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 500, padding: '5px 10px',
            background: showHelp ? 'var(--accent-light)' : 'transparent',
            border: '1px solid', borderColor: showHelp ? 'var(--accent-border)' : 'var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer',
            color: showHelp ? 'var(--accent)' : 'var(--text-muted)',
            fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 14 }}>⚡</span>
          Quick start
        </button>

        {/* Log out */}
        <button
          onClick={() => setShowLogin(true)}
          title="Sign out"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 500, padding: '5px 10px',
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', cursor: 'pointer',
            color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger-border)'; e.currentTarget.style.color = 'var(--danger)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          <span style={{ fontSize: 14 }}>🚪</span>
          Log out
        </button>

      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left sidebar nav */}
        <SideNav activeView={activeView} setActiveView={setActiveView} onToggleChat={() => setShowChat(v => !v)} />

        {/* Main content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

          {/* Chat Widget */}
          {showChat && <ChatWidget onClose={() => setShowChat(false)} />}

          {/* History view */}
          {activeView === 'history' && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <SessionHistory key={historyRefresh} onReopen={(sid) => {
                load(sid);
                setActiveView('diagnose');
              }} />
            </div>
          )}

          {/* About view */}
          {activeView === 'about' && (
            <AboutView />
          )}

          {/* Diagnostic view */}
          {activeView === 'diagnose' && (
            <>
              {isIdle && <InputForm onSubmit={run} onNavigate={setActiveView} />}

              {!isIdle && (
                <>
                  <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                    {/* Question bar */}
                    <div style={{
                      padding: '12px 20px', background: 'var(--surface-1)',
                      borderBottom: '1px solid var(--border)', flexShrink: 0,
                    }}>
                      {/* Session context indicators (moved from topbar) */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginBottom: 12,
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: 10,
                        flexWrap: 'wrap',
                      }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '3px 9px', background: 'var(--surface-2)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)',
                        }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)' }} />
                          {state.serverName}
                        </div>
                        {state.dbms && <Badge variant="dbms" dbms={state.dbms} size="sm">{state.dbms}</Badge>}
                        <div style={{
                          padding: '3px 9px', background: 'var(--surface-2)',
                          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)',
                        }}>
                          {state.ticketNumber}
                        </div>
                        <Badge variant="mode" mode={state.mode} size="sm">
                          {state.mode === 'interactive' ? '● Interactive' : '▶ Auto'}
                        </Badge>
                        {isRunning && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', fontSize: 11 }}>
                            <Spinner size={11} />
                            <span>{phaseLabel(phase)}</span>
                            {elapsed > 0 && (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 10,
                                background: 'var(--surface-2)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)', padding: '1px 5px',
                                color: 'var(--text-muted)',
                              }}>
                                {formatElapsed(elapsed)}
                              </span>
                            )}
                          </div>
                        )}
                        {isComplete && state.analysis && <SeverityBadge severity={state.analysis.severity} />}

                        <div style={{ flex: 1 }} />

                        {/* New session */}
                        <button
                          onClick={handleReset}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '4px 12px',
                            background: 'var(--surface-2)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius)', cursor: 'pointer',
                            color: 'var(--text-muted)', fontFamily: 'var(--font-sans)',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--accent-border)';
                            e.currentTarget.style.background = 'var(--surface-3)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.background = 'var(--surface-2)';
                            e.currentTarget.style.color = 'var(--text-muted)';
                          }}
                        >
                          + New session
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>
                            Diagnostic question
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                            "{state.question}"
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            {state.intentCategory && <Badge variant="purple" size="sm">{state.intentCategory.replace(/_/g, ' ')}</Badge>}
                            {state.playbookId && <Badge variant="default" size="sm">{state.playbookId}</Badge>}
                            {isComplete && (() => {
                              let totalActive = Object.values(stepElapsed).reduce((sum, t) => sum + t.active, 0);
                              let totalWait = Object.values(stepElapsed).reduce((sum, t) => sum + t.wait, 0);
                              
                              if (totalActive === 0 && state.checkpointLog.length > 0) {
                                totalActive = state.checkpointLog.reduce((sum, entry) => sum + (entry.active_duration || 0), 0);
                                totalWait = state.checkpointLog.reduce((sum, entry) => sum + (entry.wait_duration || 0), 0);
                              }

                              return (
                                <>
                                  <Badge variant="success" size="sm">✓ Complete</Badge>
                                  <span style={{
                                    fontSize: 10, color: 'var(--text-muted)',
                                    fontFamily: 'var(--font-mono)', display: 'inline-flex',
                                    alignItems: 'center', background: 'var(--surface-2)',
                                    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                    padding: '1px 6px', marginLeft: 4
                                  }}>
                                    Total: {formatElapsed(totalActive + totalWait)} ({formatElapsed(totalActive)} active{totalWait > 0 ? ` / ${formatElapsed(totalWait)} wait` : ''})
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        {isComplete && state.analysis && (
                          <CopyButton text={
                            `Server: ${state.serverName}\nTicket: ${state.ticketNumber}\n\n` +
                            `Summary: ${state.analysis.summary}\n\n` +
                            `Severity: ${state.analysis.severity.toUpperCase()}\n\n` +
                            `Key Findings:\n${state.analysis.key_findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\n` +
                            `Recommended Actions:\n${state.analysis.recommended_actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`
                          } />
                        )}
                      </div>
                    </div>

                    {/* Playbook Flow Graph */}
                    <PlaybookGraph
                      playbookId={state.playbookId}
                      currentStep={state.currentStep}
                      stepsExecuted={state.stepsExecuted}
                      stepsSkipped={state.stepsSkipped}
                      isPendingApproval={phase === 'pending_approval'}
                      phase={phase}
                    />

                    <div style={{ flex: 1, overflowY: 'auto' }}>

                      {/* Classifying / Analyzing */}
                      {(phase === 'classifying' || phase === 'analyzing') && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 16 }}>
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-light)', border: '1px solid var(--accent-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spinner size={22} />
                          </div>
                          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', textAlign: 'center', marginBottom: 4 }}>
                            {phase === 'classifying' ? 'Classifying intent and selecting playbook...' : 'Generating final analysis...'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>AI is working</div>
                        </div>
                      )}

                      {/* Executing / Evaluating */}
                      {(phase === 'executing' || phase === 'evaluating') && state.currentStep && (
                        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div className="fade-in" style={{
                            padding: '14px 16px', background: 'var(--surface-1)',
                            border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)',
                            borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                              <Spinner size={13} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {phase === 'executing' ? 'Executing diagnostic step' : 'Claude evaluating results'}
                              </span>
                              {elapsed > 0 && (
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-faint)' }}>
                                  {formatElapsed(elapsed)}
                                </span>
                              )}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                              {state.currentStep}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              Checkpoint {state.currentIteration} · {state.mode} mode
                            </div>
                          </div>
                          {state.stepsExecuted.length > 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ color: 'var(--success)' }}>✓</span>
                              Completed:
                              {state.stepsExecuted.map(s => {
                                const t = stepElapsed[s];
                                return (
                                  <span key={s} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--success-light)', border: '1px solid var(--success-border)', color: 'var(--success)', padding: '1px 5px', borderRadius: 'var(--radius-sm)', marginLeft: 4 }}>
                                    {s}
                                    {t && (
                                      <span style={{ color: 'var(--text-faint)', marginLeft: 4 }}>
                                        {state.mode === 'interactive' && t.wait > 0
                                          ? `${formatElapsed(t.active)} active · ${formatElapsed(t.wait)} wait`
                                          : formatElapsed(t.active)}
                                      </span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pending approval */}
                      {phase === 'pending_approval' && state.pendingApproval && (
                        <CheckpointApprovalPanel
                          pending={state.pendingApproval}
                          onDecision={submitDecision}
                          serverName={state.serverName}
                          ticketNumber={state.ticketNumber}
                          maxSteps={5}
                        />
                      )}

                      {/* Completed steps below approval panel */}
                      {phase === 'pending_approval' && state.checkpointLog.length > 0 && (
                        <div style={{ padding: '0 20px 20px' }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 9 }}>
                            Steps completed this session
                          </div>
                          {state.checkpointLog.map((entry, i) => {
                            const t = stepElapsed[entry.step_id];
                            return (
                              <div key={i} style={{
                                display: 'flex', gap: 10, padding: '8px 12px', marginBottom: 6,
                                background: 'var(--surface-1)', border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)', opacity: 0.85, alignItems: 'flex-start',
                              }}>
                                <div style={{
                                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                  background: 'var(--success-light)', border: '1px solid var(--success-border)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10, fontWeight: 600, color: 'var(--success)',
                                }}>{i + 1}</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{entry.step_id}</div>
                                  <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 1 }}>✓ {entry.dba_decision === 'approved' ? 'Approved' : entry.dba_decision || 'Complete'}</div>
                                  <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1, fontFamily: 'var(--font-mono)' }}>
                                    {entry.row_count} rows
                                    {t && (
                                      <span style={{ marginLeft: 8 }}>
                                        {state.mode === 'interactive' && t.wait > 0
                                          ? `· ${formatElapsed(t.active)} active · ${formatElapsed(t.wait)} wait`
                                          : `· ${formatElapsed(t.active)}`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Final report */}
                      {isComplete && state.analysis && (
                        <DiagnosticReport
                          sessionId={state.sessionId || ''}
                          analysis={state.analysis}
                          checkpointLog={state.checkpointLog}
                          serverName={state.serverName}
                          ticketNumber={state.ticketNumber}
                          playbookId={state.playbookId}
                          mode={state.mode}
                          stepElapsed={stepElapsed}
                        />
                      )}

                      {/* Error */}
                      {isError && (
                        <div style={{ padding: 24 }}>
                          <div className="fade-in" style={{
                            padding: 16, background: 'var(--danger-light)',
                            border: '1px solid var(--danger-border)',
                            borderLeft: '3px solid var(--danger)', borderRadius: 'var(--radius-md)',
                          }}>
                            <div style={{ fontWeight: 600, color: 'var(--danger)', marginBottom: 6, fontSize: 14 }}>Session error</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>{state.errorMessage}</div>
                            <Button variant="ghost" size="sm" onClick={handleReset}>Start new session</Button>
                          </div>
                        </div>
                      )}

                    </div>
                  </main>

                  <CheckpointRail
                    nodes={state.nodes}
                    playbookId={state.playbookId}
                    playbookTitle={state.playbookTitle}
                    dbms={state.dbms}
                    mode={state.mode}
                    stepsSkipped={state.stepsSkipped}
                    currentIteration={state.currentIteration}
                    maxSteps={5}
                    isPendingApproval={phase === 'pending_approval'}
                    stepElapsed={stepElapsed}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Help overlay */}
      {showHelp && <HelpOverlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
