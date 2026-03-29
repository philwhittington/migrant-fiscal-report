import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface Phase {
  id: number;
  name: string;
  label: string;
  start: string;
  end: string;
  color: string;
  status: "done" | "in_progress" | "pending";
  summary: string;
}

interface Milestone {
  id: string;
  name: string;
  date: string;
  status: "done" | "review" | "in_progress" | "pending";
  description: string;
  imfRef: string;
}

interface Task {
  id: string;
  name: string;
  phase: number;
  imfRef: string;
  imfArea: string;
  owner: string;
  executor: "agent" | "human" | "partner";
  startDate: string;
  endDate: string;
  effortDays: number;
  status: "done" | "review" | "in_progress" | "pending";
  kanbanCol: "done" | "review" | "in_progress" | "backlog";
  dependsOn: string[];
  objective: string;
  outputs: string[];
  llmRole: string;
  humanRequired: string;
  notes: string;
}

interface Plan {
  projectName: string;
  objective: string;
  source: string;
  staffContext: string;
  targetGoLive: string;
  targetDate: string;
  startDate: string;
  generatedBy: string;
  generatedNote: string;
  milestones: Milestone[];
  phases: Phase[];
  tasks: Task[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

const PLAN_START = new Date("2025-04-01");
const PLAN_END = new Date("2027-03-31");
const TOTAL_MS = PLAN_END.getTime() - PLAN_START.getTime();

function dateX(dateStr: string, timelineWidth: number): number {
  const d = new Date(dateStr);
  const pct = (d.getTime() - PLAN_START.getTime()) / TOTAL_MS;
  return Math.max(0, Math.min(1, pct)) * timelineWidth;
}

function statusColor(status: string): string {
  switch (status) {
    case "done": return "#7A9E7E";
    case "review": return "#C9A227";
    case "in_progress": return "#6EA1BE";
    default: return "#D1D5DB";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "done": return "Done";
    case "review": return "In review";
    case "in_progress": return "In progress";
    default: return "Backlog";
  }
}

function executorBadge(executor: string): string {
  switch (executor) {
    case "agent": return "LLM-led";
    case "human": return "Human-led";
    case "partner": return "Commissioner";
    default: return executor;
  }
}

function executorColor(executor: string): string {
  switch (executor) {
    case "agent": return "bg-teal/10 text-teal border-teal/20";
    case "human": return "bg-deep-blue/10 text-deep-blue border-deep-blue/20";
    default: return "bg-gold/10 text-gold border-gold/20";
  }
}

// ── PROMPT shown in panel 1 ────────────────────────────────────────────────

const PROMPT_DISPLAY = `System: You are a project planning assistant. You are helping a very small
tax administration — the DCTRT, tax authority of the Republic of the
Marshall Islands — implement a VAT system by Q4 2026.

Context:
  - 7 staff total. Manual operating environment. No IT system.
  - Current date: April 2025. VAT target go-live: October 2026.
  - Staff have deep knowledge of the local taxpayer base and how
    things actually work, but limited time and no spare capacity.
  - All project management tasks must be executable by existing staff
    with the support of a PFTAC-funded long-term advisor.

Input: The IMF's seven challenge areas and seven recommendations
(4.1–4.7) from the 2025 Technical Assistance Report on Consumption
and Income Tax Reform for the Marshall Islands:

  Rec 4.1: Appoint a long-term advisor
  Rec 4.2: Establish project governance and management structure
  Rec 4.3: Develop training programme for all staff
  Rec 4.4: Build a clean VAT taxpayer register
  Rec 4.5: Design and execute taxpayer education campaign
  Rec 4.6: Develop compliance programme, forms, and procedures
  Rec 4.7: Initiate ITAS procurement (IT system)

  Challenge areas: Reform project management, Taxpayer registration,
  Organisation/staffing/training, Compliance/forms/procedures,
  Taxpayer education, IT systems, Post-implementation monitoring.

Task: Produce a structured implementation plan with:
  - Four delivery phases from April 2025 to March 2027
  - Tasks for each phase: ID, name, owner, executor (LLM-led /
    human-led / Commissioner decision), effort in days, dependencies
  - For each task: objective, expected outputs, LLM role, what
    requires human authority (cannot be delegated)
  - Seven milestones with dates and status
  - For each phase: a plain-language summary of what it achieves

Rules:
  - Every task must map to at least one IMF recommendation
  - Human-authority gates must be explicit — especially for:
    refund authorisation, legislation sign-off, go-live decision
  - No task can exceed 45 person-days (staff are spread across
    existing obligations)
  - LLM role must be specific: name what is drafted, generated, or
    synthesised — not "assist with" or "support"
  - The plan must be executable without external IT — LLM +
    spreadsheets is the operating model until ITAS is delivered
  - Current snapshot (March 2026): Phases 1–2 are substantially
    complete. Reflect actual status realistically.`;

// ── Gantt Chart ────────────────────────────────────────────────────────────

const LABEL_W = 180;
const ROW_H = 28;
const PHASE_H = 20;
const HEADER_H = 44;
const MILESTONE_R = 5;
const TODAY = new Date("2026-03-29");

function GanttChart({
  plan,
  onSelectTask,
  selectedId,
}: {
  plan: Plan;
  onSelectTask: (t: Task | null) => void;
  selectedId: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    obs.observe(el);
    setWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  const TW = Math.max(1, width - LABEL_W); // timeline width

  // Build row structure: phase header → tasks in that phase
  type Row = { type: "phase"; phase: Phase } | { type: "task"; task: Task };
  const rows: Row[] = [];
  for (const phase of plan.phases) {
    rows.push({ type: "phase", phase });
    for (const task of plan.tasks.filter((t) => t.phase === phase.id)) {
      rows.push({ type: "task", task });
    }
  }

  // Quarter labels
  const quarters: { label: string; date: string }[] = [
    { label: "Q2 2025", date: "2025-04-01" },
    { label: "Q3 2025", date: "2025-07-01" },
    { label: "Q4 2025", date: "2025-10-01" },
    { label: "Q1 2026", date: "2026-01-01" },
    { label: "Q2 2026", date: "2026-04-01" },
    { label: "Q3 2026", date: "2026-07-01" },
    { label: "Q4 2026", date: "2026-10-01" },
    { label: "Q1 2027", date: "2027-01-01" },
  ];

  // Y position calculation
  function rowY(rowIndex: number): number {
    let y = HEADER_H;
    for (let i = 0; i < rowIndex; i++) {
      y += rows[i].type === "phase" ? PHASE_H : ROW_H;
    }
    return y;
  }

  const totalH = HEADER_H + rows.reduce((s, r) => s + (r.type === "phase" ? PHASE_H : ROW_H), 0) + 20;
  const todayX = LABEL_W + dateX(TODAY.toISOString().split("T")[0], TW);

  return (
    <div ref={containerRef} className="w-full overflow-x-auto">
      <svg
        width={width}
        height={totalH}
        className="font-sans select-none"
        style={{ fontFamily: "inherit" }}
      >
        {/* Background */}
        <rect width={width} height={totalH} fill="white" />

        {/* Quarter grid lines + labels */}
        {quarters.map((q) => {
          const x = LABEL_W + dateX(q.date, TW);
          return (
            <g key={q.date}>
              <line x1={x} y1={HEADER_H - 8} x2={x} y2={totalH} stroke="#E5E7EB" strokeWidth={1} />
              <text x={x + 3} y={16} fontSize={9} fill="#9CA3AF" fontWeight="500" letterSpacing="0.03em">
                {q.label}
              </text>
            </g>
          );
        })}

        {/* Rows */}
        {rows.map((row, i) => {
          const y = rowY(i);

          if (row.type === "phase") {
            const { phase } = row;
            const x1 = LABEL_W + dateX(phase.start, TW);
            const x2 = LABEL_W + dateX(phase.end, TW);
            return (
              <g key={`phase-${phase.id}`}>
                <rect x={0} y={y} width={width} height={PHASE_H} fill="#F9FAFB" />
                <text x={8} y={y + 13} fontSize={9} fill="#6B7280" fontWeight="700" letterSpacing="0.06em">
                  {phase.label.toUpperCase()}
                </text>
                <rect
                  x={x1}
                  y={y + 4}
                  width={Math.max(1, x2 - x1)}
                  height={PHASE_H - 8}
                  fill={phase.color}
                  opacity={0.15}
                  rx={2}
                />
              </g>
            );
          }

          const { task } = row;
          const tx1 = LABEL_W + dateX(task.startDate, TW);
          const tx2 = LABEL_W + dateX(task.endDate, TW);
          const barW = Math.max(4, tx2 - tx1);
          const phaseColor = plan.phases.find((p) => p.id === task.phase)?.color ?? "#6B7280";
          const isSelected = selectedId === task.id;
          const isDone = task.status === "done";
          const isReview = task.status === "review";

          return (
            <g
              key={task.id}
              onClick={() => onSelectTask(isSelected ? null : task)}
              style={{ cursor: "pointer" }}
            >
              {/* Row bg */}
              <rect
                x={0}
                y={y}
                width={width}
                height={ROW_H}
                fill={isSelected ? "#EFF6FF" : "transparent"}
              />
              {/* Hover highlight */}
              <rect
                x={0}
                y={y}
                width={width}
                height={ROW_H}
                fill="transparent"
                className="hover:fill-linen/60 transition-colors"
              />

              {/* Task label */}
              <text
                x={8}
                y={y + 17}
                fontSize={10}
                fill={isSelected ? "#163E5F" : "#374151"}
                fontWeight={isSelected ? "600" : "400"}
              >
                <tspan fontSize={9} fill="#9CA3AF" fontWeight="500">{task.id} </tspan>
                {task.name.length > 28 ? task.name.slice(0, 26) + "…" : task.name}
              </text>

              {/* Bar */}
              <rect
                x={tx1}
                y={y + 7}
                width={barW}
                height={ROW_H - 14}
                fill={isDone ? phaseColor : isReview ? "#C9A227" : phaseColor}
                opacity={isDone ? 1 : isReview ? 0.9 : 0.4}
                rx={2}
                stroke={isSelected ? "#163E5F" : "none"}
                strokeWidth={isSelected ? 1.5 : 0}
              />

              {/* Status dot */}
              {!isDone && (
                <circle
                  cx={tx1 + barW / 2}
                  cy={y + ROW_H / 2}
                  r={3}
                  fill={statusColor(task.status)}
                  opacity={0.9}
                />
              )}

              {/* Bottom border */}
              <line x1={0} y1={y + ROW_H} x2={width} y2={y + ROW_H} stroke="#F3F4F6" strokeWidth={1} />
            </g>
          );
        })}

        {/* Milestones */}
        {plan.milestones.map((m) => {
          const mx = LABEL_W + dateX(m.date, TW);
          const col = statusColor(m.status);
          return (
            <g key={m.id}>
              <line x1={mx} y1={HEADER_H} x2={mx} y2={totalH - 10} stroke={col} strokeWidth={1} strokeDasharray="3,2" opacity={0.6} />
              {/* Diamond */}
              <polygon
                points={`${mx},${HEADER_H - 2} ${mx + MILESTONE_R},${HEADER_H + MILESTONE_R} ${mx},${HEADER_H + MILESTONE_R * 2} ${mx - MILESTONE_R},${HEADER_H + MILESTONE_R}`}
                fill={col}
                opacity={0.9}
              />
            </g>
          );
        })}

        {/* Today line */}
        {todayX >= LABEL_W && todayX <= width && (
          <g>
            <line x1={todayX} y1={HEADER_H} x2={todayX} y2={totalH} stroke="#F26B44" strokeWidth={1.5} />
            <rect x={todayX - 14} y={HEADER_H - 14} width={28} height={12} fill="#F26B44" rx={2} />
            <text x={todayX} y={HEADER_H - 5} fontSize={8} fill="white" textAnchor="middle" fontWeight="600">
              TODAY
            </text>
          </g>
        )}

        {/* Label column separator */}
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={totalH} stroke="#E5E7EB" strokeWidth={1} />

        {/* Header bar */}
        <rect x={0} y={0} width={width} height={HEADER_H} fill="white" />
        <rect x={0} y={HEADER_H - 1} width={width} height={1} fill="#E5E7EB" />
        <text x={8} y={16} fontSize={9} fill="#9CA3AF" fontWeight="600" letterSpacing="0.06em">TASK</text>
        <text x={8} y={30} fontSize={8} fill="#D1D5DB">Click any bar to see full specification</text>
      </svg>
    </div>
  );
}

// ── Milestone progress bar ─────────────────────────────────────────────────

function MilestoneProgress({ milestones }: { milestones: Milestone[] }) {
  const done = milestones.filter((m) => m.status === "done").length;
  const review = milestones.filter((m) => m.status === "review").length;
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1">
        {milestones.map((m) => (
          <div
            key={m.id}
            className={cn(
              "h-2 w-5 rounded-sm",
              m.status === "done" ? "bg-sage" :
              m.status === "review" ? "bg-gold" :
              m.status === "in_progress" ? "bg-teal" :
              "bg-rule"
            )}
            title={`${m.id}: ${m.name} — ${statusLabel(m.status)}`}
          />
        ))}
      </div>
      <span className="font-sans text-[0.6875rem] text-steel">
        {done} of {milestones.length} milestones complete · {review > 0 ? `${review} in review · ` : ""}{milestones.length - done - review} pending
      </span>
    </div>
  );
}

// ── Kanban board ───────────────────────────────────────────────────────────

const KANBAN_COLS: { id: string; label: string; statusBg: string }[] = [
  { id: "backlog", label: "Backlog", statusBg: "bg-linen border-rule" },
  { id: "in_progress", label: "In Progress", statusBg: "bg-teal/10 border-teal/30" },
  { id: "review", label: "In Review", statusBg: "bg-gold/10 border-gold/30" },
  { id: "done", label: "Done", statusBg: "bg-sage/10 border-sage/30" },
];

function KanbanBoard({
  plan,
  onSelectTask,
  selectedId,
}: {
  plan: Plan;
  onSelectTask: (t: Task | null) => void;
  selectedId: string | null;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {KANBAN_COLS.map((col) => {
        const tasks = plan.tasks.filter((t) => t.kanbanCol === col.id);
        return (
          <div key={col.id} className={cn("border rounded-sm", col.statusBg)}>
            <div className="px-3 py-2 border-b border-current/10">
              <span className="font-sans text-[0.625rem] font-semibold uppercase tracking-wider text-steel">
                {col.label}
              </span>
              <span className="ml-1.5 font-sans text-[0.625rem] text-steel/60">({tasks.length})</span>
            </div>
            <div className="p-2 space-y-2">
              {tasks.map((task) => {
                const phase = plan.phases.find((p) => p.id === task.phase);
                const isSelected = selectedId === task.id;
                return (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(isSelected ? null : task)}
                    className={cn(
                      "w-full text-left p-2.5 bg-white border rounded-sm transition-all",
                      isSelected
                        ? "border-deep-blue shadow-sm"
                        : "border-rule hover:border-steel/40 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start gap-1.5 mb-1.5">
                      <span className="font-mono text-[0.6rem] text-steel/70 flex-shrink-0 mt-0.5">{task.id}</span>
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0 mt-1"
                        style={{ backgroundColor: phase?.color ?? "#9CA3AF" }}
                      />
                    </div>
                    <p className="font-sans text-[0.75rem] text-navy font-medium leading-snug mb-1.5">
                      {task.name}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn(
                        "inline-block px-1 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide rounded-sm border",
                        executorColor(task.executor)
                      )}>
                        {executorBadge(task.executor)}
                      </span>
                      <span className="font-sans text-[0.5625rem] text-steel/60">{task.effortDays}d</span>
                    </div>
                    <p className="font-sans text-[0.625rem] text-steel/70 mt-1.5 truncate">{task.imfArea}</p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Task detail panel ──────────────────────────────────────────────────────

function TaskDetail({ task, plan, onClose }: { task: Task; plan: Plan; onClose: () => void }) {
  const phase = plan.phases.find((p) => p.id === task.phase);
  return (
    <div className="border border-rule bg-white mt-4">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-rule">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[0.6875rem] text-steel">{task.id}</span>
            <span
              className="inline-block px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide rounded-sm"
              style={{ background: (phase?.color ?? "#9CA3AF") + "20", color: phase?.color ?? "#9CA3AF" }}
            >
              {phase?.name}
            </span>
            <span className={cn(
              "inline-block px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide rounded-sm border",
              executorColor(task.executor)
            )}>
              {executorBadge(task.executor)}
            </span>
            <span
              className="inline-block px-1.5 py-0.5 text-[0.5625rem] font-semibold uppercase tracking-wide rounded-sm"
              style={{ background: statusColor(task.status) + "25", color: statusColor(task.status) }}
            >
              {statusLabel(task.status)}
            </span>
          </div>
          <h4 className="font-serif text-[1rem] font-semibold text-navy leading-snug">{task.name}</h4>
          <p className="font-sans text-[0.6875rem] text-steel mt-1">
            {task.imfArea} · {task.imfRef} · {task.effortDays} person-days · {task.owner}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 font-sans text-[0.75rem] text-steel hover:text-navy flex-shrink-0"
          aria-label="Close task detail"
        >
          ✕
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          <div>
            <div className="font-sans text-[0.5625rem] uppercase tracking-[0.08em] text-steel/70 mb-1.5">Objective</div>
            <p className="font-sans text-[0.8125rem] text-navy leading-relaxed">{task.objective}</p>
          </div>

          <div>
            <div className="font-sans text-[0.5625rem] uppercase tracking-[0.08em] text-steel/70 mb-1.5">Expected outputs</div>
            <ul className="space-y-1">
              {task.outputs.map((o, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-sage mt-0.5 flex-shrink-0 text-[0.75rem]">✓</span>
                  <span className="font-sans text-[0.75rem] text-navy">{o}</span>
                </li>
              ))}
            </ul>
          </div>

          {task.dependsOn.length > 0 && (
            <div>
              <div className="font-sans text-[0.5625rem] uppercase tracking-[0.08em] text-steel/70 mb-1.5">Depends on</div>
              <div className="flex flex-wrap gap-1.5">
                {task.dependsOn.map((d) => (
                  <span key={d} className="font-mono text-[0.6875rem] px-2 py-0.5 bg-linen border border-rule rounded-sm text-steel">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-teal/5 border border-teal/20 rounded-sm p-3">
            <div className="font-sans text-[0.5625rem] uppercase tracking-[0.08em] text-teal mb-1.5">LLM role in this task</div>
            <p className="font-sans text-[0.75rem] text-deep-blue leading-relaxed">{task.llmRole}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-sm p-3">
            <div className="font-sans text-[0.5625rem] uppercase tracking-[0.08em] text-amber-700 mb-1.5">
              ⚠ Requires human authority
            </div>
            <p className="font-sans text-[0.75rem] text-amber-800 leading-relaxed">{task.humanRequired}</p>
          </div>

          {task.notes && (
            <div>
              <div className="font-sans text-[0.5625rem] uppercase tracking-[0.08em] text-steel/70 mb-1.5">Notes</div>
              <p className="font-sans text-[0.75rem] text-steel italic leading-relaxed">{task.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Phase legend ───────────────────────────────────────────────────────────

function PhaseLegend({ phases }: { phases: Phase[] }) {
  return (
    <div className="flex flex-wrap gap-4">
      {phases.map((p) => (
        <div key={p.id} className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="font-sans text-[0.6875rem] text-steel">{p.name}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 border-t border-dashed border-coral" style={{ borderColor: "#F26B44" }} />
        <span className="font-sans text-[0.6875rem] text-coral" style={{ color: "#F26B44" }}>Today (Mar 2026)</span>
      </div>
    </div>
  );
}

// ── Main widget ────────────────────────────────────────────────────────────

type View = "prompt" | "gantt" | "kanban";

export function ImplementationPlanWidget() {
  const [view, setView] = useState<View>("gantt");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: plan, isLoading } = useQuery<Plan>({
    queryKey: ["implementation-plan"],
    queryFn: () => fetch("/data/implementation-plan.json").then((r) => r.json()),
    staleTime: Infinity,
  });

  if (isLoading || !plan) {
    return (
      <div className="my-10 border border-rule bg-white py-16 flex items-center justify-center">
        <span className="font-sans text-sm text-steel animate-pulse">Loading implementation plan…</span>
      </div>
    );
  }

  const views: { id: View; label: string; sub: string }[] = [
    { id: "prompt", label: "Prompt", sub: "What was given to Claude" },
    { id: "gantt", label: "Gantt", sub: "18 tasks · 4 phases · click any bar" },
    { id: "kanban", label: "Kanban", sub: "Tasks by status · click any card" },
  ];

  return (
    <div className="my-10 border border-rule bg-white" id="implementation-plan">
      {/* Header */}
      <div className="px-5 py-4 bg-navy border-b border-navy/20">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-sans text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/50 mb-1">
              Live demonstration · pre-generated output
            </div>
            <h3 className="font-serif text-[1.0625rem] font-semibold text-white leading-snug">
              Marshall Islands VAT Implementation Plan 2025–2027
            </h3>
            <p className="font-sans text-[0.75rem] text-white/60 mt-1">
              Output generated from IMF TA recommendations · Claude API · Illustrative data
            </p>
          </div>
          <div className="font-sans text-[0.6875rem] text-white/50 text-right hidden sm:block leading-relaxed">
            Generated from 7 IMF<br />recommendations in ~40 s.<br />
            <span className="text-white/30">Click any task for the full spec.</span>
          </div>
        </div>
      </div>

      {/* Milestone progress */}
      <div className="px-5 py-3 border-b border-rule bg-linen">
        <MilestoneProgress milestones={plan.milestones} />
      </div>

      {/* View tabs */}
      <div className="flex border-b border-rule">
        {views.map((v, i) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={cn(
              "flex-1 px-4 py-3 font-sans text-sm text-left transition-colors border-r last:border-r-0 border-rule",
              view === v.id
                ? "bg-white text-navy border-b-2 border-b-coral -mb-px"
                : "bg-linen text-steel hover:bg-white hover:text-navy"
            )}
          >
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-steel/20 flex items-center justify-center text-[0.625rem] font-bold text-steel flex-shrink-0">
                {i + 1}
              </span>
              <div>
                <div className="font-semibold">{v.label}</div>
                <div className="text-[0.6875rem] text-steel hidden sm:block">{v.sub}</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-5">

        {/* ── Prompt view ── */}
        {view === "prompt" && (
          <div>
            <p className="font-sans text-sm text-steel mb-4 leading-relaxed">
              The prompt below was given to Claude to produce the implementation plan shown in the Gantt
              and Kanban views. It includes the seven IMF recommendations, the Marshall Islands
              operational context — seven staff, manual environment, no IT system — and explicit
              instructions about which tasks require human authority. The output appeared in approximately
              40 seconds.
            </p>
            <div className="mb-5">
              <div className="font-sans text-[0.6875rem] font-semibold uppercase tracking-wide text-steel mb-2">
                Input prompt
              </div>
              <pre className="bg-navy text-off-white font-mono text-[0.75rem] leading-relaxed p-4 overflow-x-auto rounded-sm whitespace-pre-wrap">
                {PROMPT_DISPLAY}
              </pre>
            </div>
            <div className="bg-linen border border-rule p-4">
              <p className="font-sans text-[0.8125rem] text-deep-blue leading-relaxed">
                <strong className="font-semibold">What this illustrates.</strong> The prompt encodes three
                things that an off-the-shelf LLM cannot supply: knowledge of the local operating context
                (seven staff, manual environment, no ITAS), knowledge of which decisions require human
                authority (refund payments, go-live sign-off, legislative approval), and knowledge of
                what a realistic Pacific tax administration implementation actually looks like. The
                structural prompt template is reusable across administrations; the contextual content
                is specific to the Marshall Islands.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setView("gantt")}
                className="font-sans text-sm px-4 py-2 bg-deep-blue text-white rounded-sm hover:bg-navy transition-colors"
              >
                See the output →
              </button>
            </div>
          </div>
        )}

        {/* ── Gantt view ── */}
        {view === "gantt" && (
          <div>
            <div className="mb-3">
              <PhaseLegend phases={plan.phases} />
            </div>
            <GanttChart
              plan={plan}
              onSelectTask={setSelectedTask}
              selectedId={selectedTask?.id ?? null}
            />
            {selectedTask && (
              <TaskDetail
                task={selectedTask}
                plan={plan}
                onClose={() => setSelectedTask(null)}
              />
            )}
            {!selectedTask && (
              <p className="mt-3 font-sans text-[0.6875rem] text-steel italic">
                Click any task bar to see the full specification — objective, expected outputs, LLM role, and what requires human authority.
              </p>
            )}
          </div>
        )}

        {/* ── Kanban view ── */}
        {view === "kanban" && (
          <div>
            <p className="font-sans text-sm text-steel mb-4 leading-relaxed">
              Status snapshot as of March 2026. Phase 1 tasks are complete. Phase 2 is substantially
              complete, with legislation in review and training materials in progress. Phase 3 starts
              April 2026.
            </p>
            <KanbanBoard
              plan={plan}
              onSelectTask={setSelectedTask}
              selectedId={selectedTask?.id ?? null}
            />
            {selectedTask && (
              <TaskDetail
                task={selectedTask}
                plan={plan}
                onClose={() => setSelectedTask(null)}
              />
            )}
            {!selectedTask && (
              <p className="mt-4 font-sans text-[0.6875rem] text-steel italic">
                Click any card to see the full task specification.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-rule bg-linen/60">
        <p className="font-sans text-[0.6875rem] text-steel/70 leading-relaxed">
          <span className="font-semibold text-steel">Source:</span> {plan.source}.
          Plan generated illustratively using Claude API. All dates, effort estimates, and staff
          assignments are illustrative. Tasks and outputs reflect realistic Pacific tax administration
          constraints.
        </p>
      </div>
    </div>
  );
}
