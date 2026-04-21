import { CrudTable } from '@/components/admin/crud-table'

export default function Page() {
  return <CrudTable tableName="customers" title="Kunden" fields={[
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'E-Mail', type: 'email' },
    { key: 'phone', label: 'Telefon' },
    { key: 'address', label: 'Adresse' },
  ]} />
}
