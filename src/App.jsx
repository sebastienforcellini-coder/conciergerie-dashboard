import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Calendar from "./pages/Calendar";
import Finances from "./pages/Finances";
import Export from "./pages/Export";
import Dashboard from "./pages/Dashboard";

const NAV = [
  { to: "/", label: "Dashboard", icon: "◈" },
  { to: "/properties", label: "Propriétés", icon: "⌂" },
  { to: "/calendar", label: "Calendrier", icon: "▦" },
  { to: "/finances", label: "Finances", icon: "◎" },
  { to: "/export", label: "Export", icon: "↓" },
];

export default function App() {
  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <nav style={{
        width: 220, background: "#1a1a2e", color: "white",
        display: "flex", flexDirection: "column", padding: "0",
        flexShrink: 0,
      }}>
        <div style={{ padding: "24px 24px 20px", borderBottom: "1px solid #ffffff12" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "white", marginBottom: 2 }}>Conciergerie</div>
          <div style={{ fontSize: 11, color: "#ffffff55" }}>40 biens · Marrakech</div>
        </div>
        <div style={{ flex: 1, padding: "12px 0" }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === "/"} style={({ isActive }) => ({
              padding: "10px 24px",
              color: isActive ? "#f0c040" : "#ffffff99",
              textDecoration: "none",
              background: isActive ? "#ffffff12" : "transparent",
              borderLeft: isActive ? "3px solid #f0c040" : "3px solid transparent",
              display: "flex", alignItems: "center", gap: 10,
              fontSize: 14, transition: "all .15s",
            })}>
              <span style={{ fontSize: 14, opacity: .8 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #ffffff12", fontSize: 11, color: "#ffffff33" }}>
          v1.0 — conciergerie-dashboard
        </div>
      </nav>

      <main style={{ flex: 1, overflow: "auto", background: "#f7f7f8" }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/property/:id" element={<PropertyDetail />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/export" element={<Export />} />
        </Routes>
      </main>
    </div>
  );
}
