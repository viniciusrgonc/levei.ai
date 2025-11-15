import { Card, CardContent } from '@/components/ui/card';
import { Bike, Car, Truck, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

export interface DeliveryCategory {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  is_active: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  'Moto': <Bike className="h-8 w-8" />,
  'Motocicleta': <Bike className="h-8 w-8" />,
  'Carro': <Car className="h-8 w-8" />,
  'Van': <Package className="h-8 w-8" />,
  'Caminhão': <Truck className="h-8 w-8" />,
};

interface VehicleCategorySelectorProps {
  selectedCategoryId: string | null;
  onSelect: (categoryId: string, category: DeliveryCategory) => void;
  disabled?: boolean;
}

export default function VehicleCategorySelector({
  selectedCategoryId,
  onSelect,
  disabled = false,
}: VehicleCategorySelectorProps) {
  const { data: categories, isLoading } = useQuery({
    queryKey: ['delivery-categories-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_categories')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data as DeliveryCategory[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg mb-1">Tipo de Veículo</h3>
          <p className="text-sm text-muted-foreground">
            Selecione o tipo de veículo necessário para sua entrega
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg mb-1">Tipo de Veículo</h3>
        <p className="text-sm text-muted-foreground">
          Selecione o tipo de veículo necessário para sua entrega
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories?.map((category) => {
          const isSelected = selectedCategoryId === category.id;
          const icon = iconMap[category.name] || <Package className="h-8 w-8" />;
          
          return (
            <Card
              key={category.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                isSelected
                  ? 'ring-2 ring-primary border-primary bg-primary/5'
                  : 'hover:border-primary/50',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !disabled && onSelect(category.id, category)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col h-full">
                  <div className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center mb-3',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {icon}
                  </div>
                  
                  <h4 className="font-semibold text-base mb-2">{category.name}</h4>
                  
                  <div className="pt-3 border-t space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Preço Base:</span>
                      <span className="font-medium">R$ {category.base_price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Por KM:</span>
                      <span className="font-medium">R$ {category.price_per_km.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedCategoryId && categories && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm">
            ✓ <span className="font-medium">{categories.find(c => c.id === selectedCategoryId)?.name}</span> selecionado
          </p>
        </div>
      )}
    </div>
  );
}
