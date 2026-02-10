import React, { useState, useEffect, useCallback } from 'react';

// --- Types ---

type AIProvider = 'openai-compat' | 'ollama' | 'openrouter';

interface Config {
  paperless: {
    host: string;
    apiKey: string;
  };
  ai: {
    provider: AIProvider;
    apiKey: string;
    baseURL: string;
    model: string;
  };
  processing: {
    scanInterval: number;
    receiptTag: string;
    processedTag: string;
    failedTag: string;
    maxRetries: number;
  };
  observability: {
    helicone: {
      enabled: boolean;
      apiKey: string;
    };
  };
}

const DEFAULT_CONFIG: Config = {
  paperless: {
    host: '',
    apiKey: '',
  },
  ai: {
    provider: 'openai-compat',
    apiKey: '',
    baseURL: '',
    model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
  },
  processing: {
    scanInterval: 300,
    receiptTag: 'receipt',
    processedTag: 'ai-processed',
    failedTag: 'ai-failed',
    maxRetries: 3,
  },
  observability: {
    helicone: {
      enabled: false,
      apiKey: '',
    },
  },
};

// --- Styles (Dark Theme) ---

const theme = {
  bg: '#1a1b1e',
  cardBg: '#25262b',
  text: '#c1c2c5',
  textMuted: '#909296',
  border: '#373a40',
  primary: '#339af0',
  primaryHover: '#228be6',
  success: '#40c057',
  danger: '#fa5252',
  inputBg: '#2c2e33',
  radius: '4px',
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: theme.bg,
    color: theme.text,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '2rem',
    boxSizing: 'border-box',
  },
  header: {
    marginBottom: '2rem',
    borderBottom: `1px solid ${theme.border}`,
    paddingBottom: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#fff',
  },
  section: {
    backgroundColor: theme.cardBg,
    borderRadius: theme.radius,
    border: `1px solid ${theme.border}`,
    padding: '1.5rem',
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '1.5rem',
    fontSize: '1.1rem',
    fontWeight: 500,
    color: '#fff',
    borderBottom: `1px solid ${theme.border}`,
    paddingBottom: '0.5rem',
  },
  row: {
    display: 'flex',
    gap: '1.5rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  field: {
    flex: 1,
    minWidth: '250px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  input: {
    backgroundColor: theme.inputBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
    color: theme.text,
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  select: {
    backgroundColor: theme.inputBg,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
    color: theme.text,
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    outline: 'none',
    cursor: 'pointer',
  },
  checkboxWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
    cursor: 'pointer',
  },
  button: {
    padding: '0.6rem 1.2rem',
    borderRadius: theme.radius,
    border: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  primaryBtn: {
    backgroundColor: theme.primary,
    color: '#fff',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    border: `1px solid ${theme.border}`,
    color: theme.text,
  },
  successBtn: {
    backgroundColor: theme.success,
    color: '#fff',
  },
  dangerBtn: {
    backgroundColor: theme.danger,
    color: '#fff',
  },
  message: {
    padding: '1rem',
    borderRadius: theme.radius,
    marginTop: '1rem',
    fontSize: '0.9rem',
  },
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  actions: {
    display: 'flex',
    gap: '1rem',
    marginTop: '2rem',
    justifyContent: 'flex-end',
  },
};

// --- Components ---

