// ── Tipos de produto compartilhados entre admin, solicitante e motoboy ────────
// ÚNICA fonte de verdade — não duplicar strings em outros arquivos.

export interface ProductTypeDefinition {
  key: string;   // valor salvo no banco (product_type)
  label: string; // texto exibido na UI
  icon: string;  // emoji
}

export const PRODUCT_TYPES: ProductTypeDefinition[] = [
  { key: 'Alimentos',         label: 'Alimentos',         icon: '🍔' },
  { key: 'Documentos',        label: 'Documentos',        icon: '📄' },
  { key: 'Eletrônicos',       label: 'Eletrônicos',       icon: '📱' },
  { key: 'Encomenda Pequena', label: 'Encomenda Pequena', icon: '📦' },
  { key: 'Encomenda Média',   label: 'Encomenda Média',   icon: '📦' },
  { key: 'Encomenda Grande',  label: 'Encomenda Grande',  icon: '🗃️' },
  { key: 'Farmácia',          label: 'Farmácia',          icon: '💊' },
  { key: 'Outros',            label: 'Outros',            icon: '📬' },
];

// Fallback para motoboys que não configuraram (nunca deve acontecer com a
// validação de obrigatoriedade, mas serve de segurança).
export const DEFAULT_ACCEPTED_TYPES: string[] = [
  'Alimentos',
  'Documentos',
  'Encomenda Pequena',
];

// Helper: retorna o emoji do tipo
export function getProductTypeIcon(key: string): string {
  return PRODUCT_TYPES.find(t => t.key === key)?.icon ?? '📦';
}

// Helper: label amigável (com fallback para a própria key)
export function getProductTypeLabel(key: string): string {
  return PRODUCT_TYPES.find(t => t.key === key)?.label ?? key;
}
