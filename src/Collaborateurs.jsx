import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase";

const ROLES = ["Coordinateur","Manager","Comptable","Commercial","Assistant","Autre"];
const SPECIALITES = ["Plombier","Électricien","Pisciniste","Jardinier","Peintre","Menuisier","Climatisation","Serrurier","Nettoyage","Maçon","Autre"];

const emptyInterne = { type:"interne", nom:"", role:"Coordinateur", telephone:"", email:"", notes:"" };
const emptyPrest   = { type:"prestataire", nom:"", specialite:"Plombier", telephone:"", email:"", notes:"" };

const ROLE_COLORS = {
  Coordinateur: { bg:"#E6F1FB", color:"#0C447C" },
  Manager:      { bg:"#EEEDFE", color:"#3C3489" },
  Comptable:    { bg:"#EAF3DE", color:"#27500A" },
  Commercial:   { bg:"#FAEEDA", color:"#633806" },
  Assistant:    { bg:"#F1EFE8", color:"#444441" },
  Autre:        { bg:"#F1EFE8", color:"#5F5E5A" },
};

const SPEC_COLORS = {
  Plombier:      { bg:"#E6F1FB", color:"#0C447C" },
  Électricien:   { bg:"#FAEEDA", color:"#633806" },
  Pisciniste:    { bg:"#E1F5EE", color:"#085041" },
  Jardinier:     { bg:"#EAF3DE", color:"#27500A" },
  Peintre:       { bg:"#FAECE7", color:"#712B13" },
  Menuisier:     { bg:"#EEEDFE", color:"#3C3489" },
  Climatisation: { bg:"#E6F1FB", color:"#185FA5" },
  Serrurier:     { bg:"#F1EFE8", color:"#444441" },
  Nettoyage:     { bg:"#E1F5EE", color:"#0F6E56" },
  Maçon:         { bg:"#FAEEDA", color:"#854F0B" },
  Autre:         { bg:"#F1EFE8", color:"#5F5E5A" },
};

function fmt(str) { return str ? str[0].toUpperCase() : "?"; }

const st = {
  input:  { padding:"9px 11px", borderRadius:8, border:"1px solid #e5e7eb", fontSize:13, width:"100%", boxSizing:"border-box", background:"white" },
  label:  { fontSize:12, color:"#6b7280", display:"block", marginBottom:3 },
  btn:    { background:"#1a1a2e", color:"white", border:"none", padding:"9px 18px", borderRadius:9, cursor:"pointer", fontSize:13, fontWeight:500 },
  btnSm:  { background:"none", border:"1px solid #e5e7eb", color:"#6b7280", padding:"6px 12px", borderRadius:7, cursor:"pointer", fontSize:12 },
  card:   { background:"white", border:"1px solid #f0f0f0", borderRadius:14, padding:20, boxShadow:"0 1px 4px rgba(0,0,0,.05)" },
  cardHd: { fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:".5px", marginBottom:16 },
};

function Avatar({ nom, bg, color, size=44 }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:bg, color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:600, flexShrink:0 }}>
      {fmt(nom)}
    </div>
  );
}

function CollabCard({ c, onDelete, onEdit }) {
  const colors = c.type==="interne" ? (ROLE_COLORS[c.role]||ROLE_COLORS["Autre"]) : (SPEC_COLORS[c.specialite]||SPEC_COLORS["Autre"]);
  const badge  = c.type==="interne" ? c.role : c.specialite;
  return (
    <div style={{ background:"white", border:"1px solid #f0f0f0", borderRadius:14, padding:18, boxShadow:"0 1px 4px rgba(0,0,0,.04)", display:"flex", flexDirection:"column", gap:12, transition:"box-shadow .15s" }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,.08)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,.04)"}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <Avatar nom={c.nom} bg={colors.bg} color={colors.color} size={44}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, fontWeight:600, color:"#1a1a2e", marginBottom:3 }}>{c.nom||"—"}</div>
          <span style={{ fontSize:11, background:colors.bg, color:colors.color, padding:"2px 9px", borderRadius:99, fontWeight:500 }}>{badge}</span>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
        {c.telephone && (
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#6b7280" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            {c.telephone}
          </div>
        )}
        {c.email && (
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#6b7280" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            {c.email}
          </div>
        )}
        {c.notes && <div style={{ fontSize:11, color:"#9ca3af", fontStyle:"italic", marginTop:2 }}>{c.notes}</div>}
      </div>
      <div style={{ display:"flex", gap:8, borderTop:"1px solid #f5f5f5", paddingTop:10 }}>
        <button onClick={()=>onEdit(c)} style={{ ...st.btnSm, flex:1 }}>Modifier</button>
        <button onClick={()=>onDelete(c.id)} style={{ ...st.btnSm, color:"#E24B4A", borderColor:"#FAECE7" }}>Suppr.</button>
      </div>
    </div>
  );
}

