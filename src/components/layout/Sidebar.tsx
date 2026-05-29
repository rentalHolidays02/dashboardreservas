import React, { useState, useRef } from 'react';
import {
  PanelLeft,
  LayoutDashboard,
  Users,
  Calendar,
  Banknote,
  AlertTriangle,
  Mail,
  Home,
  FileText,
  User,
  ShieldCheck,
  KeyRound,
  TrendingUp,
  type LucideProps,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useNavigationGuard } from '../../context/NavigationGuardContext';
import { appsScriptApi } from '../../services/api';
import logoFull from '../../assets/logo/rental-logo.svg';
import type { User as AppUser } from '../../services/mockData';

interface SidebarProps {
  user: AppUser;
  onLogout: () => void;
  onRoleChange?: (role: AppUser['role']) => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onCollapse: (v: boolean) => void;
  onHoverChange: (v: boolean) => void;
}

type IconComponent = React.FC<LucideProps>;

const categories: { label: string; items: { Icon: IconComponent; label: string; path: string; prominent?: boolean }[] }[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { Icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
      { Icon: TrendingUp, label: 'Resumen', path: '/analiticas' },
      { Icon: FileText, label: 'Registros', path: '/registros' },
      { Icon: Banknote, label: 'Análisis', path: '/analisis' },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { Icon: Calendar, label: 'Limpiezas', path: '/cleans' },
      { Icon: Users, label: 'Trabajadores', path: '/workers' },
      { Icon: Home, label: 'Alojamientos', path: '/alojamientos' },
      { Icon: KeyRound, label: 'Entrega de Llaves', path: '/entrega-de-llaves' },
    ],
  },
  {
    label: 'SISTEMA',
    items: [
      { Icon: ShieldCheck, label: 'Usuarios', path: '/usuarios' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { Icon: Banknote, label: 'Pagos', path: '/pagos' },
      { Icon: AlertTriangle, label: 'Incidencias', path: '/incidencias' },
      { Icon: Mail, label: 'Sugerencias', path: '/sugerencias' },
      { Icon: FileText, label: 'Generar Informe', path: '/generar-informe', prominent: true },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  user,
  onLogout,
  onRoleChange,
  isOpen,
  onClose,
  isCollapsed,
  onCollapse,
  onHoverChange,
}) => {
  const userRole = user.role;
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { requestNavigate } = useNavigationGuard();
  const [isHovered, setIsHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const collapsed = isCollapsed && !isOpen && !isHovered;
  const isHoverExpanded = isCollapsed && isHovered && !isOpen;

  const handleMouseEnter = () => {
    clearTimeout(leaveTimer.current);
    setIsHovered(true);
    onHoverChange(true);
  };
  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setIsHovered(false);
      onHoverChange(false);
    }, 60);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 xl:hidden"
          onClick={onClose}
        />
      )}

      <div
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`sidebar-panel fixed left-0 top-0 h-full bg-slate-50 dark:bg-stone-900 xl:bg-transparent dark:xl:bg-transparent border-r border-slate-200/20 dark:border-stone-700/20 z-50 flex flex-col overflow-hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'}
        `}
        style={{ width: isOpen ? '240px' : collapsed ? '73px' : '240px' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center h-16 pl-[18px] pr-3 shrink-0">
          <img
            src={logoFull}
            alt="RH Pagos"
            className="h-9 w-auto object-contain shrink-0"
          />
          <div className="flex-1" />
          <button
            onClick={() => { onCollapse(!isCollapsed); setIsHovered(false); onHoverChange(false); }}
            className={`hidden xl:flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0 sidebar-fade
              ${isHoverExpanded
                ? 'text-orange-700 hover:bg-white/50'
                : 'text-slate-400 hover:bg-white/50'
              }`}
          >
            <PanelLeft size={16} />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-4">
          {categories
            .filter(cat => {
              if (userRole === 'trabajador') {
                return cat.label === 'PRINCIPAL' || cat.label === 'OPERACIONES';
              }
              return true;
            })
            .map((cat) => {
      const filteredItems = cat.items.filter(item => {
        if (userRole === 'trabajador') {
          return item.label === 'Dashboard' || item.label === 'Resumen';
        }
        // Para admin, no mostrar 'Registros' ni 'Resumen'
        return item.label !== 'Registros' && item.label !== 'Resumen';
      });

              if (filteredItems.length === 0) return null;

              return (
                <div key={cat.label}>
                  <div className="h-5 pl-5 mb-1 flex items-center">
                    <span className="sidebar-fade text-[10px] tracking-widest text-slate-400 uppercase whitespace-nowrap">
                      {cat.label}
                    </span>
                  </div>

                  <ul className="space-y-0.5 px-3">
                    {filteredItems.map(({ Icon, label, path, prominent }) => {
                  const active = location.pathname === path;
                  
                  const linkBase = "flex items-center h-10 w-full gap-3 pl-2 pr-3 rounded-md text-sm tracking-tight transition-all duration-200";
                  
                  const linkClasses = prominent 
                    ? `${linkBase} mt-1 ${active ? 'bg-orange-600 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`
                    : `${linkBase} ${active ? 'text-orange-600 dark:text-orange-500' : 'text-slate-500 dark:text-stone-400 hover:text-slate-800 dark:hover:text-stone-200 hover:bg-white/25 dark:hover:bg-stone-700/40'}`;

                  const iconClasses = prominent
                    ? "text-white"
                    : active ? "text-orange-700" : "";

                  const textClasses = prominent
                    ? "font-medium text-white"
                    : active ? "font-normal" : "font-normal text-slate-500";

                  return (
                    <li key={path}>
                      <Link
                        to={path}
                        onClick={(e) => {
                          e.preventDefault();
                          requestNavigate(() => {
                            navigate(path);
                            if (window.innerWidth < 1280) onClose();
                          });
                        }}
                        title={collapsed ? label : undefined}
                        className={linkClasses}
                      >
                        <span className={`shrink-0 w-8 h-8 flex items-center justify-center ${iconClasses}`}>
                          <Icon size={18} />
                        </span>
                        <span className={`sidebar-fade whitespace-nowrap ${textClasses}`}>
                          {label}
                        </span>
                      </Link>
                    </li>
                  );
                    })}
                  </ul>
                </div>
              );
            })}
        </nav>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="px-3 pb-4 pt-3 shrink-0">

          {/* Profile link */}
          <Link
            to="/perfil"
            onClick={(e) => {
              e.preventDefault();
              requestNavigate(() => {
                navigate('/perfil');
                if (window.innerWidth < 1280) onClose();
              });
            }}
            title={collapsed ? 'Mi perfil' : undefined}
            className={`flex items-center h-12 w-full gap-3 pl-2 pr-3 mb-2 rounded-xl transition-all cursor-pointer
              ${collapsed ? '' : 'bg-white/20 dark:bg-stone-800/40 border border-white/40 dark:border-stone-700/40'}
              hover:bg-black/5 dark:hover:bg-black/20`}
          >
            <div className="shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 text-[10px] font-medium soft-shadow overflow-hidden">
              {(user.name || 'U')
                .split(' ')
                .map((w) => w.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ''))
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase() || 'U'}
            </div>
            <div className="sidebar-fade min-w-0">
              <p className="text-sm tracking-tight text-slate-800 dark:text-stone-200 whitespace-nowrap leading-tight truncate max-w-[120px]">
                {user.name}
              </p>
              <p className="text-xs text-slate-400 dark:text-stone-500 capitalize leading-tight">Ver perfil</p>
            </div>
          </Link>

        </div>
      </div>
    </>
  );
};

export default Sidebar;
