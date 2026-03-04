"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  Package,
  TrendingUp,
  MessageSquare,
  Settings,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  LogOut,
  User,
  Users,
  Database,
  DollarSign,
  Lock,
  ArrowLeftRight,
  Menu,
  X,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useSession, signIn as googleSignIn, signOut as googleSignOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { MarketTicker } from "./MarketTicker"

const mainNav = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Contratos", href: "/contratos", icon: FileText },
  { name: "Estoque", href: "/estoque", icon: Package },
  { name: "Produtividade", href: "/produtividade", icon: TrendingUp },
  { name: "Custos", href: "/custos", icon: DollarSign },
]

const allNav = [
  ...mainNav,
  { name: "Barter / Troca", href: "/dashboard/barter", icon: ArrowLeftRight },
  { name: "Gráficos", href: "/graficos", icon: BarChart3 },
  { name: "Sync Google Drive", href: "/upload", icon: RefreshCw, adminOnly: true },
  { name: "Gerenciamento", href: "/gerenciamento", icon: Database, adminOnly: true },
  { name: "Assistente AI", href: "/chat", icon: MessageSquare },
  { name: "Configurações", href: "/config", icon: Settings },
]

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isHovered, setIsHovered] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { user, signOut, isAdmin } = useAuth()
  const { data: googleSession } = useSession()

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const showSidebar = !isCollapsed || isHovered

  return (
    <div className="flex h-screen bg-gray-50">
      {/* ─── Desktop Sidebar ─────────────────────────────── */}
      <div
        className={cn(
          "hidden md:flex fixed left-0 top-0 h-full bg-gradient-to-b from-slate-900 to-slate-800 text-white transition-all duration-300 z-50 shadow-2xl flex-col",
          showSidebar ? "w-64" : "w-16"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            {showSidebar && (
              <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                MyAgroAI
              </h1>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
            >
              {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {allNav.map((item) => {
            const isActive = pathname === item.href
            // @ts-ignore
            const isRestricted = item.adminOnly && !isAdmin
            return (
              <Link
                key={item.name}
                href={isRestricted ? "#" : item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg"
                    : isRestricted
                      ? "text-slate-500 cursor-not-allowed hover:bg-slate-800/50"
                      : "hover:bg-slate-700 text-slate-300"
                )}
                onClick={(e) => isRestricted && e.preventDefault()}
              >
                <div className="relative">
                  <item.icon className={cn("h-5 w-5 flex-shrink-0", isRestricted && "opacity-50")} />
                  {/* @ts-ignore */}
                  {item.adminOnly && !showSidebar && (
                    <div className="absolute -top-1 -right-1 bg-slate-900 rounded-full p-0.5">
                      <Lock className="h-2.5 w-2.5 text-amber-400" />
                    </div>
                  )}
                </div>
                {showSidebar && (
                  <div className="flex items-center justify-between flex-1 min-w-0">
                    <span className={cn("truncate text-sm", isRestricted && "opacity-50")}>{item.name}</span>
                    {/* @ts-ignore */}
                    {item.adminOnly && (
                      <Lock className={cn("h-3.5 w-3.5 ml-2", isAdmin ? "text-emerald-400/50" : "text-amber-400")} />
                    )}
                  </div>
                )}
                {isRestricted && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-xs text-amber-400 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-slate-700 shadow-xl transition-opacity">
                    Acesso Restrito (Admin)
                  </div>
                )}
              </Link>
            )
          })}

          {isAdmin && (
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 hover:bg-slate-700 text-slate-300",
                pathname === "/admin/users" ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg" : ""
              )}
            >
              <Users className="h-5 w-5 flex-shrink-0" />
              {showSidebar && <span className="truncate text-sm">Gestão de Usuários</span>}
            </Link>
          )}
        </nav>

        {/* User Info & Logout */}
        {showSidebar && (
          <div className="border-t border-slate-700">
            <div className="p-3 bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-full">
                  <User className="h-4 w-4 text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.profile?.full_name || user?.email}
                  </p>
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    isAdmin ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                  )}>
                    {isAdmin ? "👨‍💼 Admin" : "👤 Viewer"}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-2 space-y-1">
              {googleSession ? (
                <Button onClick={() => googleSignOut()} variant="ghost" className="w-full justify-start text-sm text-red-400 hover:text-red-300 hover:bg-slate-700">
                  <LogOut className="h-4 w-4 mr-2" />Sair do Google
                </Button>
              ) : (
                <Button onClick={() => googleSignIn("google")} variant="ghost" className="w-full justify-start text-sm text-blue-400 hover:text-blue-300 hover:bg-slate-700">
                  <User className="h-4 w-4 mr-2" />Entrar com Google
                </Button>
              )}
              <Button onClick={() => signOut()} variant="ghost" className="w-full justify-start text-sm text-slate-400 hover:text-white hover:bg-slate-700">
                <LogOut className="h-4 w-4 mr-2" />Sair do App
              </Button>
            </div>
            <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500">
              <p>© 2024 MyAgroAI</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Mobile Header ────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            🌾 MyAgroAI
          </h1>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg bg-slate-700 text-white"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ─── Mobile Slide-down Menu ───────────────────────── */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-slate-900/95 backdrop-blur-sm pt-16 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {allNav.map((item) => {
              // @ts-ignore
              const isRestricted = item.adminOnly && !isAdmin
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={isRestricted ? "#" : item.href}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3 rounded-xl transition-all font-medium",
                    isActive
                      ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
                      : isRestricted
                        ? "text-slate-500 opacity-60"
                        : "text-slate-300 hover:bg-slate-800"
                  )}
                  onClick={(e) => isRestricted && e.preventDefault()}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                  {/* @ts-ignore */}
                  {item.adminOnly && !isAdmin && <Lock className="h-3.5 w-3.5 ml-auto text-amber-400" />}
                </Link>
              )
            })}
            <div className="mt-6 pt-4 border-t border-slate-700 space-y-1">
              <div className="px-4 py-2 text-slate-400 text-sm">{user?.email}</div>
              <button
                onClick={() => signOut()}
                className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-400 hover:bg-slate-800 font-medium"
              >
                <LogOut className="h-5 w-5" />
                <span>Sair do App</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* ─── Main Content ─────────────────────────────────── */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-300",
          "md:ml-16",            // collapsed sidebar width
          showSidebar ? "md:ml-64" : "md:ml-16",
          "pt-[56px] md:pt-0",  // space for mobile header
          "pb-20 md:pb-0",      // space for mobile bottom nav
        )}
      >
        <MarketTicker />
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {/* ─── Mobile Bottom Navigation ─────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-2xl">
        <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
          {mainNav.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0",
                  isActive
                    ? "text-emerald-400"
                    : "text-slate-400 active:text-white"
                )}
              >
                <div className={cn(
                  "p-1.5 rounded-lg transition-all",
                  isActive ? "bg-emerald-500/20" : ""
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className={cn("text-[10px] font-medium leading-none truncate max-w-[60px]", isActive ? "text-emerald-400" : "text-slate-500")}>
                  {item.name}
                </span>
              </Link>
            )
          })}
          {/* More button */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-slate-400"
          >
            <div className="p-1.5 rounded-lg">
              <Menu className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium text-slate-500">Mais</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
