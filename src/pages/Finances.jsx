import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

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

  const totalRevenue = filteredBookings.reduce((s, b) => s + (b.amount || 0), 0);
  const totalCommission = filteredBookings.reduce((s, b) => {
    const prop = properties.find(p => p.id === b.propertyId);
    const rate = prop ? prop.commissionRate : 20;
    return s + (b.amount || 0) * rate / 100;
  }, 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalReversement = totalRevenue - totalCommission - totalExpenses;

  const statCard = (label, value, color) => (
    <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px #0001", flex: 1 }}>
      <div style={{ fontSize: 13, color: "#999", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value.toLocaleString("fr-FR")} MAD</div>
    </div>
  );

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Finances</h1>
        <div style={{ display: "flex", gap: 12 }}>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
            <option value="all">Toutes les proprietes</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
        {statCard("Revenus bruts", totalRevenue, "#2ecc71")}
        {statCard("Commissions", totalCommission, "#f0c040")}
        {statCard("Depenses", totalExpenses, "#e74c3c")}
        {statCard("Reversement proprietaires", totalReversement, "#3498db")}
      </div>

      <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px #0001" }}>
        <h3 style={{ marginTop: 0 }}>Detail par propriete</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              {["Propriete", "Proprietaire", "Reservations", "Revenus", "Commission", "Depenses", "Reversement"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 13, color: "#666" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {properties.map((p, i) => {
              const pb = bookings.filter(b => b.propertyId === p.id && b.checkIn && b.checkIn.startsWith(String(selectedYear)));
              const pe = expenses.filter(e => e.propertyId === p.id && e.date && e.date.startsWith(String(selectedYear)));
              const rev = pb.reduce((s, b) => s + (b.amount || 0), 0);
              const com = pb.reduce((s, b) => s + (b.amount || 0) * (p.commissionRate || 20) / 100, 0);
              const exp = pe.reduce((s, e) => s + (e.amount || 0), 0);
              const reversement = rev - com - exp;
              return (
                <tr key={p.id} style={{ borderTop: "1px solid #f0f0f0", background: i % 2 === 0 ? "white" : "#fafafa" }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{p.name}</td>
                  <td style={{ padding: "10px 12px", color: "#666" }}>{p.owner}</td>
                  <td style={{ padding: "10px 12px" }}>{pb.length}</td>
                  <td style={{ padding: "10px 12px", color: "#2ecc71", fontWeight: 600 }}>{rev.toLocaleString("fr-FR")}</td>
                  <td style={{ padding: "10px 12px", color: "#f0c040", fontWeight: 600 }}>{Math.round(com).toLocaleString("fr-FR")}</td>
                  <td style={{ padding: "10px 12px", color: "#e74c3c", fontWeight: 600 }}>{exp.toLocaleString("fr-FR")}</td>
                  <td style={{ padding: "10px 12px", color: "#3498db", fontWeight: 600 }}>{Math.round(reversement).toLocaleString("fr-FR")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
