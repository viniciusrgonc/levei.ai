import { useEffect } from 'react';
import { Bike, Car, Truck, Package, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export interface DeliveryCategory {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  is_active: boolean;
  allows_return: boolean;
}

const QUERY_KEY = ['delivery-categories-active'];

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes('farm')) return <span className="text-2xl">💊</span>;
  if (n.includes('moto') || n.includes('bike') || n.includes('bici')) return <Bike className="h-6 w-6" />;
  if (n.includes('carro') || n.includes('car')) return <Car className="h-6 w-6" />;
  if (n.includes('van') || n.includes('util') || n.includes('caminhão') || n.includes('caminhao') || n.includes('truck')) return <Truck className="h-6 w-6" />;
  return <Package className="h-6 w-6" />;
}

interface VehicleCategorySelectorProps {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string, category: DeliveryCategory) => void;
  disabled?: boolean;
  distance?: number;
}

export default function VehicleCategorySelector({
  selectedCategoryId,
  onSelect,
  disabled = false,
  distance,
}: VehicleCategorySelectorProps) {
  const queryClient = useQueryClient();

  const { data: categories, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_categories')
        .select('*')
        .eq('is_active', true)
        .order('base_price');
      if (error) throw error;
      return data as DeliveryCategory[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  // Realtime: invalidate cache whenever admin changes delivery_categories
  useEffect(() => {
    const channel = supabase
      .channel('delivery-categories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_categories' }, () => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Mostra skeleton tanto no primeiro carregamento quanto no refetch em background
  // (evita flash de estado vazio enquanto os dados chegam)
  if (isLoading || isFetching) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center space-y-3">
        <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm text-gray-500">Erro ao carregar categorias de veículo.</p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!categories?.length) {
    return (
      <div className="py-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-100 mx-auto flex items-center justify-center">
          <AlertCircle className="h-6 w-6 text-amber-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-700">Nenhum veículo disponível</p>
          <p className="text-xs text-gray-400 mt-1 max-w-[240px] mx-auto">
            As categorias de veículo ainda não foram configuradas. Contate o administrador da plataforma.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 font-medium"
        >
          <RefreshCw className="h-3 w-3" />
          Recarregar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const isSelected = selectedCategoryId === category.id;
        const estimatedTotal = distance && distance > 0
          ? category.base_price + distance * category.price_per_km
          : null;

        return (
          <button
            key={category.id}
            disabled={disabled}
            onClick={() => !disabled && onSelect(category.id, category)}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all',
              isSelected
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-100 bg-white hover:border-gray-200',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {/* Icon */}
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0',
              isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              {categoryIcon(category.name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900">{category.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                R$ {category.base_price.toFixed(2)} + R$ {category.price_per_km.toFixed(2)}/km
              </p>
            </div>

            {/* Price estimate or check */}
            <div className="flex-shrink-0 text-right">
              {isSelected ? (
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              ) : estimatedTotal ? (
                <div>
                  <p className="text-sm font-bold text-gray-900">R$ {estimatedTotal.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400">estimado</p>
                </div>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
