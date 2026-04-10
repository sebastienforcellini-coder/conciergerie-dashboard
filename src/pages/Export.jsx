import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { calcCommission, commissionLabel } from "./Properties";
import * as XLSX from "xlsx";

function fmt(n) { return Math.round(n); }

export default function Export() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedProperty, setSelectedProperty] = useState("all");
  const [loading, setLoading] = useState(false);

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

  const exportExcel = async () => {
    setLoading(true);
    const wb = XLSX.utils.book_new();
    const propsToExport = selectedProperty === "all"
      ? properties
      : properties.filter(p => p.id === selectedProperty);

    propsToExport.forEach(p => {
      const pb = bookings
        .filter(b => b.propertyId === p.id && b.checkIn?.startsWith(String(selectedYear)))
        .sort((a, b) => a.checkIn > b.checkIn ? 1 : -1);
      const pe = expenses.filter(e => e.propertyId === p.id && e.date?.startsWith(String(selectedYear)));

      const totals = pb.reduce((acc, b) => {
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

      const rows = [];

      rows.push({ A: "BIEN", B: p.name, C: "", D: "PROPRIÉTAIRE", E: p.owner, F: "", G: "ANNÉE", H: selectedYear });
      rows.push({ A: "MODÈLE COMMISSION", B: commissionLabel(p), C: "", D: p.commissionRules?.notes || "" });
      rows.push({ A: "" });

      rows.push({ A: "──── RÉSERVATIONS ────" });
      rows.push({
        A: "Voyageur", B: "Plateforme", C: "Arrivée", D: "Départ", E: "Nuits",
        F: "Voyageurs", G: "Montant brut MAD", H: "Comm. plateforme MAD",
        I: "Ma commission MAD", J: "Frais ménage MAD", K: "Reversement MAD", L: "Encaissé"
      });

      pb.forEach(b => {
        const { platformFee, commission, cleaning, reversement } = calcCommission(b, p);
        rows.push({
          A: b.name || "",
          B: b.platform || "",
          C: b.checkIn || "",
          D: b.checkOut || "",
          E: b.nights || 0,
          F: b.guests || "",
          G: fmt(b.amount || 0),
          H: platformFee > 0 ? fmt(platformFee) : 0,
          I: fmt(commission),
          J: cleaning > 0 ? fmt(cleaning) : 0,
          K: fmt(reversement),
          L: b.paid ? "Oui" : "Non",
        });
      });

      rows.push({ A: "" });
      rows.push({
        A: "TOTAL RÉSERVATIONS", B: "", C: "", D: "", E: "",
        F: "", G: fmt(totals.revenue),
        H: totals.platformFee > 0 ? fmt(totals.platformFee) : 0,
        I: fmt(totals.commission),
        J: totals.cleaning > 0 ? fmt(totals.cleaning) : 0,
        K: fmt(totals.reversement),
      });

      rows.push({ A: "" });
      rows.push({ A: "──── DÉPENSES ────" });
      rows.push({ A: "Date", B: "Catégorie", C: "Description", G: "Montant MAD" });

      pe.forEach(e => {
        rows.push({ A: e.date || "", B: e.category || "", C: e.description || "", G: fmt(e.amount || 0) });
      });

      rows.push({ A: "TOTAL DÉPENSES", G: fmt(exp) });
      rows.push({ A: "" });

      rows.push({ A: "──── RÉSUMÉ ────" });
      rows.push({ A: "Revenus bruts", G: fmt(totals.revenue) });
      if (totals.platformFee > 0) rows.push({ A: "Commission plateforme", G: `− ${fmt(totals.platformFee)}` });
      rows.push({ A: "Ma commission conciergerie", G: `− ${fmt(totals.commission)}` });
      if (totals.cleaning > 0) rows.push({ A: "Frais ménage", G: `− ${fmt(totals.cleaning)}` });
      if (exp > 0) rows.push({ A: "Dépenses", G: `− ${fmt(exp)}` });
      rows.push({ A: "REVERSEMENT NET PROPRIÉTAIRE", G: fmt(totals.reversement - exp) });

      const ws = XLSX.utils.json_to_sheet(rows, { skipHeader: true });

      ws["!cols"] = [
        { wch: 20 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 6 },
        { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 10 }
      ];

      const sheetName = p.name.substring(0, 28).replace(/[\\/?*[\]:]/g, "");
      XLSX.utils.book_append_sheet(wb, ws, sheetName || `Bien${properties.indexOf(p) + 1}`);
    });

    if (selectedProperty === "all" && properties.length > 1) {
      const summaryRows = [];
      summaryRows.push({ A: "RÉCAPITULATIF GÉNÉRAL", B: "", C: "", D: "", E: "", F: "", G: "", H: "", I: String(selectedYear) });
      summaryRows.push({ A: "" });
      summaryRows.push({
        A: "Bien", B: "Propriétaire", C: "Modèle", D: "Réservations",
        E: "Revenus bruts", F: "Comm. plateforme", G: "Ma commission", H: "Dépenses", I: "Reversement net"
      });

      let grandTotals = { revenue: 0, platformFee: 0, commission: 0, expenses: 0, reversement: 0 };

      properties.forEach(p => {
        const pb = bookings.filter(b => b.propertyId === p.id && b.checkIn?.startsWith(String(selectedYear)));
        const pe = expenses.filter(e => e.propertyId === p.id && e.date?.startsWith(String(selectedYear)));
        const t = pb.reduce((acc, b) => {
          const { platformFee, commission, cleaning, reversement } = calcCommission(b, p);
          return { revenue: acc.revenue + (b.amount || 0), platformFee: acc.platformFee + platformFee, commission: acc.commission + commission, reversement: acc.reversement + reversement };
        }, { revenue: 0, platformFee: 0, commission: 0, reversement: 0 });
        const exp = pe.reduce((s, e) => s + (e.amount || 0), 0);

        grandTotals.revenue += t.revenue;
        grandTotals.platformFee += t.platformFee;
        grandTotals.commission += t.commission;
        grandTotals.expenses += exp;
        grandTotals.reversement += t.reversement - exp;

        summaryRows.push({
          A: p.name, B: p.owner, C: commissionLabel(p), D: pb.length,
          E: fmt(t.revenue), F: t.platformFee > 0 ? fmt(t.platformFee) : 0,
          G: fmt(t.commission), H: exp > 0 ? fmt(exp) : 0, I: fmt(t.reversement - exp)
        });
      });

      summaryRows.push({ A: "" });
      summaryRows.push({
        A: "TOTAL GÉNÉRAL", B: "", C: "", D: "",
        E: fmt(grandTotals.revenue), F: fmt(grandTotals.platformFee),
        G: fmt(grandTotals.commission), H: fmt(grandTotals.expenses), I: fmt(grandTotals.reversement)
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows, { skipHeader: true });
      wsSummary["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Récapitulatif");
    }

    XLSX.writeFile(wb, `conciergerie-${selectedYear}${selectedProperty !== "all" ? "-" + (properties.find(p => p.id === selectedProperty)?.name || "") : ""}.xlsx`);
    setLoading(false);
  };

  const propsToExport = selectedProperty === "all" ? properties : properties.filter(p => p.id === selectedProperty);
  const previewBookings = bookings.filter(b =>
    propsToExport.some(p => p.id === b.propertyId) && b.checkIn?.startsWith(String(selectedYear))
  );

  const s = {
    page: { padding: 28 },
    h1: { margin: "0 0 24px", fontSize: 22, fontWeight: 500, color: "#1a1a2e" },
    grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, maxWidth: 900 },
    card: { background: "white", borderRadius: 12, padding: 28, border: "1px solid #f0f0f0" },
    cardHd: { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 16 },
    label: { fontSize: 12, color: "#666", display: "block", marginBottom: 6 },
    select: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 14, background: "white", marginBottom: 16 },
    btn: { width: "100%", background: "#1a1a2e", color: "white", border: "none", padding: 14, borderRadius: 8, cursor: "pointer", fontSize: 15, fontWeight: 500 },
    stat: { background: "#f8f8f8", borderRadius: 8, padding: "10px 14px", marginBottom: 10 },
    statLbl: { fontSize: 11, color: "#999", marginBottom: 4 },
    statVal: (color) => ({ fontSize: 18, fontWeight: 500, color: color || "#1a1a2e" }),
  };

  const previewTotals = previewBookings.reduce((acc, b) => {
    const prop = properties.find(p => p.id === b.propertyId);
    if (!prop) return acc;
    const { commission, reversement } = calcCommission(b, prop);
    return { revenue: acc.revenue + (b.amount || 0), commission: acc.commission + commission, reversement: acc.reversement + reversement };
  }, { revenue: 0, commission: 0, reversement: 0 });

  return (
    <div className="page">
      <h1 style={s.h1}>Export Excel</h1>
      <div className="grid-2" style={{maxWidth:900}}>
        <div style={s.card}>
          <div style={s.cardHd}>Paramètres d'export</div>
          <label style={s.label}>Année</label>
          <select style={s.select} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
          <label style={s.label}>Bien</label>
          <select style={s.select} value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)}>
            <option value="all">Tous les biens (1 onglet par bien + récapitulatif)</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name} — {p.owner}</option>)}
          </select>
          <button style={{ ...s.btn, opacity: loading ? .6 : 1 }} onClick={exportExcel} disabled={loading}>
            {loading ? "Génération..." : "Télécharger Excel"}
          </button>
          <p style={{ fontSize: 11, color: "#bbb", marginTop: 12, textAlign: "center" }}>
            1 onglet par bien · Réservations + dépenses + reversement · Récapitulatif général
          </p>
        </div>

        <div style={s.card}>
          <div style={s.cardHd}>Aperçu — {selectedYear}</div>
          <div style={s.stat}>
            <div style={s.statLbl}>Biens inclus</div>
            <div style={s.statVal()}>{propsToExport.length} bien{propsToExport.length > 1 ? "s" : ""}</div>
          </div>
          <div style={s.stat}>
            <div style={s.statLbl}>Réservations</div>
            <div style={s.statVal()}>{previewBookings.length}</div>
          </div>
          <div style={s.stat}>
            <div style={s.statLbl}>Revenus bruts</div>
            <div style={s.statVal("#2ecc71")}>{Math.round(previewTotals.revenue).toLocaleString("fr-FR")} MAD</div>
          </div>
          <div style={s.stat}>
            <div style={s.statLbl}>Mes commissions</div>
            <div style={s.statVal("#f0a500")}>{Math.round(previewTotals.commission).toLocaleString("fr-FR")} MAD</div>
          </div>
          <div style={s.stat}>
            <div style={s.statLbl}>Total à reverser</div>
            <div style={s.statVal("#3498db")}>{Math.round(previewTotals.reversement).toLocaleString("fr-FR")} MAD</div>
          </div>
        </div>
      </div>
    </div>
  );
}
