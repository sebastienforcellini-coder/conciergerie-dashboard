import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";

export default function Export() {
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

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const propsToExport = selectedProperty === "all"
      ? properties
      : properties.filter(p => p.id === selectedProperty);

    propsToExport.forEach(p => {
      const pb = bookings.filter(b =>
        b.propertyId === p.id && b.checkIn && b.checkIn.startsWith(String(selectedYear))
      );
      const pe = expenses.filter(e =>
        e.propertyId === p.id && e.date && e.date.startsWith(String(selectedYear))
      );
      const rev = pb.reduce((s, b) => s + (b.amount || 0), 0);
      const com = pb.reduce((s, b) => s + (b.amount || 0) * (p.commissionRate || 20) / 100, 0);
      const exp = pe.reduce((s, e) => s + (e.amount || 0), 0);

      const rows = [
        { A: "Propriete", B: p.name, C: "Proprietaire", D: p.owner, E: "Annee", F: selectedYear },
        { A: "" },
        { A: "RESERVATIONS" },
        { A: "Voyageur", B: "Plateforme", C: "Arrivee", D: "Depart", E: "Nuits", F: "Montant MAD", G: "Commission MAD", H: "Paye" },
      ];

      pb.forEach(b => {
        rows.push({
          A: b.name || "",
          B: b.platform || "",
          C: b.checkIn || "",
          D: b.checkOut || "",
          E: b.nights || "",
          F: b.amount || 0,
          G: Math.round((b.amount || 0) * (p.commissionRate || 20) / 100),
          H: b.paid ? "Oui" : "Non",
        });
      });

      rows.push({ A: "TOTAL RESERVATIONS", F: rev, G: Math.round(com) });
      rows.push({ A: "" });
      rows.push({ A: "DEPENSES" });
      rows.push({ A: "Date", B: "Categorie", C: "Description", F: "Montant MAD" });

      pe.forEach(e => {
        rows.push({
          A: e.date || "",
          B: e.category || "",
          C: e.description || "",
          F: e.amount || 0,
        });
      });

      rows.push({ A: "TOTAL DEPENSES", F: exp });
      rows.push({ A: "" });
      rows.push({ A: "RESUME" });
      rows.push({ A: "Revenus bruts", F: rev });
      rows.push({ A: "Commissions conciergerie", F: Math.round(com) });
      rows.push({ A: "Depenses", F: exp });
      rows.push({ A: "Reversement proprietaire", F: Math.round(rev - com - exp) });

      const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });
      XLSX.utils.book_append_sheet(wb, ws, p.name.substring(0, 28));
    });

    XLSX.writeFile(wb, "conciergerie-" + selectedYear + ".xlsx");
  };

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ marginBottom: 24 }}>Export Excel</h1>
      <div style={{ background: "white", borderRadius: 12, padding: 32, boxShadow: "0 2px 8px #0001", maxWidth: 500 }}>
        <h3 style={{ marginTop: 0 }}>Exporter en Excel</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 6 }}>Annee</label>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, color: "#666", display: "block", marginBottom: 6 }}>Propriete</label>
          <select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14 }}>
            <option value="all">Toutes les proprietes (1 onglet par propriete)</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name} - {p.owner}</option>)}
          </select>
        </div>
        <button onClick={exportExcel} style={{
          width: "100%", background: "#1a1a2e", color: "white",
          border: "none", padding: "14px", borderRadius: 8,
          cursor: "pointer", fontSize: 16, fontWeight: 600
        }}>
          Telecharger Excel
        </button>
        <p style={{ fontSize: 12, color: "#999", marginTop: 16, textAlign: "center" }}>
          Un onglet par propriete avec reservations, depenses et reversement
        </p>
      </div>
    </div>
  );
}
