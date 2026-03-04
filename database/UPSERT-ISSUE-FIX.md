## 🔴 ERRO NA IMPLEMENTAÇÃO DO UPSERT

Tentei implementar agregação de duplicatas mas cometi um erro ao editar o arquivo.

## ✅ SOLUÇÃO TEMPORÁRIA MAIS SIMPLES:

**Para evitar o erro "ON CONFLICT cannot affect row twice", use uma destas opções:**

### **Opção 1: Deletar dados antigos antes de importar** (Recomendado)

Antes de fazer upload do arquivo de estoque, delete todos os registros:

```sql
-- Deletar TODOS os registros de estoque antes de re-importar
DELETE FROM public.estoque_insumos;
```

Depois faça o upload. Como a tabela está vazia, não haverá conflitos.

---

### **Opção 2: Usar INSERT normal (sem UPSERT)**

Como o PDF tem produtos duplicados dentro dele mesmo, precisaria:
1. Voltar ao INSERT normal (sem UPSERT)
2. Sempre deletar dados antigos antes de fazer upload

Vou reverter para INSERT normal.

