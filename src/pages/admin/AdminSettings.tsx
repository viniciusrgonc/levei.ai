import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Settings, DollarSign, Percent, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  description: string;
}

interface DeliveryCategory {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  is_active: boolean;
}

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [feeValues, setFeeValues] = useState<Record<string, string>>({});
  const [categoryValues, setCategoryValues] = useState<Record<string, { base_price: string; price_per_km: string }>>({});

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['platform_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .order('key');
      if (error) throw error;
      return data as PlatformSetting[];
    },
  });

  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ['delivery_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as DeliveryCategory[];
    },
  });

  useEffect(() => {
    if (settings) {
      const vals: Record<string, string> = {};
      settings.forEach(s => { vals[s.key] = s.value; });
      setFeeValues(vals);
    }
  }, [settings]);

  useEffect(() => {
    if (categories) {
      const vals: Record<string, { base_price: string; price_per_km: string }> = {};
      categories.forEach(c => {
        vals[c.id] = {
          base_price: c.base_price.toString(),
          price_per_km: c.price_per_km.toString(),
        };
      });
      setCategoryValues(vals);
    }
  }, [categories]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (updates: { key: string; value: string }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ value: update.value })
          .eq('key', update.key);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform_settings'] });
      toast.success('Taxas e comissões salvas com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar configurações'),
  });

  const saveCategoriesMutation = useMutation({
    mutationFn: async (updates: { id: string; base_price: number; price_per_km: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('delivery_categories')
          .update({ base_price: update.base_price, price_per_km: update.price_per_km })
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_categories'] });
      toast.success('Preços por categoria salvos com sucesso!');
    },
    onError: () => toast.error('Erro ao salvar preços'),
  });

  const handleSaveFees = () => {
    const updates = Object.entries(feeValues).map(([key, value]) => ({ key, value }));
    saveSettingsMutation.mutate(updates);
  };

  const handleSaveCategories = () => {
    if (!categories) return;
    const updates = categories.map(c => ({
      id: c.id,
      base_price: parseFloat(categoryValues[c.id]?.base_price || '0'),
      price_per_km: parseFloat(categoryValues[c.id]?.price_per_km || '0'),
    }));
    saveCategoriesMutation.mutate(updates);
  };

  const platformFee = parseFloat(feeValues['platform_fee_percentage'] || '20');
  const driverCommission = parseFloat(feeValues['driver_commission_percentage'] || '80');

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 h-16 border-b bg-primary backdrop-blur supports-[backdrop-filter]:bg-primary/95">
            <div className="flex h-full items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
                <h1 className="text-xl font-bold text-primary-foreground">Configurações do Sistema</h1>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-5xl mx-auto space-y-6">

              {/* Taxas e Comissões */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Percent className="h-5 w-5 text-primary" />
                    <CardTitle>Taxas e Comissões</CardTitle>
                  </div>
                  <CardDescription>
                    Configure as taxas da plataforma e comissões dos entregadores
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingSettings ? (
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <>
                      {settings?.map(setting => (
                        <div key={setting.key} className="space-y-2">
                          <Label htmlFor={setting.key}>{setting.description}</Label>
                          <Input
                            id={setting.key}
                            type="number"
                            step="0.1"
                            value={feeValues[setting.key] ?? setting.value}
                            onChange={(e) => setFeeValues(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          />
                        </div>
                      ))}

                      <div className="bg-muted/50 p-4 rounded-lg mt-4">
                        <p className="text-sm font-medium mb-2">Exemplo de distribuição para R$ 100,00:</p>
                        <p className="text-sm text-muted-foreground">• Entregador recebe: <strong>R$ {(100 * driverCommission / 100).toFixed(2)}</strong></p>
                        <p className="text-sm text-muted-foreground">• Plataforma recebe: <strong>R$ {(100 * platformFee / 100).toFixed(2)}</strong></p>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveFees} disabled={saveSettingsMutation.isPending}>
                          {saveSettingsMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar Taxas
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Preços por Categoria de Veículo */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <CardTitle>Preços por Categoria de Veículo</CardTitle>
                  </div>
                  <CardDescription>
                    Valor base e por quilômetro para cada categoria de entrega
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loadingCategories ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                  ) : categories?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma categoria cadastrada. Adicione em <strong>Categorias de Entrega</strong>.
                    </p>
                  ) : (
                    <>
                      {categories?.map((cat, index) => (
                        <div key={cat.id}>
                          {index > 0 && <Separator className="mb-6" />}
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{cat.name}</h3>
                              {!cat.is_active && (
                                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Inativo</span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Valor Base (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={categoryValues[cat.id]?.base_price ?? cat.base_price}
                                  onChange={(e) => setCategoryValues(prev => ({
                                    ...prev,
                                    [cat.id]: { ...prev[cat.id], base_price: e.target.value }
                                  }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Valor por Km (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={categoryValues[cat.id]?.price_per_km ?? cat.price_per_km}
                                  onChange={(e) => setCategoryValues(prev => ({
                                    ...prev,
                                    [cat.id]: { ...prev[cat.id], price_per_km: e.target.value }
                                  }))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveCategories} disabled={saveCategoriesMutation.isPending}>
                          {saveCategoriesMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                          Salvar Preços
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Sistema */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    <CardTitle>Informações do Sistema</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Versão:</span>
                    <span className="font-medium">1.0.0</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ambiente:</span>
                    <span className="font-medium">Produção</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Banco de dados:</span>
                    <span className="font-medium text-green-600">Conectado</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Última atualização:</span>
                    <span className="font-medium">{new Date().toLocaleDateString('pt-BR')}</span>
                  </div>
                </CardContent>
              </Card>

            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
