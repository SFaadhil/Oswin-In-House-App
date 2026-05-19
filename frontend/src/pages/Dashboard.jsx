import { useState, useEffect } from "react";
import { TrendingUp, CreditCard, AlertCircle, RefreshCw, ArrowUpRight, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api, { formatCurrency, getDueStatus } from "../utils/api";
import { toast } from "sonner";

const URGENCY_CLASSES = { success: "text-green-600 dark:text-green-400", warning: "text-yellow-600 dark:text-yellow-400", urgent: "text-orange-600 dark:text-orange-400", danger: "text-red-600 dark:text-red-400", muted: "text-muted-foreground" };
const URGENCY_CARD = { success: "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800", warning: "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800", urgent: "bg-orange-50 border-orange-200 dark:bg-orange-900/10 dark:border-orange-800", danger: "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800", muted: "bg-card border-border" };
const CHART_COLORS = ["#009d44", "#e31e24", "#ffed00", "#8B5CF6", "#06B6D4", "#F97316", "#EC4899", "#14B8A6"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      {label && <p className="text-muted-foreground mb-1 text-xs">{label}</p>}
      {payload.map((p, i) => <p key={i} className="text-foreground font-medium">{p.name}: {formatCurrency(p.value)}</p>)}
    </div>
  );
};

function MetricCard({ title, value, icon: Icon, color, subtitle, testId }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 hover:shadow-md transition-shadow" data-testid={testId}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}><Icon size={17} /></div>
      </div>
      <p className="text-2xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{value}</p>
      {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get("/reports/dashboard");
      setStats(res.data);
    } catch { toast.error("Failed to load dashboard data"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!stats) return null;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Dashboard</h1>
          <p className="text-sm text-muted-foreground">Overview of your subscription spending</p>
        </div>
        <button onClick={fetchStats} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="refresh-dashboard">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Monthly Cost" value={formatCurrency(stats.total_monthly)} icon={TrendingUp} color="bg-primary/10 text-primary" subtitle="Recurring monthly" testId="metric-monthly-cost" />
        <MetricCard title="Annual Cost" value={formatCurrency(stats.total_annual)} icon={ArrowUpRight} color="bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" subtitle="Projected yearly" testId="metric-annual-cost" />
        <MetricCard title="Active Subs" value={stats.active_count} icon={CreditCard} color="bg-purple-100 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400" subtitle="Currently active" testId="metric-active-count" />
        <MetricCard title="Due Soon" value={stats.upcoming_count} icon={AlertCircle} color={stats.upcoming_count > 0 ? "bg-red-100 text-[#e31e24] dark:bg-red-900/20" : "bg-muted text-muted-foreground"} subtitle="Within 7 days" testId="metric-upcoming-count" />
      </div>

      {stats.one_time_total > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/10 dark:border-yellow-800 rounded-xl p-4 flex items-center gap-3">
          <DollarSign size={18} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground">One-Time Costs: {formatCurrency(stats.one_time_total)}</p>
            <p className="text-xs text-muted-foreground">These are not included in monthly/annual totals</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5" data-testid="category-pie-chart">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Spending by Category</p>
          {stats.category_breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.category_breakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                  {stats.category_breakdown.map((entry, i) => <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5" data-testid="monthly-trend-chart">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Monthly Spending Trend (Historical)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.monthly_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total" name="Total" fill="#009d44" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5" data-testid="upcoming-renewals-list">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Due in 7 Days</p>
          {stats.upcoming_renewals.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No upcoming renewals</p>
          ) : (
            <div className="space-y-2">
              {stats.upcoming_renewals.slice(0, 5).map(sub => {
                const due = getDueStatus(sub.next_due_date);
                return (
                  <div key={sub._id} className={`flex items-center justify-between p-3 rounded-lg border ${URGENCY_CARD[due.variant]}`}>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{sub.subscription_name}</p>
                      <p className="text-xs text-muted-foreground">{sub.billing_cycle}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(sub.cost, sub.currency)}</p>
                      <p className={`text-xs font-bold ${URGENCY_CLASSES[due.variant]}`}>{due.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5" data-testid="recent-subscriptions-list">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Recently Added</p>
          {stats.recent_subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No subscriptions yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recent_subscriptions.map(sub => (
                <div key={sub._id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{sub.subscription_name}</p>
                    <p className="text-xs text-muted-foreground">{sub.billing_cycle} · {sub.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatCurrency(sub.cost, sub.currency)}</p>
                    <p className="text-xs text-muted-foreground">{sub.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
