export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    const response = await fetch(decodeURIComponent(url), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; conciergerie-dashboard/1.0)" }
    });
    if (!response.ok) return res.status(500).json({ error: `Erreur fetch: ${response.status}` });

    const icsText = await response.text();
    const events  = parseICS(icsText);
    res.status(200).json({ events, count: events.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

function parseICS(icsText) {
  const events = [];
  const lines  = icsText.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n");
  let current  = null;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    while (i+1 < lines.length && (lines[i+1].startsWith(" ")||lines[i+1].startsWith("\t"))) {
      i++; line += lines[i].trim();
    }
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT" && current) {
      if (current.checkIn && current.checkOut && current.uid) events.push(current);
      current = null;
    } else if (current) {
      if      (line.startsWith("DTSTART"))     current.checkIn     = parseDate(line.split(":")[1]);
      else if (line.startsWith("DTEND"))       current.checkOut    = parseDate(line.split(":")[1]);
      else if (line.startsWith("SUMMARY"))     current.summary     = line.substring(line.indexOf(":")+1).trim();
      else if (line.startsWith("UID"))         current.uid         = line.substring(line.indexOf(":")+1).trim();
      else if (line.startsWith("DESCRIPTION")) current.description = line.substring(line.indexOf(":")+1).trim();
    }
  }
  return events;
}

function parseDate(raw) {
  if (!raw) return null;
  const clean = raw.split("T")[0].replace(/\D/g,"");
  if (clean.length < 8) return null;
  return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}`;
}
