/**
 * Authentication and Authorization Types
 */

export type UserRole = 'admin' | 'viewer'

export interface UserProfile {
    id: string
    email: string
    full_name: string | null
    role: UserRole
    approved?: boolean // New field for approval system
    created_at: string
    updated_at: string
}

export interface AuthUser {
    id: string
    email: string
    profile: UserProfile | null
}

export interface AuthContextType {
    user: AuthUser | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<void>
    signUp: (email: string, password: string, fullName: string) => Promise<void>
    signOut: () => Promise<void>
    isAdmin: boolean
    isViewer: boolean
}

export interface PermissionsHook {
    canEdit: boolean
    canDelete: boolean
    canUpload: boolean
    canView: boolean
    isAdmin: boolean
    isViewer: boolean
}
