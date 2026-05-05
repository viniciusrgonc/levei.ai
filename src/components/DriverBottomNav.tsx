import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Wallet, History, User } from 'lucide-react';

const tabs = [
  { label: 'Início',    icon: Home,    path: '/driver/dashboard' },
  { label: 'Ganhos',    icon: Wallet,  path: '/driver/wallet' },
  { label: 'Histórico', icon: History, path: '/driver/history' },
  { label: 'Perfil',    icon: User,    path: '/driver/profile' },
];

export function DriverBottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.path ||
            (tab.path !== '/driver/dashboard' && pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{ minHeight: 44 }}
              className={`flex flex-col items-center gap-1 flex-1 py-2 transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
