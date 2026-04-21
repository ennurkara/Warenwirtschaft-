import { CrudTable } from '@/components/admin/crud-table'

export default function Page() {
  return <CrudTable tableName="manufacturers" title="Hersteller" fields={[
    { key: 'name', label: 'Name' },
  ]} />
}
