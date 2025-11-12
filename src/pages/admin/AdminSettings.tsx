import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Settings, DollarSign, Percent, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';

export default function AdminSettings() {
  const [pricing, setPricing] = useState({
    moto: { base: '5.00', perKm: '2.50' },
    carro: { base: '8.00', perKm: '3.50' },
    van: { base: '12.00', perKm: '4.50' },
  });

  const [fees, setFees] = useState({
    platformFee: '10',
    driverCommission: '85',
    restaurantFee: '5',
  });

  const handlePricingChange = (vehicle: string, field: string, value: string) => {
    setPricing(prev => ({
      ...prev,
      [vehicle]: {
        ...prev[vehicle as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleFeesChange = (field: string, value: string) => {
    setFees(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const savePricing = () => {
    // In a real app, this would save to the database
    toast.success('Configurações de preços salvas com sucesso!');
  };

  const saveFees = () => {
    // In a real app, this would save to the database
    toast.success('Configurações de taxas salvas com sucesso!');
  };

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
              {/* Pricing Configuration */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <CardTitle>Configuração de Preços</CardTitle>
                  </div>
                  <CardDescription>
                    Defina os valores base e por quilômetro para cada tipo de veículo
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Moto */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Moto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="moto-base">Valor Base (R$)</Label>
                        <Input
                          id="moto-base"
                          type="number"
                          step="0.01"
                          value={pricing.moto.base}
                          onChange={(e) => handlePricingChange('moto', 'base', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="moto-km">Valor por Km (R$)</Label>
                        <Input
                          id="moto-km"
                          type="number"
                          step="0.01"
                          value={pricing.moto.perKm}
                          onChange={(e) => handlePricingChange('moto', 'perKm', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Carro */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Carro</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="carro-base">Valor Base (R$)</Label>
                        <Input
                          id="carro-base"
                          type="number"
                          step="0.01"
                          value={pricing.carro.base}
                          onChange={(e) => handlePricingChange('carro', 'base', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="carro-km">Valor por Km (R$)</Label>
                        <Input
                          id="carro-km"
                          type="number"
                          step="0.01"
                          value={pricing.carro.perKm}
                          onChange={(e) => handlePricingChange('carro', 'perKm', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Van */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-foreground">Van</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="van-base">Valor Base (R$)</Label>
                        <Input
                          id="van-base"
                          type="number"
                          step="0.01"
                          value={pricing.van.base}
                          onChange={(e) => handlePricingChange('van', 'base', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="van-km">Valor por Km (R$)</Label>
                        <Input
                          id="van-km"
                          type="number"
                          step="0.01"
                          value={pricing.van.perKm}
                          onChange={(e) => handlePricingChange('van', 'perKm', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={savePricing}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Preços
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Fees Configuration */}
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
                  <div className="space-y-2">
                    <Label htmlFor="platform-fee">Taxa da Plataforma (%)</Label>
                    <Input
                      id="platform-fee"
                      type="number"
                      step="0.1"
                      value={fees.platformFee}
                      onChange={(e) => handleFeesChange('platformFee', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentual cobrado pela plataforma em cada entrega
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="driver-commission">Comissão do Entregador (%)</Label>
                    <Input
                      id="driver-commission"
                      type="number"
                      step="0.1"
                      value={fees.driverCommission}
                      onChange={(e) => handleFeesChange('driverCommission', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Percentual que o entregador recebe do valor da entrega
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="restaurant-fee">Taxa do Solicitante (%)</Label>
                    <Input
                      id="restaurant-fee"
                      type="number"
                      step="0.1"
                      value={fees.restaurantFee}
                      onChange={(e) => handleFeesChange('restaurantFee', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Taxa adicional cobrada do solicitante
                    </p>
                  </div>

                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Exemplo de distribuição:</strong>
                      <br />
                      Para uma entrega de R$ 100,00:
                      <br />
                      • Entregador recebe: R$ {(100 * Number(fees.driverCommission) / 100).toFixed(2)}
                      <br />
                      • Plataforma recebe: R$ {(100 * Number(fees.platformFee) / 100).toFixed(2)}
                      <br />
                      • Taxa do solicitante: R$ {(100 * Number(fees.restaurantFee) / 100).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={saveFees}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Taxas
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* System Info */}
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
