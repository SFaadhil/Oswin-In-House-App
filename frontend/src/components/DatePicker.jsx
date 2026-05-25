import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import "react-day-picker/dist/style.css";

/**
 * DatePicker — button that shows a calendar popover when clicked.
 * value: "YYYY-MM-DD" string or ""
 * onChange: called with "YYYY-MM-DD"
 * minDate: "YYYY-MM-DD" string — days before this are disabled
 */
export default function DatePicker({ value, onChange, placeholder = "Select date", minDate, disabled = false, className = "" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse safely — add noon to avoid UTC-offset day shift
  const toDate = (str) => str ? new Date(str + "T12:00:00") : undefined;

  const selected = toDate(value);
  const minDateObj = toDate(minDate);
  const disabledDays = minDateObj ? { before: minDateObj } : undefined;

  const displayValue = selected
    ? selected.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (date) => {
    if (!date) return;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    onChange(`${y}-${m}-${d}`);
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        className={`w-full bg-background border border-border rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-ring transition-all ${
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-ring/60"
        } ${open ? "ring-2 ring-ring border-ring" : ""}`}
      >
        <span className={displayValue ? "text-foreground" : "text-muted-foreground"}>
          {displayValue || placeholder}
        </span>
        <Calendar size={14} className="text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-[200] mt-1.5 bg-card border border-border rounded-xl shadow-2xl overflow-hidden dp-popover">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            disabled={disabledDays}
            defaultMonth={selected || new Date()}
            showOutsideDays
            fixedWeeks
            components={{
              IconLeft: () => <ChevronLeft size={14} />,
              IconRight: () => <ChevronRight size={14} />,
            }}
          />
        </div>
      )}
    </div>
  );
}
