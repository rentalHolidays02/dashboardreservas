import React, { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings, 
  LogOut,
  BarChart3
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface SidebarProps {
  userRole: 'admin' | 'viewer';
  onLogout: () => void;
  isOpen: boolean;
  onClose: () => void;
  isCollapsed: boolean;
  onCollapse: (v: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ userRole, onLogout, isOpen, onClose, isCollapsed, onCollapse }) => {

  const menuItems = [
    
    { icon: <LayoutDashboard size={20} />, label: 'Dashboard', path: '/dashboard', active: false },
    { icon: <Calendar size={20} />, label: 'Limpiezas', path: '/cleans', active: true },
    { icon: <Users size={20} />, label: 'Trabajadores', path: '/workers', active: false },
    { icon: <BarChart3 size={20} />, label: 'Reportes', path: '#', active: false },
   
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <div 
        className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64 w-64'
        }`}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          {(!isCollapsed || isOpen) && <span className="font-bold text-xl tracking-tight">RH Pagos</span>}
          <button 
            onClick={() => onCollapse(!isCollapsed)}
            className="hidden lg:block p-1 hover:bg-slate-800 rounded-md transition-colors"
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
          
          {/* Close button for mobile */}
          <button 
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-slate-800 rounded-md transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 mt-6 px-3">
          <ul className="space-y-2">
            {menuItems.map((item, index) => (
              <li key={index}>
                <Link
                  to={item.path}
                  onClick={() => { if(window.innerWidth < 1024) onClose(); }}
                  className={`flex items-center p-3 rounded-lg transition-all ${
                    location.pathname === item.path
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  } ${isCollapsed && !isOpen ? 'lg:justify-center' : 'space-x-3'}`}
                >
                  {item.icon}
                  {(!isCollapsed || isOpen) && <span className="font-medium">{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer / User info */}
        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center ${isCollapsed && !isOpen ? 'lg:justify-center' : 'space-x-3'} mb-4`}>
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">
              {userRole === 'admin' ? 'A' : 'V'}
            </div>
            {(!isCollapsed || isOpen) && (
              <div className="flex flex-col">
                <span className="text-sm font-medium">Usuario {userRole}</span>
                <span className="text-xs text-slate-500 capitalize">{userRole}</span>
              </div>
            )}
          </div>
          <button 
            onClick={onLogout}
            className={`flex items-center w-full p-3 text-slate-400 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition-colors ${
              isCollapsed && !isOpen ? 'lg:justify-center' : 'space-x-3'
            }`}
          >
            <LogOut size={20} />
            {(!isCollapsed || isOpen) && <span className="font-medium text-sm">Cerrar sesión</span>}
          </button>
        </div>
      </div>
    </>
  );
};


export default Sidebar;
