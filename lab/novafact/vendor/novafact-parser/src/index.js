// Sources du paquet vendorisé. C'est ce que l'on relit en revue.
export function parseRef(input) {
  const m = String(input).match(/^([A-Z]{2,5})-(\d{1,8})$/);
  if (!m) return null;
  return { prefix: m[1], number: Number(m[2]) };
}

export function formatRef({ prefix, number }) {
  return `${prefix}-${String(number).padStart(4, '0')}`;
}
