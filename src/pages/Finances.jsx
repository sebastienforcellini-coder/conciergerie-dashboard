import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { calcCommission, commissionLabel } from "./Properties";

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function fmt(n) { return Math.round(n).toLocaleString("fr-FR"); }

export default function Finances() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedProperty, setSelectedProperty] = useState("all");

  useEffect(() => {
    const load = async () => {
      const [pSnap, bSnap, eSnap] = await Promise.all([
        getDocs(collection(db, "properties")),
        getDocs(collection(db, "bookings")),
        getDocs(collection(db, "expenses"))
      ]);
      setProperties(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBookings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setExpenses(eSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  const filteredBookings = bookings.filter(b => {
    const inYear = b.checkIn && b.checkIn.startsWith(String(selectedYear));
    const inProp = selectedProperty === "all" || b.propertyId === selectedProperty;
    return inYear && inProp;
  });

  const filteredExpenses = expenses.filter(e => {
    const inYear = e.date && e.date.startsWith(String(selectedYear));
    const inProp = selectedProperty === "all" || e.propertyId === selectedProperty;
    return inYear && inProp;
  });

  const totals = filteredBookings.reduce((acc, b) => {
    const prop = properties.find(p => p.id === b.propertyId);
    if (!prop) return acc;
    const { platformFee, commission, cleaning, reversement } = calcCommission(b, prop);
    return {
      revenue: acc.revenue + (b.amount || 0),
      platformFee: acc.platformFee + platformFee,
      commission: acc.commission + commission,
      cleaning: acc.cleaning + cleaning,
      reversement: acc.reversement + reversement,
    };
  }, { revenue: 0, platformFee: 0, commission: 0, cleaning: 0, reversement: 0 });

  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const monthlyData = MONTHS.map((_, mi) => {
    const mb = filteredBookings.filter(b => b.checkIn?.startsWith(`${selectedYear}-${String(mi+1).padStart(2,"0")}`));
    return mb.reduce((acc, b) => {
      const prop = properties.find(p => p.id === b.propertyId);
      if (!prop) return acc;
      const { commission } = calcCommission(b, prop);
      return { revenue: acc.revenue + (b.amount || 0), commission: acc.commission + commission };
    }, { revenue: 0, commission: 0 });
  });

  const maxMonthly = Math.max(...monthlyData.map(m => m.revenue), 1);

  const propRows = properties
    .filter(p => selectedProperty === "all" || p.id === selectedProperty)
    .map(p => {
      const pb = bookings.filter(b => b.propertyId === p.id && b.checkIn?.startsWith(String(selectedYear)));
      const pe = expenses.filter(e => e.propertyId === p.id && e.date?.startsWith(String(selectedYear)));
      const stats = pb.reduce((acc, b) => {
        const { platformFee, commission, cleaning, reversement } = calcCommission(b, p);
        return {
          revenue: acc.revenue + (b.amount || 0),
          platformFee: acc.platformFee + platformFee,
          commission: acc.commission + commission,
          cleaning: acc.cleaning + cleaning,
          reversement: acc.reversement + reversement,
        };
      }, { revenue: 0, platformFee: 0, commission: 0, cleaning: 0, reversement: 0 });
      const exp = pe.reduce((s, e) => s + (e.amount || 0), 0);
      return { ...p, ...stats, expenses: exp, count: pb.length };
    });

  const s = {
    page: { padding: 28 },
    topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
    h1: { margin: 0, fontSize: 22, fontWeight: 500, color: "#1a1a2e" },
    filters: { display: "flex", gap: 10 },
    select: { padding: "8px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, background: "white", cursor: "pointer" },
    kpiRow: { display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 10, marginBottom: 20 },
    kpi: { background: "#f8f8f8", borderRadius: 10, padding: "14px 16px" },
    kpiLbl: { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 },
    kpiVal: (color) => ({ fontSize: 20, fontWeight: 500, color: color || "#1a1a2e" }),
    row2: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 },
    card: { background: "white", border: "1px solid #f0f0f0", borderRadius: 12, padding: 20 },
    cardHd: { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 16 },
    th: { padding: "10px 12px", textAlign: "left", fontSize: 11, color: "#999", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", borderBottom: "1px solid #f0f0f0" },
    td: { padding: "10px 12px", fontSize: 13 },
  };

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <h1 style={s.h1}>Finances</h1>
        <div style={s.filters}>
          <select style={s.select} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select style={s.select} value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
            <option value="all">Tous les biens</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-4" style={{marginBottom:20}}>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Revenus bruts</div>
          <div style={s.kpiVal("#2ecc71")}>{fmt(totals.revenue)} MAD</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>{filteredBookings.length} réservations</div>
        </div>
        {totals.platformFee > 0 && (
          <div style={s.kpi}>
            <div style={s.kpiLbl}>Commissions plateformes</div>
            <div style={s.kpiVal("#e74c3c")}>− {fmt(totals.platformFee)} MAD</div>
            <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Airbnb / Booking</div>
          </div>
        )}
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Mes commissions</div>
          <div style={s.kpiVal("#f0c040")}>{fmt(totals.commission)} MAD</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>revenus conciergerie</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Dépenses</div>
          <div style={s.kpiVal("#e74c3c")}>− {fmt(totalExpenses)} MAD</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>charges des biens</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Reversement propriétaires</div>
          <div style={s.kpiVal("#3498db")}>{fmt(totals.reversement - totalExpenses)} MAD</div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>net total à reverser</div>
        </div>
      </div>

      <div className="grid-2-1" style={{marginBottom:16}}>
        <div style={s.card}>
          <div style={s.cardHd}>Revenus & commissions par mois — {selectedYear}</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
            {monthlyData.map((m, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 80, gap: 1 }}>
                  {m.revenue > 0 && (
                    <>
                      <div style={{ width: "100%", background: "#f0c040", borderRadius: "2px 2px 0 0", height: Math.round((m.commission / maxMonthly) * 80) + "px" }} />
                      <div style={{ width: "100%", background: "#1D9E75", height: Math.round(((m.revenue - m.commission) / maxMonthly) * 80) + "px" }} />
                    </>
                  )}
                  {m.revenue === 0 && <div style={{ width: "100%", background: "#f5f5f5", height: 4, borderRadius: 2 }} />}
                </div>
                <div style={{ fontSize: 9, color: "#bbb" }}>{MONTHS[i]}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
            {[["#1D9E75","Revenus nets"],["#f0c040","Ma commission"]].map(([bg, lbl]) => (
              <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#888" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, display: "inline-block" }} />{lbl}
              </span>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardHd}>Répartition</div>
          {totals.revenue > 0 ? (
            <div>
              {[
                { label: "Mes commissions", value: totals.commission, color: "#f0c040", pct: Math.round(totals.commission / totals.revenue * 100) },
                { label: "Frais plateformes", value: totals.platformFee, color: "#e74c3c", pct: Math.round(totals.platformFee / totals.revenue * 100) },
                { label: "Reversement", value: totals.reversement, color: "#3498db", pct: Math.round(totals.reversement / totals.revenue * 100) },
              ].map(item => (
                <div key={item.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: "#666" }}>{item.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{fmt(item.value)} MAD <span style={{ color: "#aaa" }}>({item.pct}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: "#f5f5f5", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: item.pct + "%", background: item.color, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p style={{ color: "#bbb", fontSize: 13 }}>Aucune donnée pour cette période.</p>}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardHd}>Détail par bien — {selectedYear}</div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {["Bien","Propriétaire","Modèle","Résa","Revenus bruts","Comm. plateformes","Ma commission","Dépenses","Reversement net"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {propRows.length === 0 && (
              <tr><td colSpan={9} style={{ ...s.td, textAlign: "center", color: "#bbb", padding: 32 }}>Aucune donnée</td></tr>
            )}
            {propRows.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 0 ? "white" : "#fafafa", borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ ...s.td, fontWeight: 500 }}>{p.name}</td>
                <td style={{ ...s.td, color: "#888" }}>{p.owner}</td>
                <td style={{ ...s.td, color: "#888" }}>{commissionLabel(p)}</td>
                <td style={s.td}>{p.count}</td>
                <td style={{ ...s.td, color: "#2ecc71", fontWeight: 500 }}>{fmt(p.revenue)}</td>
                <td style={{ ...s.td, color: "#e74c3c" }}>{p.platformFee > 0 ? `− ${fmt(p.platformFee)}` : "—"}</td>
                <td style={{ ...s.td, color: "#f0a500", fontWeight: 500 }}>{fmt(p.commission)}</td>
                <td style={{ ...s.td, color: "#e74c3c" }}>{p.expenses > 0 ? `− ${fmt(p.expenses)}` : "—"}</td>
                <td style={{ ...s.td, color: "#3498db", fontWeight: 500 }}>{fmt(p.reversement - p.expenses)}</td>
              </tr>
            ))}
          </tbody>
          {propRows.length > 1 && (
            <tfoot>
              <tr style={{ borderTop: "2px solid #f0f0f0", background: "#f8f8f8" }}>
                <td colSpan={4} style={{ ...s.td, fontWeight: 600, color: "#1a1a2e" }}>TOTAL</td>
                <td style={{ ...s.td, color: "#2ecc71", fontWeight: 600 }}>{fmt(totals.revenue)}</td>
                <td style={{ ...s.td, color: "#e74c3c", fontWeight: 600 }}>{totals.platformFee > 0 ? `− ${fmt(totals.platformFee)}` : "—"}</td>
                <td style={{ ...s.td, color: "#f0a500", fontWeight: 600 }}>{fmt(totals.commission)}</td>
                <td style={{ ...s.td, color: "#e74c3c", fontWeight: 600 }}>{totalExpenses > 0 ? `− ${fmt(totalExpenses)}` : "—"}</td>
                <td style={{ ...s.td, color: "#3498db", fontWeight: 600 }}>{fmt(totals.reversement - totalExpenses)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
