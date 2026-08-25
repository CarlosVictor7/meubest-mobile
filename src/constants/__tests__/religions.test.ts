import {
  FILTERABLE_RELIGIONS,
  RELIGION_KEYS,
  RELIGION_OPTIONS,
  RELIGION_OTHER,
  RELIGION_PREFER_NOT_SAY,
  religionKeyFor,
} from '../religions';

describe('religions — mapeamento rótulo → chave', () => {
  it('mapeia exatamente os rótulos combinados', () => {
    expect(RELIGION_KEYS).toEqual({
      'Católica': 'catolica',
      'Evangélica': 'evangelica',
      'Espírita': 'espirita',
      'Umbanda': 'umbanda',
      'Candomblé': 'candomble',
      'Budismo': 'budismo',
      'Judaísmo': 'judaismo',
      'Islamismo': 'islamismo',
      'Hinduísmo': 'hinduismo',
      'Religiões de matriz africana': 'matriz_africana',
      'Sem religião': 'sem_religiao',
      'Ateu / Ateia': 'ateu',
      'Agnóstico(a)': 'agnostico',
      'Prefiro não informar': 'nao_informar',
      'Outra': 'outra',
    });
  });

  it('toda opção da lista tem chave', () => {
    for (const label of RELIGION_OPTIONS) {
      expect(religionKeyFor(label)).toBe(RELIGION_KEYS[label as keyof typeof RELIGION_KEYS]);
    }
  });

  it('chaves são únicas', () => {
    const keys = Object.values(RELIGION_KEYS);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('texto livre de "Outra" vira outra; vazio vira null', () => {
    expect(religionKeyFor('Wicca')).toBe('outra');
    expect(religionKeyFor('  Católica ')).toBe('catolica');
    expect(religionKeyFor('')).toBeNull();
    expect(religionKeyFor('   ')).toBeNull();
    expect(religionKeyFor(null)).toBeNull();
    expect(religionKeyFor(undefined)).toBeNull();
  });

  it('FILTERABLE_RELIGIONS exclui nao_informar e outra', () => {
    const keys = FILTERABLE_RELIGIONS.map((r) => r.key);
    expect(keys).not.toContain('nao_informar');
    expect(keys).not.toContain('outra');
    expect(keys).toHaveLength(Object.keys(RELIGION_KEYS).length - 2);
    const labels = FILTERABLE_RELIGIONS.map((r) => r.label);
    expect(labels).not.toContain(RELIGION_OTHER);
    expect(labels).not.toContain(RELIGION_PREFER_NOT_SAY);
    expect(FILTERABLE_RELIGIONS[0]).toEqual({ label: 'Católica', key: 'catolica' });
  });
});
