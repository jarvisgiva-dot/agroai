import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Pencil, Trash2 } from "lucide-react"
import { CustoAplicacao } from "@/types"

interface CustosAplicacaoListProps {
    data: CustoAplicacao[]
    selectedIds: number[]
    onSelect: (id: number) => void
    onSelectAll: () => void
    onEdit: (item: CustoAplicacao) => void
    onDelete: (id: number) => void
}

export function CustosAplicacaoList({
    data,
    selectedIds,
    onSelect,
    onSelectAll,
    onEdit,
    onDelete
}: CustosAplicacaoListProps) {
    if (data.length === 0) {
        return <div className="text-center p-8 text-gray-500">Nenhum dado de custo por aplicação encontrado.</div>
    }

    // Calcular totais
    const totalCusto = data.reduce((acc, item) => acc + (item.custo_total || 0), 0)
    const totalCustoScHa = data.reduce((acc, item) => acc + (item.custo_sc_ha || 0), 0)
    const totalCustoRsHa = data.reduce((acc, item) => acc + (item.custo_rs_ha || 0), 0)

    const allSelected = data.length > 0 && data.every(item => selectedIds.includes(item.id))

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">
                            <Checkbox
                                checked={allSelected}
                                onCheckedChange={onSelectAll}
                            />
                        </TableHead>
                        <TableHead>Aplicação</TableHead>
                        <TableHead>Cultura</TableHead>
                        <TableHead>Safra</TableHead>
                        <TableHead>Fazenda</TableHead>
                        <TableHead className="text-right">Custo Total</TableHead>
                        <TableHead className="text-right">Custo sc/ha</TableHead>
                        <TableHead className="text-right">Custo R$/ha</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>
                                <Checkbox
                                    checked={selectedIds.includes(item.id)}
                                    onCheckedChange={() => onSelect(item.id)}
                                />
                            </TableCell>
                            <TableCell className="font-medium">{item.aplicacao}</TableCell>
                            <TableCell>{item.cultura}</TableCell>
                            <TableCell>{item.safra}</TableCell>
                            <TableCell>{item.fazenda}</TableCell>
                            <TableCell className="text-right font-medium">
                                {item.custo_total?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell className="text-right">
                                {item.custo_sc_ha?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right">
                                {item.custo_rs_ha?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
                                        <Pencil className="h-4 w-4 text-blue-500" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold">
                        <TableCell colSpan={5} className="text-right">Total</TableCell>
                        <TableCell className="text-right">
                            {totalCusto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell className="text-right">
                            {totalCustoScHa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                            {totalCustoRsHa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    )
}
