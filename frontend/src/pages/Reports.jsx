import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download, FileText } from "lucide-react";
import api, { formatCurrency, formatApiError } from "../utils/api";
import { toast } from "sonner";

const TABS = ["Category", "By Person", "By Adder", "All Subscriptions", "One-Time Payments"];
const COLORS = ["#009d44", "#e31e24", "#ffed00", "#8B5CF6", "#06B6D4", "#F97316", "#EC4899", "#14B8A6"];

const TT = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      {label && <p className="text-muted-foreground mb-1 text-xs">{label}</p>}
      {payload.map((p, i) => <p key={i} className="text-foreground font-medium">{p.name}: {formatCurrency(p.value)}</p>)}
    </div>
  );
};

const SummaryTable = ({ data, title, cols }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm" data-testid={`${title.toLowerCase().replace(/\s+/g, '-')}-table`}>
      <thead><tr className="bg-muted/50 border-b border-border">
        {cols.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}
      </tr></thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-b border-border hover:bg-muted/30">
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <span className="text-foreground font-medium">{row.name}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-center text-muted-foreground">{row.count}</td>
            <td className="px-4 py-3 text-right text-foreground font-medium">{formatCurrency(row.monthly)}</td>
            <td className="px-4 py-3 text-right text-foreground font-medium">{formatCurrency(row.annual)}</td>
            {row.one_time !== undefined && <td className="px-4 py-3 text-right text-foreground font-medium">{formatCurrency(row.one_time)}</td>}
          </tr>
        ))}
        <tr className="bg-muted/30 font-semibold">
          <td className="px-4 py-3 text-foreground">Total</td>
          <td className="px-4 py-3 text-center text-muted-foreground">{data.reduce((a, r) => a + r.count, 0)}</td>
          <td className="px-4 py-3 text-right text-primary">{formatCurrency(data.reduce((a, r) => a + r.monthly, 0))}</td>
          <td className="px-4 py-3 text-right text-primary">{formatCurrency(data.reduce((a, r) => a + r.annual, 0))}</td>
          {data[0]?.one_time !== undefined && <td className="px-4 py-3 text-right text-primary">{formatCurrency(data.reduce((a, r) => a + (r.one_time || 0), 0))}</td>}
        </tr>
      </tbody>
    </table>
  </div>
);

