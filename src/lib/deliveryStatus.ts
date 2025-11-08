/**
 * Delivery Status Utilities
 * Centraliza a lógica de conversão e exibição de status de entregas
 */

export type DeliveryStatus = 
  | 'pending'      // Disponível para aceitar
  | 'accepted'     // Aceito - Indo para coleta
  | 'picked_up'    // Coletado - Indo para entrega
  | 'delivered'    // Entregue
  | 'cancelled';   // Cancelada

interface StatusConfig {
  label: string;
  icon: string;
  color: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}

/**
 * Retorna a configuração de exibição para um status
 */
export function getStatusConfig(status: DeliveryStatus): StatusConfig {
  const configs: Record<DeliveryStatus, StatusConfig> = {
    pending: {
      label: 'Disponível',
      icon: '🕐',
      color: 'text-yellow-600',
      variant: 'secondary'
    },
    accepted: {
      label: 'Coleta em Andamento',
      icon: '🚗',
      color: 'text-blue-600',
      variant: 'default'
    },
    picked_up: {
      label: 'Entrega em Andamento',
      icon: '📦',
      color: 'text-purple-600',
      variant: 'default'
    },
    delivered: {
      label: 'Entregue',
      icon: '✨',
      color: 'text-green-600',
      variant: 'default'
    },
    cancelled: {
      label: 'Cancelada',
      icon: '❌',
      color: 'text-red-600',
      variant: 'destructive'
    }
  };

  return configs[status] || {
    label: status,
    icon: '❓',
    color: 'text-gray-600',
    variant: 'secondary'
  };
}

/**
 * Retorna apenas o label traduzido para português
 */
export function getStatusLabel(status: DeliveryStatus): string {
  return getStatusConfig(status).label;
}

/**
 * Retorna apenas o ícone para o status
 */
export function getStatusIcon(status: DeliveryStatus): string {
  return getStatusConfig(status).icon;
}

/**
 * Retorna apenas a cor para o status
 */
export function getStatusColor(status: DeliveryStatus): string {
  return getStatusConfig(status).color;
}

/**
 * Retorna apenas a variante do badge para o status
 */
export function getStatusVariant(status: DeliveryStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  return getStatusConfig(status).variant;
}

/**
 * Verifica se a entrega está ativa (em andamento)
 */
export function isDeliveryActive(status: DeliveryStatus): boolean {
  return ['accepted', 'picked_up'].includes(status);
}

export function isPickupPhase(status: DeliveryStatus): boolean {
  return status === 'accepted';
}

export function isDeliveryPhase(status: DeliveryStatus): boolean {
  return status === 'picked_up';
}

/**
 * Verifica se a entrega está completa
 */
export function isDeliveryComplete(status: DeliveryStatus): boolean {
  return status === 'delivered' || status === 'cancelled';
}

/**
 * Retorna os próximos status possíveis a partir do status atual
 */
export function getNextPossibleStatuses(status: DeliveryStatus): DeliveryStatus[] {
  const transitions: Record<DeliveryStatus, DeliveryStatus[]> = {
    pending: ['accepted', 'cancelled'],
    accepted: ['picked_up', 'cancelled'],
    picked_up: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: []
  };

  return transitions[status] || [];
}
