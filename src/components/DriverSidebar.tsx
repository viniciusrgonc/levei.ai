import { Home, Map, Wallet, History, User, LogOut, Bike } from 'lucide-react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

const menuItems = [
  { title: 'Início', url: '/driver/dashboard', icon: Home },
  { title: 'Mapa', url: '/driver/map', icon: Map },
  { title: 'Ganhos', url: '/driver/wallet', icon: Wallet },
  { title: 'Histórico', url: '/driver/history', icon: History },
  { title: 'Perfil', url: '/driver/profile', icon: User },
];

export function DriverSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isCollapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await signOut();
    toast({ title: 'Até logo!' });
    navigate('/auth');
  };

  return (
    <Sidebar className={isCollapsed ? 'w-16' : 'w-56'} collapsible="icon">
      <SidebarContent className="border-r border-sidebar-border bg-sidebar">
        {/* Logo */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bike className="w-4 h-4 text-primary-foreground" />
            </div>
            {!isCollapsed && <span className="font-bold text-foreground">Levei</span>}
          </div>
        </div>

        <SidebarGroup className="flex-1 py-4">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1 px-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all touch-target ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                        }`}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <SidebarGroup className="border-t border-sidebar-border py-4">
          <SidebarGroupContent>
            <SidebarMenu className="px-2">
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={handleSignOut}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all touch-target w-full"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
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