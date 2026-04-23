import { createClient } from '@/lib/supabase/server'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'

type SaleItemRow = { vk_preis: number }
type SaleRow = {
  id: string
  rechnungsnr: string | null
  datum: string
  customer: { name: string } | null
  items: SaleItemRow[] | null
}

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('sales')
    .select('id, rechnungsnr, datum, customer:customers(name), items:sale_items(vk_preis)')
    .order('datum', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Verkaufsbelege</h1>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Datum</TableHead><TableHead>Rechnungsnr</TableHead>
            <TableHead>Kunde</TableHead><TableHead>Positionen</TableHead>
            <TableHead className="text-right">Summe</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {((data ?? []) as unknown as SaleRow[]).map(s => {
              const total = (s.items ?? []).reduce((sum: number, i: SaleItemRow) => sum + Number(i.vk_preis), 0)
              return (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.datum)}</TableCell>
                  <TableCell>{s.rechnungsnr ?? '—'}</TableCell>
                  <TableCell>{s.customer?.name ?? '—'}</TableCell>
                  <TableCell>{(s.items ?? []).length}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(total)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
