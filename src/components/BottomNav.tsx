import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Package, Wallet, User } from 'lucide-react';

const tabs = [
  { label: 'Início', icon: Home, path: '/restaurant/dashboard' },
  { label: 'Entregas', icon: Package, path: '/restaurant/history' },
  { label: 'Carteira', icon: Wallet, path: '/restaurant/wallet' },
  { label: 'Perfil', icon: User, path: '/restaurant/profile' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.path ||
            (tab.path !== '/restaurant/dashboard' && pathname.startsWith(tab.path));
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-1 flex-1 py-2 transition-colors ${
                isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon
                className="h-5 w-5"
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
