export function isValidCNPJ(cnpj: string) {
  const clean = cnpj.replace(/\D/g, '');
  if (!clean || clean.length !== 14 || /^([0-9])\1+$/.test(clean)) return false;
  const calc = (base: string, factors: number[]) => {
    const sum = base.split('').reduce((acc, cur, i) => acc + parseInt(cur) * factors[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const base = clean.substring(0, 12);
  const d1 = calc(base, [5,4,3,2,9,8,7,6,5,4,3,2]);
  const d2 = calc(base + d1, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return clean.endsWith(`${d1}${d2}`);
}

export function isValidPlateMercosul(plate: string) {
  const p = plate.toUpperCase();
  return /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(p);
}

export function isValidUUID(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}