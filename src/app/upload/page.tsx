"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard/DashboardLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    RefreshCw, CheckCircle, AlertCircle, Clock, FileText,
    Database, Folder, Loader2, ChevronDown, ChevronUp,
    CloudOff, Wifi, SkipForward, LogIn
} from "lucide-react"
import { ProtectedRoute } from "@/components/auth/ProtectedRoute"
import { signIn as nextAuthSignIn } from "next-auth/react"

interface SyncLog {
    id: string
    file_name: string
    file_id: string
    status: "success" | "error" | "skipped" | "processing"
    file_type: string | null
    records_processed: number
    error_message: string | null
    processed_at: string | null
    modified_time: string
    file_size: number | null
}

interface SyncStats {
    total: number
    success: number
    error: number
    processing: number
    lastSync: string | null
}

const StatusIcon = ({ status }: { status: SyncLog["status"] }) => {
    switch (status) {
        case "success": return <CheckCircle className="h-4 w-4 text-emerald-500" />
        case "error": return <AlertCircle className="h-4 w-4 text-red-500" />
        case "processing": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
        case "skipped": return <SkipForward className="h-4 w-4 text-gray-400" />
    }
}

const StatusBadge = ({ status }: { status: SyncLog["status"] }) => {
    const styles = {
        success: "bg-emerald-100 text-emerald-700",
        error: "bg-red-100 text-red-700",
        processing: "bg-blue-100 text-blue-700",
        skipped: "bg-gray-100 text-gray-500",
    }
    const labels = {
        success: "Sucesso",
        error: "Erro",
        processing: "Processando",
        skipped: "Ignorado",
    }
    return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
            {labels[status]}
        </span>
    )
}