function App() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:3001');
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [testingAI, setTestingAI] = useState(false);
  const [testingPaperless, setTestingPaperless] = useState(false);

  // Fetch initial config
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/config`);
        if (!res.ok) throw new Error(`Failed to load config: ${res.statusText}`);
        const data = await res.json();
        
        // Merge with default to ensure all fields exist
        setConfig(prev => ({
          ...prev,
          ...data,
          paperless: { ...prev.paperless, ...data.paperless },
          ai: { ...prev.ai, ...data.ai },
          processing: { ...prev.processing, ...data.processing },
          observability: { ...prev.observability, ...data.observability },
        }));
      } catch (err) {
        // If config endpoint fails (e.g. first run), we keep defaults but show error
        console.error("Config fetch error:", err);
        // Optional: setStatusMsg({ type: 'error', text: 'Could not load current config. Using defaults.' });
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [apiBaseUrl]);

  const handleSave = async () => {
    setStatusMsg({ type: 'info', text: 'Saving configuration...' });
    try {
      const res = await fetch(`${apiBaseUrl}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save configuration');
      setStatusMsg({ type: 'success', text: 'Configuration saved successfully' });
      
      // Clear success message after 3s
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' });
    }
  };

  const handleTestAI = async () => {
    setTestingAI(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/config/test-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.ai),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI Connection Test Failed');
      setStatusMsg({ type: 'success', text: 'AI Connection Verified! ' + (data.message || '') });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setTestingAI(false);
    }
  };

  const handleTestPaperless = async () => {
    setTestingPaperless(true);
    setStatusMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/config/test-paperless`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.paperless),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Paperless Connection Test Failed');
      setStatusMsg({ type: 'success', text: 'Paperless Connection Verified! ' + (data.message || '') });
    } catch (err) {
      setStatusMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      setTestingPaperless(false);
    }
  };

  // Helper to update nested state
  const updateConfig = (section: keyof Config, field: string, value: string | number | boolean, subSection?: string) => {
    setConfig(prev => {
      if (section === 'observability' && subSection === 'helicone') {
         return {
          ...prev,
          observability: {
            ...prev.observability,
            helicone: {
              ...prev.observability.helicone,
              [field]: value as boolean | string
            }
          }
        };
      }
      
      const newConfig = { ...prev };
      
      if (section === 'paperless') {
        newConfig.paperless = { ...prev.paperless, [field]: value as string };
      } else if (section === 'ai') {
        newConfig.ai = { ...prev.ai, [field]: value as string };
      } else if (section === 'processing') {
        newConfig.processing = { ...prev.processing, [field]: value as string | number };
      }
      
      return newConfig;
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={{...styles.loadingOverlay, color: '#fff'}}>Loading configuration...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>ReceiptHero Configuration</h1>
          <p style={{ margin: '0.5rem 0 0', color: theme.textMuted, fontSize: '0.9rem' }}>
            Manage your AI OCR settings and Paperless integration
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ fontSize: '0.8rem', color: theme.textMuted }}>API URL:</label>
          <input 
            style={{ ...styles.input, width: '200px', padding: '0.3rem' }}
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
          />
        </div>
      </header>

      {/* Status Message */}
      {statusMsg && (
        <div style={{
          ...styles.message,
          backgroundColor: statusMsg.type === 'error' ? 'rgba(250, 82, 82, 0.1)' : 
                         statusMsg.type === 'success' ? 'rgba(64, 192, 87, 0.1)' : 'rgba(51, 154, 240, 0.1)',
          color: statusMsg.type === 'error' ? theme.danger : 
                 statusMsg.type === 'success' ? theme.success : theme.primary,
          border: `1px solid ${statusMsg.type === 'error' ? theme.danger : 
                              statusMsg.type === 'success' ? theme.success : theme.primary}`,
          marginBottom: '2rem'
        }}>
          <strong>{statusMsg.type.toUpperCase()}:</strong> {statusMsg.text}
        </div>
      )}

      {/* Paperless Section */}
      <section style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: `1px solid ${theme.border}`, paddingBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Paperless-NGX</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              style={{...styles.button, ...styles.secondaryBtn, fontSize: '0.8rem', padding: '0.4rem 0.8rem'}}
              onClick={handleTestPaperless}
              disabled={testingPaperless}
            >
              {testingPaperless ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Host URL</label>
            <input
              style={styles.input}
              placeholder="http://paperless:8000"
              value={config.paperless.host}
              onChange={(e) => updateConfig('paperless', 'host', e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>API Token</label>
            <input
              style={styles.input}
              type="password"
              placeholder="Token..."
              value={config.paperless.apiKey}
              onChange={(e) => updateConfig('paperless', 'apiKey', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* AI Provider Section */}
      <section style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: `1px solid ${theme.border}`, paddingBottom: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>AI Provider</h2>
          <button 
            style={{...styles.button, ...styles.secondaryBtn, fontSize: '0.8rem', padding: '0.4rem 0.8rem'}}
            onClick={handleTestAI}
            disabled={testingAI}
          >
            {testingAI ? 'Testing...' : 'Test AI Connection'}
          </button>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Provider</label>
            <select
              style={styles.select}
              value={config.ai.provider}
              onChange={(e) => updateConfig('ai', 'provider', e.target.value)}
            >
              <option value="openai-compat">OpenAI Compatible (Together, etc.)</option>
              <option value="ollama">Ollama (Local)</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Model</label>
            <input
              style={styles.input}
              placeholder="e.g. meta-llama/Llama-3-70b-Chat-hf"
              value={config.ai.model}
              onChange={(e) => updateConfig('ai', 'model', e.target.value)}
            />
          </div>
        </div>

        <div style={styles.row}>
          {(config.ai.provider === 'openai-compat' || config.ai.provider === 'ollama') && (
            <div style={styles.field}>
              <label style={styles.label}>Base URL {config.ai.provider === 'openai-compat' ? '(Optional)' : '(Required for remote)'}</label>
              <input
                style={styles.input}
                placeholder={config.ai.provider === 'ollama' ? "http://localhost:11434" : "https://api.together.xyz/v1"}
                value={config.ai.baseURL}
                onChange={(e) => updateConfig('ai', 'baseURL', e.target.value)}
              />
            </div>
          )}
          
          {(config.ai.provider === 'openai-compat' || config.ai.provider === 'openrouter') && (
            <div style={styles.field}>
              <label style={styles.label}>API Key</label>
              <input
                style={styles.input}
                type="password"
                placeholder="sk-..."
                value={config.ai.apiKey}
                onChange={(e) => updateConfig('ai', 'apiKey', e.target.value)}
              />
            </div>
          )}
        </div>
      </section>

      {/* Processing Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Processing Configuration</h2>
        
        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Scan Interval (seconds)</label>
            <input
              style={styles.input}
              type="number"
              value={config.processing.scanInterval}
              onChange={(e) => updateConfig('processing', 'scanInterval', parseInt(e.target.value) || 0)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Max Retries</label>
            <input
              style={styles.input}
              type="number"
              value={config.processing.maxRetries}
              onChange={(e) => updateConfig('processing', 'maxRetries', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label style={styles.label}>Source Tag</label>
            <input
              style={styles.input}
              value={config.processing.receiptTag}
              onChange={(e) => updateConfig('processing', 'receiptTag', e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Success Tag</label>
            <input
              style={{...styles.input, borderColor: theme.success}}
              value={config.processing.processedTag}
              onChange={(e) => updateConfig('processing', 'processedTag', e.target.value)}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Failure Tag</label>
            <input
              style={{...styles.input, borderColor: theme.danger}}
              value={config.processing.failedTag}
              onChange={(e) => updateConfig('processing', 'failedTag', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Observability Section */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Observability (Helicone)</h2>
        
        <label style={styles.checkboxWrapper}>
          <input
            type="checkbox"
            checked={config.observability.helicone.enabled}
            onChange={(e) => updateConfig('observability', 'enabled', e.target.checked, 'helicone')}
          />
          <span style={{ fontSize: '0.9rem' }}>Enable Helicone Monitoring</span>
        </label>

        {config.observability.helicone.enabled && (
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Helicone API Key</label>
              <input
                style={styles.input}
                type="password"
                placeholder="sk-helicone-..."
                value={config.observability.helicone.apiKey}
                onChange={(e) => updateConfig('observability', 'apiKey', e.target.value, 'helicone')}
              />
            </div>
          </div>
        )}
      </section>

      {/* Actions */}
      <div style={styles.actions}>
        <button 
          style={{...styles.button, ...styles.primaryBtn, width: '200px', justifyContent: 'center'}}
          onClick={handleSave}
          disabled={statusMsg?.type === 'info'}
        >
          {statusMsg?.type === 'info' ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
}

export default App;
