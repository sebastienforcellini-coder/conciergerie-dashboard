import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { calcCommission, commissionLabel } from "./Properties";

const PLATFORMS = ["Airbnb", "Booking", "Direct", "Gens de confiance", "Autre"];
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const PLT_COLORS = {
  Airbnb: { bg: "#ff585018", color: "#c0392b" },
  Booking: { bg: "#00319818", color: "#003198" },
  Direct: { bg: "#2ecc7118", color: "#1a7a44" },
  "Gens de confiance": { bg: "#EEEDFE", color: "#534AB7" },
  Autre: { bg: "#f0f0f0", color: "#666" },
};

const emptyBooking = {
  name: "", platform: "Airbnb", checkIn: "", checkOut: "",
  amount: "", guests: "", notes: "", paid: false,
};

const s = {
  page: { padding: 28 },
  back: { background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 13, padding: "0 0 16px", display: "flex", alignItems: "center", gap: 6 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  h1: { margin: "0 0 4px", fontSize: 22, fontWeight: 500 },
  owner: { fontSize: 14, color: "#888" },
  badge: (bg, color) => ({ background: bg, color, fontSize: 12, padding: "3px 10px", borderRadius: 99, fontWeight: 500 }),
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 20 },
  kpi: { background: "#f8f8f8", borderRadius: 10, padding: "14px 16px" },
  kpiLbl: { fontSize: 11, color: "#999", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".4px" },
  kpiVal: (color) => ({ fontSize: 20, fontWeight: 500, color: color || "#1a1a2e" }),
  row2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 },
  card: { background: "white", border: "1px solid #f0f0f0", borderRadius: 12, padding: 20 },
  cardHd: { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 14 },
  btn: { background: "#1a1a2e", color: "white", border: "none", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontSize: 13 },
  btnSm: { background: "none", border: "1px solid #e0e0e0", color: "#666", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12 },
  input: { padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, width: "100%", boxSizing: "border-box" },
  select: { padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, width: "100%", background: "white" },
  label: { fontSize: 11, color: "#888", display: "block", marginBottom: 3 },
  brow: { display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #f5f5f5" },
  yearBtn: (active) => ({
    padding: "5px 12px", borderRadius: 6, border: "1px solid " + (active ? "#1a1a2e" : "#e0e0e0"),
    background: active ? "#1a1a2e" : "white", color: active ? "white" : "#666",
    cursor: "pointer", fontSize: 13
  }),
};

function nights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}

function fmt(n) { return Math.round(n).toLocaleString("fr-FR"); }

