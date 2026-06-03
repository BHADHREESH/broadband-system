import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, CreditCard, FileText, Headphones, LayoutDashboard, LogOut, Router, UserPlus, Users } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { apiRequest, downloadUrl } from "./lib/api.js";
import { clearSession, readUser, roleHome, saveSession } from "./lib/auth.js";
import { date, dateTime, money } from "./lib/format.js";

const nav = {
  admin: [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["customers", Users, "Customers"],
    ["plans", Router, "Plans"],
    ["billing", FileText, "Billing"],
    ["payments", CreditCard, "Payments"],
    ["support", Headphones, "Support"],
    ["notifications", Activity, "Notifications"],
    ["team", UserPlus, "Team Users"]
  ],
  staff: [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["tickets", Headphones, "Tickets"],
    ["customers", Users, "Customers"],
    ["payments", CreditCard, "Payments"],
    ["connections", Router, "Connections"]
  ],
  customer: [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["billing", FileText, "Bills"],
    ["support", Headphones, "Support"],
    ["ai", Bot, "AI Help"]
  ]
};

function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    fn()
      .then((data) => active && setState({ loading: false, error: "", data }))
      .catch((err) => active && setState({ loading: false, error: err.message, data: null }));
    return () => {
      active = false;
    };
  }, deps);
  return state;
}

function Stat({ label, value, sub }) {
  return (
    <div className="card">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <strong className="mt-2 block text-3xl text-navy">{value}</strong>
      {sub && <span className="mt-1 block text-sm text-slate-500">{sub}</span>}
    </div>
  );
}

