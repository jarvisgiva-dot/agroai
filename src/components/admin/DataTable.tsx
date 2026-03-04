'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    TableFooter,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2, Plus, Search, Pencil } from 'lucide-react'
import { deleteRecords } from '@/app/actions/admin'
import { useToast } from '@/components/ui/use-toast'

interface Column {
    header: string
    accessorKey: string
    format?: (value: any) => React.ReactNode
}

interface DataTableProps {
    data: any[]
    columns: Column[]
    tableName: string // e.g., 'produtividade_colheita'
    onAdd?: () => void
    onEdit?: (row: any) => void
}

export function DataTable({ data, columns, tableName, onAdd, onEdit }: DataTableProps) {
    const router = useRouter()
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [isDeleting, setIsDeleting] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const { toast } = useToast()

    // Filter data based on search term
    const filteredData = data.filter((row) => {
        if (!searchTerm) return true
        const lowerTerm = searchTerm.toLowerCase()
        return columns.some((col) => {
            const value = row[col.accessorKey]
            return String(value).toLowerCase().includes(lowerTerm)
        })
    })

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredData.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(filteredData.map((row) => row.id))
        }
    }

    const toggleSelectRow = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))
        } else {
            setSelectedIds([...selectedIds, id])
        }
    }

    const handleDelete = async (ids: number[]) => {
        if (!confirm(`Tem certeza que deseja excluir ${ids.length} registro(s)?`)) return

        setIsDeleting(true)
        const result = await deleteRecords(tableName, ids)
        setIsDeleting(false)

        if (result.success) {
            toast({
                title: 'Sucesso',
                description: result.message,
                variant: 'default',
            })
            setSelectedIds([])
            router.refresh()
        } else {
            toast({
                title: 'Erro',
                description: result.message,
                variant: 'destructive',
            })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-sm text-gray-500">
                        {selectedIds.length} selecionado(s) de {filteredData.length}
                    </div>
                    <div className="space-x-2 flex">
                        {selectedIds.length > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(selectedIds)}
                                disabled={isDeleting}
                                className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {isDeleting ? 'Excluindo...' : 'Excluir Selecionados'}
                            </Button>
                        )}
                        {onAdd && (
                            <Button onClick={onAdd} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                                <Plus className="w-4 h-4 mr-2" />
                                Novo Item
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50/50">
                            <TableHead className="w-[50px]">
                                <input
                                    type="checkbox"
                                    checked={data.length > 0 && selectedIds.length === data.length}
                                    onChange={toggleSelectAll}
                                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                            </TableHead>
                            {columns.map((col) => (
                                <TableHead key={col.accessorKey} className="font-semibold text-gray-700">
                                    {col.header}
                                </TableHead>
                            ))}
                            <TableHead className="text-right font-semibold text-gray-700">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length + 2} className="h-24 text-center text-gray-500">
                                    Nenhum registro encontrado.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredData.map((row) => (
                                <TableRow key={row.id} data-state={selectedIds.includes(row.id) && "selected"} className="hover:bg-gray-50">
                                    <TableCell>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(row.id)}
                                            onChange={() => toggleSelectRow(row.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        />
                                    </TableCell>
                                    {columns.map((col) => (
                                        <TableCell key={col.accessorKey} className="py-3">
                                            {col.format ? col.format(row[col.accessorKey]) : row[col.accessorKey]}
                                        </TableCell>
                                    ))}
                                    <TableCell className="text-right space-x-2">
                                        {onEdit && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => onEdit(row)}
                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete([row.id])}
                                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                    <TableFooter className="bg-gray-100/50 font-bold">
                        <TableRow>
                            <TableCell className="text-center">Total</TableCell>
                            {columns.map((col) => {
                                const isNumeric = [
                                    'quantidade_estoque',
                                    'valor_total_estoque',
                                    'qtd_contrato_sacas',
                                    'producao_liquida_sacas',
                                    'area_colhida_ha'
                                ].includes(col.accessorKey)

                                const total = isNumeric
                                    ? filteredData.reduce((sum, row) => sum + (Number(row[col.accessorKey]) || 0), 0)
                                    : null

                                return (
                                    <TableCell key={col.accessorKey}>
                                        {total !== null ? (
                                            col.format ? col.format(total) : total.toLocaleString('pt-BR')
                                        ) : '-'}
                                    </TableCell>
                                )
                            })}
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>
    )
}
