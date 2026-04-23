import React, { useState } from 'react';
import Sidebar from './Sidebar';
import WorkerBottomNav from './WorkerBottomNav';
import { Menu } from 'lucide-react';
import type { User } from '../../services/mockData';

interface MainLayoutProps {
  children: React.ReactNode;
  user: User;
  onLogout: () => void;
  onRoleChange?: (role: User['role']) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children, user, onLogout, onRoleChange }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const isEffectivelyCollapsed = isSidebarCollapsed && !isSidebarHovered;
  const isWorker = user.role === 'trabajador';

  return (
    <div className="h-screen bg-transparent flex flex-col xl:flex-row overflow-hidden">
      {/* Mobile Header — hidden for worker (replaced by bottom nav) */}
      {!isWorker && (
        <div className="xl:hidden bg-transparent p-4 flex items-center justify-between sticky top-0 z-40">
          <span className="font-semibold text-slate-900 dark:text-stone-100 tracking-tight">RH Pagos</span>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-stone-800 rounded-md transition-colors text-slate-600 dark:text-stone-400"
          >
            <Menu size={22} />
          </button>
        </div>
      )}

      {/* Sidebar — hidden on mobile for worker */}
      <div className={isWorker ? 'hidden xl:block' : ''}>
        <Sidebar
          user={user}
          onLogout={onLogout}
          onRoleChange={onRoleChange}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isCollapsed={isSidebarCollapsed}
          onCollapse={setIsSidebarCollapsed}
          onHoverChange={setIsSidebarHovered}
        />
      </div>

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col sidebar-main-content overflow-y-auto ${isWorker ? 'pt-0 px-4 md:p-8 pb-24 xl:pb-8' : 'p-4 md:p-8'}`}
        style={{ marginLeft: isEffectivelyCollapsed ? '73px' : '240px' }}
      >
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </main>

      {/* Bottom nav for worker on mobile */}
      {isWorker && <WorkerBottomNav />}
    </div>
  );
};

export default MainLayout;
