import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { calcCommission } from "./Properties";

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const DAYS   = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];

function fmt(n) { return Math.round(n).toLocaleString("fr-FR"); }
function getToday() { return new Date().toISOString().split("T")[0]; }
function isOccupied(propId, bookings, date) {
  return bookings.find(b => b.propertyId === propId && b.checkIn <= date && b.checkOut > date);
}
function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const PLT = {
  Airbnb:              { bg: "#FAECE7", color: "#993C1D" },
  Booking:             { bg: "#E6F1FB", color: "#0C447C" },
  Direct:              { bg: "#EAF3DE", color: "#27500A" },
  "Gens de confiance": { bg: "#EEEDFE", color: "#3C3489" },
  Perso:               { bg: "#F1EFE8", color: "#5F5E5A" },
  Autre:               { bg: "#F1EFE8", color: "#5F5E5A" },
};

const IC = {
  home: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>,
  euro: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  alert: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
};

function KpiCard({ label, value, sub, icon, accent, trend }) {
  return (
    <div style={{ background:"#fff", borderRadius:14, padding:"18px 20px", boxShadow:"0 1px 4px rgba(0,0,0,.06)", border:"1px solid #f0f0f0", display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div style={{ fontSize:11, color:"#9ca3af", fontWeight:500, textTransform:"uppercase", letterSpacing:".4px" }}>{label}</div>
        <div style={{ width:36, height:36, borderRadius:10, background:accent+"18", display:"flex", alignItems:"center", justifyContent:"center", color:accent }}>{icon}</div>
      </div>
      <div>
        <div style={{ fontSize:26, fontWeight:600, color:"#1a1a2e", lineHeight:1, letterSpacing:"-.5px" }}>{value}</div>
        {sub && <div style={{ fontSize:12, marginTop:6, color: trend==="up" ? "#0F6E56" : trend==="warn" ? "#854F0B" : "#9ca3af" }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const today    = getToday();
  const week     = getNext7Days();
  const now      = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthLbl = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "properties")),
      getDocs(collection(db, "bookings")),
    ]).then(([pSnap, bSnap]) => {
      setProperties(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBookings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const checkinsToday   = bookings.filter(b => b.checkIn === today);
  const checkoutsToday  = bookings.filter(b => b.checkOut === today);
  const occupiedTonight = properties.filter(p => isOccupied(p.id, bookings, today));
  const unpaid          = bookings.filter(b => !b.paid && b.checkOut < today);
  const noFutureResa    = properties.filter(p => !bookings.find(b => b.propertyId === p.id && b.checkIn > today));

  const monthBookings   = bookings.filter(b => b.checkIn?.startsWith(monthStr));
  const totalRevenue    = monthBookings.reduce((s,b) => s + (b.amount||0), 0);
  const totalCommission = monthBookings.reduce((s,b) => {
    const prop = properties.find(p => p.id === b.propertyId);
    return prop ? s + calcCommission(b,prop).commission : s;
  }, 0);

  const propRanked = properties.map(p => {
    const pb  = monthBookings.filter(b => b.propertyId === p.id);
    const rev = pb.reduce((s,b) => s + (b.amount||0), 0);
    const com = pb.reduce((s,b) => s + calcCommission(b,p).commission, 0);
    return { ...p, rev, com, count: pb.length };
  }).sort((a,b) => b.rev - a.rev);

  const getPropForBooking = b => properties.find(p => p.id === b.propertyId);
  const getPropStatus = p => {
    const occ = isOccupied(p.id, bookings, today);
    if (!occ) return "free";
    if (occ.platform === "Perso" || occ.amount === 0) return "perso";
    return "busy";
  };
  const shortName = name => name.length > 10 ? name.substring(0,9)+"…" : name;
  const occCell = s => ({ busy:{bg:"#E1F5EE",color:"#085041",border:"#9FE1CB"}, perso:{bg:"#EEEDFE",color:"#3C3489",border:"#CECBF6"}, free:{bg:"#f5f5f5",color:"#c0c0c0",border:"#e8e8e8"} }[s] || {bg:"#f5f5f5",color:"#c0c0c0",border:"#e8e8e8"});
  const greet = now.getHours()<12?"Bonjour":now.getHours()<18?"Bon après-midi":"Bonsoir";

  const card = { background:"#fff", border:"1px solid #f0f0f0", borderRadius:14, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" };
  const cardHd = { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", marginBottom:14 };
  const brow = { display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f7f7f7" };

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"#9ca3af" }}>Chargement...</div>;

  return (
    <div style={{ padding:"24px 28px", minHeight:"100vh" }}>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:600, color:"#1a1a2e", marginBottom:3 }}>{greet} !</h1>
          <div style={{ fontSize:13, color:"#9ca3af" }}>{DAYS[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()} · {properties.length} biens sous gestion</div>
        </div>
        {checkinsToday.length > 0 && (
          <div style={{ background:"#E1F5EE", color:"#085041", fontSize:13, fontWeight:500, padding:"8px 16px", borderRadius:99, border:"1px solid #9FE1CB" }}>
            {checkinsToday.length} check-in{checkinsToday.length>1?"s":""} aujourd'hui
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:12, marginBottom:20 }}>
        <KpiCard label="Biens occupés ce soir" value={`${occupiedTonight.length} / ${properties.length}`} sub={`Taux ${properties.length>0?Math.round(occupiedTonight.length/properties.length*100):0}%`} icon={IC.home} accent="#1D9E75" trend={occupiedTonight.length>properties.length/2?"up":"neu"} />
        <KpiCard label={`Commissions ${monthLbl}`} value={`${fmt(totalCommission)} MAD`} sub={`sur ${fmt(totalRevenue)} MAD bruts`} icon={IC.euro} accent="#f0c040" trend="up" />
        <KpiCard label="Encaissements en attente" value={unpaid.length} sub={unpaid.length>0?`${unpaid.length} résa non payée${unpaid.length>1?"s":""}` : "Tout est encaissé"} icon={IC.alert} accent={unpaid.length>0?"#E24B4A":"#1D9E75"} trend={unpaid.length>0?"warn":"up"} />
        <KpiCard label="Biens sans résa à venir" value={noFutureResa.length} sub={noFutureResa.length>0?"à relancer":"Tous les biens ont une résa"} icon={IC.search} accent={noFutureResa.length>0?"#EF9F27":"#1D9E75"} trend={noFutureResa.length>0?"warn":"up"} />
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:14 }}>

        <div style={card}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px" }}>Mouvements du jour</div>
            <div style={{ display:"flex", gap:8 }}>
              <span style={{ background:"#E1F5EE", color:"#085041", fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:99 }}>
                {checkinsToday.length} arrivée{checkinsToday.length!==1?"s":""}
              </span>
              <span style={{ background:"#F1EFE8", color:"#5F5E5A", fontSize:11, fontWeight:500, padding:"3px 10px", borderRadius:99 }}>
                {checkoutsToday.length} départ{checkoutsToday.length!==1?"s":""}
              </span>
            </div>
          </div>

          {checkinsToday.length===0 && checkoutsToday.length===0 && (
            <div style={{ fontSize:13, color:"#c0c0c0", padding:"16px 0", textAlign:"center" }}>Aucun mouvement aujourd'hui</div>
          )}

          {checkinsToday.length>0 && (
            <div style={{ marginBottom:checkoutsToday.length>0?16:0 }}>
              <div style={{ fontSize:11, color:"#0F6E56", fontWeight:600, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#1D9E75" }}/>
                ARRIVÉES
              </div>
              {checkinsToday.map(b => {
                const prop = getPropForBooking(b);
                const plt  = PLT[b.platform]||PLT["Autre"];
                const totalGuests = Number(b.guests)||0;
                return (
                  <div key={b.id} style={{ ...brow, alignItems:"flex-start" }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:plt.bg, color:plt.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0, marginTop:2 }}>
                      {(b.name||"?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{b.name||"—"}</div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{prop?.name||"—"} · {b.nights||"?"} nuit{(b.nights||0)>1?"s":""}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:4, background:"#1a1a2e", color:"white", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:99 }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                          {totalGuests > 0 ? `${totalGuests} pers.` : "? pers."}
                        </div>
                        <div style={{ fontSize:10, background:plt.bg, color:plt.color, padding:"2px 8px", borderRadius:99, fontWeight:500 }}>{b.platform}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#1a1a2e" }}>{fmt(b.amount||0)} MAD</div>
                      <div style={{ fontSize:11, color:b.paid?"#0F6E56":"#A32D2D", marginTop:2, fontWeight:500 }}>{b.paid?"Encaissé":"Non payé"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {checkoutsToday.length>0 && (
            <div style={{ paddingTop:checkinsToday.length>0?14:0, borderTop:checkinsToday.length>0?"1px solid #f5f5f5":"none" }}>
              <div style={{ fontSize:11, color:"#5F5E5A", fontWeight:600, marginBottom:8, display:"flex", alignItems:"center", gap:6 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#888780" }}/>
                DÉPARTS
              </div>
              {checkoutsToday.map(b => {
                const prop = getPropForBooking(b);
                const plt  = PLT[b.platform]||PLT["Autre"];
                const totalGuests = Number(b.guests)||0;
                return (
                  <div key={b.id} style={{ ...brow, alignItems:"flex-start" }}>
                    <div style={{ width:34, height:34, borderRadius:"50%", background:"#f5f5f5", color:"#888", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, flexShrink:0, marginTop:2 }}>
                      {(b.name||"?")[0].toUpperCase()}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{b.name||"—"}</div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{prop?.name||"—"}</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:4, background:"#f5f5f5", color:"#6b7280", fontSize:11, fontWeight:600, padding:"2px 8px", borderRadius:99, border:"1px solid #e5e7eb" }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                          {totalGuests > 0 ? `${totalGuests} pers.` : "? pers."}
                        </div>
                        <div style={{ fontSize:10, background:plt.bg, color:plt.color, padding:"2px 8px", borderRadius:99, fontWeight:500 }}>{b.platform}</div>
                      </div>
                    </div>
                    <div style={{ textAlign:"right", flexShrink:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:b.paid?"#0F6E56":"#A32D2D" }}>{b.paid?"Encaissé":"Non payé"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={card}>
          <div style={cardHd}>Occupation — 7 jours</div>
          <div style={{ display:"flex", gap:3, marginBottom:8 }}>
            {week.map(d => <div key={d} style={{ flex:1, textAlign:"center", fontSize:10, color:d===today?"#1a1a2e":"#c0c0c0", fontWeight:d===today?700:400 }}>{DAYS[new Date(d).getDay()]}<br/>{new Date(d).getDate()}</div>)}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
            {properties.slice(0,14).map(p => (
              <div key={p.id} style={{ display:"flex", gap:3 }}>
                {week.map(d => {
                  const occ = isOccupied(p.id, bookings, d);
                  const isP = occ && (occ.platform==="Perso"||occ.amount===0);
                  return <div key={d} title={occ?`${p.name} — ${occ.name}`:p.name+" — libre"} style={{ flex:1, height:16, borderRadius:3, background:!occ?"#f0f0f0":isP?"#AFA9EC":"#5DCAA5" }} />;
                })}
              </div>
            ))}
          </div>
          {properties.length>14 && <div style={{ fontSize:11, color:"#c0c0c0", marginTop:8 }}>+ {properties.length-14} autres → voir Calendrier</div>}
          <div style={{ display:"flex", gap:14, marginTop:12 }}>
            {[["#5DCAA5","Occupé"],["#AFA9EC","Perso"],["#f0f0f0","Libre"]].map(([bg,lbl]) => (
              <span key={lbl} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#9ca3af" }}>
                <span style={{ width:10, height:10, borderRadius:2, background:bg, display:"inline-block", border:"1px solid #e0e0e0" }}/>{lbl}
              </span>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={cardHd}>Alertes</div>
          {[
            { dot:unpaid.length>0?"#E24B4A":"#1D9E75", label:"Encaissements en attente", val:`${unpaid.length} résa` },
            { dot:noFutureResa.length>0?"#EF9F27":"#1D9E75", label:"Biens sans résa future", val:`${noFutureResa.length} biens` },
            { dot:"#378ADD", label:"Réservations ce mois", val:`${monthBookings.length}` },
          ].map(a => (
            <div key={a.label} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #f7f7f7" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:a.dot, flexShrink:0 }}/>
              <div style={{ flex:1, fontSize:13, color:"#374151" }}>{a.label}</div>
              <div style={{ fontSize:13, fontWeight:500, color:"#1a1a2e" }}>{a.val}</div>
            </div>
          ))}

          <div style={{ ...cardHd, marginTop:18, paddingTop:14, borderTop:"1px solid #f5f5f5" }}>Top biens — {monthLbl}</div>
          {propRanked.length===0 && <div style={{ fontSize:13, color:"#c0c0c0", textAlign:"center", padding:"12px 0" }}>Aucune réservation ce mois</div>}
          {propRanked.slice(0,5).map((p,i) => {
            const maxRev = propRanked[0]?.rev||1;
            const medals = ["#BA7517","#888780","#993C1D"];
            return (
              <div key={p.id} onClick={() => navigate(`/property/${p.id}`)}
                style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid #f7f7f7", cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.opacity=".7"}
                onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                <div style={{ width:18, fontSize:12, fontWeight:700, color:medals[i]||"#d1d5db", textAlign:"center" }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"#1a1a2e", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                  <div style={{ height:4, borderRadius:2, background:"#f0f0f0", marginTop:4 }}>
                    <div style={{ height:"100%", borderRadius:2, background:"#1D9E75", width:Math.round(p.rev/maxRev*100)+"%" }}/>
                  </div>
                </div>
                <div style={{ textAlign:"right", minWidth:80 }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{fmt(p.rev)} MAD</div>
                  <div style={{ fontSize:11, color:"#f0a500" }}>+{fmt(p.com)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ ...card }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ ...cardHd, marginBottom:0 }}>Vue globale — {properties.length} biens ce soir</div>
          <div style={{ display:"flex", gap:14 }}>
            {[["#5DCAA5","#E1F5EE","Occupé"],["#AFA9EC","#EEEDFE","Perso"],["#c0c0c0","#f5f5f5","Libre"]].map(([color,bg,lbl]) => (
              <span key={lbl} style={{ display:"flex", alignItems:"center", gap:4, fontSize:11, color:"#9ca3af" }}>
                <span style={{ width:10, height:10, borderRadius:2, background:bg, border:`1px solid ${color}60`, display:"inline-block" }}/>{lbl}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(76px,1fr))", gap:5 }}>
          {properties.map(p => {
            const status = getPropStatus(p);
            const c = occCell(status);
            return (
              <div key={p.id} onClick={() => navigate(`/property/${p.id}`)}
                title={`${p.name} — ${p.owner}`}
                style={{ height:34, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:600, cursor:"pointer", background:c.bg, color:c.color, border:`1px solid ${c.border}`, transition:"transform .12s", overflow:"hidden", whiteSpace:"nowrap" }}
                onMouseEnter={e => e.currentTarget.style.transform="scale(1.05)"}
                onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
                {shortName(p.name)}
              </div>
            );
          })}
          {properties.length===0 && <div style={{ gridColumn:"1/-1", textAlign:"center", padding:32, color:"#c0c0c0", fontSize:13 }}>Aucune propriété — commencez par en ajouter une.</div>}
        </div>
      </div>
    </div>
  );
}
