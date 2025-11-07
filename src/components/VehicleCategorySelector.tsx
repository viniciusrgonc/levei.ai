import { Card, CardContent } from '@/components/ui/card';
import { Bike, Car, Truck, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VehicleCategory = 'motorcycle' | 'car' | 'van' | 'truck' | 'hourly_service';

interface VehicleCategoryOption {
  id: VehicleCategory;
  name: string;
  icon: React.ReactNode;
  description: string;
  capacity: {
    weight: string;
    dimensions: string;
  };
}

const categories: VehicleCategoryOption[] = [
  {
    id: 'motorcycle',
    name: 'Motocicleta',
    icon: <Bike className="h-8 w-8" />,
    description: 'Ideal para pacotes leves e entregas rápidas',
    capacity: {
      weight: 'Até 5kg',
      dimensions: '40 x 40 x 30 cm',
    },
  },
  {
    id: 'car',
    name: 'Carro',
    icon: <Car className="h-8 w-8" />,
    description: 'Para entregas de tamanho médio',
    capacity: {
      weight: 'Até 30kg',
      dimensions: '60 x 50 x 50 cm',
    },
  },
  {
    id: 'van',
    name: 'Van',
    icon: <Package className="h-8 w-8" />,
    description: 'Ideal para volumes maiores',
    capacity: {
      weight: 'Até 200kg',
      dimensions: '150 x 120 x 100 cm',
    },
  },
  {
    id: 'truck',
    name: 'Caminhão',
    icon: <Truck className="h-8 w-8" />,
    description: 'Para cargas grandes e pesadas',
    capacity: {
      weight: 'Até 1000kg',
      dimensions: '250 x 180 x 180 cm',
    },
  },
  {
    id: 'hourly_service',
    name: 'Serviço por Hora',
    icon: <Clock className="h-8 w-8" />,
    description: 'Entregador à disposição por tempo determinado',
    capacity: {
      weight: 'Variável',
      dimensions: 'Múltiplas entregas',
    },
  },
];

interface VehicleCategorySelectorProps {
  selectedCategory: VehicleCategory | null;
  onSelect: (category: VehicleCategory) => void;
  disabled?: boolean;
}

export default function VehicleCategorySelector({
  selectedCategory,
  onSelect,
  disabled = false,
}: VehicleCategorySelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-lg mb-1">Tipo de Veículo</h3>
        <p className="text-sm text-muted-foreground">
          Selecione o tipo de veículo necessário para sua entrega
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const isSelected = selectedCategory === category.id;
          
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
              onClick={() => !disabled && onSelect(category.id)}
            >
              <CardContent className="p-4">
                <div className="flex flex-col h-full">
                  <div className={cn(
                    'w-14 h-14 rounded-full flex items-center justify-center mb-3',
                    isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {category.icon}
                  </div>
                  
                  <h4 className="font-semibold text-base mb-2">{category.name}</h4>
                  
                  <p className="text-sm text-muted-foreground mb-3 flex-grow">
                    {category.description}
                  </p>
                  
                  <div className="pt-3 border-t space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Peso:</span>
                      <span className="font-medium">{category.capacity.weight}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Dimensões:</span>
                      <span className="font-medium">{category.capacity.dimensions}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedCategory && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="text-sm">
            ✓ <span className="font-medium">{categories.find(c => c.id === selectedCategory)?.name}</span> selecionado
          </p>
        </div>
      )}
    </div>
  );
}
