import { useEffect, useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

const PLT_COLORS = {
  Airbnb:              { bg:"#FAECE7", border:"#F5C4B3", text:"#712B13", dot:"#D85A30" },
  Booking:             { bg:"#E6F1FB", border:"#B5D4F4", text:"#0C447C", dot:"#378ADD" },
  Direct:              { bg:"#EAF3DE", border:"#C0DD97", text:"#27500A", dot:"#639922" },
  "Gens de confiance": { bg:"#EEEDFE", border:"#CECBF6", text:"#3C3489", dot:"#7F77DD" },
  Perso:               { bg:"#F1EFE8", border:"#D3D1C7", text:"#444441", dot:"#888780" },
  Autre:               { bg:"#F1EFE8", border:"#D3D1C7", text:"#5F5E5A", dot:"#888780" },
};

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n) { return String(n).padStart(2, "0"); }
function dateStr(year, month, day) { return `${year}-${pad(month+1)}-${pad(day)}`; }

function getBookingsForProp(propId, bookings, year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const monthStart  = dateStr(year, month, 1);
  const monthEnd    = dateStr(year, month, daysInMonth);
  return bookings.filter(b =>
    b.propertyId === propId &&
    b.checkIn  <= monthEnd &&
    b.checkOut >  monthStart
  );
}

function getSegments(booking, year, month) {
  const daysInMonth = getDaysInMonth(year, month);
  const startDay = Math.max(1, (() => {
    const ci = new Date(booking.checkIn);
    if (ci.getFullYear() === year && ci.getMonth() === month) return ci.getDate();
    return 1;
  })());
  const endDay = Math.min(daysInMonth, (() => {
    const co = new Date(booking.checkOut);
    if (co.getFullYear() === year && co.getMonth() === month) return co.getDate() - 1;
    return daysInMonth;
  })());
  return { startDay, endDay };
}

const COL_W = 32;
const ROW_H = 44;
const LABEL_W = 180;

