import { describe, it, expect } from 'vitest';
import { isValidCNPJ, isValidPlateMercosul } from '../utils/validators';

describe('validators', () => {
  it('validates CNPJ', () => {
    expect(isValidCNPJ('11.222.333/0001-81')).toBe(true);
    expect(isValidCNPJ('00.000.000/0000-00')).toBe(false);
  });
  it('validates Mercosul plate', () => {
    expect(isValidPlateMercosul('ABC1D23')).toBe(true);
    expect(isValidPlateMercosul('AAA0000')).toBe(false);
  });
});