import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";

const PLATFORMS = ["Airbnb", "Booking", "Direct", "Gens de confiance", "Autre"];

const emptyRules = {
  mode: "percent_brut",
  rate: 20,
  rates: { Airbnb: 20, Booking: 18, Direct: 15, "Gens de confiance": 10 },
  amountPerNight: 200,
  platformFeeIncluded: true,
  platformFeeRate: 3,
  cleaningFee: 0,
  notes: "",
};

const emptyForm = {
  name: "", address: "", owner: "", phone: "", email: "",
  icalAirbnb: "", icalBooking: "",
  commissionRules: { ...emptyRules },
};

const MODES = [
  { value: "percent_brut",    label: "% sur montant brut",         desc: "Ex : 20% du total Airbnb encaissé" },
  { value: "percent_net",     label: "% sur montant net",          desc: "Après déduction commission plateforme" },
  { value: "fixed_per_night", label: "Montant fixe / nuit",        desc: "Ex : 200 MAD par nuit" },
  { value: "per_platform",    label: "% différent par plateforme", desc: "Airbnb 20%, Direct 15%..." },
];

const PLT_COLORS = {
  Airbnb:              { bg: "#FAECE7", color: "#993C1D" },
  Booking:             { bg: "#E6F1FB", color: "#0C447C" },
  Direct:              { bg: "#EAF3DE", color: "#27500A" },
  "Gens de confiance": { bg: "#EEEDFE", color: "#3C3489" },
};

export function calcCommission(booking, property) {
  const rules = property.commissionRules || { mode: "percent_brut", rate: 20, platformFeeIncluded: false, platformFeeRate: 3, cleaningFee: 0 };
  const amount = booking.amount || 0;
  const nights = booking.nights || 1;
  let platformFee = 0;
  if (rules.platformFeeIncluded) platformFee = Math.round(amount * (rules.platformFeeRate || 3) / 100);
  const base = rules.platformFeeIncluded ? amount - platformFee : amount;
  let commission = 0;
  if (rules.mode === "percent_brut")      commission = Math.round(amount * (rules.rate || 20) / 100);
  else if (rules.mode === "percent_net")  commission = Math.round(base * (rules.rate || 20) / 100);
  else if (rules.mode === "fixed_per_night") commission = Math.round((rules.amountPerNight || 0) * nights);
  else if (rules.mode === "per_platform") { const rate = rules.rates?.[booking.platform] ?? 20; commission = Math.round(amount * rate / 100); }
  const cleaning = rules.cleaningFee || 0;
  const reversement = Math.round(amount - platformFee - commission - cleaning);
  return { platformFee, commission, cleaning, reversement };
}

export function commissionLabel(property) {
  const rules = property.commissionRules;
  if (!rules) return "20%";
  if (rules.mode === "percent_brut")      return `${rules.rate}% brut`;
  if (rules.mode === "percent_net")       return `${rules.rate}% net`;
  if (rules.mode === "fixed_per_night")   return `${rules.amountPerNight} MAD/nuit`;
  if (rules.mode === "per_platform")      return "Multi-taux";
  return "—";
}

