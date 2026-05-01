/**
 * Delivery Status Utilities
 * Centraliza a lógica de conversão e exibição de status de entregas.
 * Usado por todas as páginas: restaurante, driver e admin.
 */

export type DeliveryStatus =
  | 'pending'      // Disponível para aceitar
  | 'accepted'     // Aceito - Indo para coleta
  | 'picking_up'   // A caminho da coleta (driver)
  | 'picked_up'    // Coletado - Indo para entrega
  | 'delivering'   // Em rota de entrega (driver)
  | 'delivered'    // Entregue (final para entregas normais; intermediário para entregas com retorno)
  | 'returning'    // Retornando ao ponto de coleta (só para requires_return=true)
  | 'cancelled';   // Cancelada

interface StatusConfig {
  label: string;
  icon: string;
  /** Classe de cor do texto (ex: 'text-amber-600') */
  color: string;
  /** Classes completas para badge: bg + text + border (ex: 'bg-amber-100 text-amber-800 border-amber-200') */
  badge: string;
  /** Classe para o ponto indicador (ex: 'bg-amber-400') */
  dot: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

const STATUS_MAP: Record<DeliveryStatus, StatusConfig> = {
  pending: {
    label: 'Aguardando entregador',
    icon: '🕐',
    color: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-400',
    variant: 'secondary',
  },
  accepted: {
    label: 'Coleta em andamento',
    icon: '🚗',
    color: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-400',
    variant: 'default',
  },
  picking_up: {
    label: 'A caminho da coleta',
    icon: '🛵',
    color: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-blue-400',
    variant: 'default',
  },
  picked_up: {
    label: 'Em rota de entrega',
    icon: '📦',
    color: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-400',
    variant: 'default',
  },
  delivering: {
    label: 'Em rota de entrega',
    icon: '📦',
    color: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    dot: 'bg-purple-400',
    variant: 'default',
  },
  delivered: {
    label: 'Entregue',
    icon: '✅',
    color: 'text-green-600',
    badge: 'bg-green-100 text-green-800 border-green-200',
    dot: 'bg-green-400',
    variant: 'default',
  },
  returning: {
    label: 'Retornando ao ponto',
    icon: '↩️',
    color: 'text-orange-600',
    badge: 'bg-orange-100 text-orange-800 border-orange-200',
    dot: 'bg-orange-400',
    variant: 'default',
  },
  cancelled: {
    label: 'Cancelada',
    icon: '❌',
    color: 'text-red-600',
    badge: 'bg-red-100 text-red-800 border-red-200',
    dot: 'bg-red-400',
    variant: 'destructive',
  },
};

const FALLBACK: StatusConfig = {
  label: 'Desconhecido',
  icon: '❓',
  color: 'text-gray-600',
  badge: 'bg-gray-100 text-gray-700 border-gray-200',
  dot: 'bg-gray-400',
  variant: 'secondary',
};

export function getStatusConfig(status: string): StatusConfig {
  return STATUS_MAP[status as DeliveryStatus] ?? FALLBACK;
}

export function getStatusLabel(status: string): string {
  return getStatusConfig(status).label;
}

export function getStatusIcon(status: string): string {
  return getStatusConfig(status).icon;
}

export function getStatusColor(status: string): string {
  return getStatusConfig(status).color;
}

export function getStatusBadge(status: string): string {
  return getStatusConfig(status).badge;
}

export function getStatusDot(status: string): string {
  return getStatusConfig(status).dot;
}

export function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  return getStatusConfig(status).variant;
}

export function isDeliveryActive(status: string): boolean {
  return ['accepted', 'picking_up', 'picked_up', 'delivering', 'returning'].includes(status);
}

export function isPickupPhase(status: string): boolean {
  return status === 'accepted' || status === 'picking_up';
}

export function isDeliveryPhase(status: string): boolean {
  return status === 'picked_up' || status === 'delivering';
}

export function isDeliveryComplete(status: string): boolean {
  return status === 'delivered' || status === 'cancelled';
}

export function isReturning(status: string): boolean {
  return status === 'returning';
}

export function getNextPossibleStatuses(status: DeliveryStatus): DeliveryStatus[] {
  const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
    pending: ['accepted', 'cancelled'],
    accepted: ['picking_up', 'picked_up', 'cancelled'],
    picking_up: ['picked_up', 'cancelled'],
    picked_up: ['delivering', 'delivered', 'returning', 'cancelled'],
    delivering: ['delivered', 'returning', 'cancelled'],
    returning: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  };
  return transitions[status] ?? [];
}
