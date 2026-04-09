import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const MONTHS = ["Jan","Fev","Mar","Avr","Mai","Jun","Jul","Aou","Sep","Oct","Nov","Dec"];
const COLORS = { Airbnb: "#ff5850", Booking: "#003198", Direct: "#2ecc71", default: "#999" };

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function isBooked(day, year, month, bookings) {
  const date = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
  return bookings.find(b => b.checkIn <= date && b.checkOut > date);
}

export default function Calendar() {
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      const [pSnap, bSnap] = await Promise.all([
        getDocs(collection(db, "properties")),
        getDocs(collection(db, "bookings"))
      ]);
      setProperties(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBookings(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    load();
  }, []);

  const days = getDaysInMonth(year, month);

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>Calendrier</h1>
        <button onClick={prev} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", background: "white" }}>prev</button>
        <span style={{ fontWeight: 700, fontSize: 18 }}>{MONTHS[month]} {year}</span>
        <button onClick={next} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #ddd", cursor: "pointer", background: "white" }}>suiv</button>
      </div>

      {properties.length === 0 ? (
        <p style={{ color: "#999" }}>Aucune propriete - ajoutez-en dans l'onglet Proprietes.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ padding: "8px 16px", background: "#1a1a2e", color: "white", textAlign: "left", minWidth: 160, position: "sticky", left: 0, zIndex: 1 }}>
                  Propriete
                </th>
                {Array.from({ length: days }, (_, i) => i + 1).map(d => (
                  <th key={d} style={{ padding: "8px 4px", background: "#1a1a2e", color: "white", textAlign: "center", minWidth: 32, fontSize: 12 }}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {properties.map((p, pi) => {
                const propBookings = bookings.filter(b => b.propertyId === p.id);
                return (
                  <tr key={p.id} style={{ background: pi % 2 === 0 ? "white" : "#f9f9f9" }}>
                    <td style={{ padding: "8px 16px", fontWeight: 600, fontSize: 13, position: "sticky", left: 0, background: pi % 2 === 0 ? "white" : "#f9f9f9", borderRight: "2px solid #eee" }}>
                      {p.name}
                      <div style={{ fontSize: 11, color: "#999", fontWeight: 400 }}>{p.owner}</div>
                    </td>
                    {Array.from({ length: days }, (_, i) => i + 1).map(d => {
                      const booking = isBooked(d, year, month, propBookings);
                      const color = booking ? (COLORS[booking.platform] || COLORS.default) : null;
                      return (
                        <td key={d}
                          title={booking ? booking.name + " - " + booking.platform : ""}
                          style={{ padding: 4, textAlign: "center", background: color ? color + "30" : "transparent", borderLeft: "1px solid #f0f0f0" }}>
                          {booking && (
                            <div style={{ width: 20, height: 20, borderRadius: "50%", background: color, margin: "0 auto" }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
            {Object.entries(COLORS).filter(([k]) => k !== "default").map(([platform, color]) => (
              <div key={platform} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                {platform}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
