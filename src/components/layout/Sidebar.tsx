import React, { useState, useRef } from 'react';
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

// Cuando tengas un icono cuadrado para el modo mini, importa aquí:
// import logoMark from '../../assets/logo/logo-mark.png';
const LOGO_MARK: string | null = null;

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

  // Visually collapsed = mini mode (permanently collapsed AND not hovered AND not mobile-open)
  const collapsed = isCollapsed && !isOpen && !isHovered;
  // Shows active toggle icon when hovering over mini sidebar
  const isHoverExpanded = isCollapsed && isHovered && !isOpen;

  const text = (visible: boolean) =>
    `sidebar-text ${visible ? 'visible' : 'hidden-text'}`;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`sidebar-panel fixed left-0 top-0 h-full bg-slate-50 z-50 flex flex-col overflow-hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ width: isOpen ? '240px' : `${collapsed ? 80 : 240}px` }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className={`flex items-center min-h-[64px] px-4 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 min-w-0 overflow-hidden">
            {/* Mini mode: show logo mark or small logo */}
            {collapsed && (
              <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                <img
                  src={LOGO_MARK ?? logoFull}
                  alt="Logo"
                  className={LOGO_MARK ? 'w-8 h-8 object-contain rounded-lg' : 'h-6 object-contain'}
                />
              </div>
            )}

            {/* Expanded mode: full logo */}
            <span className={text(!collapsed)}>
              <img src={logoFull} alt="RH Pagos" className="h-8 object-contain" />
            </span>
          </div>

          {/* Toggle — visible only when expanded */}
          {!collapsed && (
            <button
              onClick={() => {
                onCollapse(!isCollapsed);
                setIsHovered(false);
                onHoverChange(false);
              }}
              className={`hidden lg:flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0 ml-2 ${
                isHoverExpanded
                  ? 'bg-slate-900 text-white hover:bg-slate-700'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
            >
              <PanelLeft size={16} />
            </button>
          )}

          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100 ml-2"
          >
            <PanelLeft size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          {categories.map((cat) => (
            <div key={cat.label}>
              <p className={`sidebar-text px-3 mb-1 text-[10px] tracking-widest text-slate-400 uppercase ${text(!collapsed)}`}>
                {cat.label}
              </p>
              <ul className="space-y-0.5">
                {cat.items.map((item) => {
                  const active = location.pathname === item.path;
                  return (
                    <li key={item.path} className={collapsed ? 'flex justify-center' : ''}>
                      <Link
                        to={item.path}
                        onClick={() => { if (window.innerWidth < 1024) onClose(); }}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center transition-colors duration-150 rounded-lg text-sm tracking-tight ${
                          collapsed
                            ? `w-10 h-10 justify-center ${active ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`
                            : `gap-3 px-3 py-2 w-full ${active ? 'bg-slate-700 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`
                        }`}
                      >
                        <span className={`shrink-0 ${active ? 'text-white' : 'text-slate-400'}`}>
                          {item.icon}
                        </span>
                        <span className={text(!collapsed)}>
                          {item.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-3">
          <div className={`flex items-center gap-3 px-3 py-2 mb-2 bg-slate-200/60 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs shrink-0">
              {userRole === 'admin' ? 'A' : 'V'}
            </div>
            <div className={text(!collapsed)}>
              <p className="text-sm tracking-tight text-slate-800 truncate">
                {userRole === 'admin' ? 'Administrador' : 'Visualizador'}
              </p>
              <p className="text-xs text-slate-400 capitalize">{userRole}</p>
            </div>
          </div>

          <div className={collapsed ? 'flex justify-center' : ''}>
            <button
              onClick={onLogout}
              title={collapsed ? 'Cerrar sesión' : undefined}
              className={`flex items-center transition-colors rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-500 ${
                collapsed
                  ? 'w-10 h-10 justify-center'
                  : 'gap-3 px-3 py-2 w-full text-sm tracking-tight'
              }`}
            >
              <LogOut size={18} className="shrink-0" />
              <span className={text(!collapsed)}>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
