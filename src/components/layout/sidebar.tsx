'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useRepo } from '@/hooks/use-repo';
import {
  LayoutDashboard,
  AppWindow,
  Boxes,
  FileCode2,
  BookOpen,
  Ruler,
  GitFork,
  Inbox,
  Settings,
  ChevronLeft,
  Menu,
  Wand2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, view: 'overview', color: 'text-blue-400' },
  { id: 'dashboards', label: 'Dashboards', icon: AppWindow, view: 'dashboards', color: 'text-violet-400' },
  { id: 'modules', label: 'Modules', icon: Boxes, view: 'modules', color: 'text-emerald-400' },
  { id: 'scripts', label: 'Scripts', icon: FileCode2, view: 'scripts', color: 'text-amber-400' },
  { id: 'reference', label: 'Reference', icon: BookOpen, view: 'reference', color: 'text-cyan-400' },
  { id: 'standards', label: 'Standards', icon: Ruler, view: 'standards', color: 'text-rose-400' },
  { id: 'maps', label: 'Maps', icon: GitFork, view: 'maps', color: 'text-orange-400' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, view: 'inbox', color: 'text-indigo-400' },
];

export function Sidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentView = searchParams.get('view') || 'overview';
  const repoParam = searchParams.get('repo') || '';
  const branchParam = searchParams.get('branch') || 'main';
  const { stats } = useRepo();
  const [collapsed, setCollapsed] = useState(false);

  const handleNavigate = (view: string) => {
    router.push(`/dashboard?repo=${repoParam}&branch=${branchParam}&view=${view}`);
  };

  return (
    <aside
      className={cn(
        'border-r bg-card flex flex-col transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo / Brand */}
      <div className="p-3 border-b flex items-center gap-2">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate text-foreground">NetSuite</p>
              <p className="text-[10px] text-muted-foreground truncate">Dashboard Manager</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 shrink-0"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Navigation
          </p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.view;
          const badge =
            item.id === 'inbox'
              ? stats.inboxCount
              : item.id === 'scripts'
                ? stats.scriptCount
                : undefined;

          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.view)}
              title={collapsed ? item.label : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', !isActive && item.color)} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <Badge
                      variant={isActive ? 'secondary' : 'outline'}
                      className="text-xs px-1.5 py-0 h-5"
                    >
                      {badge}
                    </Badge>
                  )}
                </>
              )}
            </button>
          );
        })}

        {/* Script Builder as special highlighted item */}
        {!collapsed && (
          <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Tools
          </p>
        )}
        <button
          onClick={() => handleNavigate('script-builder')}
          title={collapsed ? 'Script Builder' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            currentView === 'script-builder'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Wand2 className={cn('h-4 w-4 shrink-0', currentView !== 'script-builder' && 'text-purple-400')} />
          {!collapsed && <span className="flex-1 text-left">Script Builder</span>}
        </button>
      </nav>

      {/* Settings */}
      <div className="p-2 border-t">
        <button
          onClick={() => handleNavigate('settings')}
          title={collapsed ? 'Settings' : undefined}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            currentView === 'settings'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}
