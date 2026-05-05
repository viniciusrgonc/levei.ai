import { useNavigate } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { ArrowLeft, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import leveiLogo from '@/assets/levei-logo.png';

interface AdminPageHeaderProps {
  title: string;
  /** Mostra botão voltar. Padrão: false (não mostrar no dashboard). */
  showBack?: boolean;
  /** Mostra botão Sair. Padrão: false. */
  showLogout?: boolean;
  /** Conteúdo extra no lado direito (ex: botões de ação). */
  children?: React.ReactNode;
}

export function AdminPageHeader({
  title,
  showBack = false,
  showLogout = false,
  children,
}: AdminPageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/admin');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <header
      className="sticky top-0 z-10 bg-primary border-b border-primary/20"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {/* Lado esquerdo: voltar + sidebar + logo + título */}
        <div className="flex items-center gap-2">
          {showBack && (
            <button
              onClick={handleBack}
              aria-label="Voltar"
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <SidebarTrigger className="text-primary-foreground hover:bg-white/10" />
          <div className="flex items-center gap-2 ml-1">
            <img src={leveiLogo} alt="Levei" className="h-7 w-7 rounded-lg object-cover" />
            <h1 className="text-base font-bold text-white truncate max-w-[180px] sm:max-w-none">
              {title}
            </h1>
          </div>
        </div>

        {/* Lado direito: ações + logout */}
        <div className="flex items-center gap-2">
          {children}
          {showLogout && (
            <button
              onClick={handleLogout}
              aria-label="Sair"
              className="flex items-center gap-1.5 text-white font-medium text-sm px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
