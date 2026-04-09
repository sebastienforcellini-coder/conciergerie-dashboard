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
  { value: "percent_brut", label: "% sur montant brut", desc: "Ex : 20% du total Airbnb encaissé" },
  { value: "percent_net", label: "% sur montant net", desc: "Après déduction commission plateforme" },
  { value: "fixed_per_night", label: "Montant fixe / nuit", desc: "Ex : 200 MAD par nuit, quelle que soit la résa" },
  { value: "per_platform", label: "% différent par plateforme", desc: "Airbnb 20%, Direct 15%, etc." },
];

const s = {
  page: { padding: 32 },
  topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  h1: { margin: 0, fontSize: 24, fontWeight: 500 },
  btn: { background: "#1a1a2e", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  card: { background: "white", borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: "0 1px 4px #0001", border: "1px solid #f0f0f0" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 12, color: "#888" },
  input: { padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, outline: "none" },
  select: { padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, background: "white" },
  section: { fontSize: 12, fontWeight: 600, color: "#1a1a2e", textTransform: "uppercase", letterSpacing: ".5px", margin: "20px 0 12px" },
  modeCard: (active) => ({
    border: active ? "2px solid #1a1a2e" : "1px solid #e0e0e0",
    borderRadius: 8, padding: "10px 14px", cursor: "pointer",
    background: active ? "#f8f8ff" : "white",
  }),
  modeTitle: (active) => ({ fontSize: 13, fontWeight: 600, color: active ? "#1a1a2e" : "#444" }),
  modeDesc: { fontSize: 11, color: "#888", marginTop: 2 },
  propCard: { background: "white", borderRadius: 12, padding: 20, boxShadow: "0 1px 4px #0001", border: "1px solid #f0f0f0", cursor: "pointer", transition: "box-shadow .15s" },
  badge: (color, bg) => ({ background: bg, color, padding: "2px 10px", borderRadius: 20, fontSize: 12 }),
  actions: { display: "flex", gap: 8, marginTop: 16 },
  btnSave: { background: "#1a1a2e", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  btnCancel: { background: "#f0f0f0", border: "none", padding: "10px 20px", borderRadius: 8, cursor: "pointer", fontSize: 14 },
  btnDanger: { background: "none", border: "1px solid #e8e8e8", color: "#bbb", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12 },
};

function CommissionConfigurator({ rules, onChange }) {
  const set = (key, val) => onChange({ ...rules, [key]: val });
  const setRate = (platform, val) => onChange({ ...rules, rates: { ...rules.rates, [platform]: Number(val) } });

  return (
    <div>
      <div style={s.section}>Modèle de commission</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {MODES.map(m => (
          <div key={m.value} style={s.modeCard(rules.mode === m.value)} onClick={() => set("mode", m.value)}>
            <div style={s.modeTitle(rules.mode === m.value)}>{m.label}</div>
            <div style={s.modeDesc}>{m.desc}</div>
          </div>
        ))}
      </div>

      {(rules.mode === "percent_brut" || rules.mode === "percent_net") && (
        <div style={{ ...s.grid2, marginBottom: 12 }}>
          <div style={s.field}>
            <label style={s.label}>Taux de commission (%)</label>
            <input type="number" style={s.input} value={rules.rate}
              onChange={e => set("rate", Number(e.target.value))} min={0} max={100} />
          </div>
        </div>
      )}

      {rules.mode === "fixed_per_night" && (
        <div style={{ ...s.grid2, marginBottom: 12 }}>
          <div style={s.field}>
            <label style={s.label}>Montant fixe par nuit (MAD)</label>
            <input type="number" style={s.input} value={rules.amountPerNight}
              onChange={e => set("amountPerNight", Number(e.target.value))} min={0} />
          </div>
        </div>
      )}

      {rules.mode === "per_platform" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          {PLATFORMS.slice(0, 4).map(p => (
            <div key={p} style={s.field}>
              <label style={s.label}>{p} (%)</label>
              <input type="number" style={s.input} value={rules.rates?.[p] ?? 20}
                onChange={e => setRate(p, e.target.value)} min={0} max={100} />
            </div>
          ))}
        </div>
      )}

      <div style={{ ...s.grid2, marginBottom: 12 }}>
        <div style={s.field}>
          <label style={{ ...s.label, display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={rules.platformFeeIncluded}
              onChange={e => set("platformFeeIncluded", e.target.checked)} />
            Déduire commission plateforme avant calcul
          </label>
        </div>
        {rules.platformFeeIncluded && (
          <div style={s.field}>
            <label style={s.label}>Taux commission plateforme (%)</label>
            <input type="number" style={s.input} value={rules.platformFeeRate}
              onChange={e => set("platformFeeRate", Number(e.target.value))} min={0} max={30} step={0.5} />
          </div>
        )}
      </div>

      <div style={{ ...s.grid2, marginBottom: 12 }}>
        <div style={s.field}>
          <label style={s.label}>Frais ménage fixes par séjour (MAD, 0 = aucun)</label>
          <input type="number" style={s.input} value={rules.cleaningFee}
            onChange={e => set("cleaningFee", Number(e.target.value))} min={0} />
        </div>
      </div>

      <div style={s.field}>
        <label style={s.label}>Notes / accord particulier</label>
        <textarea style={{ ...s.input, resize: "vertical", minHeight: 60, fontFamily: "inherit" }}
          value={rules.notes} onChange={e => set("notes", e.target.value)}
          placeholder="Ex : commission réduite à 15% en juillet-août, frais de ménage à la charge du propriétaire..." />
      </div>
    </div>
  );
}

export function calcCommission(booking, property) {
  const rules = property.commissionRules || { mode: "percent_brut", rate: 20, platformFeeIncluded: false, platformFeeRate: 3, cleaningFee: 0 };
  const amount = booking.amount || 0;
  const nights = booking.nights || 1;

  let platformFee = 0;
  if (rules.platformFeeIncluded) {
    platformFee = Math.round(amount * (rules.platformFeeRate || 3) / 100);
  }

  const base = rules.platformFeeIncluded ? amount - platformFee : amount;

  let commission = 0;
  if (rules.mode === "percent_brut") {
    commission = Math.round(amount * (rules.rate || 20) / 100);
  } else if (rules.mode === "percent_net") {
    commission = Math.round(base * (rules.rate || 20) / 100);
  } else if (rules.mode === "fixed_per_night") {
    commission = Math.round((rules.amountPerNight || 0) * nights);
  } else if (rules.mode === "per_platform") {
    const rate = rules.rates?.[booking.platform] ?? 20;
    commission = Math.round(amount * rate / 100);
  }

  const cleaning = rules.cleaningFee || 0;
  const reversement = Math.round(amount - platformFee - commission - cleaning);

  return { platformFee, commission, cleaning, reversement };
}

export function commissionLabel(property) {
  const rules = property.commissionRules;
  if (!rules) return "20%";
  if (rules.mode === "percent_brut") return `${rules.rate}% brut`;
  if (rules.mode === "percent_net") return `${rules.rate}% net`;
  if (rules.mode === "fixed_per_night") return `${rules.amountPerNight} MAD/nuit`;
  if (rules.mode === "per_platform") return "Multi-taux";
  return "—";
}

export default function Properties() {
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    const snap = await getDocs(collection(db, "properties"));
    setProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name || !form.owner) return alert("Nom et propriétaire requis");
    await addDoc(collection(db, "properties"), form);
    setForm(emptyForm);
    setShowForm(false);
    load();
  };

  const remove = async (e, id) => {
    e.stopPropagation();
    if (!confirm("Supprimer cette propriété ?")) return;
    await deleteDoc(doc(db, "properties", id));
    load();
  };

  const setRules = (rules) => setForm(f => ({ ...f, commissionRules: rules }));

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <h1 style={s.h1}>Propriétés ({properties.length})</h1>
        <button style={s.btn} onClick={() => setShowForm(!showForm)}>+ Ajouter une propriété</button>
      </div>

      {showForm && (
        <div style={s.card}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 500 }}>Nouvelle propriété</h3>
          <div style={s.grid2}>
            {[["name","Nom de la propriété *"],["owner","Propriétaire *"],["phone","Téléphone"],["email","Email"],["address","Adresse"]].map(([key, label]) => (
              <div key={key} style={s.field}>
                <label style={s.label}>{label}</label>
                <input style={s.input} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
          </div>

          <div style={s.section}>Liens iCal</div>
          <div style={s.grid2}>
            {[["icalAirbnb","iCal Airbnb"],["icalBooking","iCal Booking"]].map(([key, label]) => (
              <div key={key} style={s.field}>
                <label style={s.label}>{label}</label>
                <input style={s.input} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} placeholder="https://..." />
              </div>
            ))}
          </div>

          <CommissionConfigurator rules={form.commissionRules} onChange={setRules} />

          <div style={s.actions}>
            <button style={s.btnSave} onClick={save}>Enregistrer</button>
            <button style={s.btnCancel} onClick={() => setShowForm(false)}>Annuler</button>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: "#999" }}>Chargement...</p> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {properties.length === 0 && <p style={{ color: "#999" }}>Aucune propriété — ajoutez-en une !</p>}
          {properties.map(p => (
            <div key={p.id} style={s.propCard}
              onClick={() => navigate(`/property/${p.id}`)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px #0002"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 4px #0001"}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 500 }}>{p.name}</h3>
                <span style={s.badge("#b8860b", "#f0c04020")}>{commissionLabel(p)}</span>
              </div>
              <p style={{ color: "#666", margin: "8px 0 4px", fontSize: 13 }}>Propriétaire : {p.owner}</p>
              {p.phone && <p style={{ color: "#888", margin: "3px 0", fontSize: 13 }}>Tél : {p.phone}</p>}
              {p.address && <p style={{ color: "#888", margin: "3px 0", fontSize: 13 }}>Adresse : {p.address}</p>}
              {p.commissionRules?.notes && (
                <p style={{ color: "#999", margin: "6px 0 0", fontSize: 12, fontStyle: "italic" }}>
                  {p.commissionRules.notes.substring(0, 60)}{p.commissionRules.notes.length > 60 ? "…" : ""}
                </p>
              )}
              <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {p.icalAirbnb && <span style={s.badge("#ff5850", "#ff585018")}>Airbnb</span>}
                {p.icalBooking && <span style={s.badge("#003198", "#00319818")}>Booking</span>}
                {p.commissionRules?.mode === "per_platform" && <span style={s.badge("#534AB7", "#EEEDFE")}>Multi-taux</span>}
              </div>
              <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#aaa" }}>Voir la fiche →</span>
                <button style={s.btnDanger} onClick={e => remove(e, p.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
