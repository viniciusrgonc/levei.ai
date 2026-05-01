import { SidebarTrigger } from '@/components/ui/sidebar';
import leveiLogo from '@/assets/levei-logo.png';

interface AdminPageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export function AdminPageHeader({ title, children }: AdminPageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 bg-primary border-b border-primary/20">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="text-primary-foreground hover:bg-white/10" />
          <div className="flex items-center gap-3">
            <img src={leveiLogo} alt="Levei" className="h-8 w-8 rounded-lg object-cover" />
            <h1 className="text-base font-bold text-white">{title}</h1>
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2">{children}</div>
        )}
      </div>
    </header>
  );
}
