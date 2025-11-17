import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, Package } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AdminSidebar } from '@/components/AdminSidebar';
import NotificationBell from '@/components/NotificationBell';

type ProductTypeSetting = {
  id: string;
  product_type: string;
  percentage_increase: number;
  is_active: boolean;
};

export default function AdminProductSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<ProductTypeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchSettings();
  }, [user, navigate]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('product_type_settings')
      .select('*')
      .order('product_type');

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível carregar as configurações'
      });
      return;
    }

    setSettings(data || []);
    setLoading(false);
  };

  const handlePercentageChange = (id: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings(prev => prev.map(setting => 
      setting.id === id 
        ? { ...setting, percentage_increase: numValue }
        : setting
    ));
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const updates = settings.map(setting => ({
        id: setting.id,
        percentage_increase: setting.percentage_increase
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('product_type_settings')
          .update({ percentage_increase: update.percentage_increase })
          .eq('id', update.id);

        if (error) throw error;
      }

      toast({
        title: 'Sucesso',
        description: 'Configurações atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível salvar as configurações'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        
        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center gap-4 px-4 md:px-6">
              <SidebarTrigger className="-ml-2" />
              <div className="flex-1" />
              <NotificationBell />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/admin/dashboard')}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Configurações de Produtos</h1>
                  <p className="text-muted-foreground">Configure os acréscimos por tipo de produto</p>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Percentuais de Acréscimo
                  </CardTitle>
                  <CardDescription>
                    Defina a porcentagem de acréscimo no valor da entrega para cada tipo de produto
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {settings.map((setting) => (
                    <div key={setting.id} className="flex items-center gap-4 p-4 border rounded-lg">
                      <div className="flex-1">
                        <Label htmlFor={`setting-${setting.id}`} className="font-medium">
                          {setting.product_type}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`setting-${setting.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={setting.percentage_increase}
                          onChange={(e) => handlePercentageChange(setting.id, e.target.value)}
                          className="w-24 text-right"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleSave}
                      disabled={saving}
                      size="lg"
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saving ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
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
