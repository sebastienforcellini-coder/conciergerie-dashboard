import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { calcCommission } from "./Properties";

const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function fmt(n) { return Math.round(n).toLocaleString("fr-FR"); }

function getToday() { return new Date().toISOString().split("T")[0]; }

function isOccupied(propId, bookings, date) {
  return bookings.find(b => b.propertyId === propId && b.checkIn <= date && b.checkOut > date);
}

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return d.toISOString().split("T")[0];
  });
}

const PLT_COLORS = {
  Airbnb:              { bg: "#FAECE7", color: "#712B13", border: "#F5C4B3" },
  Booking:             { bg: "#E6F1FB", color: "#0C447C", border: "#B5D4F4" },
  Direct:              { bg: "#EAF3DE", color: "#27500A", border: "#C0DD97" },
  "Gens de confiance": { bg: "#EEEDFE", color: "#3C3489", border: "#CECBF6" },
  Perso:               { bg: "#F1EFE8", color: "#444441", border: "#D3D1C7" },
  Autre:               { bg: "#F1EFE8", color: "#5F5E5A", border: "#D3D1C7" },
};

export default function Dashboard() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const today = getToday();
  const week = getNext7Days();
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  useEffect(() => {
    const load = async () => {
      const [pSnap, bSnap] = await Promise.all([
        getDocs(collection(db, "properties")),
        getDocs(collection(db, "bookings")),
      ]);
      setProperties(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBookings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    load();
  }, []);

  const checkinsToday  = bookings.filter(b => b.checkIn  === today);
  const checkoutsToday = bookings.filter(b => b.checkOut === today);
  const occupiedTonight = properties.filter(p => isOccupied(p.id, bookings, today));
  const unpaid = bookings.filter(b => !b.paid && b.checkOut < today);

  const monthBookings = bookings.filter(b => b.checkIn?.startsWith(monthStr));
  const totalRevenue = monthBookings.reduce((s, b) => s + (b.amount || 0), 0);
  const totalCommission = monthBookings.reduce((s, b) => {
    const prop = properties.find(p => p.id === b.propertyId);
    if (!prop) return s;
    return s + calcCommission(b, prop).commission;
  }, 0);

  const propCommissions = properties.map(p => {
    const pb = monthBookings.filter(b => b.propertyId === p.id);
    const comm = pb.reduce((s, b) => s + calcCommission(b, p).commission, 0);
    const rev  = pb.reduce((s, b) => s + (b.amount || 0), 0);
    return { ...p, comm, rev, count: pb.length };
  }).sort((a, b) => b.rev - a.rev);

  const propNeedAttention = properties.filter(p => {
    const future = bookings.filter(b => b.propertyId === p.id && b.checkIn > today);
    return future.length === 0;
  });

  const weekDays = week.map(d => {
    const num = new Date(d).getDate();
    const dayLabel = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"][new Date(d).getDay()];
    return { date: d, label: `${dayLabel} ${num}` };
  });

  const s = {
    page: { padding: "24px 28px", minHeight: "100vh" },
    topbar: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
    greeting: { fontSize: 20, fontWeight: 500, color: "#1a1a2e" },
    sub: { fontSize: 13, color: "#888", marginTop: 3 },
    todayBadge: { background: "#E1F5EE", color: "#085041", fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 99 },
    kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 10, marginBottom: 18 },
    kpi: { background: "#f8f8f8", borderRadius: 10, padding: "14px 16px" },
    kpiLbl: { fontSize: 11, color: "#999", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 },
    kpiVal: { fontSize: 24, fontWeight: 500, color: "#1a1a2e" },
    kpiHint: (ok) => ({ fontSize: 11, marginTop: 5, color: ok ? "#0F6E56" : "#854F0B" }),
    mainGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 },
    card: { background: "white", border: "1px solid #f0f0f0", borderRadius: 12, padding: 18 },
    cardHd: { fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 14 },
    bitem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f7f7f7" },
    av: (bg, color) => ({ width: 30, height: 30, borderRadius: "50%", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }),
    binfo: { flex: 1, minWidth: 0 },
    bname: { fontSize: 13, fontWeight: 500, color: "#1a1a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
    bsub: { fontSize: 11, color: "#999", marginTop: 1 },
    pill: (bg, color) => ({ background: bg, color, fontSize: 10, padding: "2px 7px", borderRadius: 99, display: "inline-block" }),
    bamt: { fontSize: 12, fontWeight: 500, color: "#1a1a2e", textAlign: "right" },
    alertItem: { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f7f7f7" },
    dot: (c) => ({ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 }),
    podRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid #f7f7f7" },
    podBar: (pct) => ({ height: 5, borderRadius: 3, background: "#1D9E75", width: pct + "%" }),
    occCell: (status) => {
      const map = {
        busy:  { bg: "#E1F5EE", color: "#085041", border: "#9FE1CB" },
        perso: { bg: "#EEEDFE", color: "#3C3489", border: "#CECBF6" },
        free:  { bg: "#f5f5f5", color: "#bbb",    border: "#e8e8e8" },
      };
      const t = map[status] || map.free;
      return { height: 32, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 500, cursor: "pointer", border: `1px solid ${t.border}`, background: t.bg, color: t.color, transition: "opacity .15s", overflow: "hidden" };
    },
  };

  const getPropStatus = (p) => {
    const occ = isOccupied(p.id, bookings, today);
    if (!occ) return "free";
    if (occ.platform === "Perso" || occ.amount === 0) return "perso";
    return "busy";
  };

  const shortName = (name) => name.replace(/^(Riad|Dar)\s+/i, "").substring(0, 7);

  const getPropForBooking = (b) => properties.find(p => p.id === b.propertyId);

  if (loading) return <div style={{ padding: 40, color: "#999" }}>Chargement du dashboard...</div>;

  const days = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const greetHour = now.getHours();
  const greet = greetHour < 12 ? "Bonjour" : greetHour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <div>
          <div style={s.greeting}>{greet} ! Bonne journée.</div>
          <div style={s.sub}>
            {days[now.getDay()]} {now.getDate()} {MONTHS[now.getMonth()]} {now.getFullYear()} — {properties.length} biens sous gestion
          </div>
        </div>
        <div style={s.todayBadge}>
          {checkinsToday.length} check-in{checkinsToday.length !== 1 ? "s" : ""} aujourd'hui
        </div>
      </div>

      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Biens occupés ce soir</div>
          <div style={s.kpiVal}>{occupiedTonight.length}<span style={{ fontSize: 14, color: "#bbb", fontWeight: 400 }}>/{properties.length}</span></div>
          <div style={s.kpiHint(occupiedTonight.length > properties.length / 2)}>
            Taux {properties.length > 0 ? Math.round(occupiedTonight.length / properties.length * 100) : 0}%
          </div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Commissions {monthLabel}</div>
          <div style={{ fontSize: 20, fontWeight: 500, color: "#1a1a2e" }}>{fmt(totalCommission)} MAD</div>
          <div style={s.kpiHint(true)}>sur {fmt(totalRevenue)} MAD bruts</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Encaissements en attente</div>
          <div style={s.kpiVal}>{unpaid.length}</div>
          <div style={s.kpiHint(unpaid.length === 0)}>réservation{unpaid.length !== 1 ? "s" : ""} non payée{unpaid.length !== 1 ? "s" : ""}</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiLbl}>Biens sans résa à venir</div>
          <div style={s.kpiVal}>{propNeedAttention.length}</div>
          <div style={s.kpiHint(propNeedAttention.length === 0)}>à relancer</div>
        </div>
      </div>

      <div style={s.mainGrid}>
        <div style={s.card}>
          <div style={s.cardHd}>Check-ins aujourd'hui</div>
          {checkinsToday.length === 0 && <p style={{ fontSize: 13, color: "#bbb" }}>Aucun check-in aujourd'hui.</p>}
          {checkinsToday.map(b => {
            const prop = getPropForBooking(b);
            const plt = PLT_COLORS[b.platform] || PLT_COLORS["Autre"];
            return (
              <div key={b.id} style={s.bitem}>
                <div style={s.av(plt.bg, plt.color)}>{(b.name || "?")[0].toUpperCase()}</div>
                <div style={s.binfo}>
                  <div style={s.bname}>{b.name} <span style={s.pill(plt.bg, plt.color)}>{b.platform}</span></div>
                  <div style={s.bsub}>{prop?.name || "—"} · {b.nights || "?"} nuit{(b.nights || 0) > 1 ? "s" : ""} · {b.guests || "?"} pers.</div>
                </div>
                <div style={s.bamt}>{fmt(b.amount || 0)} MAD</div>
              </div>
            );
          })}

          {checkoutsToday.length > 0 && (
            <>
              <div style={{ ...s.cardHd, marginTop: 16, paddingTop: 14, borderTop: "1px solid #f5f5f5" }}>Check-outs aujourd'hui</div>
              {checkoutsToday.map(b => {
                const prop = getPropForBooking(b);
                const plt = PLT_COLORS[b.platform] || PLT_COLORS["Autre"];
                return (
                  <div key={b.id} style={s.bitem}>
                    <div style={s.av("#f5f5f5", "#888")}>{(b.name || "?")[0].toUpperCase()}</div>
                    <div style={s.binfo}>
                      <div style={s.bname}>{b.name}</div>
                      <div style={s.bsub}>{prop?.name || "—"}</div>
                    </div>
                    <div style={{ fontSize: 12, color: b.paid ? "#0F6E56" : "#A32D2D", fontWeight: 500 }}>{b.paid ? "Encaissé" : "Non payé"}</div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div style={s.card}>
          <div style={s.cardHd}>Occupation — 7 jours</div>
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {weekDays.map(d => (
              <div key={d.date} style={{ flex: 1, textAlign: "center", fontSize: 10, color: d.date === today ? "#1a1a2e" : "#bbb", fontWeight: d.date === today ? 600 : 400 }}>{d.label}</div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {properties.slice(0, 12).map(p => (
              <div key={p.id} style={{ display: "flex", gap: 4 }}>
                {week.map(d => {
                  const occ = isOccupied(p.id, bookings, d);
                  const isPerso = occ && (occ.platform === "Perso" || occ.amount === 0);
                  return (
                    <div key={d} title={occ ? `${p.name} — ${occ.name} (${occ.platform})` : p.name + " — libre"}
                      style={{ flex: 1, height: 18, borderRadius: 3, background: !occ ? "#f0f0f0" : isPerso ? "#AFA9EC" : "#5DCAA5" }} />
                  );
                })}
              </div>
            ))}
          </div>
          {properties.length > 12 && <div style={{ fontSize: 11, color: "#bbb", marginTop: 8 }}>+ {properties.length - 12} autres biens — voir calendrier</div>}
          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            {[["#5DCAA5","Occupé"],["#AFA9EC","Perso"],["#f0f0f0","Libre"]].map(([bg, lbl]) => (
              <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#888" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, display: "inline-block", border: "1px solid #e0e0e0" }} />
                {lbl}
              </span>
            ))}
          </div>
        </div>

        <div style={s.card}>
          <div style={s.cardHd}>Alertes</div>
          <div style={s.alertItem}>
            <div style={s.dot(unpaid.length > 0 ? "#E24B4A" : "#5DCAA5")} />
            <div style={{ flex: 1, fontSize: 13 }}>Encaissements en attente</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: unpaid.length > 0 ? "#A32D2D" : "#0F6E56" }}>{unpaid.length} résa</div>
          </div>
          <div style={s.alertItem}>
            <div style={s.dot(propNeedAttention.length > 0 ? "#EF9F27" : "#5DCAA5")} />
            <div style={{ flex: 1, fontSize: 13 }}>Biens sans réservation future</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: propNeedAttention.length > 0 ? "#854F0B" : "#0F6E56" }}>{propNeedAttention.length} biens</div>
          </div>
          <div style={s.alertItem}>
            <div style={s.dot("#378ADD")} />
            <div style={{ flex: 1, fontSize: 13 }}>Réservations ce mois</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#185FA5" }}>{monthBookings.length}</div>
          </div>

          <div style={{ ...s.cardHd, marginTop: 16, paddingTop: 14, borderTop: "1px solid #f5f5f5" }}>Top biens — {monthLabel}</div>
          {propCommissions.slice(0, 5).map((p, i) => {
            const maxRev = propCommissions[0]?.rev || 1;
            return (
              <div key={p.id} style={{ ...s.podRow, cursor: "pointer" }} onClick={() => navigate(`/property/${p.id}`)}>
                <div style={{ width: 18, fontSize: 12, fontWeight: 600, color: i === 0 ? "#BA7517" : i === 1 ? "#888" : i === 2 ? "#993C1D" : "#ccc", textAlign: "center" }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a1a2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ marginTop: 3 }}>
                    <div style={{ height: 4, borderRadius: 2, background: "#f0f0f0" }}>
                      <div style={s.podBar(Math.round(p.rev / maxRev * 100))} />
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right", minWidth: 90 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{fmt(p.rev)} MAD</div>
                  <div style={{ fontSize: 11, color: "#f0a500" }}>+{fmt(p.comm)} comm.</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 12, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={s.cardHd}>Vue globale — {properties.length} biens</div>
          <div style={{ display: "flex", gap: 12 }}>
            {[["#5DCAA5","#E1F5EE","Occupé"],["#AFA9EC","#EEEDFE","Perso"],["#bbb","#f5f5f5","Libre"]].map(([color, bg, lbl]) => (
              <span key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#888" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, border: `1px solid ${color}40`, display: "inline-block" }} />{lbl}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 4 }}>
          {properties.map(p => {
            const status = getPropStatus(p);
            return (
              <div key={p.id}
                style={s.occCell(status)}
                title={`${p.name} — ${p.owner} — ${status === "busy" ? "Occupé" : status === "perso" ? "Usage perso" : "Libre"}`}
                onClick={() => navigate(`/property/${p.id}`)}
                onMouseEnter={e => e.currentTarget.style.opacity = ".75"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                {shortName(p.name)}
              </div>
            );
          })}
          {properties.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 32, color: "#bbb", fontSize: 13 }}>
              Aucune propriété — commencez par en ajouter une dans l'onglet Propriétés.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
