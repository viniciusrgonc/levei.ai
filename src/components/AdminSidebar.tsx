import { LayoutDashboard, Users, PackageCheck, AlertCircle, Settings, Tag, ShoppingBag, DollarSign, BarChart3, MapPin, Layers, Percent, LogOut, Map, Star, Gift, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import leveiLogo from '@/assets/levei-logo.png';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
  SidebarHeader,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';

async function fetchPendingCount(): Promise<number> {
  const { count } = await supabase
    .from('drivers')
    .select('id', { count: 'exact', head: true })
    .eq('driver_status', 'pending')
    .not('submitted_at', 'is', null);
  return count ?? 0;
}

const menuItems = [
  {
    title: 'Dashboard',
    url: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Entregadores',
    url: '/admin/drivers',
    icon: Users,
  },
  {
    title: 'Solicitantes',
    url: '/admin/restaurants',
    icon: Users,
  },
  {
    title: 'Entregas',
    url: '/admin/deliveries',
    icon: PackageCheck,
  },
  {
    title: 'Transações',
    url: '/admin/transactions',
    icon: DollarSign,
  },
  {
    title: 'Relatórios',
    url: '/admin/reports',
    icon: BarChart3,
  },
  {
    title: 'Categorias',
    url: '/admin/delivery-categories',
    icon: Tag,
  },
  {
    title: 'Tipos de Produto',
    url: '/admin/product-settings',
    icon: ShoppingBag,
  },
  {
    title: 'Raio de Entregas',
    url: '/admin/radius-settings',
    icon: MapPin,
  },
  {
    title: 'Múltiplas Entregas',
    url: '/admin/batch-settings',
    icon: Layers,
  },
  {
    title: 'Tipos de Taxa',
    url: '/admin/fee-types',
    icon: Percent,
  },
  {
    title: 'Mapa ao Vivo',
    url: '/admin/driver-map',
    icon: Map,
  },
  {
    title: 'Loja de Pontos',
    url: '/admin/points-store',
    icon: ShoppingBag,
  },
  {
    title: 'Gerenciar Pontos',
    url: '/admin/points-manager',
    icon: Gift,
  },
  {
    title: 'Campanhas',
    url: '/admin/campaigns',
    icon: Zap,
  },
  {
    title: 'Tarifas',
    url: '/admin/pricing',
    icon: Percent,
  },
  {
    title: 'Avaliações',
    url: '/admin/reviews',
    icon: Star,
  },
  {
    title: 'Indicações',
    url: '/admin/referrals',
    icon: Gift,
  },
  {
    title: 'Disputas',
    url: '/admin/disputes',
    icon: AlertCircle,
  },
  {
    title: 'Configurações',
    url: '/admin/settings',
    icon: Settings,
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const isCollapsed = state === 'collapsed';

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['admin-pending-drivers-count'],
    queryFn: fetchPendingCount,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border py-4 px-3">
        <div className="flex flex-col items-center gap-1">
          <img
            src={leveiLogo}
            alt="Levei.ai"
            className={isCollapsed ? 'h-8 w-8 rounded-lg object-cover' : 'h-10 w-10 rounded-xl object-cover'}
          />
          {!isCollapsed && (
            <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0">Admin</Badge>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="border-r border-sidebar-border flex flex-col">
        <SidebarGroup className="flex-1">
          {!isCollapsed && (
            <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
              Administração
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5 px-2">
              {menuItems.map((item) => {
                const showBadge = item.url === '/admin/drivers' && pendingCount > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={isActive(item.url)}
                      onClick={() => navigate(item.url)}
                      tooltip={item.title}
                      className="w-full"
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="flex-1">{item.title}</span>
                      {showBadge && !isCollapsed && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                          {pendingCount > 9 ? '9+' : pendingCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Sair — fixo no rodapé do sidebar */}
        <SidebarGroup className="border-t border-sidebar-border mt-auto">
          <SidebarGroupContent>
            <SidebarMenu className="px-2 py-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleLogout}
                  tooltip="Sair"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  <span>Sair</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
