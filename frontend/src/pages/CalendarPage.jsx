import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalIcon } from "lucide-react";
import api from "../utils/api";
import { toast } from "sonner";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const VIEWS = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "employee", label: "Employee" },
];

function pad(n) { return String(n).padStart(2, "0"); }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function inRange(dayStr, start, end) { return dayStr >= start && dayStr <= end; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

// Month grid
function MonthView({ cursor, leaves, onDayClick }) {
  const today = new Date();
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - monthStart.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  return (
    <div data-testid="month-view">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {DAYS.map(d => <div key={d} className="px-2 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = fmt(d) === fmt(today);
          const dayLeaves = leaves.filter(l => inRange(fmt(d), l.start_date, l.end_date));
          return (
            <button key={i} onClick={() => onDayClick(d, dayLeaves)}
              className={`min-h-[88px] border-r border-b border-border p-1.5 text-left transition-colors hover:bg-muted/50 ${!inMonth ? "bg-muted/20" : ""}`}
              data-testid={`cal-day-${fmt(d)}`}>
              <span className={`text-xs font-semibold ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : !inMonth ? "text-muted-foreground/50" : "text-foreground"}`}>
                {d.getDate()}
              </span>
              <div className="space-y-0.5 mt-1">
                {dayLeaves.slice(0, 3).map(l => (
                  <div key={l._id + fmt(d)} className="text-xs px-1.5 py-0.5 rounded font-medium truncate" style={{ background: (l.leave_type?.color || "#009d44") + "30", color: l.leave_type?.color || "#009d44" }}>
                    {l.user?.name?.split(" ")[0]}
                  </div>
                ))}
                {dayLeaves.length > 3 && <p className="text-xs text-muted-foreground">+{dayLeaves.length - 3}</p>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Week view: 7 columns for the week
function WeekView({ cursor, leaves, onDayClick }) {
  const today = new Date();
  const weekStart = new Date(cursor);
  weekStart.setDate(cursor.getDate() - cursor.getDay());
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  return (
    <div className="grid grid-cols-7 border-b border-border" data-testid="week-view">
      {days.map(d => {
        const isToday = fmt(d) === fmt(today);
        const dayLeaves = leaves.filter(l => inRange(fmt(d), l.start_date, l.end_date));
        return (
          <button key={fmt(d)} onClick={() => onDayClick(d, dayLeaves)}
            className="min-h-[320px] border-r border-border p-2 text-left hover:bg-muted/40 transition-colors"
            data-testid={`week-day-${fmt(d)}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{DAYS[d.getDay()]}</p>
              <span className={`text-sm font-semibold ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-foreground"}`}>{d.getDate()}</span>
            </div>
            <div className="space-y-1">
              {dayLeaves.map(l => (
                <div key={l._id + fmt(d)} className="text-xs px-2 py-1 rounded font-medium truncate" style={{ background: (l.leave_type?.color || "#009d44") + "30", color: l.leave_type?.color || "#009d44" }}>
                  {l.user?.name}
                </div>
              ))}
              {dayLeaves.length === 0 && <p className="text-xs text-muted-foreground/60">—</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Day view: timeline of who's on leave
function DayView({ cursor, leaves }) {
  const dayStr = fmt(cursor);
  const dayLeaves = leaves.filter(l => inRange(dayStr, l.start_date, l.end_date));
  return (
    <div className="p-5" data-testid="day-view">
      <p className="text-lg font-semibold text-foreground mb-1" style={{ fontFamily: "Chivo" }}>
        {cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
      </p>
      <p className="text-sm text-muted-foreground mb-5">{dayLeaves.length} team member{dayLeaves.length !== 1 ? "s" : ""} on leave</p>
      {dayLeaves.length === 0 ? (
        <p className="text-center py-10 text-muted-foreground text-sm">Everyone's in today 🎉</p>
      ) : (
        <div className="space-y-2">
          {dayLeaves.map(l => (
            <div key={l._id} className="flex items-center justify-between bg-background border border-border rounded-lg px-4 py-3" data-testid={`day-leave-${l._id}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">{l.user?.name?.[0]?.toUpperCase()}</div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{l.user?.name}</p>
                  <p className="text-xs text-muted-foreground">{l.start_date} → {l.end_date} · {l.reason}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ background: (l.leave_type?.color || "#009d44") + "30", color: l.leave_type?.color || "#009d44" }}>{l.leave_type?.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Year view: 12 mini month grids
function YearView({ cursor, leaves, onMonthClick }) {
  const year = cursor.getFullYear();
  const today = new Date();
  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="year-view">
      {Array.from({ length: 12 }, (_, m) => {
        const monthStart = new Date(year, m, 1);
        const gridStart = new Date(monthStart);
        gridStart.setDate(monthStart.getDate() - monthStart.getDay());
        const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
        return (
          <button key={m} onClick={() => onMonthClick(new Date(year, m, 1))} className="bg-background border border-border rounded-lg p-3 text-left hover:shadow-md transition-shadow" data-testid={`year-month-${m}`}>
            <p className="text-sm font-semibold text-foreground mb-2" style={{ fontFamily: "Chivo" }}>{MONTHS[m]}</p>
            <div className="grid grid-cols-7 gap-0.5">
              {DAYS.map(d => <div key={d} className="text-[9px] text-center text-muted-foreground">{d[0]}</div>)}
              {cells.map((d, i) => {
                const inMonth = d.getMonth() === m;
                const isToday = fmt(d) === fmt(today);
                const dayLeaves = leaves.filter(l => inRange(fmt(d), l.start_date, l.end_date));
                return (
                  <div key={i} className={`text-[10px] text-center rounded aspect-square flex items-center justify-center ${!inMonth ? "text-muted-foreground/30" : isToday ? "bg-primary text-primary-foreground font-bold" : dayLeaves.length ? "text-foreground font-semibold" : "text-foreground"}`}
                    style={dayLeaves.length && !isToday ? { background: (dayLeaves[0].leave_type?.color || "#009d44") + "40" } : {}}>
                    {d.getDate()}
                  </div>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// Employee view: rows of employees with horizontal timeline of their leaves in the current month
function EmployeeView({ cursor, leaves }) {
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get("/users").then(r => setUsers(r.data)).catch(() => {}); }, []);
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const today = new Date();

  const userLeaves = useMemo(() => {
    const map = new Map();
    for (const l of leaves) {
      if (!map.has(l.user?.id)) map.set(l.user?.id, []);
      map.get(l.user?.id).push(l);
    }
    return map;
  }, [leaves]);

  return (
    <div className="overflow-x-auto" data-testid="employee-view">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-bold uppercase tracking-wider text-muted-foreground min-w-[160px] border-r border-border">Employee</th>
            {Array.from({ length: daysInMonth }, (_, i) => {
              const d = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
              const isToday = fmt(d) === fmt(today);
              return <th key={i} className={`px-0.5 py-2 text-center font-medium ${isToday ? "bg-primary/20 text-primary" : "text-muted-foreground"}`} style={{ width: 28 }}>{i + 1}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {users.length === 0 && <tr><td colSpan={daysInMonth + 1} className="py-8 text-center text-muted-foreground">Loading employees…</td></tr>}
          {users.map(u => {
            const leavesForUser = userLeaves.get(u._id) || [];
            return (
              <tr key={u._id} className="border-b border-border hover:bg-muted/20" data-testid={`emp-row-${u._id}`}>
                <td className="sticky left-0 bg-card px-3 py-2 border-r border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">{u.full_name?.[0]?.toUpperCase()}</div>
                    <span className="text-foreground text-xs truncate">{u.full_name}</span>
                  </div>
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = fmt(new Date(cursor.getFullYear(), cursor.getMonth(), i + 1));
                  const match = leavesForUser.find(l => inRange(d, l.start_date, l.end_date));
                  return (
                    <td key={i} className="px-0 py-2 text-center" style={{ width: 28 }}>
                      {match && <div className="h-5 w-full rounded-sm" title={`${match.leave_type?.name} · ${match.reason || ""}`} style={{ background: match.leave_type?.color || "#009d44" }} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CalendarPage() {
  const today = new Date();
  const [view, setView] = useState("month");
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Compute date range per view
  const range = useMemo(() => {
    if (view === "day") return { start: fmt(cursor), end: fmt(cursor) };
    if (view === "week") {
      const ws = addDays(cursor, -cursor.getDay());
      return { start: fmt(ws), end: fmt(addDays(ws, 6)) };
    }
    if (view === "year") {
      return { start: `${cursor.getFullYear()}-01-01`, end: `${cursor.getFullYear()}-12-31` };
    }
    // month + employee
    const s = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const e = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    // for month view extend to grid bounds
    if (view === "month") {
      const gs = addDays(s, -s.getDay());
      return { start: fmt(gs), end: fmt(addDays(gs, 41)) };
    }
    return { start: fmt(s), end: fmt(e) };
  }, [view, cursor]);

  useEffect(() => {
    setLoading(true);
    api.get(`/leaves/calendar?start=${range.start}&end=${range.end}`)
      .then(res => setLeaves(res.data))
      .catch(() => toast.error("Failed to load calendar"))
      .finally(() => setLoading(false));
  }, [range]);

  const navPrev = () => {
    if (view === "day") setCursor(addDays(cursor, -1));
    else if (view === "week") setCursor(addDays(cursor, -7));
    else if (view === "year") setCursor(new Date(cursor.getFullYear() - 1, cursor.getMonth(), 1));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
  };
  const navNext = () => {
    if (view === "day") setCursor(addDays(cursor, 1));
    else if (view === "week") setCursor(addDays(cursor, 7));
    else if (view === "year") setCursor(new Date(cursor.getFullYear() + 1, cursor.getMonth(), 1));
    else setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
  };

  const title = useMemo(() => {
    if (view === "day") return cursor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (view === "week") {
      const ws = addDays(cursor, -cursor.getDay());
      const we = addDays(ws, 6);
      return `${ws.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${we.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    if (view === "year") return `${cursor.getFullYear()}`;
    return `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [view, cursor]);

  return (
    <div className="space-y-4" data-testid="calendar-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-light text-foreground" style={{ fontFamily: "Chivo" }}>Team Calendar</h1>
          <p className="text-sm text-muted-foreground">Approved leaves across the team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-muted rounded-lg p-0.5" data-testid="calendar-view-switcher">
            {VIEWS.map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${view === v.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                data-testid={`cal-view-${v.id}`}>
                {v.label}
              </button>
            ))}
          </div>
          <button onClick={navPrev} className="p-2 rounded-lg bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground" data-testid="cal-prev"><ChevronLeft size={16} /></button>
          <p className="text-base font-semibold text-foreground min-w-[180px] text-center" style={{ fontFamily: "Chivo" }}>{title}</p>
          <button onClick={navNext} className="p-2 rounded-lg bg-muted hover:bg-secondary text-muted-foreground hover:text-foreground" data-testid="cal-next"><ChevronRight size={16} /></button>
          <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))} className="px-3 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted" data-testid="cal-today">Today</button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden" data-testid="calendar-grid">
        {loading ? (
          <div className="flex items-center justify-center h-96"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
        ) : view === "day" ? (
          <DayView cursor={cursor} leaves={leaves} />
        ) : view === "week" ? (
          <WeekView cursor={cursor} leaves={leaves} onDayClick={(d, dl) => setSelected({ date: d, leaves: dl })} />
        ) : view === "year" ? (
          <YearView cursor={cursor} leaves={leaves} onMonthClick={(d) => { setCursor(d); setView("month"); }} />
        ) : view === "employee" ? (
          <EmployeeView cursor={cursor} leaves={leaves} />
        ) : (
          <MonthView cursor={cursor} leaves={leaves} onDayClick={(d, dl) => setSelected({ date: d, leaves: dl })} />
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-card border border-border rounded-xl p-5 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()} data-testid="day-detail-modal">
            <p className="text-base font-semibold text-foreground flex items-center gap-2" style={{ fontFamily: "Chivo" }}>
              <CalIcon size={16} className="text-primary" /> {selected.date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </p>
            {selected.leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-3">Nobody on leave this day.</p>
            ) : (
              <div className="space-y-2 mt-4">
                {selected.leaves.map(l => (
                  <div key={l._id} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: l.leave_type?.color }} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{l.user?.name}</p>
                        <p className="text-xs text-muted-foreground">{l.leave_type?.name} · {l.start_date} → {l.end_date}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => setSelected(null)} className="w-full mt-4 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted" data-testid="day-detail-close">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
