import React, { useState, useRef, useEffect } from 'react';
import {
  PanelLeft,
  LayoutDashboard,
  Users,
  Calendar,
  LogOut,
  Banknote,
  AlertTriangle,
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

const categories = [
  {
    label: 'PRINCIPAL',
    items: [
      { icon: <LayoutDashboard size={18} />, label: 'Dashboard', path: '/dashboard' },
    ],
  },
  {
    label: 'OPERACIONES',
    items: [
      { icon: <Calendar size={18} />, label: 'Limpiezas', path: '/cleans' },
      { icon: <Users size={18} />, label: 'Trabajadores', path: '/workers' },
    ],
  },
  {
    label: 'FINANZAS',
    items: [
      { icon: <Banknote size={18} />, label: 'Pagos', path: '/pagos' },
      { icon: <AlertTriangle size={18} />, label: 'Incidencias', path: '/incidencias' },
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
  const layoutTimer = useRef<ReturnType<typeof setTimeout>>();

  const collapsed = isCollapsed && !isOpen && !isHovered;
  const isHoverExpanded = isCollapsed && isHovered && !isOpen;

  // miniLayout: ONLY controls which element gets the highlight bg.
  // Switches to true AFTER the collapse animation ends (icon already at rest).
  // Switches to false IMMEDIATELY on expand so layout is ready as width grows.
  // The icon x-position NEVER changes — always pl-2 inside px-3.
  const [miniLayout, setMiniLayout] = useState(isCollapsed);
  useEffect(() => {
    clearTimeout(layoutTimer.current);
    if (collapsed) {
      layoutTimer.current = setTimeout(() => setMiniLayout(true), 420);
    } else {
      setMiniLayout(false);
    }
    return () => clearTimeout(layoutTimer.current);
  }, [collapsed]);

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
        className={`sidebar-panel fixed left-0 top-0 h-full bg-slate-50 z-50 flex flex-col overflow-hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ width: isOpen ? '240px' : collapsed ? '80px' : '240px' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >

        {/* ── Header ───────────────────────────────────────────────────── */}
        {/* pl-[18px] puts the logo at the same left edge as the icon in nav items:
            nav px-3 (12px) + link pl-2 (8px) - half-logo-offset ≈ 18px            */}
        <div className="flex items-center h-16 pl-[18px] pr-3 shrink-0">
          <img
            src={logoFull}
            alt="RH Pagos"
            className="h-7 w-auto object-contain shrink-0"
          />
          <div className="flex-1" />
          <button
            onClick={() => { onCollapse(!isCollapsed); setIsHovered(false); onHoverChange(false); }}
            className={`hidden lg:flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0 sidebar-fade
              ${isHoverExpanded
                ? 'bg-slate-900 text-white hover:bg-slate-700'
                : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
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
                {cat.items.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <li key={item.path}>
                      {/*
                        Layout NEVER changes: always flex, w-full, gap-3, pl-2, pr-3, h-10.
                        miniLayout only decides whether the bg is on this link (expanded)
                        or on the icon span (mini). Icon x-position: 12+8=20px. Always.
                      */}
                      <Link
                        to={item.path}
                        onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                        title={miniLayout ? item.label : undefined}
                        className={`group flex items-center h-10 w-full gap-3 pl-2 pr-3 rounded-lg
                          text-sm tracking-tight transition-colors duration-150
                          ${!miniLayout
                            ? active
                              ? 'bg-slate-700 text-white'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                            : active
                              ? 'text-white'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                      >
                        {/* Icon span: gets the square bg in mini mode */}
                        <span
                          className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150
                            ${miniLayout
                              ? active
                                ? 'bg-slate-700 text-white'
                                : 'text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-700'
                              : active
                                ? 'text-white'
                                : 'text-slate-400'
                            }`}
                        >
                          {item.icon}
                        </span>
                        <span className="sidebar-fade whitespace-nowrap">{item.label}</span>
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
          <div className="flex items-center h-12 w-full gap-3 pl-2 pr-3 mb-2 bg-slate-200/60 rounded-xl">
            <div className="shrink-0 w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs">
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
            title={miniLayout ? 'Cerrar sesión' : undefined}
            className={`group flex items-center h-10 w-full gap-3 pl-2 pr-3 rounded-lg transition-colors
              ${!miniLayout
                ? 'text-slate-500 hover:bg-red-50 hover:text-red-500'
                : 'text-slate-500 hover:text-red-500'
              }`}
          >
            <span className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150
              ${miniLayout ? 'group-hover:bg-red-50 group-hover:text-red-500 text-slate-400' : ''}`}
            >
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
