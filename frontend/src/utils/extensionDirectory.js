const COMMON_AREA_KEYWORDS = ['portaria', 'porteiro', 'academia', 'salão', 'salao', 'festas', 'gourmet', 'acesso'];

export const GROUP_LABELS = {
  torreA: 'Torre A',
  blocoB: 'Bloco B',
  common: 'Portaria e áreas comuns',
  other: 'Outros',
};

// Convenção do condomínio: ramais que começam com 1 são da Torre A
// (andar+unidade em seguida), com 2 são do Bloco B, e o restante
// (porteiros, academia, salão de festas, espaço gourmet) fica em "outros".
export function classifyExtension(ext) {
  const name = (ext.name || '').toLowerCase();
  if (COMMON_AREA_KEYWORDS.some((kw) => name.includes(kw))) {
    return { key: 'common', unitLabel: null };
  }
  const num = ext.number || '';
  if (num.startsWith('1') && num.length >= 3) {
    return { key: 'torreA', unitLabel: formatUnitLabel(num) };
  }
  if (num.startsWith('2') && num.length >= 3) {
    return { key: 'blocoB', unitLabel: formatUnitLabel(num) };
  }
  return { key: 'other', unitLabel: null };
}

export function formatUnitLabel(num) {
  const rest = num.slice(1);
  if (rest.length < 3) return null;
  const floor = rest.slice(0, rest.length - 2);
  const unit = rest.slice(-2);
  return `Andar ${floor} · Unid. ${unit}`;
}

export function buildExtensionDirectory(extensions = []) {
  const map = new Map();
  extensions.forEach((ext) => map.set(ext.number, ext));
  return map;
}

// Descreve quem está do outro lado de uma chamada (src/dst do CDR): se o
// número bate com um ramal conhecido do condomínio, mostra nome + Torre/
// Bloco + apartamento; senão é uma linha externa e mostramos só o número.
export function describeCallParty(number, directory) {
  if (!number) return { label: '—', isInternal: false, groupKey: null };
  const ext = directory.get(number);
  if (!ext) return { label: number, isInternal: false, groupKey: null };
  const { key, unitLabel } = classifyExtension(ext);
  const tower = GROUP_LABELS[key];
  const detailParts = [tower, unitLabel].filter(Boolean);
  return {
    label: ext.name || `Ramal ${number}`,
    detail: detailParts.join(' · '),
    isInternal: true,
    groupKey: key,
    number,
  };
}
