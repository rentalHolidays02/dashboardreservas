import React, { useState } from 'react';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  userRole: 'admin' | 'viewer';
  onLogout: () => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, userRole, onLogout }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  // Effectively expanded = permanently open OR hover-expanded
  const isEffectivelyCollapsed = isSidebarCollapsed && !isSidebarHovered;

  return (
    <div className="h-screen bg-transparent flex flex-col xl:flex-row overflow-hidden">
      {/* Mobile Header */}
      <div className="xl:hidden bg-transparent p-4 flex items-center justify-between sticky top-0 z-40">
        <span className="font-semibold text-slate-900 dark:text-stone-100 tracking-tight">RH Pagos</span>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-slate-100 dark:hover:bg-stone-800 rounded-md transition-colors text-slate-600 dark:text-stone-400"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Sidebar */}
      <Sidebar
        userRole={userRole}
        onLogout={onLogout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapse={setIsSidebarCollapsed}
        onHoverChange={setIsSidebarHovered}
      />

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col p-4 md:p-8 sidebar-main-content overflow-y-auto"
        style={{ marginLeft: isEffectivelyCollapsed ? '73px' : '240px' }}
      >
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
