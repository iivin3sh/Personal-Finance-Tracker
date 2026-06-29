import { useCallback, useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { QRCodeSVG } from 'qrcode.react';
import "./App.css";

const API = "http://localhost:5000";
const TOKEN_KEY = "finance_tracker_token";

const CATEGORIES = [
  "food",
  "transport",
  "housing",
  "utilities",
  "health",
  "education",
  "entertainment",
  "shopping",
  "general",
];

const CAT_COLORS = {
  food: "#6d7cff",
  transport: "#2dd4bf",
  housing: "#f59e0b",
  utilities: "#a78bfa",
  health: "#f472b6",
  education: "#38bdf8",
  entertainment: "#fb7185",
  shopping: "#34d399",
  general: "#94a3b8",
};

const CAT_ICONS = {
  food: "🍽️",
  transport: "🚗",
  housing: "🏠",
  utilities: "💡",
  health: "❤️",
  education: "📚",
  entertainment: "🎬",
  shopping: "🛍️",
  general: "📦",
};

function StatCard({ label, value, tone = "default", sub }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.type || "success"}`}>
      <span>{toast.message}</span>
      <button onClick={onClose}>×</button>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [userEmail, setUserEmail] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [totpUri, setTotpUri] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [filter, setFilter] = useState("all");
  const [editingId, setEditingId] = useState(null);
  const [pendingOverdraft, setPendingOverdraft] = useState(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currentCurrency, setCurrentCurrency] = useState("INR");
  const [convertForm, setConvertForm] = useState({ amount: "", from: "USD", to: "INR" });
  const [convertedResult, setConvertedResult] = useState(null);

  const CURRENCY_MAP = {
    INR: { locale: "en-IN", symbol: "INR", sign: "₹" },
    USD: { locale: "en-US", symbol: "USD", sign: "$" },
    EUR: { locale: "de-DE", symbol: "EUR", sign: "€" },
    GBP: { locale: "en-GB", symbol: "GBP", sign: "£" }
  };

  const fmt = useCallback((amount) => {
    const config = CURRENCY_MAP[currentCurrency] || CURRENCY_MAP.INR;
    return new Intl.NumberFormat(config.locale, {
      style: "currency",
      currency: config.symbol,
      maximumFractionDigits: 2
    }).format(Number(amount || 0));
  }, [currentCurrency]);

  // ⚡ Live Exchange Rates Calculator (Fixed Base Rates for instantaneous performance)
  const calculateConversion = () => {
    const rates = { USD: 1, INR: 83.5, EUR: 0.93, GBP: 0.79 };
    const amt = Number(convertForm.amount);
    if (!amt || amt <= 0) return setConvertedResult(null);

    // Convert input value back to standard Base (USD) then multiply into target currency
    const amountInUSD = amt / rates[convertForm.from];
    const finalAmount = amountInUSD * rates[convertForm.to];
    
    const targetConfig = CURRENCY_MAP[convertForm.to] || CURRENCY_MAP.INR;
    setConvertedResult(new Intl.NumberFormat(targetConfig.locale, {
      style: "currency",
      currency: targetConfig.symbol
    }).format(finalAmount));
  };

  const [authForm, setAuthForm] = useState({
    email: "",
    password: "",
    code: "",
    new_password: "",
  });

  const [summary, setSummary] = useState({
    balance: 0,
    income_total: 0,
    expense_total: 0,
    transaction_count: 0,
    history: [],
    insights: [],
  });

  const [txForm, setTxForm] = useState({
    amount: "",
    type: "expense",
    category: "general",
    note: "",
  });

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
  }, []);

  const authFetch = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
      return response;
    },
    [token]
  );

  const loadSummary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [summaryRes, meRes] = await Promise.all([
        authFetch("/summary"),
        authFetch("/me"),
      ]);

      if (summaryRes.status === 401 || meRes.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setUserEmail("");
        showToast("Session expired. Please log in again.", "error");
        return;
      }

      const summaryData = await summaryRes.json();
      const meData = await meRes.json();

      setSummary({
        balance: summaryData.balance || 0,
        income_total: summaryData.income_total || 0,
        expense_total: summaryData.expense_total || 0,
        transaction_count: summaryData.transaction_count || 0,
        history: [...(summaryData.history || [])].reverse(),
        insights: summaryData.insights || [],
      });
      setUserEmail(meData.email || "");
    } catch {
      showToast("Could not connect to the backend.", "error");
    } finally {
      setLoading(false);
    }
  }, [authFetch, showToast, token]);

  useEffect(() => {
    if (token) return; 

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [token]);

  const resetTxForm = () => {
    setTxForm({ amount: "", type: "expense", category: "general", note: "" });
    setEditingId(null);
    setPendingOverdraft(null);
  };

  const handleAuthChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  };

  const handleTxChange = (event) => {
    const { name, value } = event.target;
    setTxForm((current) => ({ ...current, [name]: value }));
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!authForm.email || !authForm.password) return showToast("Please fill all fields", "error");
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: regEmail, password: regPassword }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.message || "Registration failed", "error");

      // 🌟 DO NOT auto-login yet! Instead, save the secret link and show the setup screen:
      setTotpUri(data.totp_uri); 
      localStorage.setItem(TOKEN_KEY, data.token); // Save token for later dashboard access
      showToast("Account created! Set up security next.", "success");
    } catch {
      showToast("Server error during registration", "error");
    }
  };

  const submitAuth = async () => {
    setAuthLoading(true);
    try {
      let path = "/login";
      let payload = { email: authForm.email, password: authForm.password };

      if (authMode === "register") {
        path = "/register";
      }
      if (authMode === "forgot") {
        path = "/forgot-password";
        payload = { email: authForm.email };
      }
      if (authMode === "reset") {
        path = "/reset-password";
        payload = {
          email: authForm.email,
          code: authForm.code,
          new_password: authForm.new_password,
        };
      }

      const response = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        showToast(data.message || "Request failed.", "error");
        return;
      }

      if (authMode === "login") {
        setToken(data.token);
        setUserEmail(data.email);
        showToast("Welcome back.", "success");
      } else if (authMode === "register") {
        setToken(data.token);
        setUserEmail(data.email);
        setTotpUri(data.totp_uri);
      } else if (authMode === "forgot") {
        showToast(data.message || "Verification code sent.", "success");
        setAuthMode("reset");
      } else if (authMode === "reset") {
        showToast("Password updated. You can log in now.", "success");
        setAuthMode("login");
        setAuthForm((current) => ({ ...current, password: "", code: "", new_password: "" }));
      }
    } catch {
      showToast("Backend is not reachable.", "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const saveTransaction = async (bypass = false) => {
    if (!txForm.amount || Number(txForm.amount) <= 0) {
      showToast("Enter a valid positive amount.", "error");
      return;
    }

    setSaving(true);
    try {
      const isEditing = Boolean(editingId);
      const response = await authFetch(isEditing ? `/transactions/${editingId}` : "/transactions", {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          ...txForm,
          amount: Number(txForm.amount),
          bypass_overdraft: bypass,
        }),
      });
      const data = await response.json();

      if (response.status === 400 && data.status === "overdraft_warning") {
        setPendingOverdraft(data.message);
        return;
      }

      if (!response.ok) {
        showToast(data.message || "Could not save transaction.", "error");
        return;
      }

      showToast(isEditing ? "Transaction updated." : "Transaction added.", "success");
      resetTxForm();
      setSummary((current) => ({
        ...current,
        balance: data.balance,
        income_total: data.income_total,
        expense_total: data.expense_total,
        transaction_count: data.transaction_count,
        history: [...(data.history || [])].reverse(),
        insights: data.insights || [],
      }));
    } catch {
      showToast("Could not save transaction.", "error");
    } finally {
      setSaving(false);
    }
  };

  const editTransaction = (transaction) => {
    setEditingId(transaction.id);
    setPendingOverdraft(null);
    setTxForm({
      amount: String(transaction.amount || ""),
      type: transaction.type || "expense",
      category: transaction.category || "general",
      note: transaction.note || "",
    });
  };

  const removeTransaction = async (transactionId) => {
    if (!window.confirm("Delete this transaction?")) return;
    try {
      const response = await authFetch(`/transactions/${transactionId}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) {
        showToast(data.message || "Could not delete transaction.", "error");
        return;
      }
      showToast("Transaction deleted.", "success");
      setSummary((current) => ({
        ...current,
        balance: data.balance,
        income_total: data.income_total,
        expense_total: data.expense_total,
        transaction_count: data.transaction_count,
        history: [...(data.history || [])].reverse(),
        insights: data.insights || [],
      }));
    } catch {
      showToast("Could not delete transaction.", "error");
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUserEmail("");
    resetTxForm();
    setSummary({ balance: 0, income_total: 0, expense_total: 0, transaction_count: 0, history: [], insights: [] });
  };

  const filteredHistory = useMemo(() => {
    return summary.history.filter((item) => {
      // Check transaction type filter (all, income, expense)
      const matchesType = filter === "all" || item.type === filter;
      
      if (!item.timestamp) return matchesType;
      
      // Extract just the 'YYYY-MM-DD' part from your timestamp string ('2026-06-29 23:08')
      const itemDate = item.timestamp.split(" ")[0]; 
      
      // Check if it fits inside our calendar boundaries
      const matchesStart = !startDate || itemDate >= startDate;
      const matchesEnd = !endDate || itemDate <= endDate;
      
      return matchesType && matchesStart && matchesEnd;
    });
  }, [filter, summary.history, startDate, endDate]);

  const pieData = useMemo(() => {
    const expenseItems = filteredHistory.filter(item => item.type === "expense");
    const totals = {};
    
    expenseItems.forEach(item => {
      totals[item.category] = (totals[item.category] || 0) + item.amount;
    });
    
    return Object.entries(totals).map(([name, value]) => ({ name, value }));
  }, [filteredHistory]);

  if (!token) {
    return (
      <div 
        className="auth-shell" 
        style={{
          "--mouse-x": `${mousePos.x}px`,
          "--mouse-y": `${mousePos.y}px`
        }}
      >   
        <Toast toast={toast} onClose={() => setToast(null)} />
        <section className="auth-panel auth-panel-left">
          <div className="brand-badge">Finance Tracker</div>
          <h1>Track Income, Expenses, And Spending Insights In One Place</h1>
          <p>
            Smart budgeting, zero stress. Your money, mastered. Secured by time, tracked by you. Take control of your cash flow. 
          </p>
          <div className="auth-feature-grid">
            <div><strong>Time Travel</strong><span>Filter and track history by specific dates</span></div>
            <div><strong>Next-Gen Security</strong><span>TOTP multi-factor verification</span></div>
            <div><strong>Insights</strong><span>Category chart and summary cards</span></div>
          </div>
        </section>

        <section className="auth-panel auth-panel-right">
          <div className="card auth-card">
            <div className="auth-tabs">
              {[
                ["login", "Login"],
                ["register", "Register"],
                ["forgot", "Forgot password"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={authMode === key ? "active" : ""}
                  onClick={() => setAuthMode(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <h2>{authMode === "reset" ? "Reset password" : authMode === "forgot" ? "Request reset code" : authMode === "register" ? "Create account" : "Welcome back"}</h2>

            <div className="form-grid">
              <label>
                Email
                <input name="email" type="email" value={authForm.email} onChange={handleAuthChange} />
              </label>

              {(authMode === "login" || authMode === "register") && (
                <label>
                  Password
                  <input name="password" type="password" value={authForm.password} onChange={handleAuthChange} />
                </label>
              )}

              {authMode === "reset" && (
                <>
                  <label>
                    Verification code
                    <input name="code" value={authForm.code} onChange={handleAuthChange} />
                  </label>
                  <label>
                    New password
                    <input name="new_password" type="password" value={authForm.new_password} onChange={handleAuthChange} />
                  </label>
                </>
              )}
            </div>

            <button className="primary-btn" onClick={submitAuth} disabled={authLoading}>
              {authLoading ? "Please wait..." : authMode === "register" ? "Create account" : authMode === "forgot" ? "Send code" : authMode === "reset" ? "Reset password" : "Login"}
            </button>

            {(authMode === "forgot" || authMode === "reset") && (
              <button className="text-btn" onClick={() => setAuthMode(authMode === "forgot" ? "reset" : "login")}>
                {authMode === "forgot" ? "Already have a code? Reset password" : "Back to login"}
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  if (totpUri) {
    return (
      <div className="auth-shell" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="card auth-card" style={{ textAlign: 'center', padding: '32px', maxWidth: '420px', margin: 'auto' }}>
          <h2 style={{ fontSize: '22px', fontWeight: '600', color: '#f8fafc', marginBottom: '8px' }}>🔐 Secure Your Account</h2>
          <p style={{ margin: '12px 0 24px 0', color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
            Scan this QR code with Google Authenticator or Microsoft Authenticator to link your profile.
          </p>
          
          <div style={{ background: 'white', padding: '16px', borderRadius: '12px', display: 'inline-block', marginBottom: '24px' }}>
            <QRCodeSVG value={totpUri} size={200} />
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '28px', lineHeight: '1.5' }}>
            Once scanned, your mobile device will safely generate dynamic numbers for account recovery actions.
          </p>
          
          <button className="primary-btn" style={{ width: '100%' }} onClick={() => { setTotpUri(""); loadSummary(); }}>
            Enter Dashboard 🚀
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <header className="topbar">
        <div>
          <div className="brand-badge">Finance Tracker</div>
          <h1>Dashboard</h1>
          <p>{userEmail}</p>
        </div>
        <div className="topbar-actions">
          <select 
            value={currentCurrency} 
            onChange={(e) => setCurrentCurrency(e.target.value)}
            style={{ width: 'auto', margin: 0, padding: '0.5rem 1rem', borderRadius: '10px' }}
          >
            <option value="INR">NP NPR (₹)</option>
            <option value="USD">🇺🇸 USD ($)</option>
            <option value="EUR">🇪🇺 EUR (€)</option>
            <option value="GBP">🇬🇧 GBP (£)</option>
          </select>

          <button className="ghost-btn" onClick={loadSummary}>Refresh</button>
          <button className="ghost-btn danger" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="stats-grid">
          <StatCard label="Balance" value={fmt(summary.balance)} tone={summary.balance >= 0 ? "positive" : "negative"} />
          <StatCard label="Income" value={fmt(summary.income_total)} tone="positive" />
          <StatCard label="Expenses" value={fmt(summary.expense_total)} tone="negative" />
          <StatCard label="Transactions" value={summary.transaction_count} sub={`${summary.history.filter((item) => item.type === "income").length} income · ${summary.history.filter((item) => item.type === "expense").length} expense`} />
        </section>

        <section className="card form-card">
          <div className="section-head">
            <div>
              <span className="eyebrow">{editingId ? "Edit transaction" : "Add transaction"}</span>
              <h2>{editingId ? "Update your entry" : "Create a new entry"}</h2>
            </div>
            {editingId ? <button className="text-btn" onClick={resetTxForm}>Cancel edit</button> : null}
          </div>

          <div className="segmented-control">
            {["income", "expense"].map((type) => (
              <button
                key={type}
                className={txForm.type === type ? "active" : ""}
                onClick={() => setTxForm((current) => ({ ...current, type }))}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="form-grid two-col">
            <label>
              Amount
              <input name="amount" type="number" value={txForm.amount} onChange={handleTxChange} placeholder="0.00" />
            </label>
            <label>
              Category
              <select name="category" value={txForm.category} onChange={handleTxChange}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{CAT_ICONS[category]} {category}</option>
                ))}
              </select>
            </label>
            <label className="full-width">
              Note
              <input name="note" value={txForm.note} onChange={handleTxChange} placeholder="Optional note" />
            </label>
          </div>

          {pendingOverdraft ? (
            <div className="warning-box">
              <p>{pendingOverdraft}</p>
              <div className="inline-actions">
                <button className="primary-btn" onClick={() => saveTransaction(true)}>Proceed anyway</button>
                <button className="ghost-btn" onClick={() => setPendingOverdraft(null)}>Cancel</button>
              </div>
            </div>
          ) : null}

          <button className="primary-btn" onClick={() => saveTransaction(false)} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Update transaction" : "Add transaction"}
          </button>
        </section>

        <section className="card form-card" style={{ marginTop: '1rem' }}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Calculator Tool</span>
              <h2>Currency Converter</h2>
            </div>
          </div>

          <div className="form-grid" style={{ gap: '12px' }}>
            <label>
              Amount to Convert
              <input 
                type="number" 
                placeholder="0.00"
                value={convertForm.amount}
                onChange={(e) => setConvertForm(prev => ({ ...prev, amount: e.target.value }))}
                onKeyUp={calculateConversion}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
              <label>
                From
                <select value={convertForm.from} onChange={(e) => setConvertForm(prev => ({ ...prev, from: e.target.value }))} change={setTimeout(calculateConversion, 10)}>
                  <option value="USD">🇺🇸 USD</option>
                  <option value="INR">🇮🇳 INR</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="GBP">🇬🇧 GBP</option>
                </select>
              </label>
              <label>
                To
                <select value={convertForm.to} onChange={(e) => setConvertForm(prev => ({ ...prev, to: e.target.value }))} change={setTimeout(calculateConversion, 10)}>
                  <option value="INR">🇮🇳 INR</option>
                  <option value="USD">🇺🇸 USD</option>
                  <option value="EUR">🇪🇺 EUR</option>
                  <option value="GBP">🇬🇧 GBP</option>
                </select>
              </label>
            </div>

            {convertedResult && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(109, 124, 255, 0.12)', borderRadius: '14px', border: '1px solid rgba(109, 124, 255, 0.25)', textAlign: 'center' }}>
                <span style={{ fontSize: '12px', color: '#9ca9c9', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Converted Estimation</span>
                <strong style={{ fontSize: '22px', color: '#34d399', marginTop: '4px', display: 'block' }}>{convertedResult}</strong>
              </div>
            )}
          </div>
        </section>

        <section className="card insights-card">
          <div className="section-head">
            <div>
              <span className="eyebrow">Insights</span>
              <h2>Expense breakdown</h2>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : pieData.length === 0 ? (
            <EmptyState icon="📊" title="No expense data yet" subtitle="Add some expenses to unlock spending insights." />
          ) : (
            <>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={92} paddingAngle={4}>
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={CAT_COLORS[entry.name] || "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => fmt(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend-list">
                {pieData.map((entry) => (
                  <div key={entry.name} className="legend-item">
                    <span className="legend-left">
                      <span className="legend-dot" style={{ background: CAT_COLORS[entry.name] || "#94a3b8" }} />
                      <span>{CAT_ICONS[entry.name] || "📦"} {entry.name}</span>
                    </span>
                    <strong>{fmt(entry.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="card table-card">
          <div className="section-head column-on-mobile">
            <div>
              <span className="eyebrow">History</span>
              <h2>Transactions</h2>
            </div>
            
            {/* 📅 4. Insert the Calendar Inputs Here */}
            <div className="date-filter-group">
              <label>
                From: <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label>
                To: <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
              { (startDate || endDate) && (
                <button className="text-btn danger" onClick={() => { setStartDate(""); setEndDate(""); }}>Clear</button>
              )}
            </div>

            <select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}>
              <option value="all">All Types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </div>

          {loading ? (
            <div className="loading-state">Loading...</div>
          ) : filteredHistory.length === 0 ? (
            <EmptyState icon="🧾" title="No transactions found" subtitle="Try changing the filter or add a new transaction." />
          ) : (
            <div className="transaction-list">
              {filteredHistory.map((transaction) => (
                <article key={transaction.id} className="transaction-row">
                  <div className="transaction-icon">{CAT_ICONS[transaction.category] || "📦"}</div>
                  <div className="transaction-main">
                    <strong>{transaction.category}</strong>
                    <span>
                      {transaction.type} · {transaction.timestamp}
                      {transaction.note ? ` · ${transaction.note}` : ""}
                    </span>
                  </div>
                  <div className={`transaction-amount ${transaction.type === "income" ? "positive" : "negative"}`}>
                    {transaction.type === "income" ? "+" : "-"}{fmt(transaction.amount)}
                  </div>
                  <div className="row-actions">
                    <button className="ghost-btn" onClick={() => editTransaction(transaction)}>Edit</button>
                    <button className="ghost-btn danger" onClick={() => removeTransaction(transaction.id)}>Delete</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
