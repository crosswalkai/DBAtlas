// components/ui.tsx — shared primitives

import React from 'react';
import type { DbmsType, Severity, SessionMode, DbaDecision } from '../types';

// ── Badge ─────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'purple' | 'dbms' | 'mode';
  dbms?: DbmsType;
  mode?: SessionMode;
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', dbms, mode, size = 'md' }: BadgeProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    fontWeight: 600, borderRadius: 'var(--radius-sm)',
    border: '0.5px solid',
    fontSize: size === 'sm' ? 10 : 11,
    padding: size === 'sm' ? '1px 6px' : '2px 8px',
    letterSpacing: '0.04em', textTransform: 'uppercase',
    fontFamily: 'var(--font-sans)',
    whiteSpace: 'nowrap',
  };

  if (variant === 'dbms' && dbms) {
    const map: Record<DbmsType, React.CSSProperties> = {
      oracle:     { background: 'var(--oracle-bg)',     color: 'var(--oracle-text)',     borderColor: 'var(--oracle-border)' },
      sqlserver:  { background: 'var(--sqlserver-bg)',  color: 'var(--sqlserver-text)',  borderColor: 'var(--sqlserver-border)' },
      postgresql: { background: 'var(--postgres-bg)',   color: 'var(--postgres-text)',   borderColor: 'var(--postgres-border)' },
      mongodb:    { background: 'var(--mongo-bg)',      color: 'var(--mongo-text)',      borderColor: 'var(--mongo-border)' },
    };
    return <span style={{ ...base, ...map[dbms] }}>{children}</span>;
  }

  if (variant === 'mode' && mode) {
    const s = mode === 'interactive'
      ? { background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent-border)' }
      : { background: 'var(--surface-2)', color: 'var(--text-muted)', borderColor: 'var(--border)' };
    return <span style={{ ...base, ...s }}>{children}</span>;
  }

  const variants: Record<string, React.CSSProperties> = {
    default: { background: 'var(--surface-2)', color: 'var(--text-muted)', borderColor: 'var(--border)' },
    accent:  { background: 'var(--accent-light)', color: 'var(--accent)', borderColor: 'var(--accent-border)' },
    success: { background: 'var(--success-light)', color: 'var(--success)', borderColor: 'var(--success-border)' },
    warning: { background: 'var(--warning-light)', color: 'var(--warning)', borderColor: 'var(--warning-border)' },
    danger:  { background: 'var(--danger-light)', color: 'var(--danger)', borderColor: 'var(--danger-border)' },
    purple:  { background: 'var(--purple-light)', color: 'var(--purple)', borderColor: 'var(--purple-border)' },
  };
  return <span style={{ ...base, ...variants[variant] }}>{children}</span>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, BadgeProps['variant']> = {
    critical: 'danger', high: 'warning', medium: 'accent', low: 'success',
  };
  return <Badge variant={map[severity]}>{severity}</Badge>;
}

export function DbaDecisionBadge({ decision }: { decision: DbaDecision }) {
  const map: Record<DbaDecision, { variant: BadgeProps['variant']; label: string }> = {
    approved:        { variant: 'success', label: '✓ Approved' },
    redirected:      { variant: 'warning', label: '⤴ Redirected' },
    switched_playbook: { variant: 'purple', label: '⇄ Switched' },
    stopped:         { variant: 'default', label: '■ Stopped' },
  };
  const { variant, label } = map[decision];
  return <Badge variant={variant} size="sm">{label}</Badge>;
}

// ── Button ────────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({
  children, variant = 'primary', size = 'md',
  loading, disabled, style, ...props
}: ButtonProps) {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, fontFamily: 'var(--font-sans)', fontWeight: 500,
    borderRadius: 'var(--radius)', cursor: disabled || loading ? 'not-allowed' : 'pointer',
    border: '1px solid', transition: 'all 0.15s',
    fontSize: size === 'sm' ? 12 : 13,
    padding: size === 'sm' ? '5px 12px' : '8px 16px',
    opacity: disabled || loading ? 0.6 : 1,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' },
    secondary: { background: 'transparent', color: 'var(--warning)', borderColor: 'var(--warning-border)' },
    ghost:     { background: 'transparent', color: 'var(--text-muted)', borderColor: 'var(--border)' },
    danger:    { background: 'transparent', color: 'var(--danger)', borderColor: 'var(--danger-border)' },
  };
  return (
    <button style={{ ...base, ...variants[variant], ...style }} disabled={disabled || loading} {...props}>
      {loading ? <Spinner size={14} /> : children}
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  accentColor?: string;
}

export function Card({ children, style, accentColor }: CardProps) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow)',
      ...(accentColor ? { borderTop: `2px solid ${accentColor}` } : {}),
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--text-faint)',
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider({ margin = 12 }: { margin?: number }) {
  return <div style={{ height: 1, background: 'var(--border)', margin: `${margin}px 0` }} />;
}
