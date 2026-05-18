import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="flex h-screen bg-surface-alt">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6 md:px-6 md:py-8 pt-16 md:pt-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
