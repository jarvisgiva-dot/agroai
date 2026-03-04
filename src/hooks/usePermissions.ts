"use client"

import { useAuth } from '@/contexts/AuthContext'
import { PermissionsHook } from '@/types/auth'

/**
 * Hook para verificar permissões do usuário
 * Retorna flags booleanas de permissão baseadas no role
 */
export function usePermissions(): PermissionsHook {
    const { user, isAdmin, isViewer } = useAuth()

    return {
        canEdit: isAdmin,
        canDelete: isAdmin,
        canUpload: isAdmin,
        canView: true, // Todos podem visualizar
        isAdmin,
        isViewer,
    }
}
