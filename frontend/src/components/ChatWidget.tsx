import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Button, Spinner } from './ui';
import { sendChatMessage } from '../api/client';

type Role = 'user' | 'assistant';

interface ChatMessage {
  role: Role;
  content: string;
}

const SUGGESTIONS = [
  "What is the router-not-generator principle?",
  "How does Interactive Mode work?",
  "What SQL Server scenarios are available?",
  "What comes after the demo?",
  "What does DBAtlas do?"
];

// Simple inline parser for bolding and code spans
const parseInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code 
          key={index} 
          style={{ 
            background: 'var(--surface-2)', 
            padding: '2px 4px', 
            borderRadius: '4px', 
            fontFamily: 'var(--font-mono)', 
            fontSize: '0.9em',
            color: 'var(--accent)'
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

// Rich Markdown Block Parser
const renderMarkdown = (text: string) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    
    if (!line.trim()) {
      i++;
      continue;
    }
    
    // Headings
    if (line.startsWith('#')) {
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const content = match[2];
        const headingStyle: React.CSSProperties = {
          fontWeight: 600,
          marginTop: '14px',
          marginBottom: '6px',
          color: 'var(--text-primary)',
        };
        if (level === 1) { 
          headingStyle.fontSize = '1.35em'; 
          headingStyle.borderBottom = '1px solid var(--border)'; 
          headingStyle.paddingBottom = '4px'; 
        }
        else if (level === 2) headingStyle.fontSize = '1.2em';
        else headingStyle.fontSize = '1.1em';
        
        elements.push(
          <div key={i} style={headingStyle}>
            {parseInline(content)}
          </div>
        );
        i++;
        continue;
      }
    }
    
    // Horizontal Rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '14px 0' }} />);
      i++;
      continue;
    }
    
    // Table
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      
      const validRows = tableLines.filter(row => !row.match(/^\|[\s:-|]+$/));
      if (validRows.length > 0) {
        const parsedRows = validRows.map(row => {
          const cells = row.split('|').map(c => c.trim());
          if (cells[0] === '') cells.shift();
          if (cells[cells.length - 1] === '') cells.pop();
          return cells;
        });
        
        elements.push(
          <div key={i} style={{ overflowX: 'auto', margin: '10px 0', border: '1px solid var(--border)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {parsedRows[0].map((cell, idx) => (
                    <th key={idx} style={{ padding: '8px 10px', fontWeight: 600 }}>{parseInline(cell)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(1).map((row, rowIdx) => (
                  <tr key={rowIdx} style={{ borderBottom: rowIdx < parsedRows.length - 2 ? '1px solid var(--border)' : 'none' }}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx} style={{ padding: '8px 10px', color: 'var(--text-primary)' }}>{parseInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }
    
    // Bullet list
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={i} style={{ margin: '6px 0 6px 20px', padding: 0, listStyleType: 'disc' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '4px', color: 'var(--text-primary)' }}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }
    
    // Default Paragraph
    elements.push(
      <p key={i} style={{ margin: '6px 0', color: 'var(--text-primary)' }}>
        {parseInline(line)}
      </p>
    );
    i++;
  }
  
  return elements;
};

export function ChatWidget({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or while loading
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Send chat request
      const res = await sendChatMessage(newMessages);
      const reply = res.response;
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      console.error(err);
      const errMsg = err.response?.data?.detail || err.message || String(err);
      const status = err.response?.status || 'Network/Unknown';
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ Sorry, I encountered an error: [Status: ${status}] ${errMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="fade-in" style={{
      position: 'fixed',
      bottom: 20,
      left: 70, // Just to the right of the SideNav
      width: 760, // Expanded by 100% (from 380px)
      height: 550, // Slightly taller to fit layout well
      background: 'var(--surface-1)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 1000,
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--accent-light)',
        borderBottom: '1px solid var(--accent-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🤖</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>DBAtlas Knowledge Base</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button 
            title="Clear conversation"
            onClick={() => setMessages([])} 
            disabled={messages.length === 0}
            style={{
              background: 'none', border: 'none', cursor: messages.length === 0 ? 'default' : 'pointer',
              fontSize: 9.5, color: 'var(--text-muted)', opacity: messages.length === 0 ? 0.3 : 1,
              marginRight: 14 // Fushed slightly left
            }}
          >
            🧹 Clear
          </button>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 16, color: 'var(--text-muted)', lineHeight: 1,
          }}>✕</button>
        </div>
      </div>

      {/* Message List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--surface-0)' }}>
        {messages.length === 0 && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', marginBottom: 'auto' }}>
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
              Ask me anything about how DBAtlas works!
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '6px 12px',
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%', // Extra breathing room for wider layouts
            background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface-1)',
            color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
            padding: '10px 14px',
            borderRadius: 'var(--radius)',
            border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
            fontSize: 13,
            lineHeight: 1.5,
            boxShadow: 'var(--shadow-sm)'
          }}>
            {msg.role === 'user' ? parseInline(msg.content) : renderMarkdown(msg.content)}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <Spinner />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Thinking...<span style={{ animation: 'blink 1s step-end infinite' }}>|</span></span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div style={{ padding: '12px 16px', background: 'var(--surface-1)', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question... (Enter to send)"
            disabled={loading}
            style={{
              flex: 1,
              resize: 'none',
              padding: '8px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              background: 'var(--surface-0)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: 13,
              height: 40,
              minHeight: 40,
              maxHeight: 120,
              outline: 'none',
            }}
          />
          <Button 
            onClick={() => sendMessage(input)} 
            disabled={!input.trim() || loading}
            style={{ padding: '8px 14px', height: 40 }}
          >
            Send
          </Button>
        </div>
      </div>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
