// Pure text formatting. No DOM, no data access.

export function licenceClass(text) {
  const t = (text || "").toLowerCase();
  if (/controlled/.test(t)) return "closed";
  if (/licen[cs]e required|commercial|paid|academic use only|non-commercial|-nc|by-nc|registration/.test(t)) return "limited";
  if (/open|public domain|cc0|cc by|mit/.test(t)) return "open";
  return "";
}

export const prettyDate = (d) => {
  const t = Date.parse(d);
  return Number.isNaN(t) ? d : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

// The first ~400 characters, ended at a word.
export const cut = (text) => text.slice(0, 400).replace(/\s+\S*$/, "") + "…";

// "Sun, N., Zou, S. … (2024). Title" -> "Sun et al., 2024"
export function shortCite(text) {
  const year = (text.match(/\((\d{4})\)/) || text.match(/\b(19|20)\d{2}\b/) || [""])[0].replace(/[()]/g, "");
  const first = text.trim().split(/[,.]/)[0].trim().split(/\s+/);
  const surname = /^[A-Z]\.?$/.test(first[0] || "") ? first[first.length - 1] : first.length > 1 && !/,/.test(text.split(" ")[0]) ? first[first.length - 1] : first[0];
  return surname ? `${surname} et al.${year ? ", " + year : ""}` : "paper";
}