function CommissionConfigurator({ rules, onChange }) {
  const set = (key, val) => onChange({ ...rules, [key]: val });
  const setRate = (platform, val) => onChange({ ...rules, rates: { ...rules.rates, [platform]: Number(val) } });
  return (
    <div>
      <div style={st.sectionTitle}>Modèle de commission</div>
      <div className="grid-form-2" style={{marginBottom:16}}>
        {MODES.map(m => (
          <div key={m.value} onClick={() => set("mode", m.value)}
            style={{ border: rules.mode===m.value ? "2px solid #1a1a2e" : "1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", cursor:"pointer", background: rules.mode===m.value ? "#f8f8ff" : "white" }}>
            <div style={{ fontSize:13, fontWeight:500, color: rules.mode===m.value ? "#1a1a2e" : "#374151" }}>{m.label}</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{m.desc}</div>
          </div>
        ))}
      </div>
      {(rules.mode==="percent_brut"||rules.mode==="percent_net") && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div style={st.field}><label style={st.label}>Taux (%)</label><input type="number" style={st.input} value={rules.rate} onChange={e=>set("rate",Number(e.target.value))} min={0} max={100}/></div>
        </div>
      )}
      {rules.mode==="fixed_per_night" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div style={st.field}><label style={st.label}>Montant fixe / nuit (MAD)</label><input type="number" style={st.input} value={rules.amountPerNight} onChange={e=>set("amountPerNight",Number(e.target.value))} min={0}/></div>
        </div>
      )}
      {rules.mode==="per_platform" && (
        <div className="grid-form-4" style={{marginBottom:12}}>
          {PLATFORMS.slice(0,4).map(p => (
            <div key={p} style={st.field}><label style={st.label}>{p} (%)</label><input type="number" style={st.input} value={rules.rates?.[p]??20} onChange={e=>setRate(p,e.target.value)} min={0} max={100}/></div>
          ))}
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:4 }}>
          <input type="checkbox" id="pfee" checked={rules.platformFeeIncluded} onChange={e=>set("platformFeeIncluded",e.target.checked)} style={{ width:16, height:16 }}/>
          <label htmlFor="pfee" style={{ fontSize:13, color:"#374151", cursor:"pointer" }}>Déduire commission plateforme</label>
        </div>
        {rules.platformFeeIncluded && (
          <div style={st.field}><label style={st.label}>Taux plateforme (%)</label><input type="number" style={st.input} value={rules.platformFeeRate} onChange={e=>set("platformFeeRate",Number(e.target.value))} min={0} max={30} step={0.5}/></div>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div style={st.field}><label style={st.label}>Frais ménage / séjour (MAD)</label><input type="number" style={st.input} value={rules.cleaningFee} onChange={e=>set("cleaningFee",Number(e.target.value))} min={0}/></div>
      </div>
      <div style={st.field}>
        <label style={st.label}>Notes / accord particulier</label>
        <textarea style={{ ...st.input, resize:"vertical", minHeight:56, fontFamily:"inherit" }} value={rules.notes} onChange={e=>set("notes",e.target.value)} placeholder="Ex : taux réduit en juillet-août..."/>
      </div>
    </div>
  );
}

