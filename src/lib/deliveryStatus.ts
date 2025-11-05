/**
 * Delivery Status Utilities
 * Centraliza a lógica de conversão e exibição de status de entregas
 */

export type DeliveryStatus = 
  | 'pending'
  | 'accepted'
  | 'picking_up'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

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
      label: 'Aguardando Motorista',
      icon: '🕐',
      color: 'text-yellow-600',
      variant: 'secondary'
    },
    accepted: {
      label: 'Aceito - Indo Buscar',
      icon: '✅',
      color: 'text-blue-600',
      variant: 'default'
    },
    picking_up: {
      label: 'Coletando Pedido',
      icon: '🏃',
      color: 'text-cyan-600',
      variant: 'default'
    },
    picked_up: {
      label: 'Pedido Coletado',
      icon: '📦',
      color: 'text-purple-600',
      variant: 'default'
    },
    delivering: {
      label: 'A Caminho da Entrega',
      icon: '🚚',
      color: 'text-indigo-600',
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
  return ['accepted', 'picking_up', 'picked_up', 'delivering'].includes(status);
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
    accepted: ['picking_up', 'picked_up', 'cancelled'],
    picking_up: ['picked_up', 'cancelled'],
    picked_up: ['delivering', 'delivered', 'cancelled'],
    delivering: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: []
  };

  return transitions[status] || [];
}
