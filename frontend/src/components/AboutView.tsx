import React from 'react';

export function AboutView() {
  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '24px 32px',
      background: 'var(--surface-0)',
      fontFamily: 'var(--font-sans)',
      color: 'var(--text-primary)',
    }}>
      <div style={{ maxWidth: 840, margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--brand-teal)' }}>About DBAtlas</h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0', fontWeight: 500 }}>
            Database Agentic Troubleshooting Advisor — DBA Copilot
          </p>
        </div>

        {/* 3-Paragraph Summary */}
        <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 36 }}>
          <p style={{ margin: 0 }}>
            <strong>DBAtlas</strong> is an AI-guided database diagnostics platform designed to streamline performance incident triage for Database Administrators. By translating complex, natural-language performance questions into structured, system-executed playbooks, it bridges the gap between fast-paced database alerts and senior DBA troubleshooting expertise across multiple database target platforms.
          </p>
          <p style={{ margin: 0 }}>
            At the heart of DBAtlas is a strict separation of intelligence and execution. The AI engine acts exclusively as a <strong>router, not a generator</strong>—reading results at each checkpoint to navigate pre-authored playbooks, but never generating, modifying, or executing ad-hoc database queries. The FastAPI backend serves as the safety enforcer, validating and executing only senior-DBA-approved scripts from a rigid whitelist through a secure, read-only data boundary.
          </p>
          <p style={{ margin: 0 }}>
            Designed with human-in-the-loop control as a primary trust boundary, the application defaults to <strong>Interactive Mode</strong>. At each checkpoint, the diagnostic loop pauses to present Claude's reasoning and recommended next steps to the on-call DBA, who retains final routing authority to approve recommendations, redirect to alternative steps, switch playbooks, or stop the session to generate the final incident report.
          </p>
        </div>

        {/* Diagram Title */}
        <div style={{ marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Layered System Architecture</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
            Visualizing the safety boundaries, execution controls, and DBA-in-the-loop flow
          </p>
        </div>

        {/* Layered Diagram Component */}
        <div style={{
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'stretch',
          marginBottom: 32,
        }}>
          
          {/* Layer 1: DBA */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '12px',
            border: '1px solid var(--border-accent)',
            borderRadius: 'var(--radius)',
            background: 'var(--accent-light)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>On-call DBA</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Plain-language question (Auto or Interactive Mode)</div>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 14, margin: '-6px 0' }}>↓</div>

          {/* Layer 2: Access Boundary */}
          <div style={{
            padding: '14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Access boundary — RBAC (Role-based access controls)
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                👤 DBA (Run Sessions)
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                ✍️ Senior DBA (Author Playbooks)
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', background: 'var(--surface-0)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                🛡️ Admin (Manage Access)
              </span>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 14, margin: '-6px 0' }}>↓</div>

          {/* Layer 3: Backend & AI Router */}
          <div style={{
            padding: '16px',
            border: '1px solid var(--warning-border)',
            borderRadius: 'var(--radius)',
            background: 'var(--warning-light)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning)', letterSpacing: '0.05em', textAlign: 'center' }}>
              Backend (FastAPI) — The Only Executor & Safety Enforcer
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-teal)' }}>AI — Router, Not Generator</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Reads check result & recommends next step. Never writes or modifies SQL.</div>
              </div>

              <div style={{
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand-teal)' }}>Approved Script Whitelist</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Senior-DBA-authored playbooks containing fixed whitelisted script references.</div>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 14, margin: '-6px 0' }}>↓</div>

          {/* Layer 4: Data Boundary */}
          <div style={{
            padding: '14px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            background: 'var(--surface-2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Data boundary — Single Read-Only Service Account
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, width: '100%' }}>
              {['Oracle', 'SQL Server', 'PostgreSQL', 'MongoDB'].map(db => (
                <div key={db} style={{
                  padding: '6px',
                  background: 'var(--surface-0)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                }}>
                  🗄️ {db} (Read-Only)
                </div>
              ))}
            </div>
          </div>

          {/* Layer 5: Demo Mode status indicator banner */}
          <div style={{
            padding: '6px 12px',
            background: 'var(--warning-light)',
            border: '1px dashed var(--warning-border)',
            borderRadius: 'var(--radius-sm)',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--warning)',
          }}>
            🔌 Mock data engine active · Live read-only DBMS connectors next
          </div>

          <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 14, margin: '-6px 0' }}>↓</div>

          {/* Layer 6: Human Loop Control */}
          <div style={{
            padding: '12px',
            border: '1px solid #C7D2FE',
            background: '#EEF2FF',
            borderRadius: 'var(--radius)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Result returns up the same path — DBA stays in control
            </div>
            <div style={{ fontSize: 11, color: '#6366F1', marginTop: 3 }}>
              Interactive Mode pauses loop at each step for approval, override redirect, playbook switch, or stop.
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
