import {
  BarChart3,
  Bell,
  Bike,
  Bolt,
  ChevronRight,
  CircleDollarSign,
  Headphones,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Percent,
  Plug,
  Settings,
  Shield,
  Star,
  Tag,
  Users,
} from 'lucide-react';
import leveiLogo from '@/assets/levei-logo.png';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const menuItems = [
  { title: 'Visão geral', url: '/admin/dashboard', icon: LayoutDashboard },
  { title: 'Entregas', url: '/admin/deliveries', icon: PackageCheck },
  { title: 'Entregadores', url: '/admin/drivers', icon: Bike },
  { title: 'Clientes', url: '/admin/restaurants', icon: Users },
  { title: 'Financeiro', url: '/admin/transactions', icon: CircleDollarSign, nested: true },
  { title: 'Taxas dinâmicas', url: '/admin/product-settings', icon: Bolt },
  { title: 'Promoções', url: '/admin/delivery-categories', icon: Tag },
  { title: 'Avaliações', url: '/admin/reports', icon: Star },
  { title: 'Suporte', url: '/admin/disputes', icon: Headphones },
  { title: 'Relatórios', url: '/admin/reports', icon: BarChart3, nested: true },
  { title: 'Configurações', url: '/admin/settings', icon: Settings, nested: true },
  { title: 'Integrações', url: '/admin/batch-settings', icon: Plug },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const isCollapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth', { replace: true });
  };

  return (
    <Sidebar className={isCollapsed ? 'w-16 border-r-0' : 'w-64 border-r-0'} collapsible="icon">
      <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
        <SidebarHeader className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/40">
              <img src={leveiLogo} alt="levei.ai" className="h-7 w-auto" />
            </div>
            {!isCollapsed && <span className="text-2xl font-bold tracking-normal text-sidebar-foreground">levei<span className="text-primary">.ai</span></span>}
          </div>
        </SidebarHeader>

        <SidebarContent className="flex-1 px-3">
          <div className="mb-5 flex items-center gap-3 rounded-xl px-1 py-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/30">
              <Users className="h-5 w-5" />
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">Olá, Admin</p>
                  <ChevronRight className="h-4 w-4 text-sidebar-foreground/60" />
                </div>
                <p className="text-xs text-primary">Administrador</p>
              </div>
            )}
          </div>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                {menuItems.map((item) => {
                  const active = location.pathname === item.url;
                  return (
                    <SidebarMenuItem key={`${item.title}-${item.url}`}>
                      <SidebarMenuButton asChild isActive={active} tooltip={isCollapsed ? item.title : undefined}>
                        <NavLink
                          to={item.url}
                          end
                          className={`flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
                            active
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-sidebar-foreground/85 hover:bg-sidebar-accent/35 hover:text-sidebar-foreground'
                          }`}
                        >
                          <item.icon className="h-5 w-5 shrink-0" />
                          {!isCollapsed && <span className="flex-1 truncate">{item.title}</span>}
                          {!isCollapsed && item.nested && <ChevronRight className="h-4 w-4 opacity-70" />}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="space-y-4 px-4 pb-5">
          {!isCollapsed && (
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/20 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Shield className="h-5 w-5 text-success" />
                <p className="text-sm font-semibold">Modo de segurança</p>
              </div>
              <p className="text-xs text-success">Ativo</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/35 hover:text-sidebar-foreground"
          >
            <LogOut className="h-5 w-5" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
