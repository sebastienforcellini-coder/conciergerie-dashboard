import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Calendar from "./pages/Calendar";
import Finances from "./pages/Finances";
import Export from "./pages/Export";
import Dashboard from "./pages/Dashboard";

const ICONS = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  properties: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  finances: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  export: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
};

const NAV = [
  { to:"/",           label:"Dashboard",  icon:"dashboard",  end:true  },
  { to:"/properties", label:"Propriétés", icon:"properties", end:false },
  { to:"/calendar",   label:"Calendrier", icon:"calendar",   end:false },
  { to:"/finances",   label:"Finances",   icon:"finances",   end:false },
  { to:"/export",     label:"Export",     icon:"export",     end:false },
];

function PageWrapper({ children }) {
  const location = useLocation();
  return <div key={location.pathname} style={{ animation:"fadeIn .18s ease-out" }}>{children}</div>;
}

export default function App() {
  const [propCount, setPropCount] = useState("—");
  const [splash, setSplash]         = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    getDocs(collection(db,"properties")).then(snap => setPropCount(snap.size));
  }, []);

  if (splash) return (
    <div style={{ position:"fixed", inset:0, background:"#f5f0eb", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:9999, animation:"fadeIn .3s ease-out" }}>
      <img src="/logo.png" alt="You First. Everything, handled." style={{ width:"min(400px, 80vw)", opacity:1 }}/>
    </div>
  );

  return (
    <div className="app-layout">
      <nav className="app-sidebar">
        <div className="sidebar-logo" style={{ padding:"20px 16px 24px", borderBottom:"1px solid #ffffff0e" }}>
          <img src="/logo.png" alt="You First. Everything, handled." style={{ width:"100%", maxWidth:160, filter:"brightness(0) invert(1)", opacity:.92, display:"block" }}/>
        </div>

        <div style={{ flex:1, padding:"8px 8px" }}>
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="nav-item"
              style={({ isActive }) => ({
                display:"flex", alignItems:"center", gap:10,
                padding:"10px 12px", borderRadius:8, marginBottom:2,
                color: isActive ? "#f0c040" : "#ffffff70",
                textDecoration:"none", fontSize:13,
                fontWeight: isActive ? 500 : 400,
                background: isActive ? "#ffffff12" : "transparent",
                transition:"background .15s, color .15s",
              })}>
              {ICONS[icon]}
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-bottom" style={{ height:1, background:"#ffffff0e", margin:"0 16px" }}/>
        <div className="sidebar-bottom" style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:"50%", background:"#ffffff14", border:"1px solid #ffffff20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, color:"#ffffff80" }}>
            {propCount}
          </div>
          <div style={{ fontSize:11, color:"#ffffff40", lineHeight:1.4 }}>
            bien{propCount!==1?"s":""}<br/><span style={{ color:"#ffffff25" }}>sous gestion</span>
          </div>
        </div>
      </nav>

      <main className="app-main">
        <PageWrapper>
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/properties"  element={<Properties />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/calendar"    element={<Calendar />} />
            <Route path="/finances"    element={<Finances />} />
            <Route path="/export"      element={<Export />} />
          </Routes>
        </PageWrapper>
      </main>

      <nav className="bottom-nav">
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) => `bottom-nav-item${isActive ? " active" : ""}`}>
            {ICONS[icon]}
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
