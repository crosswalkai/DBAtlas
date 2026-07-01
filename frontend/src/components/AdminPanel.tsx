import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Button, Spinner } from './ui';

const BASE = import.meta.env.VITE_API_URL !== undefined 
  ? import.meta.env.VITE_API_URL 
  : (import.meta.env.DEV ? 'http://localhost:8000' : '');

interface AnalyticsData {
  top_playbooks: { name: string; count: number }[];
  top_servers: { name: string; dbms: string; count: number }[];
  outcomes: { success: number; failed: number; in_progress: number };
  total_sessions: number;
}

export function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [error, setError] = useState('');
  
  // Dummy login handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticated(true);
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);
      axios.get(`${BASE}/api/v1/analytics`)
        .then(res => {
          setData(res.data);
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to load analytics data.');
          setLoading(false);
        });
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-0)' }}>
        <div style={{ width: 400, background: 'var(--surface-1)', padding: 40, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <span style={{ fontSize: 40, lineHeight: 1, display: 'block', marginBottom: 16 }}>📊</span>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>Admin Login</h1>
            <p style={{ margin: '8px 0 0 0', fontSize: 13, color: 'var(--text-muted)' }}>Sign in to view session analytics</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input 
              type="password" 
              placeholder="Admin password (demo: any password works)" 
              style={{
                width: '100%', padding: '12px 16px', background: 'var(--surface-0)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', fontSize: 14, color: 'var(--text)'
              }}
              autoFocus
            />
            <Button type="submit" variant="primary" style={{ height: 44 }}>
              Login to Dashboard
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-muted)' }}>
          <Spinner />
          <span>Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--error)' }}>{error}</div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 40, background: 'var(--surface-0)' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: 'var(--text)' }}>Usage Analytics</h1>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Overview of DBAtlas diagnostic sessions</p>
          </div>
          <Button variant="secondary" onClick={() => setIsAuthenticated(false)}>Log Out</Button>
        </div>

        {/* Overview Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 40 }}>
          <MetricCard title="Total Sessions" value={data.total_sessions} color="var(--brand-teal)" />
          <MetricCard title="Successful" value={data.outcomes.success} color="var(--success)" />
          <MetricCard title="Failed / Unresolved" value={data.outcomes.failed} color="var(--error)" />
          <MetricCard title="In Progress" value={data.outcomes.in_progress} color="var(--accent)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          {/* Top Playbooks */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px 0' }}>Top Playbooks</h2>
            {data.top_playbooks.length === 0 ? (
              <div style={{ color: 'var(--text-faint)', fontSize: 13, fontStyle: 'italic' }}>No data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {data.top_playbooks.map(pb => (
                  <BarRow key={pb.name} label={pb.name} value={pb.count} max={data.top_playbooks[0]?.count || 1} color="var(--accent)" />
                ))}
              </div>
            )}
          </div>

          {/* Top Servers */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 20px 0' }}>Top Servers</h2>
            {data.top_servers.length === 0 ? (
              <div style={{ color: 'var(--text-faint)', fontSize: 13, fontStyle: 'italic' }}>No data available</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {data.top_servers.map(srv => (
                  <BarRow key={srv.name} label={`${srv.name} (${srv.dbms})`} value={srv.count} max={data.top_servers[0]?.count || 1} color="var(--brand-teal)" />
                ))}
              </div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

// ── UI Components for Dashboard ───────────────────────────────────────────────

function MetricCard({ title, value, color }: { title: string, value: number, color: string }) {
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {title}
      </div>
      <div style={{ fontSize: 36, fontWeight: 700, color: color, lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string, value: number, max: number, color: string }) {
  const widthPct = Math.max(2, Math.round((value / max) * 100));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '85%' }} title={label}>
          {label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>{value}</span>
      </div>
      <div style={{ width: '100%', height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${widthPct}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}
