import { Home, Plus, History, User, LogOut, Calendar, Wallet, Settings, UserCircle } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

const mainMenuItems = [
  { title: 'Dashboard', url: '/restaurant/dashboard', icon: Home },
  { title: 'Solicitar Entrega', url: '/restaurant/new-delivery', icon: Plus },
  { title: 'Agendamento', url: '/restaurant/scheduling', icon: Calendar },
  { title: 'Histórico de Entregas', url: '/restaurant/history', icon: History },
];

const settingsMenuItems = [
  { title: 'Carteira/Saldo', url: '/restaurant/wallet', icon: Wallet },
  { title: 'Meus Dados', url: '/restaurant/profile', icon: User },
  { title: 'Editar Dados Pessoais', url: '/restaurant/account', icon: UserCircle },
];

export function RestaurantSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const isCollapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Até logo!' });
    navigate('/auth');
  };

  return (
    <Sidebar className={isCollapsed ? 'w-14' : 'w-60'} collapsible="icon">
      <SidebarContent className="text-foreground font-sans">
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground font-semibold">Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        `transition-all duration-300 hover:scale-105 active:scale-95 text-foreground ${
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-foreground font-semibold">
            <Settings className="h-4 w-4 mr-2 inline" />
            {!isCollapsed && 'Configurações'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className={({ isActive }) =>
                        `transition-all duration-300 hover:scale-105 active:scale-95 text-foreground ${
                          isActive
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted/50'
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleSignOut}
                  className="transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-destructive/10 hover:text-destructive text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  {!isCollapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
