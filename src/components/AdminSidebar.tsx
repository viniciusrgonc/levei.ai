import { LayoutDashboard, Users, PackageCheck, AlertCircle, Settings, Shield, Tag } from 'lucide-react';
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
    title: 'Categorias',
    url: '/admin/delivery-categories',
    icon: Tag,
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

  const isActive = (path: string) => currentPath === path;

  return (
    <Sidebar className={state === 'collapsed' ? 'w-14' : 'w-60'} collapsible="icon">
      <SidebarHeader className="border-b border-border pb-4">
        <div className="flex items-center gap-2 px-4 py-2">
          <Shield className="h-5 w-5 text-primary" />
          {state !== 'collapsed' && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">Administrador</span>
              <Badge variant="secondary" className="w-fit text-xs">Acesso Total</Badge>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="text-foreground font-sans">
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground font-semibold">Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink 
                      to={item.url} 
                      end
                      className="transition-all duration-300 hover:scale-105 active:scale-95 text-foreground"
                    >
                      <item.icon className="h-4 w-4" />
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