const st = {
  field: { display:"flex", flexDirection:"column", gap:4 },
  label: { fontSize:12, color:"#6b7280" },
  input: { padding:"9px 11px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:13, outline:"none" },
  sectionTitle: { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", margin:"20px 0 12px" },
};

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [form, setForm]             = useState(emptyForm);
  const [showForm, setShowForm]     = useState(false);
  const [loading, setLoading]       = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    const [pSnap, bSnap] = await Promise.all([
      getDocs(collection(db, "properties")),
      getDocs(collection(db, "bookings")),
    ]);
    setProperties(pSnap.docs.map(d => ({ id:d.id, ...d.data() })));
    setBookings(bSnap.docs.map(d => ({ id:d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name||!form.owner) return alert("Nom et propriétaire requis");
    await addDoc(collection(db,"properties"), form);
    setForm(emptyForm); setShowForm(false); load();
  };

  const remove = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette propriété ?")) return;
    await deleteDoc(doc(db,"properties",id)); load();
  };

  const getStats = (p) => {
    const pb = bookings.filter(b => b.propertyId === p.id);
    const future = pb.filter(b => b.checkIn > new Date().toISOString().split("T")[0]);
    const rev = pb.reduce((s,b) => s+(b.amount||0), 0);
    const com = pb.reduce((s,b) => s+calcCommission(b,p).commission, 0);
    return { total: pb.length, future: future.length, rev, com };
  };

  const commBadgeColor = (mode) => {
    const map = { percent_brut:"#f0c04030,#b8860b", percent_net:"#E6F1FB,#0C447C", fixed_per_night:"#EAF3DE,#27500A", per_platform:"#EEEDFE,#534AB7" };
    const [bg,color] = (map[mode]||"#f0f0f0,#666").split(",");
    return { bg, color };
  };

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:600, color:"#1a1a2e", marginBottom:3 }}>Propriétés</h1>
          <div style={{ fontSize:13, color:"#9ca3af" }}>{properties.length} bien{properties.length>1?"s":""} sous gestion</div>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1a2e", color:"white", border:"none", padding:"10px 20px", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:500 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ajouter une propriété
        </button>
      </div>

      {showForm && (
        <div style={{ background:"white", borderRadius:14, padding:28, marginBottom:24, border:"1px solid #f0f0f0", boxShadow:"0 4px 16px rgba(0,0,0,.06)" }}>
          <h3 style={{ margin:"0 0 20px", fontSize:16, fontWeight:500 }}>Nouvelle propriété</h3>
          <div className="grid-form-2" style={{marginBottom:4}}>
            {[["name","Nom de la propriété *"],["owner","Propriétaire *"],["phone","Téléphone"],["email","Email"],["address","Adresse"]].map(([key,label]) => (
              <div key={key} style={st.field}>
                <label style={st.label}>{label}</label>
                <input style={st.input} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/>
              </div>
            ))}
          </div>
          <div style={st.sectionTitle}>Liens iCal</div>
          <div className="grid-form-2" style={{marginBottom:4}}>
            {[["icalAirbnb","iCal Airbnb"],["icalBooking","iCal Booking"]].map(([key,label]) => (
              <div key={key} style={st.field}>
                <label style={st.label}>{label}</label>
                <input style={st.input} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder="https://..."/>
              </div>
            ))}
          </div>
          <CommissionConfigurator rules={form.commissionRules} onChange={r=>setForm({...form,commissionRules:r})}/>
          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button onClick={save} style={{ background:"#1a1a2e", color:"white", border:"none", padding:"10px 22px", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:500 }}>Enregistrer</button>
            <button onClick={()=>setShowForm(false)} style={{ background:"#f5f5f5", border:"none", padding:"10px 22px", borderRadius:9, cursor:"pointer", fontSize:13, color:"#666" }}>Annuler</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>Chargement...</div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:16 }}>
          {properties.length===0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:48, color:"#9ca3af", background:"white", borderRadius:14, border:"1px dashed #e5e7eb" }}>
              Aucune propriété — cliquez sur "+ Ajouter" pour commencer.
            </div>
          )}
          {properties.map(p => {
            const stats = getStats(p);
            const rules = p.commissionRules || {};
            const { bg: cbg, color: ccolor } = commBadgeColor(rules.mode);
            const hasPlatforms = p.icalAirbnb || p.icalBooking;
            return (
              <div key={p.id}
                onClick={() => navigate(`/property/${p.id}`)}
                onMouseEnter={e => { e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,.10)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.06)"; e.currentTarget.style.transform="translateY(0)"; }}
                style={{ background:"white", borderRadius:14, padding:0, boxShadow:"0 1px 4px rgba(0,0,0,.06)", border:"1px solid #f0f0f0", cursor:"pointer", transition:"box-shadow .18s, transform .18s", overflow:"hidden" }}>

                <div style={{ padding:"18px 20px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:15, fontWeight:600, color:"#1a1a2e", marginBottom:2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.name}</div>
                      <div style={{ fontSize:12, color:"#9ca3af" }}>{p.owner}</div>
                    </div>
                    <div style={{ background:cbg, color:ccolor, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:99, flexShrink:0, marginLeft:10 }}>
                      {commissionLabel(p)}
                    </div>
                  </div>

                  {p.phone && <div style={{ fontSize:12, color:"#6b7280", marginBottom:2, display:"flex", alignItems:"center", gap:6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
                    {p.phone}
                  </div>}
                  {p.address && <div style={{ fontSize:12, color:"#6b7280", display:"flex", alignItems:"center", gap:6 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {p.address}
                  </div>}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", borderTop:"1px solid #f5f5f5", borderBottom:"1px solid #f5f5f5" }}>
                  {[
                    { label:"Réservations", value: stats.total },
                    { label:"À venir", value: stats.future },
                    { label:"Commission", value: stats.com > 0 ? Math.round(stats.com).toLocaleString("fr-FR")+" MAD" : "—" },
                  ].map((s,i) => (
                    <div key={i} style={{ padding:"10px 14px", borderRight: i<2?"1px solid #f5f5f5":"none", textAlign:"center" }}>
                      <div style={{ fontSize:15, fontWeight:600, color:"#1a1a2e" }}>{s.value}</div>
                      <div style={{ fontSize:10, color:"#9ca3af", marginTop:2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:6 }}>
                    {p.icalAirbnb && <span style={{ fontSize:10, background:"#FAECE7", color:"#993C1D", padding:"2px 8px", borderRadius:99, fontWeight:500 }}>Airbnb</span>}
                    {p.icalBooking && <span style={{ fontSize:10, background:"#E6F1FB", color:"#0C447C", padding:"2px 8px", borderRadius:99, fontWeight:500 }}>Booking</span>}
                    {!hasPlatforms && <span style={{ fontSize:11, color:"#c0c0c0" }}>Aucun iCal</span>}
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:12, color:"#9ca3af" }}>Voir la fiche →</span>
                    <button onClick={e=>{ e.stopPropagation(); if(confirm("Supprimer ?")) { deleteDoc(doc(db,"properties",p.id)).then(load); } }}
                      style={{ background:"none", border:"1px solid #f0f0f0", color:"#d1d5db", padding:"4px 10px", borderRadius:6, cursor:"pointer", fontSize:11 }}>
                      Suppr.
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
