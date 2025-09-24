export function causaLabel(nombre?: string, index?: number) {
  const clean = (nombre || "").trim();
  return clean || (index ? `Causa ${index}` : "");
}