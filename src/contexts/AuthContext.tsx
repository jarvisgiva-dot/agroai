"use client"

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { AuthContextType, AuthUser, UserProfile } from '@/types/auth'
import { logError } from '@/lib/logger'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Verificar sessão atual
        checkUser()

        // Escutar mudanças de autenticação
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
                    // Only reload profile if user changed or we don't have one
                    if (!user || user.id !== session.user.id) {
                        await loadUserProfile(session.user.id, session.user.email!)
                    }
                } else if (event === 'SIGNED_OUT') {
                    setUser(null)
                }
            }
        )

        return () => {
            authListener.subscription.unsubscribe()
        }
    }, [])

    async function checkUser() {
        try {
            // Get session from Supabase (it handles localStorage automatically)
            const { data: { session }, error } = await supabase.auth.getSession()

            if (error) {
                console.error('[Auth] Error getting session:', error)
                throw error
            }

            if (session?.user) {
                await loadUserProfile(session.user.id, session.user.email!)
            } else {
                // No session found
                setUser(null)
            }
        } catch (error) {
            console.warn('[Auth Check] Failed:', error)
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    async function loadUserProfile(userId: string, email: string) {
        try {
            // Timeout para buscar perfil (10s)
            const fetchProfile = async () => {
                const { data: profile, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('id', userId)
                    .single()

                if (error) throw error
                return profile
            }

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout buscando perfil')), 10000)
            )

            const profile = await Promise.race([fetchProfile(), timeoutPromise]) as any

            // Check approval status
            // Admins are always approved by default logic, but let's check the flag too
            const isRootAdmin = email.toLowerCase() === 'jarvisgiva@gmail.com'
            if (profile && profile.approved === false && profile.role !== 'admin' && !isRootAdmin) {
                console.log('[Auth] User not approved yet:', email)
                router.push('/pending-approval')
            }

            setUser({
                id: userId,
                email,
                profile: {
                    ...profile,
                    role: isRootAdmin ? 'admin' : profile.role,
                    approved: isRootAdmin ? true : profile.approved
                } as UserProfile
            })
        } catch (error: any) {
            // Se der erro (perfil não encontrado ou timeout), assumimos que é um Viewer
            console.log(`[Auth] Erro ao carregar perfil para ${email} (Fallback):`, error.message)

            const isRootAdmin = email.toLowerCase() === 'jarvisgiva@gmail.com'

            setUser({
                id: userId,
                email,
                profile: {
                    id: userId,
                    email: email,
                    role: isRootAdmin ? 'admin' : 'viewer',
                    approved: isRootAdmin ? true : false,
                    full_name: email.split('@')[0],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            })
        }
    }

    async function signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error

        if (data.user) {
            await loadUserProfile(data.user.id, data.user.email!)
            router.push('/')
        }
    }

    async function signUp(email: string, password: string, fullName: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    role: email.toLowerCase() === 'jarvisgiva@gmail.com' ? 'admin' : 'viewer',
                    approved: email.toLowerCase() === 'jarvisgiva@gmail.com' ? true : false
                }
            }
        })

        if (error) throw error

        if (data.user) {
            await loadUserProfile(data.user.id, data.user.email!)
        }
    }

    async function signOut() {
        try {
            // Limpar qualquer cache local primeiro
            sessionStorage.clear()
            localStorage.removeItem('supabase.auth.token')

            // Deslogar do Supabase
            await supabase.auth.signOut()

            // Limpar estado local
            setUser(null)

            // Forçar redirect imediato
            window.location.replace('/login')
        } catch (error) {
            // Mesmo com erro, force o logout
            console.error('Erro no logout:', error)
            setUser(null)
            window.location.replace('/login')
        }
    }

    const isAdmin = user?.profile?.role === 'admin'
    const isViewer = user?.profile?.role === 'viewer'

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                signIn,
                signUp,
                signOut,
                isAdmin,
                isViewer,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
