// Comprobaciones programadas (reglas de prueba, sin IA). Función pura: fácil de probar.
export function evaluate({ forms, text, level }) {
  const tx = text.trim();
  const w = tx.toLowerCase().replace(/['’]/g, ' ').replace(/[.,!?;:¡¿"“”()]/g, ' ').split(/\s+/).filter(Boolean);
  const flat = ' ' + w.join(' ') + ' ', min = level === 4 ? 6 : 4;
  const rep = w.some((x, i) => i && x === w[i - 1]);
  const conj = forms.some(f => flat.includes(' ' + f.toLowerCase() + ' ')) ? 1 : 0;
  const gram = w.length >= 3 ? 1 : 0;
  const coh = conj && !rep ? 1 : 0;
  const voc = w.length >= min && new Set(w).size >= Math.min(min, w.length) ? 1 : 0;
  return { c: [conj, gram, coh, voc], flags: { rep, short: w.length < 3, min, noCap: /^[a-zà-ÿ]/.test(tx), noPun: !/[.!?…]$/.test(tx) } };
}
