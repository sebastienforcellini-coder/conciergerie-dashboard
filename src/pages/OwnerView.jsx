import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { calcCommission, commissionLabel } from "./Properties";

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const PLT = {
  Airbnb:              { bg:"#FAECE7", color:"#993C1D" },
  Booking:             { bg:"#E6F1FB", color:"#0C447C" },
  Direct:              { bg:"#EAF3DE", color:"#27500A" },
  "Gens de confiance": { bg:"#EEEDFE", color:"#3C3489" },
  Autre:               { bg:"#F1EFE8", color:"#5F5E5A" },
};

function fmt(n) { return Math.round(n).toLocaleString("fr-FR"); }
function fmtDate(d) { if(!d) return "—"; const [y,m,j]=d.split("-"); return `${j}/${m}/${y}`; }
function nights(a,b) { if(!a||!b) return 0; return Math.max(0,Math.round((new Date(b)-new Date(a))/86400000)); }

export default function OwnerView() {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [depenses, setDepenses] = useState([]);
  const [year, setYear]         = useState(new Date().getFullYear());
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [pSnap, bSnap, dSnap] = await Promise.all([
          getDocs(collection(db,"properties")),
          getDocs(query(collection(db,"bookings"), where("propertyId","==",propertyId))),
          getDocs(query(collection(db,"depenses"), where("propertyId","==",propertyId))),
        ]);
        const props = pSnap.docs.map(d => ({id:d.id,...d.data()}));
        const prop  = props.find(p => p.id===propertyId);
        if (!prop) { setNotFound(true); setLoading(false); return; }
        setProperty(prop);
        setBookings(bSnap.docs.map(d => ({id:d.id,...d.data()})));
        setDepenses(dSnap.docs.map(d => ({id:d.id,...d.data()})));
        setLoading(false);
      } catch(e) {
        setNotFound(true); setLoading(false);
      }
    };
    load();
  }, [propertyId]);

  const yearBookings = bookings.filter(b => b.checkIn?.startsWith(String(year)) && b.amount > 0);
  const yearDepenses = depenses.filter(d => d.date?.startsWith(String(year)));

  const totals = yearBookings.reduce((acc,b) => {
    const { platformFee, commission, reversement } = calcCommission(b, property||{});
    return {
      revenue:    acc.revenue    + (b.amount||0),
      platformFee:acc.platformFee+ platformFee,
      commission: acc.commission + commission,
      reversement:acc.reversement+ reversement,
      nights:     acc.nights     + (b.nights||nights(b.checkIn,b.checkOut)),
    };
  }, { revenue:0, platformFee:0, commission:0, reversement:0, nights:0 });

  const totalDep = yearDepenses.reduce((s,d) => s+(d.montant||0), 0);
  const reversementNet = totals.reversement - totalDep;

  const monthlyRev = MONTHS.map((_,mi) => {
    const mb = yearBookings.filter(b => b.checkIn?.startsWith(`${year}-${String(mi+1).padStart(2,"0")}`));
    return mb.reduce((s,b) => s+(b.amount||0), 0);
  });
  const maxMonth = Math.max(...monthlyRev, 1);

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f5f0eb", gap:24 }}>
      <div translate="no" style={{ width:120, height:120, borderRadius:"50%", border:"2px solid #1a1a2e", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4 }}>
        <div style={{ fontFamily:"Georgia,serif", fontSize:13, color:"#1a1a2e", letterSpacing:"2px" }}>YOU FIRST.</div>
        <div style={{ width:40, height:1, background:"#1a1a2e", opacity:.25 }}/>
        <div style={{ fontFamily:"Georgia,serif", fontSize:7, color:"#1a1a2e", opacity:.5, letterSpacing:"1px" }}>Everything, handled.</div>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", background:"#f5f0eb", gap:16 }}>
      <div style={{ fontSize:18, fontWeight:500, color:"#1a1a2e" }}>Propriété introuvable</div>
      <div style={{ fontSize:13, color:"#9ca3af" }}>Ce lien n'est pas valide ou a expiré.</div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f5f0eb" }}>
      <div style={{ background:"#1a1a2e", padding:"20px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div translate="no" style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:"50%", border:"1.5px solid #f5f0eb", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2 }}>
            <div style={{ fontFamily:"Georgia,serif", fontSize:7, color:"#f5f0eb", letterSpacing:"1.5px" }}>YOU FIRST.</div>
            <div style={{ width:20, height:.5, background:"#f5f0eb", opacity:.4 }}/>
            <div style={{ fontFamily:"Georgia,serif", fontSize:5, color:"#f5f0eb", opacity:.5 }}>Everything, handled.</div>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:500, color:"white" }}>{property.name}</div>
            <div style={{ fontSize:12, color:"#ffffff70" }}>Espace propriétaire</div>
          </div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          {[2024,2025,2026,2027].map(y => (
            <button key={y} onClick={()=>setYear(y)} style={{ padding:"5px 12px", borderRadius:6, border:"1px solid "+(year===y?"#f0c040":"#ffffff30"), background:year===y?"#f0c04020":"transparent", color:year===y?"#f0c040":"#ffffff80", cursor:"pointer", fontSize:12 }}>{y}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:900, margin:"0 auto", padding:"28px 20px" }}>
        <div style={{ marginBottom:24 }}>
          <h1 style={{ fontSize:20, fontWeight:600, color:"#1a1a2e", marginBottom:4 }}>{property.name}</h1>
          <div style={{ fontSize:13, color:"#9ca3af" }}>
            Récapitulatif {year} · {yearBookings.length} réservation{yearBookings.length>1?"s":""} · {totals.nights} nuits
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:12, marginBottom:24 }}>
          {[
            { label:"Revenus bruts", value:`${fmt(totals.revenue)} MAD`, color:"#1D9E75" },
            { label:"Commission conciergerie", value:`− ${fmt(totals.commission)} MAD`, color:"#f0a500" },
            { label:"Charges", value:`− ${fmt(totalDep)} MAD`, color:"#E24B4A" },
            { label:"Reversement net", value:`${fmt(reversementNet)} MAD`, color:"#378ADD", bold:true },
          ].map((k,i) => (
            <div key={i} style={{ background:"white", borderRadius:12, padding:"14px 16px", boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
              <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>{k.label}</div>
              <div style={{ fontSize:k.bold?22:18, fontWeight:k.bold?600:500, color:k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:20 }}>
          <div style={{ background:"white", borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", marginBottom:14 }}>Revenus par mois — {year}</div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:80 }}>
              {monthlyRev.map((v,i) => (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                  <div style={{ width:"100%", background:v>0?"#1D9E75":"#f0f0f0", borderRadius:"3px 3px 0 0", height:Math.round((v/maxMonth)*64)+"px", minHeight:v>0?4:0 }}/>
                  <div style={{ fontSize:9, color:"#c0c0c0" }}>{MONTHS[i]}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:"white", borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", marginBottom:14 }}>Résumé financier</div>
            {[
              { label:"Revenus bruts", value:totals.revenue, color:"#1D9E75" },
              { label:"Commission conciergerie", value:-totals.commission, color:"#f0a500" },
              { label:"Charges", value:-totalDep, color:"#E24B4A" },
              { label:"Reversement net", value:reversementNet, color:"#378ADD", bold:true },
            ].map((row,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:i<3?"1px solid #f5f5f5":"none", marginTop:i===3?4:0 }}>
                <span style={{ fontSize:13, color:row.bold?"#1a1a2e":"#6b7280", fontWeight:row.bold?600:400 }}>{row.label}</span>
                <span style={{ fontSize:13, color:row.color, fontWeight:row.bold?600:500 }}>{row.value>=0?"+":""}{fmt(row.value)} MAD</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background:"white", borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)", marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", marginBottom:16 }}>Réservations {year}</div>
          {yearBookings.length===0 && <p style={{ color:"#c0c0c0", fontSize:13, textAlign:"center", padding:"16px 0" }}>Aucune réservation pour {year}.</p>}
          {yearBookings.sort((a,b)=>a.checkIn>b.checkIn?1:-1).map(b => {
            const plt = PLT[b.platform]||PLT["Autre"];
            const n   = b.nights||nights(b.checkIn,b.checkOut);
            const { commission, reversement } = calcCommission(b, property);
            return (
              <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:"1px solid #f7f7f7" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:plt.bg, color:plt.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:600, flexShrink:0 }}>
                  {(b.name||"?")[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"#1a1a2e" }}>{b.name||"Réservation"}</div>
                  <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {n} nuit{n>1?"s":""}</div>
                </div>
                <span style={{ fontSize:10, background:plt.bg, color:plt.color, padding:"2px 8px", borderRadius:99, fontWeight:500 }}>{b.platform}</span>
                <div style={{ textAlign:"right", minWidth:130 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:"#1a1a2e" }}>{fmt(b.amount)} MAD</div>
                  <div style={{ fontSize:11, color:"#378ADD" }}>Reversement : {fmt(reversement)} MAD</div>
                </div>
                <div style={{ fontSize:11, fontWeight:500, color:b.paid?"#0F6E56":"#A32D2D", minWidth:70, textAlign:"right" }}>
                  {b.paid?"Encaissé":"En attente"}
                </div>
              </div>
            );
          })}
        </div>

        {yearDepenses.length>0 && (
          <div style={{ background:"white", borderRadius:12, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)", marginBottom:20 }}>
            <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", marginBottom:16 }}>Charges {year}</div>
            {yearDepenses.sort((a,b)=>b.date>a.date?1:-1).map(d => (
              <div key={d.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #f7f7f7" }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"#1a1a2e" }}>{d.description}</div>
                  <div style={{ fontSize:11, color:"#9ca3af" }}>{fmtDate(d.date)} · {d.categorie}</div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, color:"#E24B4A" }}>− {fmt(d.montant)} MAD</div>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"flex-end", padding:"10px 0 0", borderTop:"1px solid #f0f0f0", marginTop:4 }}>
              <span style={{ fontSize:13, color:"#9ca3af" }}>Total charges : <strong style={{ color:"#E24B4A" }}>− {fmt(totalDep)} MAD</strong></span>
            </div>
          </div>
        )}

        <div style={{ textAlign:"center", padding:"20px 0", fontSize:12, color:"#c0c0c0" }} translate="no">
          You First. — Everything, handled.
        </div>
      </div>
    </div>
  );
}
