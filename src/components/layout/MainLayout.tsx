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
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden bg-slate-50 p-4 flex items-center justify-between sticky top-0 z-40">
        <span className="font-semibold text-slate-900 tracking-tight">RH Pagos</span>
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-2 hover:bg-slate-100 rounded-md transition-colors text-slate-600"
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

      {/* Main Content — margin matches sidebar width with same transition */}
      <main
        className="flex-1 p-4 md:p-8 sidebar-main-content"
        style={{ marginLeft: isEffectivelyCollapsed ? '80px' : '240px' }}
      >
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