function Status({ value }) {
  const raw = String(value || "").toLowerCase();
  const paid = raw === "paid" || raw === "active" || raw === "sent";
  const label = raw === "not_sent" || raw === "failed" || raw === "skipped" || raw === "partial" ? "not sent" : value;
  return <span className={`badge ${paid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{label || "--"}</span>;
}

function phoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

function displayPhone(value) {
  const digits = phoneDigits(value);
  return digits ? `+91 ${digits}` : "--";
}

function channelLabel(channel) {
  const labels = { app: "App", email: "Email", sms: "SMS", whatsapp: "WhatsApp" };
  return labels[channel] || channel;
}

function channelSet(value) {
  return new Set(String(value || "")
    .split(",")
    .map((channel) => channel.trim().toLowerCase())
    .filter(Boolean));
}

function readableList(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function notificationChannels(row) {
  const channels = channelSet(row.channels);
  const ordered = ["app", "whatsapp", "sms", "email"].filter((channel) => channels.has(channel));
  return ordered.length ? ordered.map(channelLabel).join(", ") : "--";
}

function notificationDeliveryDetails(row) {
  const sent = channelSet(row.sent_channels);
  const failed = channelSet(row.failed_channels);
  const skipped = channelSet(row.skipped_channels);
  const delivered = ["app", "whatsapp", "sms", "email"].filter((channel) => sent.has(channel)).map(channelLabel);
  const attention = ["app", "whatsapp", "sms", "email"].filter((channel) => failed.has(channel) || skipped.has(channel)).map(channelLabel);

  return ["app", "whatsapp", "sms", "email"]
    .some((channel) => sent.has(channel) || failed.has(channel) || skipped.has(channel))
    ? (
      <div className="min-w-[220px] space-y-1">
        {delivered.length > 0 && <p><strong className="text-navy">Delivered:</strong> {readableList(delivered)}</p>}
        {delivered.length === 0 && <p className="font-bold text-rose-700">No delivery channel completed.</p>}
        {attention.length > 0 && <p className="font-bold text-rose-700">Needs attention: {readableList(attention)}</p>}
      </div>
    )
    : "--";
}

function notificationStatus(row) {
  const sent = channelSet(row.sent_channels);
  return ["app", "whatsapp", "sms", "email"].every((channel) => sent.has(channel)) ? "sent" : "not_sent";
}

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("customer");
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", plan_id: "1", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        await apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(form) });
        setMode("login");
      } else {
        const result = await apiRequest("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: form.email, email: form.email, password: form.password, role })
        });
        saveSession(result);
        onLogin(result.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="card w-full max-w-md space-y-4">
        <div>
          <p className="text-sm font-bold uppercase text-brand">NetWave Broadband</p>
          <h1 className="text-3xl font-black text-navy">{mode === "login" ? "Secure login" : "Create customer account"}</h1>
        </div>
        {mode === "login" && (
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        )}
        {mode === "register" && (
          <>
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
              <span className="bg-slate-100 px-3 py-2 font-bold text-navy">+91</span>
              <input className="min-w-0 flex-1 border-0" placeholder="9876543210" inputMode="numeric" maxLength={10} value={form.phone} onChange={(e) => setForm({ ...form, phone: phoneDigits(e.target.value) })} />
            </div>
            <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input placeholder="Plan ID" value={form.plan_id} onChange={(e) => setForm({ ...form, plan_id: e.target.value })} />
          </>
        )}
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
        <button className="btn w-full" disabled={loading}>{loading ? "Please wait" : mode === "login" ? "Login" : "Register"}</button>
        <button type="button" className="btn-secondary w-full" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Register customer" : "Back to login"}
        </button>
      </form>
    </main>
  );
}

function Shell({ user, onLogout }) {
  const [page, setPage] = useState(roleHome(user.role));
  const items = nav[user.role] || nav.customer;
  useEffect(() => setPage(items[0][0]), [user.role]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-navy text-white shadow-soft">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="text-xl font-black">NetWave</h1>
            <p className="text-xs text-blue-100">{user.name} - {user.role}</p>
          </div>
          <nav className="flex flex-wrap gap-2">
            {items.map(([key, Icon, label]) => (
              <button key={key} onClick={() => setPage(key)} className={`rounded-lg px-3 py-2 text-sm font-bold ${page === key ? "bg-white text-navy" : "text-blue-100 hover:bg-white/10"}`}>
                <Icon className="mr-1 inline h-4 w-4" />{label}
              </button>
            ))}
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-bold text-navy" onClick={onLogout}><LogOut className="mr-1 inline h-4 w-4" />Logout</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        {user.role === "admin" && <Admin page={page} />}
        {user.role === "staff" && <Staff page={page} />}
        {user.role === "customer" && <Customer page={page} />}
      </main>
    </div>
  );
}

function Admin({ page }) {
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");
  const [billCustomerId, setBillCustomerId] = useState("");
  const customers = useLoad(() => apiRequest("/api/customers"), [refresh]);
  const plans = useLoad(() => apiRequest("/api/plans"), [refresh]);
  const bills = useLoad(() => apiRequest("/api/bills"), [refresh]);
  const payments = useLoad(() => apiRequest("/api/payments"), [refresh]);
  const tickets = useLoad(() => apiRequest("/api/support"), [refresh]);
  const notifications = useLoad(() => apiRequest("/api/payments/notifications"), [refresh]);
  const team = useLoad(() => apiRequest("/api/staff"), [refresh]);
  const list = (s) => Array.isArray(s.data) ? s.data : [];
  const paid = list(bills).filter((b) => b.status === "paid");
  const unpaid = list(bills).filter((b) => b.status !== "paid");
  const revenue = paid.reduce((sum, b) => sum + Number(b.amount || 0), 0);
  const chartData = [
    { name: "Paid", value: paid.length },
    { name: "Pending", value: unpaid.length }
  ];

  const addBill = async () => {
    const customer_id = billCustomerId.trim();
    if (!customer_id) return;
    await apiRequest("/api/bills/generate", { method: "POST", body: JSON.stringify({ customer_id }) });
    setBillCustomerId("");
    setNotice("Bill generated");
    setRefresh((x) => x + 1);
  };

  const sendReminders = async () => {
    const result = await apiRequest("/api/bills/reminders/send", { method: "POST" });
    setNotice(`${result.count || 0} reminders processed`);
    setRefresh((x) => x + 1);
  };

  if (page === "dashboard") return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Customers" value={list(customers).length} sub={`${list(customers).filter((c) => c.status === "active").length} active`} />
        <Stat label="Revenue" value={money(revenue)} sub={`${paid.length} paid bills`} />
        <Stat label="Pending Bills" value={unpaid.length} sub={money(unpaid.reduce((s, b) => s + Number(b.amount || 0), 0))} />
        <Stat label="Open Tickets" value={list(tickets).filter((t) => t.status !== "resolved").length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card h-80"><ResponsiveContainer><PieChart><Pie data={chartData} dataKey="value" nameKey="name">{chartData.map((_, i) => <Cell key={i} fill={i ? "#ef4444" : "#10b981"} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
        <div className="card h-80"><ResponsiveContainer><BarChart data={paid.map((b) => ({ name: b.customer_name, amount: Number(b.amount || 0) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="amount" fill="#0b5ed7" /></BarChart></ResponsiveContainer></div>
      </div>
    </section>
  );
  if (page === "customers") return <DataTable title="Customers" rows={list(customers)} columns={["id", "name", "email", "phone", "status"]} />;
  if (page === "plans") return <DataTable title="Plans" rows={list(plans)} columns={["id", "name", "speed", "price", "validity"]} />;
  if (page === "billing") return <DataTable title="Billing" rows={list(bills)} columns={["id", "customer_name", "amount", "status", "bill_date", "due_date"]} actions={<><input className="max-w-[180px]" placeholder="Customer ID" value={billCustomerId} onChange={(e) => setBillCustomerId(e.target.value)} /><button className="btn" onClick={addBill}>Generate Bill</button><button className="btn-secondary" onClick={sendReminders}>Send Reminders</button>{notice && <span className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{notice}</span>}</>} />;
  if (page === "payments") return <DataTable title="Payments" rows={list(payments)} columns={["id", "customer_name", "amount", "method", "receipt_number", "paid_at"]} />;
  if (page === "support") return <DataTable title="Support" rows={list(tickets)} columns={["id", "name", "email", "issue", "status"]} />;
  if (page === "notifications") return <DataTable title="Notifications" rows={list(notifications)} columns={["id", "customer_name", "channels", "notification_type", "status", "delivery_details", "created_at"]} />;
  return <TeamPanel rows={list(team)} onDone={() => setRefresh((x) => x + 1)} />;
}

function TeamPanel({ rows, onDone }) {
  const [form, setForm] = useState({ name: "", email: "", role: "staff", password: "" });
  const [notice, setNotice] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    await apiRequest("/api/staff", { method: "POST", body: JSON.stringify(form) });
    setNotice(`${form.role === "admin" ? "Admin" : "Staff"} account added`);
    setForm({ name: "", email: "", role: "staff", password: "" });
    onDone();
  };

  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="card grid gap-3 md:grid-cols-5">
        <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <input placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button className="btn">Add Team User</button>
        {notice && <p className="md:col-span-5 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{notice}</p>}
      </form>
      <DataTable title="Team Users" rows={rows} columns={["id", "name", "email", "role"]} compact />
    </section>
  );
}

function Staff({ page }) {
  const [refresh, setRefresh] = useState(0);
  const customers = useLoad(() => apiRequest("/api/customers"), [refresh]);
  const bills = useLoad(() => apiRequest("/api/bills"), [refresh]);
  const tickets = useLoad(() => apiRequest("/api/support"), [refresh]);
  const payments = useLoad(() => apiRequest("/api/payments"), [refresh]);
  const rows = (s) => Array.isArray(s.data) ? s.data : [];
  const markPaid = async (id) => {
    await apiRequest(`/api/bills/pay/${id}`, { method: "PUT" });
    setRefresh((x) => x + 1);
  };
  if (page === "dashboard") return <div className="grid gap-4 md:grid-cols-3"><Stat label="Tickets" value={rows(tickets).length} /><Stat label="Customers" value={rows(customers).length} /><Stat label="Pending Bills" value={rows(bills).filter((b) => b.status !== "paid").length} /></div>;
  if (page === "tickets") return <DataTable title="Tickets" rows={rows(tickets)} columns={["id", "issue", "status", "email"]} />;
  if (page === "customers") return <DataTable title="Customers" rows={rows(customers)} columns={["id", "name", "email", "phone", "status"]} />;
  if (page === "payments") return <DataTable title="Payments" rows={rows(payments)} columns={["customer_name", "amount", "method", "receipt_number", "paid_at"]} />;
  return <DataTable title="Connections" rows={rows(bills)} columns={["id", "customer_name", "amount", "status", "due_date"]} rowAction={(row) => row.status !== "paid" && <button className="btn" onClick={() => markPaid(row.id)}>Mark Paid</button>} />;
}

function Customer({ page }) {
  const [refresh, setRefresh] = useState(0);
  const [notice, setNotice] = useState("");
  const profile = useLoad(() => apiRequest("/api/customers/me"), [refresh]);
  const usage = useLoad(() => apiRequest("/api/usage/me"), [refresh]);
  const bills = useLoad(() => apiRequest("/api/bills"), [refresh]);
  const payments = useLoad(() => apiRequest("/api/payments"), [refresh]);
  const tickets = useLoad(() => apiRequest("/api/support"), [refresh]);
  const rows = (s) => Array.isArray(s.data) ? s.data : [];
  const dueBill = rows(bills).find((b) => b.status !== "paid");

  const payNow = async (bill) => {
    const order = await apiRequest("/api/payment/create-order", { method: "POST", body: JSON.stringify({ amount: bill.amount }) });
    if (!window.Razorpay) {
      setNotice("Razorpay checkout did not load");
      return;
    }
    new window.Razorpay({
      key: order.key_id,
      amount: order.amount,
      currency: "INR",
      name: "NetWave",
      description: "Broadband Bill",
      order_id: order.id,
      handler: async (response) => {
        await apiRequest("/api/payment/verify", { method: "POST", body: JSON.stringify({ ...response, bill_id: bill.id }) });
        setNotice("Payment successful");
        setRefresh((x) => x + 1);
      }
    }).open();
  };

  if (page === "dashboard") return (
    <section className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Plan" value={profile.data?.plan_name || "--"} sub={profile.data?.speed} />
        <Stat label="Status" value={profile.data?.status || "--"} />
        <Stat label="Current Bill" value={dueBill ? money(dueBill.amount) : "Clear"} />
        <Stat label="Due Date" value={dueBill ? date(dueBill.due_date) : "--"} />
      </div>
      <div className="card h-80"><ResponsiveContainer><LineChart data={rows(usage).map((u) => ({ day: date(u.usage_date), used: Number(u.used_gb || 0) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Line dataKey="used" stroke="#0b5ed7" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
    </section>
  );
  if (page === "billing") return <DataTable title="Bills" rows={rows(bills)} columns={["id", "amount", "status", "bill_date", "due_date"]} actions={notice && <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">{notice}</span>} rowAction={(row) => <div className="flex flex-wrap gap-2">{row.status !== "paid" && <button className="btn" onClick={() => payNow(row)}>Pay</button>}<a className="btn-secondary" href={downloadUrl(`/api/bills/download/${row.id}`)} target="_blank" rel="noreferrer">PDF</a></div>} extra={<DataTable title="Payment History" rows={rows(payments)} columns={["amount", "method", "receipt_number", "paid_at"]} compact />} />;
  if (page === "support") return <SupportPanel tickets={rows(tickets)} onDone={() => setRefresh((x) => x + 1)} />;
  return <AiPanel />;
}

function formatCell(row, column) {
  if (column === "status") return <Status value={row.sent_channels !== undefined ? notificationStatus(row) : row[column]} />;
  if (column === "phone") return displayPhone(row[column]);
  if (column === "channels" && row.sent_channels !== undefined) return notificationChannels(row);
  if (column === "delivery_details") return notificationDeliveryDetails(row);
  if (column.includes("date") || column.includes("_at")) return dateTime(row[column]);
  if (column === "amount" || column === "price") return money(row[column]);
  return row[column] ?? "--";
}

function DataTable({ title, rows, columns, actions, rowAction, extra, compact }) {
  return (
    <section className={compact ? "mt-6" : "space-y-4"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black text-navy">{title}</h2>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="min-w-[720px]">
          <thead><tr>{columns.map((c) => <th key={c}>{c.replaceAll("_", " ")}</th>)}{rowAction && <th>Action</th>}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length + (rowAction ? 1 : 0)} className="text-center text-slate-500">No records found</td></tr>}
            {rows.map((row, idx) => (
              <tr key={row.id || idx}>
                {columns.map((c) => <td key={c}>{formatCell(row, c)}</td>)}
                {rowAction && <td>{rowAction(row)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {extra}
    </section>
  );
}

function SupportPanel({ tickets, onDone }) {
  const [issue, setIssue] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    await apiRequest("/api/support", { method: "POST", body: JSON.stringify({ issue }) });
    setIssue("");
    onDone();
  };
  return (
    <section className="space-y-4">
      <form onSubmit={submit} className="card flex flex-col gap-3 md:flex-row">
        <input value={issue} onChange={(e) => setIssue(e.target.value)} placeholder="Describe your issue" required />
        <button className="btn">Raise Ticket</button>
      </form>
      <DataTable title="Tickets" rows={tickets} columns={["id", "issue", "status", "created_at"]} compact />
    </section>
  );
}

function AiPanel() {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("Ask about plans, bills, payments, service status, or support.");
  const ask = async (event) => {
    event.preventDefault();
    const result = await apiRequest("/api/ai/ask", { method: "POST", body: JSON.stringify({ message }) });
    setReply(result.reply || result.message || "I could not answer that right now.");
  };
  return (
    <section className="card space-y-4">
      <h2 className="text-2xl font-black text-navy">AI Help</h2>
      <form onSubmit={ask} className="flex flex-col gap-3 md:flex-row">
        <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask a question" required />
        <button className="btn">Ask</button>
      </form>
      <p className="rounded-xl bg-slate-50 p-4 text-slate-700">{reply}</p>
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState(() => readUser());
  const logout = () => {
    clearSession();
    setUser(null);
  };
  const memoUser = useMemo(() => user, [user]);
  if (!memoUser) return <AuthScreen onLogin={setUser} />;
  return <Shell user={memoUser} onLogout={logout} />;
}
