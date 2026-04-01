import React, { useState, useRef } from 'react';
import {
  PanelLeft,
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Banknote,
  AlertTriangle,
  type LucideProps,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import logoFull from '../../assets/logo/LogoEstandar.png';

interface SidebarProps {
  userRole: 'admin' | 'viewer';
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onCollapse: (v: boolean) => void;
  onHoverChange: (v: boolean) => void;
}

type IconComponent = React.FC<LucideProps>;

const categories: { label: string; items: { Icon: IconComponent; label: string; path: string }[] }[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { Icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { Icon: Calendar, label: 'Limpiezas', path: '/cleans' },
      { Icon: Users, label: 'Trabajadores', path: '/workers' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { Icon: Banknote, label: 'Pagos', path: '/pagos' },
      { Icon: AlertTriangle, label: 'Incidencias', path: '/incidencias' },
    ],
  },
];

const Sidebar: React.FC<SidebarProps> = ({
  userRole,
  onLogout,
  isOpen,
  onClose,
  isCollapsed,
  onCollapse,
  onHoverChange,
}) => {
  const location = useLocation();
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
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        data-collapsed={collapsed ? 'true' : 'false'}
        className={`sidebar-panel fixed left-0 top-0 h-full bg-transparent border-r border-slate-200/20 z-50 flex flex-col overflow-hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
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
            className={`hidden lg:flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0 sidebar-fade
              ${isHoverExpanded
                ? 'text-orange-700 hover:bg-white/40'
                : 'text-slate-400 hover:bg-white/40'
              }`}
          >
            <PanelLeft size={16} />
          </button>
          <button
            onClick={onClose}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100"
          >
            <PanelLeft size={18} />
          </button>
        </div>

        {/* ── Navigation ───────────────────────────────────────────────── */}
        {/* nav px-3 + link pl-2 = 20px from sidebar edge. Never changes. */}
        <nav className="flex-1 overflow-y-auto py-2 space-y-4">
          {categories.map((cat) => (
            <div key={cat.label}>
              <div className="h-5 pl-5 mb-1 flex items-center">
                <span className="sidebar-fade text-[10px] tracking-widest text-slate-400 uppercase whitespace-nowrap">
                  {cat.label}
                </span>
              </div>

              <ul className="space-y-0.5 px-3">
                {cat.items.map(({ Icon, label, path }) => {
                  const active = location.pathname === path;
                  return (
                    <li key={path}>
                      <Link
                        to={path}
                        onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                        title={collapsed ? label : undefined}
                        className={`flex items-center h-10 w-full gap-3 pl-2 pr-3 rounded-lg
                          text-sm tracking-tight transition-all duration-200
                          ${active
                            ? 'text-orange-700'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                          }`}
                      >
                        <span className={`shrink-0 w-8 h-8 flex items-center justify-center ${active ? 'text-orange-700' : ''}`}>
                          <Icon size={18} />
                        </span>
                        <span className={`sidebar-fade whitespace-nowrap
                          ${active ? 'font-normal' : 'font-normal text-slate-500'}`}>
                          {label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="px-3 pb-4 pt-3 shrink-0">
          {/* User card — same pl-2 offset, icon never moves */}
          <div className="flex items-center h-12 w-full gap-3 pl-2 pr-3 mb-2 bg-white/80 backdrop-blur-sm border border-white/60 rounded-xl">
            <div className="shrink-0 w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 text-xs font-medium soft-shadow">
              {userRole === 'admin' ? 'A' : 'V'}
            </div>
            <div className="sidebar-fade min-w-0">
              <p className="text-sm tracking-tight text-slate-800 whitespace-nowrap leading-tight">
                {userRole === 'admin' ? 'Administrador' : 'Visualizador'}
              </p>
              <p className="text-xs text-slate-400 capitalize leading-tight">{userRole}</p>
            </div>
          </div>

          {/* Logout — same layout, icon span gets bg in mini */}
          <button
            onClick={onLogout}
            title={collapsed ? 'Cerrar sesión' : undefined}
            className="flex items-center h-10 w-full gap-3 pl-2 pr-3 rounded-lg
              text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <span className="shrink-0 w-8 h-8 flex items-center justify-center">
              <LogOut size={18} />
            </span>
            <span className="sidebar-fade text-sm tracking-tight whitespace-nowrap">
              Cerrar sesión
            </span>
          </button>
        </div>

      </div>
    </>
  );
};

export default Sidebar;
