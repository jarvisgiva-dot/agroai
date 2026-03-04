"use client"

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface ProtectedRouteProps {
    children: React.ReactNode
    requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
    const { user, loading, isAdmin } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading) {
            // Se não está autenticado, redireciona para login
            if (!user) {
                router.push('/login')
                return
            }

            // Se requer admin mas usuário não é admin, redireciona
            if (requireAdmin && !isAdmin) {
                router.push('/')
            }
        }
    }, [user, loading, isAdmin, requireAdmin, router])

    // Enquanto carrega
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando...</p>
                </div>
            </div>
        )
    }

    // Se não está autenticado ou não tem permissão, não renderiza
    if (!user || (requireAdmin && !isAdmin)) {
        return null
    }

    return <>{children}</>
}