export default function PropertyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyBooking);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [pSnap, bSnap] = await Promise.all([
      getDocs(collection(db, "properties")),
      getDocs(query(collection(db, "bookings"), where("propertyId", "==", id)))
    ]);
    const props = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setProperty(props.find(p => p.id === id) || null);
    setBookings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const yearBookings = bookings.filter(b => b.checkIn?.startsWith(String(year)));

  const totalStats = yearBookings.reduce((acc, b) => {
    const { platformFee, commission, cleaning, reversement } = calcCommission(b, property || {});
    return {
      revenue: acc.revenue + (b.amount || 0),
      platformFee: acc.platformFee + platformFee,
      commission: acc.commission + commission,
      cleaning: acc.cleaning + cleaning,
      reversement: acc.reversement + reversement,
      nights: acc.nights + (b.nights || nights(b.checkIn, b.checkOut)),
    };
  }, { revenue: 0, platformFee: 0, commission: 0, cleaning: 0, reversement: 0, nights: 0 });

  const monthlyRevenue = MONTHS.map((_, mi) => {
    const mb = yearBookings.filter(b => b.checkIn?.startsWith(`${year}-${String(mi+1).padStart(2,"0")}`));
    return mb.reduce((s, b) => s + (b.amount || 0), 0);
  });
  const maxMonth = Math.max(...monthlyRevenue, 1);

  const openForm = (b = null) => {
    if (b) {
      setForm({ name: b.name, platform: b.platform, checkIn: b.checkIn, checkOut: b.checkOut, amount: b.amount, guests: b.guests || "", notes: b.notes || "", paid: b.paid || false });
      setEditId(b.id);
    } else {
      setForm(emptyBooking);
      setEditId(null);
    }
    setShowForm(true);
  };

  const saveBooking = async () => {
    if (!form.checkIn || !form.checkOut || !form.amount) return alert("Dates et montant requis");
    const n = nights(form.checkIn, form.checkOut);
    const data = { ...form, propertyId: id, nights: n, amount: Number(form.amount), guests: form.guests ? String(form.guests) : "" };
    if (editId) {
      await updateDoc(doc(db, "bookings", editId), data);
    } else {
      await addDoc(collection(db, "bookings"), data);
    }
    setShowForm(false);
    setForm(emptyBooking);
    setEditId(null);
    load();
  };

  const deleteBooking = async (bid) => {
    if (!confirm("Supprimer cette réservation ?")) return;
    await deleteDoc(doc(db, "bookings", bid));
    load();
  };

  const togglePaid = async (b) => {
    await updateDoc(doc(db, "bookings", b.id), { paid: !b.paid });
    load();
  };

  if (loading) return <div style={{ padding: 32, color: "#999" }}>Chargement...</div>;
  if (!property) return <div style={{ padding: 32, color: "#999" }}>Propriété introuvable.</div>;

  return (
    <div style={s.page}>
      <button style={s.back} onClick={() => navigate("/")}>← Retour</button>

      <div style={s.header}>
        <div>
          <h1 style={s.h1}>{property.name}</h1>
          <div style={s.owner}>{property.owner}{property.phone ? ` · ${property.phone}` : ""}{property.email ? ` · ${property.email}` : ""}</div>
          {property.address && <div style={{ fontSize: 13, color: "#aaa", marginTop: 2 }}>{property.address}</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <span style={s.badge("#f0c04030", "#b8860b")}>{commissionLabel(property)}</span>
          {property.commissionRules?.notes && (
            <span style={{ fontSize: 11, color: "#aaa", fontStyle: "italic", maxWidth: 200, textAlign: "right" }}>{property.commissionRules.notes}</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[2024, 2025, 2026, 2027].map(y => (
          <button key={y} style={s.yearBtn(year === y)} onClick={() => setYear(y)}>{y}</button>
        ))}
      </div>

      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Revenus bruts</div>
          <div style={s.kpiVal("#2ecc71")}>{fmt(totalStats.revenue)} MAD</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{yearBookings.length} résa · {totalStats.nights} nuits</div>
        </div>
        {totalStats.platformFee > 0 && (
          <div style={s.kpi}>
            <div style={s.kpiLbl}>Commission plateforme</div>
            <div style={s.kpiVal("#e74c3c")}>− {fmt(totalStats.platformFee)} MAD</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{property.commissionRules?.platformFeeRate}%</div>
          </div>
        )}
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Ma commission</div>
          <div style={s.kpiVal("#f0c040")}>+ {fmt(totalStats.commission)} MAD</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{commissionLabel(property)}</div>
        </div>
        {totalStats.cleaning > 0 && (
          <div style={s.kpi}>
            <div style={s.kpiLbl}>Frais ménage</div>
            <div style={s.kpiVal("#e67e22")}>− {fmt(totalStats.cleaning)} MAD</div>
          </div>
        )}
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Reversement propriétaire</div>
          <div style={s.kpiVal("#3498db")}>{fmt(totalStats.reversement)} MAD</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>net à reverser</div>
        </div>
      </div>

      <div style={s.row2}>
        <div style={s.card}>
          <div style={s.cardHd}>Revenus par mois — {year}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
            {monthlyRevenue.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", background: v > 0 ? "#1D9E75" : "#f0f0f0", borderRadius: "3px 3px 0 0", height: Math.round((v / maxMonth) * 64) + "px", minHeight: v > 0 ? 4 : 0, transition: "height .2s" }} />
                <div style={{ fontSize: 9, color: "#aaa" }}>{MONTHS[i]}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardHd}>Détail commission — exemple calcul</div>
          {yearBookings.slice(0, 1).map(b => {
            const c = calcCommission(b, property);
            return (
              <div key={b.id} style={{ fontSize: 13 }}>
                <div style={{ color: "#888", marginBottom: 8, fontSize: 12 }}>Exemple : {b.name} — {b.platform}</div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ color: "#666" }}>Montant encaissé</span><span style={{ fontWeight: 500 }}>{fmt(b.amount)} MAD</span>
                </div>
                {c.platformFee > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ color: "#e74c3c" }}>− Commission {b.platform}</span><span style={{ color: "#e74c3c" }}>− {fmt(c.platformFee)} MAD</span>
                </div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ color: "#f0a500" }}>− Ma commission</span><span style={{ color: "#f0a500" }}>− {fmt(c.commission)} MAD</span>
                </div>
                {c.cleaning > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f5f5f5" }}>
                  <span style={{ color: "#e67e22" }}>− Frais ménage</span><span style={{ color: "#e67e22" }}>− {fmt(c.cleaning)} MAD</span>
                </div>}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", marginTop: 4 }}>
                  <span style={{ fontWeight: 500, color: "#3498db" }}>= Reversement</span><span style={{ fontWeight: 500, color: "#3498db" }}>{fmt(c.reversement)} MAD</span>
                </div>
              </div>
            );
          })}
          {yearBookings.length === 0 && <p style={{ color: "#aaa", fontSize: 13 }}>Aucune réservation cette année.</p>}
        </div>
      </div>

      <div style={s.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={s.cardHd}>Réservations {year}</div>
          <button style={s.btn} onClick={() => openForm()}>+ Ajouter</button>
        </div>

        {showForm && (
          <div style={{ background: "#f9f9f9", borderRadius: 10, padding: 20, marginBottom: 20, border: "1px solid #eee" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={s.label}>Voyageur</label>
                <input style={s.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Prénom" />
              </div>
              <div>
                <label style={s.label}>Plateforme</label>
                <select style={s.select} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
                  {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Arrivée</label>
                <input type="date" style={s.input} value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Départ</label>
                <input type="date" style={s.input} value={form.checkOut} onChange={e => setForm({ ...form, checkOut: e.target.value })} />
              </div>
              <div>
                <label style={s.label}>Montant (MAD)</label>
                <input type="number" style={s.input} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
              </div>
              <div>
                <label style={s.label}>Voyageurs</label>
                <input type="number" style={s.input} value={form.guests} onChange={e => setForm({ ...form, guests: e.target.value })} placeholder="2" />
              </div>
              <div>
                <label style={s.label}>Notes</label>
                <input style={s.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="..." />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
                <input type="checkbox" id="paid" checked={form.paid} onChange={e => setForm({ ...form, paid: e.target.checked })} />
                <label htmlFor="paid" style={{ fontSize: 13, color: "#666" }}>Encaissé</label>
              </div>
            </div>
            {form.checkIn && form.checkOut && form.amount && (
              <div style={{ background: "#eaf6ff", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
                {(() => {
                  const preview = calcCommission({ ...form, nights: nights(form.checkIn, form.checkOut), amount: Number(form.amount) }, property);
                  return (
                    <span>
                      {nights(form.checkIn, form.checkOut)} nuits ·
                      {preview.platformFee > 0 ? ` Plateforme : −${fmt(preview.platformFee)} MAD ·` : ""}
                      {" "}Ma commission : <strong>{fmt(preview.commission)} MAD</strong> ·
                      Reversement : <strong style={{ color: "#3498db" }}>{fmt(preview.reversement)} MAD</strong>
                    </span>
                  );
                })()}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btn} onClick={saveBooking}>{editId ? "Mettre à jour" : "Enregistrer"}</button>
              <button style={{ ...s.btnSm, padding: "9px 16px" }} onClick={() => { setShowForm(false); setEditId(null); }}>Annuler</button>
            </div>
          </div>
        )}

        {yearBookings.length === 0 && !showForm && <p style={{ color: "#aaa", fontSize: 13 }}>Aucune réservation pour {year}.</p>}

        {yearBookings.sort((a, b) => a.checkIn > b.checkIn ? 1 : -1).map(b => {
          const c = calcCommission(b, property);
          const plt = PLT_COLORS[b.platform] || PLT_COLORS["Autre"];
          const n = b.nights || nights(b.checkIn, b.checkOut);
          return (
            <div key={b.id} style={s.brow}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: plt.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: plt.color }}>{(b.name || "?").charAt(0).toUpperCase()}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{b.name || "—"}</div>
                <div style={{ fontSize: 11, color: "#aaa" }}>{b.checkIn} → {b.checkOut} · {n} nuit{n > 1 ? "s" : ""} · {b.guests || "?"} pers.</div>
              </div>
              <span style={{ ...s.badge(plt.bg, plt.color), fontSize: 11 }}>{b.platform}</span>
              <div style={{ textAlign: "right", minWidth: 120 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{fmt(b.amount)} MAD</div>
                <div style={{ fontSize: 11, color: "#3498db" }}>→ {fmt(c.reversement)} MAD</div>
              </div>
              <button onClick={() => togglePaid(b)} style={{ ...s.btnSm, background: b.paid ? "#eaf7f0" : "white", color: b.paid ? "#1a7a44" : "#999", minWidth: 80 }}>
                {b.paid ? "Encaissé" : "Non payé"}
              </button>
              <button style={s.btnSm} onClick={() => openForm(b)}>Éditer</button>
              <button style={{ ...s.btnSm, color: "#e74c3c", borderColor: "#fdd" }} onClick={() => deleteBooking(b.id)}>Suppr.</button>
            </div>
          );
        })}

        {yearBookings.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, padding: "12px 0 0", fontSize: 13, borderTop: "1px solid #f0f0f0", marginTop: 8 }}>
            <span style={{ color: "#888" }}>Total : <strong style={{ color: "#2ecc71" }}>{fmt(totalStats.revenue)} MAD</strong></span>
            <span style={{ color: "#888" }}>Commission : <strong style={{ color: "#f0a500" }}>{fmt(totalStats.commission)} MAD</strong></span>
            <span style={{ color: "#888" }}>À reverser : <strong style={{ color: "#3498db" }}>{fmt(totalStats.reversement)} MAD</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
