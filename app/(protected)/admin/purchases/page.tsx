import { createClient } from '@/lib/supabase/server'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatDate } from '@/lib/utils'

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('purchases')
    .select('id, rechnungsnr, datum, supplier:suppliers(name), items:purchase_items(ek_preis)')
    .order('datum', { ascending: false })

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Einkaufsbelege</h1>
      <div className="rounded-md border bg-white">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Datum</TableHead><TableHead>Rechnungsnr</TableHead>
            <TableHead>Lieferant</TableHead><TableHead>Positionen</TableHead>
            <TableHead className="text-right">Summe</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).map((p: any) => {
              const total = (p.items ?? []).reduce((s: number, i: any) => s + Number(i.ek_preis), 0)
              return (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.datum)}</TableCell>
                  <TableCell>{p.rechnungsnr ?? '—'}</TableCell>
                  <TableCell>{p.supplier?.name ?? '—'}</TableCell>
                  <TableCell>{(p.items ?? []).length}</TableCell>
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
