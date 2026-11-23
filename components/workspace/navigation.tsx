'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { navigationGroups } from '@/components/workspace/constants';
import type { ViewName } from '@/components/workspace/types';
import { pathForView } from '@/components/workspace/view-routing';

type NavigationProps = {
  activeView: ViewName;
  countForView: (view: ViewName) => number;
  onNavigate: (view: ViewName) => void;
};

function NavigationLinks({
  activeView,
  countForView,
  onNavigate,
}: NavigationProps) {
  return (
    <>
      <nav aria-label="Primary navigation" className="workspace-nav-links">
        {navigationGroups.map((group) => (
          <div key={group.label} className="workspace-nav-group">
            <p>{group.label}</p>
            <ul>
              {group.items.map(({ label, icon: Icon }) => {
                const count = countForView(label);
                return (
                  <li key={label}>
                    <a
                      href={pathForView(label)}
                      aria-current={label === activeView ? 'page' : undefined}
                      className="workspace-nav-item"
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey ||
                          event.button !== 0
                        )
                          return;
                        event.preventDefault();
                        onNavigate(label);
                      }}
                    >
                      <Icon aria-hidden="true" className="size-4" />
                      <span>{label}</span>
                      {count ? (
                        <span className="workspace-nav-count">{count}</span>
                      ) : null}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <Link href="/about" className="workspace-nav-about">
        About this project{' '}
        <ArrowUpRight aria-hidden="true" className="size-4" />
      </Link>
    </>
  );
}

export function WorkspaceSidebar(props: NavigationProps) {
  return (
    <aside className="workspace-sidebar fixed inset-y-0 left-0 z-20 hidden flex-col lg:flex">
      <div className="workspace-nav-brand">
        <BrandMark className="size-9" />
        <span>ContractLedger AI</span>
      </div>
      <NavigationLinks {...props} />
    </aside>
  );
}

export function WorkspaceMobileMenu(props: NavigationProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Open workspace navigation"
        render={
          <Button variant="ghost" size="icon" className="size-11 lg:hidden" />
        }
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="workspace-sidebar w-[min(20rem,90vw)] gap-0"
      >
        <div className="workspace-nav-brand pr-3">
          <BrandMark className="size-9" />
          <SheetTitle className="flex-1 text-white">
            ContractLedger AI
          </SheetTitle>
          <SheetClose
            aria-label="Close workspace navigation"
            render={
              <Button
                variant="ghost"
                size="icon"
                className="size-11 hover:bg-sidebar-accent hover:text-white"
              />
            }
          >
            <X className="size-5" />
          </SheetClose>
        </div>
        <NavigationLinks
          {...props}
          onNavigate={(view) => {
            props.onNavigate(view);
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