export default function Reports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    api.get("/reports/spending")
      .then(res => setData(res.data))
      .catch(() => toast.error("Failed to load reports"))
      .finally(() => setLoading(false));
  }, []);

  const exportCSV = () => {
    if (!data?.subscriptions?.length) return;
    const headers = ["Name", "Category", "Responsible Person", "Added By", "Cost", "Monthly Cost", "Annual Cost", "Billing Cycle", "Status", "Due Date"];
    const rows = data.subscriptions.map(s => [s.name, s.category, s.responsible_person, s.owner, s.cost, s.monthly_cost, s.annual_cost, s.billing_cycle, s.status, s.next_due_date]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "subtrack-report.csv"; a.click();
    toast.success("CSV exported");
  };

  const exportPDF = async () => {
    if (!data?.subscriptions?.length) return;
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();
      doc.setFontSize(16); doc.text("SubTrack Pro - Spending Report", 14, 15);
      doc.setFontSize(9); doc.text(`Monthly: ${formatCurrency(data.total_monthly)} | Annual: ${formatCurrency(data.total_annual)} | One-Time: ${formatCurrency(data.total_one_time || 0)}`, 14, 23);
      autoTable(doc, {
        head: [["Name", "Category", "Person", "Monthly", "Annual", "Status"]],
        body: data.subscriptions.map(s => [s.name, s.category, s.responsible_person, formatCurrency(s.monthly_cost), formatCurrency(s.annual_cost), s.status]),
        startY: 28, styles: { fontSize: 8 }, headStyles: { fillColor: [0, 157, 68] },
      });
      doc.save("subtrack-report.pdf");
      toast.success("PDF exported");
    } catch { toast.error("Failed to export PDF"); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!data) return null;

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Reports</h1>
          <p className="text-sm text-muted-foreground">Spending analysis</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border text-muted-foreground hover:bg-muted rounded-lg" data-testid="export-csv-button"><Download size={14} /> CSV</button>
          <button onClick={exportPDF} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border text-muted-foreground hover:bg-muted rounded-lg" data-testid="export-pdf-button"><FileText size={14} /> PDF</button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["Total Monthly", formatCurrency(data.total_monthly)], ["Total Annual", formatCurrency(data.total_annual)], ["One-Time Costs", formatCurrency(data.total_one_time || 0)], ["Subscriptions", data.subscriptions.length]].map(([l, v]) => (
          <div key={l} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{l}</p>
            <p className="text-xl font-bold text-foreground" style={{ fontFamily: "Chivo" }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Category Spending (Monthly)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.category_breakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={110} axisLine={false} tickLine={false} />
              <Tooltip content={<TT />} />
              <Bar dataKey="monthly" name="Monthly" radius={[0, 3, 3, 0]}>
                {data.category_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Person-wise Spending</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data.person_breakdown} dataKey="monthly" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                {data.person_breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<TT />} />
              <Legend formatter={v => <span className="text-xs text-muted-foreground">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Tabs */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === i ? "text-primary border-b-2 border-primary -mb-px" : "text-muted-foreground hover:text-foreground"}`}
              data-testid={`report-tab-${i}`}>{tab}</button>
          ))}
        </div>

        {activeTab === 0 && (
          <SummaryTable data={data.category_breakdown} title="Category" cols={["Category", "Count", "Monthly", "Annual"]} />
        )}
        {activeTab === 1 && (
          <SummaryTable data={data.person_breakdown} title="Person" cols={["Person", "Count", "Monthly", "Annual", "One-Time"]} />
        )}
        {activeTab === 2 && (
          <SummaryTable data={data.user_breakdown} title="User" cols={["Added By", "Count", "Monthly", "Annual"]} />
        )}
        {activeTab === 3 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="all-subscriptions-table">
              <thead><tr className="bg-muted/50 border-b border-border">
                {["Name", "Person", "Category", "Added By", "Monthly", "Annual", "Billing", "Status"].map(h =>
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}
              </tr></thead>
              <tbody>
                {data.subscriptions.map(sub => (
                  <tr key={sub.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-foreground font-medium">{sub.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sub.responsible_person}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sub.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sub.owner}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(sub.monthly_cost)}</td>
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(sub.annual_cost)}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{sub.billing_cycle}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-md font-medium ${sub.status === "Active" ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20" : "text-muted-foreground bg-muted"}`}>{sub.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 4 && (
          <div data-testid="one-time-payments-section">
            {(!data.one_time_payments || data.one_time_payments.length === 0) ? (
              <div className="text-center py-14 text-muted-foreground">
                <p className="text-sm">No one-time payments recorded</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border-b border-border">
                  <div className="bg-background border border-border rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total One-Time Spend</p>
                    <p className="text-2xl font-bold text-foreground mt-1" style={{ fontFamily: "Chivo" }}>{formatCurrency(data.total_one_time || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{data.one_time_count || data.one_time_payments.length} payment{data.one_time_payments.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="bg-background border border-border rounded-xl p-4" data-testid="one-time-by-category">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">By Category</p>
                    <div className="space-y-1">
                      {(data.one_time_by_category || []).slice(0, 4).map(r => (
                        <div key={r.name} className="flex items-center justify-between text-xs">
                          <span className="text-foreground truncate">{r.name}</span>
                          <span className="text-primary font-semibold">{formatCurrency(r.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-background border border-border rounded-xl p-4" data-testid="one-time-by-person">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">By End-Responsible</p>
                    <div className="space-y-1">
                      {(data.one_time_by_person || []).slice(0, 4).map(r => (
                        <div key={r.name} className="flex items-center justify-between text-xs">
                          <span className="text-foreground truncate">{r.name}</span>
                          <span className="text-primary font-semibold">{formatCurrency(r.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="one-time-payments-table">
                    <thead><tr className="bg-muted/50 border-b border-border">
                      {["Payment", "Category", "Person", "Owner", "Amount", "Date"].map(h =>
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {data.one_time_payments.map(p => (
                        <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-3 text-foreground font-medium">{p.name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.category}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.responsible_person}</td>
                          <td className="px-4 py-3 text-muted-foreground">{p.owner}</td>
                          <td className="px-4 py-3 text-foreground font-semibold">{formatCurrency(p.cost)}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{(p.date || "").toString().slice(0, 10) || "—"}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/40 border-t-2 border-border">
                        <td className="px-4 py-3 font-bold text-foreground" colSpan={4}>Total</td>
                        <td className="px-4 py-3 font-bold text-primary">{formatCurrency(data.total_one_time || 0)}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