function formatBytes(bytes: number | null) {
    if (!bytes) return "—"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function timeAgo(dateStr: string | null) {
    if (!dateStr) return "nunca"
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d atrás`
    if (hours > 0) return `${hours}h atrás`
    if (mins > 0) return `${mins}min atrás`
    return "agora"
}

export default function DriveSyncPage() {
    const [status, setStatus] = useState<{ stats: SyncStats; logs: SyncLog[] } | null>(null)
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)
    const [syncResult, setSyncResult] = useState<any>(null)
    const [showAll, setShowAll] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [driveStatus, setDriveStatus] = useState<any>(null)

    const fetchDriveStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/drive/connect")
            if (res.ok) {
                const data = await res.json()
                setDriveStatus(data)
            }
        } catch (e) {
            console.error("Falha ao verificar status do Drive", e)
        }
    }, [])

    const fetchStatus = useCallback(async () => {
        try {
            const res = await fetch("/api/drive/sync")
            if (!res.ok) throw new Error("Falha ao buscar status")
            const data = await res.json()
            setStatus(data)
            setError(null)
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchDriveStatus()
        fetchStatus()
        const interval = setInterval(fetchStatus, 30000) // refresh a cada 30s
        return () => clearInterval(interval)
    }, [fetchStatus, fetchDriveStatus])

    const handleSync = async () => {
        setSyncing(true)
        setSyncResult(null)
        try {
            const res = await fetch("/api/drive/sync", { method: "POST" })
            const data = await res.json()
            setSyncResult(data)
            await fetchStatus()
        } catch (e: any) {
            setSyncResult({ error: e.message })
        } finally {
            setSyncing(false)
        }
    }

    const logs = status?.logs || []
    const visibleLogs = showAll ? logs : logs.slice(0, 10)
    const hasDriveConfig = true // Em produção, checar env vars via API

    return (
        <ProtectedRoute requireAdmin>
            <DashboardLayout>
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-emerald-50/20 to-blue-50/20 p-4 md:p-8">
                    <div className="max-w-4xl mx-auto space-y-6">

                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
                                    <Folder className="h-7 w-7 text-emerald-600" />
                                    Sync Google Drive
                                </h1>
                                <p className="text-sm text-gray-500 mt-1">
                                    Pasta: <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                                        SEXTA-FEIRA/maaster/agro/fazendas
                                    </span>
                                </p>
                            </div>
                            <Button
                                onClick={handleSync}
                                disabled={syncing}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg h-11 px-6 rounded-xl gap-2"
                            >
                                {syncing ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Sincronizando...</>
                                ) : (
                                    <><RefreshCw className="h-4 w-4" /> Sincronizar Agora</>
                                )}
                            </Button>
                        </div>

                        {/* Config Warning */}
                        {driveStatus && !driveStatus.connected && (
                            <Card className="border border-blue-200 bg-blue-50 shadow-sm">
                                <CardContent className="p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-start gap-3">
                                        <CloudOff className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="font-semibold text-blue-900">Conecte seu Google Drive</p>
                                            <p className="text-blue-700 text-sm mt-1">
                                                Para sincronizar os PDFs da pasta `fazendas`, o sistema precisa acessar o seu Drive.
                                                Nenhum arquivo externo será lido.
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={() => nextAuthSignIn('google')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[200px]"
                                    >
                                        <LogIn className="h-4 w-4 mr-2" />
                                        Conectar Conta Google
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {driveStatus?.connected && !driveStatus.hasFolderId && (
                            <Card className="border border-amber-200 bg-amber-50/80 shadow-sm">
                                <CardContent className="p-4 flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800 text-sm">Quase lá! Faltando ID da pasta</p>
                                        <p className="text-amber-700 text-xs mt-1">
                                            Você conectou a conta <b>{driveStatus.email}</b> com sucesso!<br />
                                            Agora só falta adicionar <code className="bg-amber-100 px-1 rounded font-mono">GOOGLE_DRIVE_FOLDER_ID</code> no arquivo{" "}
                                            <code className="bg-amber-100 px-1 rounded font-mono">.env.local</code> para ativar o sync automático.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Sync Result */}
                        {syncResult && (
                            <Card className={`border shadow-sm ${syncResult.error ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
                                <CardContent className="p-4 flex items-start gap-3">
                                    {syncResult.error ? (
                                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    ) : (
                                        <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <p className={`font-medium text-sm ${syncResult.error ? "text-red-800" : "text-emerald-800"}`}>
                                            {syncResult.error ? "Erro: " + syncResult.error : syncResult.message}
                                        </p>
                                        {!syncResult.error && (
                                            <p className="text-xs mt-1 text-emerald-700">
                                                {syncResult.processed} novos • {syncResult.skipped} ignorados • {syncResult.errors} erros
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {[
                                { label: "Total Arquivos", value: status?.stats.total ?? "—", icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
                                { label: "Processados", value: status?.stats.success ?? "—", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
                                { label: "Com Erro", value: status?.stats.error ?? "—", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50" },
                                { label: "Último Sync", value: timeAgo(status?.stats.lastSync ?? null), icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
                            ].map((item, i) => (
                                <Card key={i} className="border-none shadow-md rounded-2xl">
                                    <CardContent className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${item.bg}`}>
                                                <item.icon className={`h-5 w-5 ${item.color}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs text-gray-500 truncate">{item.label}</p>
                                                <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* File Log */}
                        <Card className="border-none shadow-lg rounded-2xl overflow-hidden">
                            <CardHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
                                <CardTitle className="text-gray-700 text-base flex items-center gap-2">
                                    <Database className="h-4 w-4" />
                                    Arquivos Detectados
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12 gap-3 text-gray-400">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Carregando...</span>
                                    </div>
                                ) : error ? (
                                    <div className="flex items-center justify-center py-12 gap-3 text-red-400">
                                        <AlertCircle className="h-5 w-5" />
                                        <span>{error}</span>
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                                        <Wifi className="h-8 w-8" />
                                        <p>Nenhum arquivo sincronizado ainda</p>
                                        <p className="text-xs">Clique em "Sincronizar Agora" para iniciar</p>
                                    </div>
                                ) : (
                                    <div>
                                        {/* Desktop table header */}
                                        <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100 bg-gray-50/50">
                                            <span>Arquivo</span>
                                            <span>Tipo</span>
                                            <span>Tamanho</span>
                                            <span>Registros</span>
                                            <span>Status</span>
                                        </div>

                                        {visibleLogs.map((log) => (
                                            <div key={log.id} className="px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors last:border-0">
                                                {/* Mobile view */}
                                                <div className="md:hidden space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <StatusIcon status={log.status} />
                                                            <p className="text-sm font-medium text-gray-800 truncate">{log.file_name}</p>
                                                        </div>
                                                        <StatusBadge status={log.status} />
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs text-gray-400 pl-6">
                                                        <span>{log.file_type || "detectando..."}</span>
                                                        {log.records_processed > 0 && <span>{log.records_processed} registros</span>}
                                                        <span>{timeAgo(log.processed_at)}</span>
                                                    </div>
                                                    {log.error_message && (
                                                        <p className="text-xs text-red-500 pl-6 truncate">{log.error_message}</p>
                                                    )}
                                                </div>
                                                {/* Desktop view */}
                                                <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <StatusIcon status={log.status} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 truncate">{log.file_name}</p>
                                                            {log.error_message && (
                                                                <p className="text-xs text-red-500 truncate">{log.error_message}</p>
                                                            )}
                                                            <p className="text-xs text-gray-400">{timeAgo(log.processed_at)}</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-gray-500 whitespace-nowrap">{log.file_type || "—"}</span>
                                                    <span className="text-xs text-gray-500">{formatBytes(log.file_size)}</span>
                                                    <span className="text-sm font-medium text-gray-700">{log.records_processed > 0 ? log.records_processed : "—"}</span>
                                                    <StatusBadge status={log.status} />
                                                </div>
                                            </div>
                                        ))}

                                        {logs.length > 10 && (
                                            <div className="px-5 py-3 border-t border-gray-100">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-gray-500 hover:text-gray-700 gap-1 text-xs"
                                                    onClick={() => setShowAll(!showAll)}
                                                >
                                                    {showAll ? <><ChevronUp className="h-3.5 w-3.5" /> Mostrar menos</> : <><ChevronDown className="h-3.5 w-3.5" /> Ver todos ({logs.length})</>}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Como funciona */}
                        <Card className="border-none shadow-md rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40">
                            <CardHeader className="px-5 pt-5 pb-2">
                                <CardTitle className="text-gray-700 text-base">Como funciona</CardTitle>
                            </CardHeader>
                            <CardContent className="px-5 pb-5">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { step: "1", title: "Funcionário adiciona PDF", desc: 'Sobe o novo relatório na pasta "fazendas" do Google Drive', icon: "📂" },
                                        { step: "2", title: "IA extrai os dados", desc: "Gemini AI lê o PDF e identifica: contratos, colheita, custos, talhões...", icon: "🤖" },
                                        { step: "3", title: "Supabase atualizado", desc: "Dados estruturados salvos automaticamente. App atualiza em tempo real.", icon: "⚡" },
                                    ].map((item) => (
                                        <div key={item.step} className="flex gap-3 p-3 bg-white/60 rounded-xl">
                                            <span className="text-2xl">{item.icon}</span>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    )
}