export default function Collaborateurs() {
  const [collabs, setCollabs]   = useState([]);
  const [tab, setTab]           = useState("interne");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyInterne);
  const [editId, setEditId]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

  const load = async () => {
    const snap = await getDocs(collection(db,"collaborateurs"));
    setCollabs(snap.docs.map(d => ({id:d.id,...d.data()})));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openForm = (c=null) => {
    if (c) { setForm({...c}); setEditId(c.id); }
    else   { setForm(tab==="interne" ? emptyInterne : emptyPrest); setEditId(null); }
    setShowForm(true);
  };

  const save = async () => {
    if (!form.nom) return alert("Nom requis");
    if (editId) await updateDoc(doc(db,"collaborateurs",editId), form);
    else        await addDoc(collection(db,"collaborateurs"), {...form, type:tab});
    setShowForm(false); setForm(tab==="interne"?emptyInterne:emptyPrest); setEditId(null); load();
  };

  const remove = async (id) => {
    if (!confirm("Supprimer ce collaborateur ?")) return;
    await deleteDoc(doc(db,"collaborateurs",id)); load();
  };

  const filtered = collabs
    .filter(c => c.type===tab)
    .filter(c => !search || c.nom?.toLowerCase().includes(search.toLowerCase()) || (c.role||c.specialite)?.toLowerCase().includes(search.toLowerCase()));

  const interneCount = collabs.filter(c=>c.type==="interne").length;
  const prestCount   = collabs.filter(c=>c.type==="prestataire").length;

  return (
    <div className="page">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:600, color:"#1a1a2e", marginBottom:3 }}>Collaborateurs</h1>
          <div style={{ fontSize:13, color:"#9ca3af" }}>{interneCount} membre{interneCount>1?"s":""} d'équipe · {prestCount} prestataire{prestCount>1?"s":""}</div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher..." style={{ ...st.input, width:200, padding:"8px 12px" }}/>
          <button onClick={()=>openForm()} style={st.btn}>+ Ajouter</button>
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[{id:"interne",label:`Équipe interne`,count:interneCount},{id:"prestataire",label:"Prestataires",count:prestCount}].map(t => (
          <button key={t.id} onClick={()=>{setTab(t.id);setShowForm(false);}}
            style={{ padding:"8px 18px", borderRadius:8, border:"1px solid "+(tab===t.id?"#1a1a2e":"#e5e7eb"), background:tab===t.id?"#1a1a2e":"white", color:tab===t.id?"white":"#6b7280", cursor:"pointer", fontSize:13, fontWeight:tab===t.id?500:400 }}>
            {t.label} <span style={{ opacity:.6, fontSize:11 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {showForm && (
        <div style={{ background:"white", borderRadius:14, padding:24, marginBottom:20, border:"1px solid #f0f0f0", boxShadow:"0 4px 16px rgba(0,0,0,.06)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:15, fontWeight:500 }}>{editId?"Modifier":"Nouveau"} {tab==="interne"?"membre":"prestataire"}</h3>
            <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{ background:"none", border:"none", fontSize:20, color:"#9ca3af", cursor:"pointer" }}>×</button>
          </div>
          <div className="grid-form-4" style={{ marginBottom:12 }}>
            <div><label style={st.label}>Nom complet *</label><input style={st.input} value={form.nom||""} onChange={e=>setForm({...form,nom:e.target.value})} placeholder="Prénom Nom"/></div>
            <div><label style={st.label}>{tab==="interne"?"Rôle":"Spécialité"}</label>
              <select style={st.input} value={tab==="interne"?form.role:form.specialite} onChange={e=>setForm(tab==="interne"?{...form,role:e.target.value}:{...form,specialite:e.target.value})}>
                {(tab==="interne"?ROLES:SPECIALITES).map(r=><option key={r}>{r}</option>)}
              </select>
            </div>
            <div><label style={st.label}>Téléphone</label><input style={st.input} value={form.telephone||""} onChange={e=>setForm({...form,telephone:e.target.value})} placeholder="06..."/></div>
            <div><label style={st.label}>Email</label><input style={st.input} value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} placeholder="...@..."/></div>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={st.label}>Notes</label>
            <textarea style={{ ...st.input, resize:"vertical", minHeight:52, fontFamily:"inherit" }} value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Ex : disponible 24h/24, tarif préférentiel..."/>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={save} style={st.btn}>{editId?"Mettre à jour":"Enregistrer"}</button>
            <button onClick={()=>{setShowForm(false);setEditId(null);}} style={{ ...st.btnSm, padding:"9px 16px" }}>Annuler</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:"center", padding:48, color:"#9ca3af" }}>Chargement...</div>
      ) : filtered.length===0 ? (
        <div style={{ textAlign:"center", padding:48, color:"#c0c0c0", background:"white", borderRadius:14, border:"1px dashed #e5e7eb" }}>
          {search ? `Aucun résultat pour "${search}"` : `Aucun ${tab==="interne"?"membre d'équipe":"prestataire"} — cliquez sur "+ Ajouter"`}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:16 }}>
          {filtered.map(c => <CollabCard key={c.id} c={c} onDelete={remove} onEdit={openForm}/>)}
        </div>
      )}
    </div>
  );
}
