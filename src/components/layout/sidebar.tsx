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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

const navItems = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, view: 'overview' },
  { id: 'dashboards', label: 'Dashboards', icon: AppWindow, view: 'dashboards' },
  { id: 'modules', label: 'Modules', icon: Boxes, view: 'modules' },
  { id: 'scripts', label: 'Scripts', icon: FileCode2, view: 'scripts' },
  { id: 'reference', label: 'Reference', icon: BookOpen, view: 'reference' },
  { id: 'standards', label: 'Standards', icon: Ruler, view: 'standards' },
  { id: 'maps', label: 'Maps', icon: GitFork, view: 'maps' },
  { id: 'inbox', label: 'Inbox', icon: Inbox, view: 'inbox' },
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
      <div className="p-3 flex justify-end border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 p-2 space-y-1">
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
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {badge !== undefined && badge > 0 && (
                    <Badge variant={isActive ? 'secondary' : 'outline'} className="text-xs px-1.5 py-0">
                      {badge}
                    </Badge>
                  )}
                </>
              )}
            </button>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="p-2 border-t">
          <button
            onClick={() => handleNavigate('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
              currentView === 'settings'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </div>
      )}
    </aside>
  );
}
