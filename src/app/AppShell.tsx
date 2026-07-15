import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Sun,
  LayoutList,
  Target,
  NotebookPen,
  MessageCircle,
  Plus,
  ScanLine,
  BadgeDollarSign,
  ReceiptText,
  PenLine,
  X,
} from "lucide-react";
import { KovaWordmark } from "@/components/KovaMark";
import "./AppShell.css";

const TABS = [
  { to: "/today", label: "Today", icon: Sun },
  { to: "/plan", label: "Plan", icon: LayoutList },
  { to: "/goals", label: "Goals", icon: Target },
  { to: "/space", label: "Space", icon: NotebookPen },
  { to: "/chat", label: "Chat", icon: MessageCircle },
] as const;

const FAB_ACTIONS = [
  { label: "Scan paycheck", icon: ScanLine, to: "/scan" },
  { label: "Add income", icon: BadgeDollarSign, to: "/scan?mode=manual" },
  { label: "Add expense", icon: ReceiptText, to: "/today?add=expense" },
  { label: "Quick note", icon: PenLine, to: "/space?capture=1" },
] as const;

export function AppShell() {
  const [fabOpen, setFabOpen] = useState(false);
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  return (
    <div className="kv-shell">
      <nav className="kv-sidenav" aria-label="Primary">
        <div className="kv-sidenav__brand">
          <KovaWordmark />
        </div>
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="kv-sidenav__link">
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
        <div className="kv-sidenav__spacer" />
        <div className="kv-sidenav__actions">
          {FAB_ACTIONS.map(({ label, icon: Icon, to }) => (
            <button key={label} className="kv-btn kv-btn--secondary kv-btn--sm" onClick={() => navigate(to)}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="kv-shell__content" id="main">
        <Outlet />
      </main>

      <AnimatePresence>
        {fabOpen && (
          <>
            <motion.button
              className="kv-fab__backdrop"
              aria-label="Close quick actions"
              onClick={() => setFabOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.16 }}
            />
            <motion.div
              className="kv-fab__menu"
              role="menu"
              aria-label="Quick actions"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0.28, 1] }}
            >
              {FAB_ACTIONS.map(({ label, icon: Icon, to }) => (
                <button
                  key={label}
                  role="menuitem"
                  className="kv-fab__action"
                  onClick={() => {
                    setFabOpen(false);
                    navigate(to);
                  }}
                >
                  <Icon size={16} aria-hidden="true" />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="kv-tabbar" aria-label="Primary">
        {TABS.slice(0, 2).map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
        <button
          className="kv-tabbar__fab"
          aria-label={fabOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={fabOpen}
          onClick={() => setFabOpen((v) => !v)}
        >
          {fabOpen ? <X size={22} aria-hidden="true" /> : <Plus size={22} aria-hidden="true" />}
        </button>
        {TABS.slice(2, 4).map((tab) => (
          <TabLink key={tab.to} {...tab} />
        ))}
        <TabLink {...TABS[4]} />
      </nav>
    </div>
  );
}

function TabLink({ to, label, icon: Icon }: (typeof TABS)[number]) {
  return (
    <NavLink to={to} className="kv-tabbar__tab">
      <Icon size={20} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  );
}
