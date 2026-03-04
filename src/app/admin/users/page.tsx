"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useToast } from "@/components/ui/use-toast"
import { UserProfile } from "@/types/auth"

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserProfile[]>([])
    const [loading, setLoading] = useState(true)
    const { toast } = useToast()

    useEffect(() => {
        fetchUsers()
    }, [])

    async function fetchUsers() {
        try {
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) throw error
            setUsers(data || [])
        } catch (error) {
            console.error('Error fetching users:', error)
            toast({
                title: "Erro",
                description: "Não foi possível carregar os usuários.",
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    async function handleApprove(userId: string) {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ approved: true })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(u => u.id === userId ? { ...u, approved: true } : u))
            toast({
                title: "Sucesso",
                description: "Usuário aprovado com sucesso!"
            })
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao aprovar usuário.",
                variant: "destructive"
            })
        }
    }

    async function handleRevoke(userId: string) {
        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ approved: false })
                .eq('id', userId)

            if (error) throw error

            setUsers(users.map(u => u.id === userId ? { ...u, approved: false } : u))
            toast({
                title: "Sucesso",
                description: "Acesso revogado com sucesso."
            })
        } catch (error) {
            toast({
                title: "Erro",
                description: "Erro ao revogar acesso.",
                variant: "destructive"
            })
        }
    }

    return (
        <ProtectedRoute requireAdmin>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-800">Gestão de Usuários</h2>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle>Usuários Cadastrados</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="min-w-[200px]">Nome / Email</TableHead>
                                            <TableHead className="min-w-[100px]">Função</TableHead>
                                            <TableHead className="min-w-[100px]">Status</TableHead>
                                            <TableHead className="min-w-[120px]">Data Cadastro</TableHead>
                                            <TableHead className="text-right min-w-[150px]">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {users.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="font-medium">{user.full_name || 'Sem nome'}</div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                                        {user.role === 'admin' ? 'Admin' : 'Viewer'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={user.approved ? 'outline' : 'destructive'} className={user.approved ? "bg-green-50 text-green-700 border-green-200" : ""}>
                                                        {user.approved ? 'Aprovado' : 'Pendente'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-gray-500">
                                                    {new Date(user.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {user.role !== 'admin' && (
                                                        <div className="flex justify-end gap-2">
                                                            {!user.approved ? (
                                                                <Button size="sm" onClick={() => handleApprove(user.id)} className="bg-green-600 hover:bg-green-700">
                                                                    <CheckCircle className="h-4 w-4 mr-1" />
                                                                    Aprovar
                                                                </Button>
                                                            ) : (
                                                                <Button size="sm" variant="outline" onClick={() => handleRevoke(user.id)} className="text-red-600 hover:bg-red-50 border-red-200">
                                                                    <XCircle className="h-4 w-4 mr-1" />
                                                                    Revogar
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    )
}
