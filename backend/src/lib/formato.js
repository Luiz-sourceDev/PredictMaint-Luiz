/* Formatação de datas no padrão que as telas mostram.
   O banco devolve datas como texto: "2026-11-04 08:40:00" ou "2026-11-04". */

const pad = (n) => String(n).padStart(2, "0");

// Data de hoje no fuso do servidor, em "AAAA-MM-DD"
export function hojeISO(desloc = 0) {
  const d = new Date();
  d.setDate(d.getDate() + desloc);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "2026-11-04 08:40:00" -> "04/11"
export const dm = (v) => (v ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : "—");

// "2026-11-04 08:40:00" -> "08:40"
export const hm = (v) => (v ? v.slice(11, 16) : "");

// "2026-11-04 08:40:00" -> "04/11 08:40"
export const dmhm = (v) => (v ? `${dm(v)} ${hm(v)}` : "");

// Rótulo da última medição: "Hoje 08:40", "Ontem 19:40" ou "02/11 14:00"
export function rotuloQuando(v) {
  if (!v) return "Sem medição";
  const dia = v.slice(0, 10);
  if (dia === hojeISO()) return "Hoje " + hm(v);
  if (dia === hojeISO(-1)) return "Ontem " + hm(v);
  return dmhm(v);
}

// Minutos -> "agora", "12 min", "2 h", "1 d"
export function rotuloHa(min) {
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)} h`;
  return `${Math.floor(min / 1440)} d`;
}

// Aceita "AAAA-MM-DD", "AAAA-MM-DDTHH:MM" ou vazio. Devolve texto para o MySQL ou null.
export function paraDataSQL(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

export function paraDataHoraSQL(v) {
  if (!v) return null;
  const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
  return m ? `${m[1]} ${m[2]}${m[3] || ":00"}` : null;
}
