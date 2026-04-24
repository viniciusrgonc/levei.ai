import { useEffect } from 'react';
import { Bike, Car, Truck, Package, Check } from 'lucide-react';
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
}

const QUERY_KEY = ['delivery-categories-active'];

function categoryIcon(name: string) {
  const n = name.toLowerCase();
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

  const { data: categories, isLoading } = useQuery({
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!categories?.length) {
    return (
      <div className="py-8 text-center text-gray-400 text-sm">
        Nenhuma categoria de veículo disponível no momento.
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