export default function Calendar() {
  const [properties, setProperties] = useState([]);
  const [bookings,   setBookings]   = useState([]);
  const [month,  setMonth]  = useState(new Date().getMonth());
  const [year,   setYear]   = useState(new Date().getFullYear());
  const [tooltip, setTooltip] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, "properties")),
      getDocs(collection(db, "bookings")),
    ]).then(([pSnap, bSnap]) => {
      setProperties(pSnap.docs.map(d => ({id:d.id,...d.data()})));
      setBookings(bSnap.docs.map(d => ({id:d.id,...d.data()})));
    });
  }, []);

  const prev = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const next = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const days = getDaysInMonth(year, month);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

  const totalW = LABEL_W + days * COL_W;

  return (
    <div style={{ padding:"24px 28px" }}>
      <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:600, color:"#1a1a2e", margin:0 }}>Calendrier</h1>
        <div style={{ display:"flex", alignItems:"center", gap:8, background:"white", border:"1px solid #e5e7eb", borderRadius:10, padding:"6px 4px", boxShadow:"0 1px 3px rgba(0,0,0,.05)" }}>
          <button onClick={prev} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 10px", borderRadius:7, color:"#6b7280", fontSize:18, lineHeight:1 }}>‹</button>
          <span style={{ fontWeight:600, fontSize:15, color:"#1a1a2e", minWidth:140, textAlign:"center" }}>{MONTHS[month]} {year}</span>
          <button onClick={next} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px 10px", borderRadius:7, color:"#6b7280", fontSize:18, lineHeight:1 }}>›</button>
        </div>
        <div style={{ display:"flex", gap:14, marginLeft:8 }}>
          {Object.entries(PLT_COLORS).filter(([k])=>k!=="Autre"&&k!=="Perso").map(([platform,c]) => (
            <span key={platform} style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"#6b7280" }}>
              <span style={{ width:10, height:10, borderRadius:2, background:c.bg, border:`1.5px solid ${c.dot}`, display:"inline-block" }}/>
              {platform}
            </span>
          ))}
        </div>
      </div>

      {properties.length === 0 ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af", background:"white", borderRadius:14, border:"1px dashed #e5e7eb" }}>
          Aucune propriété — ajoutez-en une dans l'onglet Propriétés.
        </div>
      ) : (
        <div style={{ background:"white", borderRadius:14, border:"1px solid #f0f0f0", boxShadow:"0 1px 4px rgba(0,0,0,.05)", overflow:"hidden" }}>
          <div ref={containerRef} style={{ overflowX:"auto" }}>
            <div style={{ minWidth: totalW + "px" }}>

              <div style={{ display:"flex", borderBottom:"1px solid #f0f0f0", position:"sticky", top:0, background:"white", zIndex:10 }}>
                <div style={{ width:LABEL_W, flexShrink:0, padding:"10px 16px", fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".4px", borderRight:"1px solid #f0f0f0" }}>
                  Propriété
                </div>
                {Array.from({length:days},(_,i)=>i+1).map(d => {
                  const ds = dateStr(year,month,d);
                  const isToday = ds===todayStr;
                  const dow = new Date(year,month,d).getDay();
                  const isWE = dow===0||dow===6;
                  return (
                    <div key={d} style={{ width:COL_W, flexShrink:0, textAlign:"center", padding:"6px 0", borderRight:"1px solid #f7f7f7", background:isToday?"#1a1a2e":isWE?"#fafafa":"white" }}>
                      <div style={{ fontSize:10, color:isToday?"#f0c040":isWE?"#9ca3af":"#c0c0c0", fontWeight:isToday?700:400 }}>
                        {["D","L","M","M","J","V","S"][dow]}
                      </div>
                      <div style={{ fontSize:12, fontWeight:isToday?700:400, color:isToday?"#f0c040":isWE?"#6b7280":"#374151" }}>
                        {d}
                      </div>
                    </div>
                  );
                })}
              </div>

              {properties.map((p, pi) => {
                const propBookings = getBookingsForProp(p.id, bookings, year, month);
                const isEven = pi%2===0;
                return (
                  <div key={p.id} style={{ display:"flex", borderBottom:"1px solid #f7f7f7", background:isEven?"white":"#fafafa", position:"relative", height:ROW_H+"px" }}>
                    <div style={{ width:LABEL_W, flexShrink:0, padding:"0 16px", borderRight:"1px solid #f0f0f0", display:"flex", flexDirection:"column", justifyContent:"center", position:"sticky", left:0, background:isEven?"white":"#fafafa", zIndex:5 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:"#1a1a2e", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{p.owner}</div>
                    </div>

                    <div style={{ flex:1, position:"relative" }}>
                      {Array.from({length:days},(_,i)=>i+1).map(d => {
                        const ds = dateStr(year,month,d);
                        const isToday = ds===todayStr;
                        const dow = new Date(year,month,d).getDay();
                        const isWE = dow===0||dow===6;
                        return (
                          <div key={d} style={{ position:"absolute", left:(d-1)*COL_W+"px", top:0, width:COL_W+"px", height:"100%", borderRight:"1px solid #f7f7f7", background:isToday?"rgba(26,26,46,.04)":isWE?"rgba(0,0,0,.015)":"transparent" }}/>
                        );
                      })}

                      {propBookings.map(b => {
                        const { startDay, endDay } = getSegments(b, year, month);
                        if (endDay < startDay) return null;
                        const plt = PLT_COLORS[b.platform] || PLT_COLORS["Autre"];
                        const barW = (endDay - startDay + 1) * COL_W - 4;
                        const barL = (startDay - 1) * COL_W + 2;
                        return (
                          <div key={b.id}
                            onMouseEnter={e => setTooltip({ booking:b, x:e.clientX, y:e.clientY })}
                            onMouseLeave={() => setTooltip(null)}
                            style={{
                              position:"absolute",
                              left:barL+"px",
                              top:"6px",
                              width:barW+"px",
                              height:(ROW_H-12)+"px",
                              background:plt.bg,
                              border:`1.5px solid ${plt.dot}40`,
                              borderRadius:6,
                              display:"flex",
                              alignItems:"center",
                              paddingLeft:8,
                              overflow:"hidden",
                              cursor:"default",
                              zIndex:3,
                              borderLeft:`3px solid ${plt.dot}`,
                            }}>
                            <div style={{ display:"flex", alignItems:"center", gap:5, minWidth:0 }}>
                              <span style={{ fontSize:11, fontWeight:600, color:plt.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                                {b.name||"—"}
                              </span>
                              {b.guests && barW > 80 && (
                                <span style={{ fontSize:10, color:plt.text+"99", flexShrink:0 }}>· {b.guests} pers.</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tooltip && (
        <div style={{
          position:"fixed",
          left: Math.min(tooltip.x+12, window.innerWidth-240)+"px",
          top: (tooltip.y-10)+"px",
          background:"#1a1a2e",
          color:"white",
          padding:"10px 14px",
          borderRadius:10,
          fontSize:12,
          zIndex:1000,
          pointerEvents:"none",
          boxShadow:"0 8px 24px rgba(0,0,0,.2)",
          minWidth:180,
        }}>
          <div style={{ fontWeight:600, marginBottom:4 }}>{tooltip.booking.name||"—"}</div>
          <div style={{ color:"#ffffff80", marginBottom:2 }}>{tooltip.booking.platform}</div>
          <div style={{ color:"#ffffff80", marginBottom:2 }}>{tooltip.booking.checkIn} → {tooltip.booking.checkOut}</div>
          <div style={{ color:"#ffffff80", marginBottom:2 }}>{tooltip.booking.nights||"?"} nuits · {tooltip.booking.guests||"?"} pers.</div>
          <div style={{ color:"#f0c040", fontWeight:600, marginTop:6 }}>{Math.round(tooltip.booking.amount||0).toLocaleString("fr-FR")} MAD</div>
        </div>
      )}
    </div>
  );
}
