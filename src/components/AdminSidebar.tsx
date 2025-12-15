import { LayoutDashboard, Users, PackageCheck, AlertCircle, Settings, Tag, ShoppingBag, DollarSign, BarChart3 } from 'lucide-react';
import leveiLogo from '@/assets/levei-logo.png';
import { NavLink, useLocation } from 'react-router-dom';
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
  const currentPath = location.pathname;
  const isCollapsed = state === 'collapsed';

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border py-4 px-4">
        <div className="flex items-center justify-center">
          <img src={leveiLogo} alt="Levei.ai" className={isCollapsed ? 'h-8 w-auto' : 'h-10 w-auto'} />
        </div>
        {!isCollapsed && (
          <Badge variant="secondary" className="w-fit text-[10px] px-1.5 py-0 mt-2 mx-auto">Admin</Badge>
        )}
      </SidebarHeader>
      <SidebarContent className="border-r border-sidebar-border">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-4 py-3">
            Administração
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink 
                      to={item.url} 
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`
                      }
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
