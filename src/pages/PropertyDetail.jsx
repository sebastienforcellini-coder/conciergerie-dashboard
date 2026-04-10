import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { calcCommission, commissionLabel } from "./Properties";
import { syncPropertyICal } from "./useICalSync";


const PLATFORMS = ["Airbnb", "Booking", "Direct", "Gens de confiance", "Autre"];
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const PLT = {
  Airbnb:              { bg:"#FAECE7", color:"#993C1D" },
  Booking:             { bg:"#E6F1FB", color:"#0C447C" },
  Direct:              { bg:"#EAF3DE", color:"#27500A" },
  "Gens de confiance": { bg:"#EEEDFE", color:"#3C3489" },
  Autre:               { bg:"#F1EFE8", color:"#5F5E5A" },
};

const MODES = [
  { value:"percent_brut",    label:"% sur montant brut",         desc:"Ex : 20% du total Airbnb" },
  { value:"percent_net",     label:"% sur montant net",          desc:"Après déduction plateforme" },
  { value:"fixed_per_night", label:"Montant fixe / nuit",        desc:"Ex : 200 MAD par nuit" },
  { value:"per_platform",    label:"% différent par plateforme", desc:"Airbnb 20%, Direct 15%..." },
];

const emptyBooking = { name:"", platform:"Airbnb", checkIn:"", checkOut:"", amount:"", guests:"", notes:"", paid:false };

function nights(a,b) { if(!a||!b) return 0; return Math.max(0,Math.round((new Date(b)-new Date(a))/86400000)); }
function fmt(n) { return Math.round(n).toLocaleString("fr-FR"); }
function fmtDate(d) {
  if (!d) return "—";
  const [y,m,j] = d.split("-");
  return `${j}/${m}/${y}`;
}

