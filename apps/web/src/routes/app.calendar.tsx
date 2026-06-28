import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin } from "lucide-react";
import { calendarApi } from "@/lib/api";

export const Route = createFileRoute("/app/calendar")({ component: Cal });

const EVENT_COLORS = ["#7C3AED", "#3B82F6", "#10B981", "#EC4899", "#F59E0B", "#06B6D4", "#EF4444", "#8B5CF6"];

function Cal() {
  const [view, setView] = useState<"Day" | "Week" | "Month" | "Year">("Month");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newColor, setNewColor] = useState(EVENT_COLORS[0]);

  const loadEvents = () => {
    const start = new Date(year, month, 1).toISOString();
    const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    calendarApi.listEvents(start, end).then((data) => {
      setEvents(Array.isArray(data) ? data : []);
    }).catch(() => setEvents([]));
  };

  useEffect(() => { loadEvents(); }, [year, month]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDate) return;
    const startTime = new Date(newDate).toISOString();
    const endTime = newEndDate ? new Date(newEndDate).toISOString() : new Date(new Date(newDate).getTime() + 3600000).toISOString();
    try {
      await calendarApi.createEvent({
        title: newTitle.trim(),
        start_time: startTime,
        end_time: endTime,
        location: newLocation || undefined,
        color: newColor,
        is_all_day: false,
      });
      setNewTitle(""); setNewDate(""); setNewEndDate(""); setNewLocation(""); setNewColor(EVENT_COLORS[0]);
      setCreating(false);
      loadEvents();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await calendarApi.deleteEvent(id);
      loadEvents();
    } catch {}
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };
  const goToday = () => { setYear(new Date().getFullYear()); setMonth(new Date().getMonth()); };

  const monthName = new Date(year, month).toLocaleString("default", { month: "long", year: "numeric" });
  const today = new Date();
  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Calendar grid calculations
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const getEventsForDay = (day: number) => {
    return events.filter((ev) => {
      const d = new Date(ev.start_time || ev.date || ev.start);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  // Day view
  const renderDayView = () => {
    const d = selectedDay || today.getDate();
    const dayEvents = getEventsForDay(d);
    const dayDate = new Date(year, month, d);
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div>
        <div className="mb-3 text-center">
          <div className="text-2xl font-bold">{dayDate.toLocaleDateString("default", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div>
        </div>
        <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
          {hours.map((h) => {
            const hourEvents = dayEvents.filter((e) => new Date(e.start_time).getHours() === h);
            return (
              <div key={h} className="grid grid-cols-[60px_1fr] gap-2 min-h-[40px]">
                <div className="text-xs text-muted-foreground text-right pr-2 pt-1">{h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}</div>
                <div className="border-t border-border/30 pt-1">
                  {hourEvents.map((e, i) => (
                    <div key={e.id || i} className="rounded px-2 py-1 text-xs text-white mb-0.5 flex items-center justify-between" style={{ background: e.color || EVENT_COLORS[i % EVENT_COLORS.length] }}>
                      <span>{e.title}</span>
                      <button onClick={() => handleDelete(e.id)} className="opacity-70 hover:opacity-100"><X className="size-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Week view
  const renderWeekView = () => {
    const curr = selectedDay || today.getDate();
    const startOfWeek = new Date(year, month, curr);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border/50 text-xs">
          {days.map((d) => (
            <div key={d.toISOString()} className={`bg-background p-3 min-h-[200px] ${d.toDateString() === today.toDateString() ? "ring-2 ring-astra-purple/50 ring-inset" : ""}`}>
              <div className="mb-2">
                <div className="text-muted-foreground">{d.toLocaleDateString("default", { weekday: "short" })}</div>
                <div className={`text-lg font-bold ${d.toDateString() === today.toDateString() ? "text-astra-purple" : ""}`}>{d.getDate()}</div>
              </div>
              {events.filter((e) => {
                const ed = new Date(e.start_time);
                return ed.toDateString() === d.toDateString();
              }).map((e, i) => (
                <div key={e.id || i} className="rounded px-1.5 py-0.5 text-[10px] text-white mb-0.5 truncate" style={{ background: e.color || EVENT_COLORS[i % EVENT_COLORS.length] }}>{e.title}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Year view
  const renderYearView = () => {
    const months = Array.from({ length: 12 }, (_, i) => i);
    return (
      <div className="grid grid-cols-3 gap-4">
        {months.map((m) => {
          const mFirstDay = new Date(year, m, 1).getDay();
          const mDays = new Date(year, m + 1, 0).getDate();
          const isCurrentMonth = m === today.getMonth() && year === today.getFullYear();
          return (
            <div key={m} className={`glass rounded-xl p-3 cursor-pointer hover:ring-astra transition ${isCurrentMonth ? "ring-1 ring-astra-purple/50" : ""}`} onClick={() => { setMonth(m); setView("Month"); }}>
              <div className="text-sm font-semibold mb-2">{new Date(year, m).toLocaleString("default", { month: "long" })}</div>
              <div className="grid grid-cols-7 gap-0.5 text-[9px] text-center">
                {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="text-muted-foreground">{d}</div>)}
                {Array.from({ length: mFirstDay }).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: mDays }).map((_, i) => {
                  const isTodayCell = i + 1 === today.getDate() && m === today.getMonth() && year === today.getFullYear();
                  return <div key={i} className={`rounded-sm ${isTodayCell ? "bg-astra-purple text-white font-bold" : ""}`}>{i + 1}</div>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Month view (main grid)
  const renderMonthView = () => {
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    return (
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-border/50 text-xs">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => <div key={d} className="bg-muted/40 p-2 text-center font-semibold text-muted-foreground">{d}</div>)}
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - firstDay + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const displayDay = !isCurrentMonth
            ? (dayNum < 1 ? daysInPrevMonth + dayNum : dayNum - daysInMonth)
            : dayNum;
          const dayEvents = isCurrentMonth ? getEventsForDay(dayNum) : [];
          const todayHighlight = isCurrentMonth && isToday(dayNum);

          return (
            <div
              key={i}
              className={`min-h-[90px] bg-background p-1.5 cursor-pointer hover:bg-muted/30 transition ${!isCurrentMonth ? "opacity-40" : ""} ${todayHighlight ? "ring-2 ring-astra-purple/50 ring-inset" : ""}`}
              onClick={() => { if (isCurrentMonth) { setSelectedDay(dayNum); setView("Day"); } }}
            >
              <div className={`text-xs mb-1 ${todayHighlight ? "bg-astra-purple text-white size-5 rounded-full grid place-items-center font-bold" : ""}`}>
                {displayDay}
              </div>
              {dayEvents.slice(0, 3).map((e, j) => (
                <div key={e.id || j} className="truncate rounded px-1 py-0.5 text-[10px] text-white mb-0.5" style={{ background: e.color || EVENT_COLORS[j % EVENT_COLORS.length] }}>{e.title}</div>
              ))}
              {dayEvents.length > 3 && <div className="text-[9px] text-muted-foreground">+{dayEvents.length - 3} more</div>}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="glass space-y-4 rounded-2xl p-4">
        <button onClick={() => setCreating(true)} className="bg-gradient-astra glow inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white"><Plus className="size-4" /> New Event</button>

        {/* Mini calendar */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">{monthName}</span>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="rounded p-1 hover:bg-muted"><ChevronLeft className="size-3"/></button>
              <button onClick={goToday} className="rounded px-1.5 text-[10px] hover:bg-muted">Today</button>
              <button onClick={nextMonth} className="rounded p-1 hover:bg-muted"><ChevronRight className="size-3"/></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
            {["S","M","T","W","T","F","S"].map((d, i) => <div key={i} className="text-muted-foreground font-medium">{d}</div>)}
            {Array.from({ length: firstDay }).map((_, i) => <div key={`pad${i}`} className="text-muted-foreground/30">{daysInPrevMonth - firstDay + i + 1}</div>)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayHasEvents = getEventsForDay(i + 1).length > 0;
              return (
                <div
                  key={i}
                  onClick={() => { setSelectedDay(i + 1); setView("Day"); }}
                  className={`rounded-md p-1 cursor-pointer transition hover:bg-muted ${isToday(i + 1) ? "bg-gradient-astra text-white font-bold" : ""} ${selectedDay === i + 1 && !isToday(i + 1) ? "bg-muted" : ""}`}
                >
                  {i + 1}
                  {dayHasEvents && !isToday(i + 1) && <div className="mx-auto mt-0.5 size-1 rounded-full bg-astra-purple" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Upcoming events */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">Upcoming</div>
          {events.length === 0 ? (
            <div className="text-xs text-muted-foreground/60">No events</div>
          ) : (
            <ul className="space-y-1.5">
              {events.slice(0, 5).map((e, i) => (
                <li key={e.id || i} className="flex items-start gap-2">
                  <div className="mt-1 size-2 rounded-full shrink-0" style={{ background: e.color || EVENT_COLORS[i % EVENT_COLORS.length] }} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{e.title}</div>
                    <div className="text-[10px] text-muted-foreground">{e.start_time ? new Date(e.start_time).toLocaleDateString("default", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Main calendar */}
      <section className="glass rounded-2xl p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="rounded-lg p-1.5 hover:bg-muted"><ChevronLeft className="size-4" /></button>
            <h2 className="font-display text-xl font-bold min-w-[180px] text-center">{view === "Year" ? year : monthName}</h2>
            <button onClick={nextMonth} className="rounded-lg p-1.5 hover:bg-muted"><ChevronRight className="size-4" /></button>
          </div>
          <div className="glass flex rounded-xl p-1 text-xs">
            {(["Day","Week","Month","Year"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 transition ${view === v ? "bg-gradient-astra text-white" : "text-muted-foreground hover:text-foreground"}`}>{v}</button>
            ))}
          </div>
        </div>

        {view === "Day" && renderDayView()}
        {view === "Week" && renderWeekView()}
        {view === "Month" && renderMonthView()}
        {view === "Year" && renderYearView()}
      </section>

      {/* Create event modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="w-full max-w-md rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-display text-lg font-semibold">New Event</h3>
            <p className="mb-4 text-sm text-muted-foreground">Add an event to your calendar.</p>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Event title"
              className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] text-muted-foreground">Start</label>
                <input type="datetime-local" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">End</label>
                <input type="datetime-local" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none" />
              </div>
            </div>
            <input value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="Location (optional)" className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            <div className="mb-4">
              <label className="text-[10px] text-muted-foreground mb-1 block">Color</label>
              <div className="flex gap-2">
                {EVENT_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)} className={`size-6 rounded-full transition ${newColor === c ? "ring-2 ring-offset-2 ring-foreground" : ""}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleCreate} disabled={!newTitle.trim() || !newDate} className="bg-gradient-astra glow rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
