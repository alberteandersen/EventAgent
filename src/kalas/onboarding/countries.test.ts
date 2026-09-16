import { describe, it, expect } from 'vitest';
import { countryFocus, countryFromLocation, globeCountry } from './countries';

describe('countryFromLocation', () => {
  it('reads the country onboarding saved, alone or after a place', () => {
    expect(countryFromLocation('France')).toBe('France');
    expect(countryFromLocation('Provence, France')).toBe('France');
    expect(countryFromLocation('København, Denmark')).toBe('Denmark');
  });

  it('understands the Danish names for the same countries', () => {
    expect(countryFromLocation('Toscana, Italien')).toBe('Italy');
    expect(countryFromLocation('frankrig')).toBe('France');
    expect(countryFromLocation('Danmark.')).toBe('Denmark');
  });

  it('gives null for a town that names no country', () => {
    expect(countryFromLocation('Odense')).toBeNull();
    expect(countryFromLocation('')).toBeNull();
    expect(countryFromLocation(null)).toBeNull();
  });

  it('answers in the globe’s own spelling', () => {
    expect(globeCountry('united states')).toBe('United States of America');
    expect(globeCountry('SPAIN')).toBe('Spain');
  });
});

describe('countryFocus', () => {
  it('points at mainland France, not French Guiana', () => {
    const f = countryFocus('France')!;
    expect(f.lat).toBeGreaterThan(42);
    expect(f.lat).toBeLessThan(51);
    expect(f.lng).toBeGreaterThan(-5);
    expect(f.lng).toBeLessThan(8);
  });

  it('pulls back further for a bigger country', () => {
    expect(countryFocus('Italy')!.altitude).toBeLessThan(countryFocus('United States of America')!.altitude);
  });

  it('has nothing for a name that is not a country', () => {
    expect(countryFocus('Atlantis')).toBeNull();
    expect(countryFocus(null)).toBeNull();
  });
});
