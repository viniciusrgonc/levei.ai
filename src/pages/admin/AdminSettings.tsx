import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarProvider } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminPageHeader } from '@/components/AdminPageHeader';
import { Settings, DollarSign, Percent, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

interface DeliveryCategory {
  id: string;
  name: string;
  base_price: number;
  price_per_km: number;
  is_active: boolean;
}

interface PricingConfig {
  id: string;
  platform_commission_percentage: number;
}

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const [commission, setCommission] = useState('');
  const [categoryValues, setCategoryValues] = useState<Record<string, { base_price: string; price_per_km: string }>>({});

  // ── pricing_config ──────────────────────────────────────────────────────────
  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('id, platform_commission_percentage')
        .maybeSingle();
      if (error) throw error;
      if (data) setCommission(String(data.platform_commission_percentage ?? 20));
      return data as PricingConfig | null;
    },
  });

  const saveCommissionMutation = useMutation({
    mutationFn: async (pct: number) => {
      if (!config?.id) throw new Error('Configuração não encontrada');
      const { error } = await supabase
        .from('pricing_config')
        .update({ platform_commission_percentage: pct })
        .eq('id', config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
      toast.success('Comissão salva com sucesso!');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar comissão'),
  });

  const platformFee = parseFloat(commission) || 20;
  const driverCommission = 100 - platformFee;

  // ── delivery_categories ─────────────────────────────────────────────────────
  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ['delivery_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_categories')
        .select('*')
        .order('name');
      if (error) throw error;
      const vals: Record<string, { base_price: string; price_per_km: string }> = {};
      (data ?? []).forEach((c: DeliveryCategory) => {
        vals[c.id] = { base_price: c.base_price.toString(), price_per_km: c.price_per_km.toString() };
      });
      setCategoryValues(vals);
      return data as DeliveryCategory[];
    },
  });

  const saveCategoriesMutation = useMutation({
    mutationFn: async (updates: { id: string; base_price: number; price_per_km: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from('delivery_categories')
          .update({ base_price: u.base_price, price_per_km: u.price_per_km })
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery_categories'] });
      toast.success('Preços por categoria salvos!');
    },
    onError: (e: any) => toast.error(e.message ?? 'Erro ao salvar preços'),
  });

  const handleSaveCategories = () => {
    if (!categories) return;
    const updates = categories.map(c => ({
      id: c.id,
      base_price: parseFloat(categoryValues[c.id]?.base_price || '0'),
      price_per_km: parseFloat(categoryValues[c.id]?.price_per_km || '0'),
    }));
    saveCategoriesMutation.mutate(updates);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <AdminSidebar />

        <div className="flex-1 flex flex-col">
          <AdminPageHeader title="Configurações do Sistema" showBack showLogout />

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
                    Percentual que a plataforma retém de cada entrega
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loadingConfig ? (
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Comissão da plataforma (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={commission}
                            onChange={e => setCommission(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Repasse ao entregador (%)</Label>
                          <Input
                            type="number"
                            value={driverCommission.toFixed(1)}
                            readOnly
                            className="bg-muted/40 cursor-not-allowed"
                          />
                        </div>
                      </div>

                      <div className="bg-muted/50 p-4 rounded-lg">
                        <p className="text-sm font-medium mb-2">Exemplo para uma entrega de R$ 100,00:</p>
                        <p className="text-sm text-muted-foreground">
                          • Entregador recebe: <strong>R$ {(100 * driverCommission / 100).toFixed(2)}</strong>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          • Plataforma recebe: <strong>R$ {(100 * platformFee / 100).toFixed(2)}</strong>
                        </p>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={() => saveCommissionMutation.mutate(platformFee)}
                          disabled={saveCommissionMutation.isPending}
                        >
                          {saveCommissionMutation.isPending
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <Save className="h-4 w-4 mr-2" />}
                          Salvar Comissão
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
                  ) : !categories?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma categoria cadastrada. Adicione em <strong>Categorias de Entrega</strong>.
                    </p>
                  ) : (
                    <>
                      {categories.map((cat, index) => (
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
                                  onChange={e => setCategoryValues(prev => ({
                                    ...prev,
                                    [cat.id]: { ...prev[cat.id], base_price: e.target.value },
                                  }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Valor por Km (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={categoryValues[cat.id]?.price_per_km ?? cat.price_per_km}
                                  onChange={e => setCategoryValues(prev => ({
                                    ...prev,
                                    [cat.id]: { ...prev[cat.id], price_per_km: e.target.value },
                                  }))}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveCategories} disabled={saveCategoriesMutation.isPending}>
                          {saveCategoriesMutation.isPending
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <Save className="h-4 w-4 mr-2" />}
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
