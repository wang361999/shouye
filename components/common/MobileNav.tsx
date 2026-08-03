"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页", icon: "🏠" },
  { href: "/forum", label: "社区", icon: "💬" },
  { href: "/tools", label: "工具", icon: "🛠️" },
  { href: "/search", label: "搜索", icon: "🔍" },
  { href: "/profile", label: "我的", icon: "👤" },
];

export default function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 safe-area-pb">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full text-xs transition-colors",
                active ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"
              )}
            >
              <span className="text-lg mb-0.5">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
