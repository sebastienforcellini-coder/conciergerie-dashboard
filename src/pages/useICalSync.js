import { collection, getDocs, addDoc, updateDoc, query, where, doc } from "firebase/firestore";
import { db } from "./firebase";

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000));
}

function extractName(summary, description) {
  if (!summary) return "Réservation iCal";
  const lower = summary.toLowerCase();
  if (lower.includes("blocked") || lower.includes("unavailable") || lower.includes("indisponible") || lower.includes("not available")) return null;
  if (lower === "reserved" || lower === "réservé") return "Réservation";
  return summary.trim();
}

function detectPlatform(uid, icalUrl) {
  if (!uid && !icalUrl) return "Airbnb";
  const src = (uid || "") + (icalUrl || "");
  if (src.includes("airbnb")) return "Airbnb";
  if (src.includes("booking")) return "Booking";
  return "Airbnb";
}

export async function syncPropertyICal(property, onProgress) {
  const results = { added: 0, updated: 0, skipped: 0, blocked: 0, errors: [] };
  const icalUrls = [];

  if (property.icalAirbnb) icalUrls.push({ url: property.icalAirbnb, platform: "Airbnb" });
  if (property.icalBooking) icalUrls.push({ url: property.icalBooking, platform: "Booking" });

  if (icalUrls.length === 0) {
    results.errors.push("Aucun lien iCal configuré pour ce bien");
    return results;
  }

  const existingSnap = await getDocs(query(collection(db, "bookings"), where("propertyId", "==", property.id)));
  const existing = existingSnap.docs.map(d => ({ docId: d.id, ...d.data() }));

  for (const { url, platform } of icalUrls) {
    try {
      onProgress?.(`Synchronisation ${platform}...`);
      const apiUrl = `/api/sync-ical?url=${encodeURIComponent(url)}`;
      const res    = await fetch(apiUrl);
      if (!res.ok) throw new Error(`Erreur API: ${res.status}`);
      const { events } = await res.json();

      for (const event of events) {
        const name = extractName(event.summary, event.description);

        if (!name) {
          results.blocked++;
          continue;
        }

        const nights = nightsBetween(event.checkIn, event.checkOut);
        if (nights === 0) continue;

        const existingBooking = existing.find(b => b.uid === event.uid);

        if (existingBooking) {
          if (existingBooking.checkIn !== event.checkIn || existingBooking.checkOut !== event.checkOut || existingBooking.name !== name) {
            await updateDoc(doc(db, "bookings", existingBooking.docId), {
              checkIn:  event.checkIn,
              checkOut: event.checkOut,
              name,
              nights,
              platform,
              uid: event.uid,
            });
            results.updated++;
          } else {
            results.skipped++;
          }
        } else {
          await addDoc(collection(db, "bookings"), {
            propertyId: property.id,
            uid:        event.uid,
            name,
            platform,
            checkIn:    event.checkIn,
            checkOut:   event.checkOut,
            nights,
            amount:     0,
            guests:     "",
            paid:       false,
            notes:      "",
            fromICal:   true,
          });
          results.added++;
        }
      }
    } catch (err) {
      results.errors.push(`${platform}: ${err.message}`);
    }
  }

  return results;
}

export async function syncAllProperties(properties, onProgress) {
  const total = { added: 0, updated: 0, skipped: 0, blocked: 0, errors: [] };
  for (const prop of properties) {
    if (!prop.icalAirbnb && !prop.icalBooking) continue;
    onProgress?.(`${prop.name}...`);
    const r = await syncPropertyICal(prop, onProgress);
    total.added   += r.added;
    total.updated += r.updated;
    total.skipped += r.skipped;
    total.blocked += r.blocked;
    total.errors   = [...total.errors, ...r.errors];
  }
  return total;
}
