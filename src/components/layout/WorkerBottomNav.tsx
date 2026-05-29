import React from 'react';
import { LayoutDashboard, TrendingUp, User } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useNavigationGuard } from '../../context/NavigationGuardContext';

const NAV_ITEMS = [
  { Icon: LayoutDashboard, label: 'Inicio',     path: '/dashboard' },
  { Icon: TrendingUp,      label: 'Resumen',    path: '/analiticas' },
  { Icon: User,            label: 'Perfil',     path: '/perfil' },
];

const WorkerBottomNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { requestNavigate } = useNavigationGuard();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 xl:hidden">
      {/* Glass bar */}
      <div className="bg-white/80 dark:bg-stone-950/90 backdrop-blur-xl border-t border-stone-200/60 dark:border-stone-800/60 flex items-stretch pb-safe">
        {NAV_ITEMS.map(({ Icon, label, path }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={(e) => {
                e.preventDefault();
                requestNavigate(() => navigate(path));
              }}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors group"
            >
              <Icon
                size={20}
                className={`transition-colors duration-200 ${
                  active
                    ? 'text-orange-500 dark:text-orange-400'
                    : 'text-slate-400 dark:text-stone-500'
                }`}
              />
              <span
                className={`text-[10px] font-medium leading-none transition-colors duration-200 ${
                  active
                    ? 'text-orange-500 dark:text-orange-400'
                    : 'text-slate-400 dark:text-stone-500'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default WorkerBottomNav;
