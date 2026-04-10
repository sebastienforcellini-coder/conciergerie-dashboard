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
import Collaborateurs from "./pages/Collaborateurs";

const ICONS = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  properties: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  finances: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  export: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  team: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
};

const NAV = [
  { to:"/",           label:"Dashboard",  icon:"dashboard",  end:true  },
  { to:"/properties", label:"Propriétés", icon:"properties", end:false },
  { to:"/calendar",   label:"Calendrier", icon:"calendar",   end:false },
  { to:"/finances",   label:"Finances",   icon:"finances",   end:false },
  { to:"/export",     label:"Export",     icon:"export",     end:false },
  { to:"/team",       label:"Équipe",     icon:"team",       end:false },
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
    <div style={{ position:"fixed", inset:0, background:"#f5f0eb", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
      <div translate="no" className="notranslate" style={{ width:"min(320px,80vw)", height:"min(320px,80vw)", borderRadius:"50%", background:"transparent", border:"2px solid #1a1a2e", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10 }}>
        <div style={{ fontFamily:"Georgia,'Times New Roman',serif", fontSize:"clamp(20px,5vw,32px)", fontWeight:400, color:"#1a1a2e", letterSpacing:"3px", lineHeight:1 }}>YOU FIRST.</div>
        <div style={{ width:"45%", height:1, background:"#1a1a2e", opacity:.25 }}/>
        <div style={{ fontFamily:"Georgia,'Times New Roman',serif", fontSize:"clamp(10px,2.5vw,14px)", color:"#1a1a2e", letterSpacing:"1.5px", opacity:.5 }}>Everything, handled.</div>
      </div>
    </div>
  );

  return (
    <div className="app-layout">
      <nav className="app-sidebar">
        <div className="sidebar-logo" style={{ padding:"20px 16px 16px", borderBottom:"1px solid #ffffff0e", display:"flex", justifyContent:"center" }}>
          <div translate="no" className="notranslate" style={{ width:130, height:130, borderRadius:"50%", background:"#f5f0eb", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:5, flexShrink:0 }}>
            <div style={{ fontFamily:"Georgia,'Times New Roman',serif", fontSize:16, fontWeight:400, color:"#1a1a2e", letterSpacing:"2px", lineHeight:1 }}>YOU FIRST.</div>
            <div style={{ width:60, height:1, background:"#1a1a2e", opacity:.25 }}/>
            <div style={{ fontFamily:"Georgia,'Times New Roman',serif", fontSize:8, color:"#1a1a2e", letterSpacing:"1px", opacity:.5 }}>Everything, handled.</div>
          </div>
        </div>

        <div style={{ flex:1, padding:"8px 8px" }}>
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className="nav-item"
              style={({ isActive }) => ({
                display:"flex", alignItems:"center", gap:10,
                padding:"11px 14px", borderRadius:8, marginBottom:2,
                color: isActive ? "#f0c040" : "#ffffffcc",
                textDecoration:"none", fontSize:14,
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
        <div className="mobile-header" style={{ display:"none" }}>
          <div translate="no" className="notranslate" style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Georgia,'Times New Roman',serif", fontSize:16, fontWeight:400, color:"white", letterSpacing:"3px", opacity:.95 }}>YOU FIRST.</div>
            <div style={{ fontFamily:"Georgia,'Times New Roman',serif", fontSize:9, color:"white", letterSpacing:"1.5px", opacity:.5, marginTop:2 }}>Everything, handled.</div>
          </div>
        </div>
        <PageWrapper>
          <Routes>
            <Route path="/"            element={<Dashboard />} />
            <Route path="/properties"  element={<Properties />} />
            <Route path="/property/:id" element={<PropertyDetail />} />
            <Route path="/calendar"    element={<Calendar />} />
            <Route path="/finances"    element={<Finances />} />
            <Route path="/export"      element={<Export />} />
            <Route path="/team"        element={<Collaborateurs />} />
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