const st = {
  input:  { padding:"9px 11px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:13, width:"100%", boxSizing:"border-box" },
  label:  { fontSize:12, color:"#6b7280", display:"block", marginBottom:3 },
  card:   { background:"white", border:"1px solid #f0f0f0", borderRadius:14, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" },
  cardHd: { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", marginBottom:14 },
  btn:    { background:"#1a1a2e", color:"white", border:"none", padding:"9px 18px", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:500 },
  btnSm:  { background:"none", border:"1px solid #e5e7eb", color:"#6b7280", padding:"6px 12px", borderRadius:7, cursor:"pointer", fontSize:12 },
  sectionTitle: { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", margin:"20px 0 12px" },
};

function CommissionConfigurator({ rules, onChange }) {
  const set = (key,val) => onChange({...rules,[key]:val});
  const setRate = (p,val) => onChange({...rules,rates:{...rules.rates,[p]:Number(val)}});
  return (
    <div>
      <div style={st.sectionTitle}>Modèle de commission</div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
        {MODES.map(m => (
          <div key={m.value} onClick={()=>set("mode",m.value)}
            style={{ border:rules.mode===m.value?"2px solid #1a1a2e":"1px solid #e5e7eb", borderRadius:10, padding:"10px 14px", cursor:"pointer", background:rules.mode===m.value?"#f8f8ff":"white" }}>
            <div style={{ fontSize:13, fontWeight:500, color:rules.mode===m.value?"#1a1a2e":"#374151" }}>{m.label}</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:2 }}>{m.desc}</div>
          </div>
        ))}
      </div>
      {(rules.mode==="percent_brut"||rules.mode==="percent_net") && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={st.label}>Taux (%)</label><input type="number" style={st.input} value={rules.rate} onChange={e=>set("rate",Number(e.target.value))} min={0} max={100}/></div>
        </div>
      )}
      {rules.mode==="fixed_per_night" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
          <div><label style={st.label}>Montant fixe / nuit (MAD)</label><input type="number" style={st.input} value={rules.amountPerNight} onChange={e=>set("amountPerNight",Number(e.target.value))} min={0}/></div>
        </div>
      )}
      {rules.mode==="per_platform" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:12 }}>
          {PLATFORMS.slice(0,4).map(p => (
            <div key={p}><label style={st.label}>{p} (%)</label><input type="number" style={st.input} value={rules.rates?.[p]??20} onChange={e=>setRate(p,e.target.value)} min={0} max={100}/></div>
          ))}
        </div>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:4 }}>
          <input type="checkbox" id="pfee" checked={rules.platformFeeIncluded} onChange={e=>set("platformFeeIncluded",e.target.checked)} style={{ width:16,height:16 }}/>
          <label htmlFor="pfee" style={{ fontSize:13, color:"#374151", cursor:"pointer" }}>Déduire commission plateforme</label>
        </div>
        {rules.platformFeeIncluded && (
          <div><label style={st.label}>Taux plateforme (%)</label><input type="number" style={st.input} value={rules.platformFeeRate} onChange={e=>set("platformFeeRate",Number(e.target.value))} min={0} max={30} step={0.5}/></div>
        )}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
        <div><label style={st.label}>Frais ménage / séjour (MAD)</label><input type="number" style={st.input} value={rules.cleaningFee||0} onChange={e=>set("cleaningFee",Number(e.target.value))} min={0}/></div>
      </div>
      <div><label style={st.label}>Notes / accord particulier</label>
        <textarea style={{ ...st.input, resize:"vertical", minHeight:56, fontFamily:"inherit" }} value={rules.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Ex : taux réduit en juillet-août..."/>
      </div>
    </div>
  );
}

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty]   = useState(null);
  const [bookings, setBookings]   = useState([]);
  const [year, setYear]           = useState(new Date().getFullYear());
  const [showForm, setShowForm]   = useState(false);
  const [showEdit, setShowEdit]   = useState(false);
  const [editForm, setEditForm]   = useState(null);
  const [form, setForm]           = useState(emptyBooking);
  const [editId, setEditId]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [syncMsg, setSyncMsg]     = useState("");
  const [syncResult, setSyncResult] = useState(null);
  const [quickEdit, setQuickEdit]   = useState(null);
  const [quickForm, setQuickForm]   = useState({ name:"", amount:"", guests:"", paid:false });

  const load = async () => {
    const [pSnap, bSnap] = await Promise.all([
      getDocs(collection(db,"properties")),
      getDocs(query(collection(db,"bookings"), where("propertyId","==",id)))
    ]);
    const props = pSnap.docs.map(d => ({id:d.id,...d.data()}));
    const prop  = props.find(p => p.id===id) || null;
    setProperty(prop);
    setBookings(bSnap.docs.map(d => ({id:d.id,...d.data()})));
    if (prop) setEditForm({
      name: prop.name||"", owner: prop.owner||"", phone: prop.phone||"",
      email: prop.email||"", address: prop.address||"",
      icalAirbnb: prop.icalAirbnb||"", icalBooking: prop.icalBooking||"",
      commissionRules: prop.commissionRules || { mode:"percent_brut", rate:20, platformFeeIncluded:false, platformFeeRate:3, cleaningFee:0, notes:"", rates:{Airbnb:20,Booking:18,Direct:15,"Gens de confiance":10}, amountPerNight:200 },
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const saveEdit = async () => {
    if (!editForm.name||!editForm.owner) return alert("Nom et propriétaire requis");
    await updateDoc(doc(db,"properties",id), editForm);
    setShowEdit(false);
    load();
  };

  const yearBookings = bookings.filter(b => b.checkIn?.startsWith(String(year)));

  const totals = yearBookings.reduce((acc,b) => {
    const { platformFee, commission, cleaning, reversement } = calcCommission(b, property||{});
    return { revenue:acc.revenue+(b.amount||0), platformFee:acc.platformFee+platformFee, commission:acc.commission+commission, cleaning:acc.cleaning+cleaning, reversement:acc.reversement+reversement, nights:acc.nights+(b.nights||nights(b.checkIn,b.checkOut)) };
  }, { revenue:0, platformFee:0, commission:0, cleaning:0, reversement:0, nights:0 });

  const monthlyRevenue = MONTHS.map((_,mi) => {
    const mb = yearBookings.filter(b => b.checkIn?.startsWith(`${year}-${String(mi+1).padStart(2,"0")}`));
    return mb.reduce((s,b) => s+(b.amount||0), 0);
  });
  const maxMonth = Math.max(...monthlyRevenue, 1);

  const openForm = (b=null) => {
    if (b) { setForm({name:b.name,platform:b.platform,checkIn:b.checkIn,checkOut:b.checkOut,amount:b.amount,guests:b.guests||"",notes:b.notes||"",paid:b.paid||false}); setEditId(b.id); }
    else   { setForm(emptyBooking); setEditId(null); }
    setShowForm(true);
  };

  const saveBooking = async () => {
    if (!form.checkIn||!form.checkOut||!form.amount) return alert("Dates et montant requis");
    const n = nights(form.checkIn,form.checkOut);
    const data = {...form, propertyId:id, nights:n, amount:Number(form.amount), guests:form.guests?String(form.guests):""};
    if (editId) await updateDoc(doc(db,"bookings",editId), data);
    else        await addDoc(collection(db,"bookings"), data);
    setShowForm(false); setForm(emptyBooking); setEditId(null); load();
  };

  const deleteBooking = async (bid) => {
    if (!confirm("Supprimer cette réservation ?")) return;
    await deleteDoc(doc(db,"bookings",bid)); load();
  };

  const togglePaid = async (b) => {
    await updateDoc(doc(db,"bookings",b.id), {paid:!b.paid}); load();
  };

  const openQuickEdit = (b) => {
    setQuickEdit(b.id);
    setQuickForm({ name: b.name==="Réservation"?"":b.name, amount: b.amount||"", guests: b.guests||"", paid: b.paid||false });
  };

  const saveQuickEdit = async (b) => {
    await updateDoc(doc(db,"bookings",b.id), {
      name:   quickForm.name   || b.name,
      amount: Number(quickForm.amount) || 0,
      guests: String(quickForm.guests) || "",
      paid:   quickForm.paid,
      fromICal: false,
    });
    setQuickEdit(null);
    load();
  };

  const handleSync = async () => {
    if (!property) return;
    setSyncing(true); setSyncResult(null); setSyncMsg("Synchronisation...");
    try {
      const r = await syncPropertyICal(property, msg => setSyncMsg(msg));
      setSyncResult(r);
      setSyncMsg("");
      load();
    } catch(e) { setSyncMsg("Erreur: "+e.message); }
    setSyncing(false);
  };

  if (loading) return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",color:"#9ca3af" }}>Chargement...</div>;
  if (!property) return <div style={{ padding:32, color:"#9ca3af" }}>Propriété introuvable.</div>;

  return (
    <div style={{ padding:"24px 28px" }}>
      <button style={{ background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:13, padding:"0 0 16px", display:"flex", alignItems:"center", gap:6 }} onClick={()=>navigate("/properties")}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        Retour aux propriétés
      </button>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:600, color:"#1a1a2e", marginBottom:4 }}>{property.name}</h1>
          <div style={{ fontSize:13, color:"#9ca3af", display:"flex", gap:16, flexWrap:"wrap" }}>
            <span>{property.owner}</span>
            {property.phone   && <span>· {property.phone}</span>}
            {property.email   && <span>· {property.email}</span>}
            {property.address && <span>· {property.address}</span>}
          </div>
          {property.commissionRules?.notes && (
            <div style={{ fontSize:12, color:"#9ca3af", fontStyle:"italic", marginTop:4 }}>{property.commissionRules.notes}</div>
          )}
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <span style={{ background:"#f0c04028", color:"#b8860b", fontSize:12, fontWeight:600, padding:"4px 12px", borderRadius:99 }}>{commissionLabel(property)}</span>

          <button onClick={handleSync} disabled={syncing} style={{display:"flex",alignItems:"center",gap:6,background:syncing?"#f5f5f5":"#E1F5EE",color:syncing?"#9ca3af":"#085041",border:"1px solid #9FE1CB",padding:"8px 16px",borderRadius:9,cursor:syncing?"not-allowed":"pointer",fontSize:13,fontWeight:500}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            {syncing ? syncMsg||"Sync..." : "Sync iCal"}
          </button>
          <button onClick={()=>setShowEdit(!showEdit)} style={{ display:"flex", alignItems:"center", gap:6, background:"white", border:"1px solid #e5e7eb", color:"#374151", padding:"8px 16px", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:500, boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Modifier la fiche
          </button>
        </div>
      </div>

      {syncResult && (
        <div style={{background:"#E1F5EE",border:"1px solid #9FE1CB",borderRadius:10,padding:"12px 16px",marginBottom:16,fontSize:13}}>
          <strong style={{color:"#085041"}}>Sync terminée — </strong>
          <span style={{color:"#0F6E56"}}>{syncResult.added} ajoutée{syncResult.added>1?"s":""}</span>
          {syncResult.updated>0 && <span style={{color:"#854F0B"}}> · {syncResult.updated} mise{syncResult.updated>1?"s":""} à jour</span>}
          {syncResult.blocked>0 && <span style={{color:"#888"}}> · {syncResult.blocked} bloquée{syncResult.blocked>1?"s":""} ignorée{syncResult.blocked>1?"s":""}</span>}
          {syncResult.errors.length>0 && <span style={{color:"#A32D2D"}}> · {syncResult.errors[0]}</span>}
          <button onClick={()=>setSyncResult(null)} style={{marginLeft:12,background:"none",border:"none",color:"#085041",cursor:"pointer",fontSize:12}}>×</button>
        </div>
      )}

      {showEdit && editForm && (
        <div style={{ background:"white", borderRadius:14, padding:28, marginBottom:24, border:"1px solid #f0f0f0", boxShadow:"0 4px 16px rgba(0,0,0,.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h3 style={{ margin:0, fontSize:16, fontWeight:500 }}>Modifier la fiche</h3>
            <button onClick={()=>setShowEdit(false)} style={{ background:"none", border:"none", color:"#9ca3af", cursor:"pointer", fontSize:20, lineHeight:1 }}>×</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
            {[["name","Nom de la propriété *"],["owner","Propriétaire *"],["phone","Téléphone"],["email","Email"],["address","Adresse"]].map(([key,label]) => (
              <div key={key}>
                <label style={st.label}>{label}</label>
                <input style={st.input} value={editForm[key]||""} onChange={e=>setEditForm({...editForm,[key]:e.target.value})}/>
              </div>
            ))}
          </div>
          <div style={st.sectionTitle}>Liens iCal</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
            {[["icalAirbnb","iCal Airbnb"],["icalBooking","iCal Booking"]].map(([key,label]) => (
              <div key={key}>
                <label style={st.label}>{label}</label>
                <input style={st.input} value={editForm[key]||""} onChange={e=>setEditForm({...editForm,[key]:e.target.value})} placeholder="https://..."/>
              </div>
            ))}
          </div>
          <CommissionConfigurator rules={editForm.commissionRules} onChange={r=>setEditForm({...editForm,commissionRules:r})}/>
          <div style={{ display:"flex", gap:10, marginTop:20 }}>
            <button onClick={saveEdit} style={st.btn}>Enregistrer les modifications</button>
            <button onClick={()=>setShowEdit(false)} style={{ ...st.btnSm, padding:"9px 16px" }}>Annuler</button>
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[2024,2025,2026,2027].map(y => (
          <button key={y} onClick={()=>setYear(y)} style={{ padding:"6px 14px", borderRadius:7, border:"1px solid "+(year===y?"#1a1a2e":"#e5e7eb"), background:year===y?"#1a1a2e":"white", color:year===y?"white":"#6b7280", cursor:"pointer", fontSize:13, fontWeight:year===y?500:400 }}>{y}</button>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(0,1fr))", gap:10, marginBottom:20 }}>
        {[
          { label:"Revenus bruts", value:`${fmt(totals.revenue)} MAD`, sub:`${yearBookings.length} résa · ${totals.nights} nuits`, color:"#1D9E75" },
          totals.platformFee>0 && { label:"Comm. plateforme", value:`− ${fmt(totals.platformFee)} MAD`, sub:`${property.commissionRules?.platformFeeRate}%`, color:"#E24B4A" },
          { label:"Ma commission", value:`+ ${fmt(totals.commission)} MAD`, sub:commissionLabel(property), color:"#f0a500" },
          { label:"Reversement propriétaire", value:`${fmt(totals.reversement)} MAD`, sub:"net à reverser", color:"#378ADD" },
        ].filter(Boolean).map((k,i) => (
          <div key={i} style={{ background:"#f8f9fa", borderRadius:12, padding:"14px 16px" }}>
            <div style={{ fontSize:11, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".4px", marginBottom:6 }}>{k.label}</div>
            <div style={{ fontSize:20, fontWeight:600, color:k.color, lineHeight:1 }}>{k.value}</div>
            <div style={{ fontSize:11, color:"#9ca3af", marginTop:5 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:16 }}>
        <div style={st.card}>
          <div style={st.cardHd}>Revenus par mois — {year}</div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:80 }}>
            {monthlyRevenue.map((v,i) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ width:"100%", background:v>0?"#1D9E75":"#f0f0f0", borderRadius:"3px 3px 0 0", height:Math.round((v/maxMonth)*64)+"px", minHeight:v>0?4:0 }}/>
                <div style={{ fontSize:9, color:"#c0c0c0" }}>{MONTHS[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={st.card}>
          <div style={st.cardHd}>Détail commission — exemple calcul</div>
          {yearBookings.slice(0,1).map(b => {
            const c = calcCommission(b, property);
            return (
              <div key={b.id} style={{ fontSize:13 }}>
                <div style={{ color:"#9ca3af", marginBottom:8, fontSize:12 }}>Exemple : {b.name} — {b.platform}</div>
                {[
                  { label:"Montant encaissé", value:`${fmt(b.amount)} MAD`, color:"#374151" },
                  c.platformFee>0 && { label:`− Commission ${b.platform}`, value:`− ${fmt(c.platformFee)} MAD`, color:"#E24B4A" },
                  { label:"− Ma commission", value:`− ${fmt(c.commission)} MAD`, color:"#f0a500" },
                  c.cleaning>0 && { label:"− Frais ménage", value:`− ${fmt(c.cleaning)} MAD`, color:"#e67e22" },
                  { label:"= Reversement", value:`${fmt(c.reversement)} MAD`, color:"#378ADD", bold:true },
                ].filter(Boolean).map((row,i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom:"1px solid #f5f5f5" }}>
                    <span style={{ color:row.color, fontWeight:row.bold?600:400 }}>{row.label}</span>
                    <span style={{ color:row.color, fontWeight:row.bold?600:400 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            );
          })}
          {yearBookings.length===0 && <p style={{ color:"#c0c0c0", fontSize:13 }}>Aucune réservation cette année.</p>}
        </div>
      </div>

      <div style={st.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={st.cardHd}>Réservations {year}</div>
          <button style={st.btn} onClick={()=>openForm()}>+ Ajouter</button>
        </div>

        {showForm && (
          <div style={{ background:"#f9fafb", borderRadius:10, padding:20, marginBottom:20, border:"1px solid #f0f0f0" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              {[["name","Voyageur","text","Prénom"],["checkIn","Arrivée","date",""],["checkOut","Départ","date",""],["amount","Montant (MAD)","number","0"]].map(([key,label,type,ph]) => (
                <div key={key}>
                  <label style={st.label}>{label}</label>
                  <input type={type} style={st.input} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={ph}/>
                </div>
              ))}
              <div>
                <label style={st.label}>Plateforme</label>
                <select style={st.input} value={form.platform} onChange={e=>setForm({...form,platform:e.target.value})}>
                  {PLATFORMS.map(p=><option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={st.label}>Voyageurs</label>
                <input type="number" style={st.input} value={form.guests} onChange={e=>setForm({...form,guests:e.target.value})} placeholder="2"/>
              </div>
              <div>
                <label style={st.label}>Notes</label>
                <input style={st.input} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="..."/>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:20 }}>
                <input type="checkbox" id="paid" checked={form.paid} onChange={e=>setForm({...form,paid:e.target.checked})} style={{ width:16,height:16 }}/>
                <label htmlFor="paid" style={{ fontSize:13, color:"#374151", cursor:"pointer" }}>Encaissé</label>
              </div>
            </div>
            {form.checkIn&&form.checkOut&&form.amount && (()=>{
              const preview = calcCommission({...form, nights:nights(form.checkIn,form.checkOut), amount:Number(form.amount)}, property);
              return (
                <div style={{ background:"#E6F1FB", borderRadius:8, padding:"10px 14px", marginBottom:12, fontSize:13, color:"#0C447C" }}>
                  {nights(form.checkIn,form.checkOut)} nuits · Ma commission : <strong>{fmt(preview.commission)} MAD</strong> · Reversement : <strong>{fmt(preview.reversement)} MAD</strong>
                </div>
              );
            })()}
            <div style={{ display:"flex", gap:8 }}>
              <button style={st.btn} onClick={saveBooking}>{editId?"Mettre à jour":"Enregistrer"}</button>
              <button style={{ ...st.btnSm, padding:"9px 16px" }} onClick={()=>{setShowForm(false);setEditId(null);}}>Annuler</button>
            </div>
          </div>
        )}

        {yearBookings.length===0&&!showForm && <p style={{ color:"#c0c0c0", fontSize:13, textAlign:"center", padding:"20px 0" }}>Aucune réservation pour {year}.</p>}

        {yearBookings.sort((a,b)=>a.checkIn>b.checkIn?1:-1).map(b => {
          const c = calcCommission(b, property);
          const plt = PLT[b.platform]||PLT["Autre"];
          const n = b.nights||nights(b.checkIn,b.checkOut);
          const isIncomplete = b.fromICal && (!b.amount || b.amount===0 || b.name==="Réservation");
          const isQuickEditing = quickEdit === b.id;
          return (
            <div key={b.id}>
              <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom: isQuickEditing?"none":"1px solid #f7f7f7", background: isIncomplete?"#fffbf0":"transparent", borderRadius: isIncomplete?8:0, padding: isIncomplete?"10px 12px":"9px 0" }}>
                <div style={{ width:30, height:30, borderRadius:"50%", background:plt.bg, color:plt.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:600, flexShrink:0 }}>{(b.name||"?")[0].toUpperCase()}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <div style={{ fontSize:13, fontWeight:500, color:"#1a1a2e" }}>{b.name||"—"}</div>
                    {isIncomplete && <span style={{ fontSize:10, background:"#FAEEDA", color:"#854F0B", padding:"1px 7px", borderRadius:99, fontWeight:600 }}>À compléter</span>}
                    {b.fromICal && !isIncomplete && <span style={{ fontSize:10, background:"#E1F5EE", color:"#085041", padding:"1px 7px", borderRadius:99 }}>iCal</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#9ca3af", marginTop:1 }}>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {n} nuit{n>1?"s":""} · {b.guests||"?"} pers.</div>
                </div>
                <span style={{ fontSize:10, background:plt.bg, color:plt.color, padding:"2px 8px", borderRadius:99, fontWeight:500 }}>{b.platform}</span>
                <div style={{ textAlign:"right", minWidth:110 }}>
                  <div style={{ fontSize:13, fontWeight:600, color: b.amount>0?"#1a1a2e":"#d1d5db" }}>{fmt(b.amount)} MAD</div>
                  <div style={{ fontSize:11, color:"#378ADD" }}>→ {fmt(c.reversement)} MAD</div>
                </div>
                {isIncomplete ? (
                  <button onClick={()=>isQuickEditing?setQuickEdit(null):openQuickEdit(b)}
                    style={{ ...st.btnSm, background:"#FAEEDA", color:"#854F0B", borderColor:"#FAC775", fontWeight:600, minWidth:90 }}>
                    {isQuickEditing ? "Annuler" : "Compléter"}
                  </button>
                ) : (
                  <button onClick={()=>togglePaid(b)} style={{ ...st.btnSm, background:b.paid?"#E1F5EE":"white", color:b.paid?"#085041":"#9ca3af", minWidth:90, fontWeight:b.paid?500:400 }}>{b.paid?"Encaissé":"Non payé"}</button>
                )}
                <button style={st.btnSm} onClick={()=>openForm(b)}>Éditer</button>
                <button style={{ ...st.btnSm, color:"#E24B4A", borderColor:"#FAECE7" }} onClick={()=>deleteBooking(b.id)}>Suppr.</button>
              </div>

              {isQuickEditing && (
                <div style={{ background:"#fffbf0", border:"1px solid #FAC775", borderTop:"none", borderRadius:"0 0 10px 10px", padding:"12px 16px", marginBottom:8, display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto auto", gap:10, alignItems:"flex-end" }}>
                  <div>
                    <label style={{ ...st.label, color:"#854F0B" }}>Nom du voyageur</label>
                    <input style={{ ...st.input, borderColor:"#FAC775" }} value={quickForm.name} onChange={e=>setQuickForm({...quickForm,name:e.target.value})} placeholder="Prénom Nom"/>
                  </div>
                  <div>
                    <label style={{ ...st.label, color:"#854F0B" }}>Montant (MAD)</label>
                    <input type="number" style={{ ...st.input, borderColor:"#FAC775" }} value={quickForm.amount} onChange={e=>setQuickForm({...quickForm,amount:e.target.value})} placeholder="0"/>
                  </div>
                  <div>
                    <label style={{ ...st.label, color:"#854F0B" }}>Nb voyageurs</label>
                    <input type="number" style={{ ...st.input, borderColor:"#FAC775" }} value={quickForm.guests} onChange={e=>setQuickForm({...quickForm,guests:e.target.value})} placeholder="2"/>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:6, paddingBottom:2 }}>
                    <input type="checkbox" id={`paid-${b.id}`} checked={quickForm.paid} onChange={e=>setQuickForm({...quickForm,paid:e.target.checked})} style={{width:15,height:15}}/>
                    <label htmlFor={`paid-${b.id}`} style={{ fontSize:12, color:"#854F0B", cursor:"pointer" }}>Encaissé</label>
                  </div>
                  <button onClick={()=>saveQuickEdit(b)} style={{ background:"#BA7517", color:"white", border:"none", padding:"9px 16px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:500 }}>
                    Enregistrer
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {yearBookings.length>0 && (
          <div style={{ display:"flex", justifyContent:"flex-end", gap:24, padding:"12px 0 0", fontSize:13, borderTop:"1px solid #f0f0f0", marginTop:8 }}>
            <span style={{ color:"#9ca3af" }}>Total : <strong style={{ color:"#1D9E75" }}>{fmt(totals.revenue)} MAD</strong></span>
            <span style={{ color:"#9ca3af" }}>Commission : <strong style={{ color:"#f0a500" }}>{fmt(totals.commission)} MAD</strong></span>
            <span style={{ color:"#9ca3af" }}>À reverser : <strong style={{ color:"#378ADD" }}>{fmt(totals.reversement)} MAD</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
