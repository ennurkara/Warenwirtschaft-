import { CrudTable } from '@/components/admin/crud-table'

export default function Page() {
  return <CrudTable tableName="customers" title="Kunden" fields={[
    { key: 'name', label: 'Name' },
    {
      key: 'customer_kind',
      label: 'Gruppe',
      type: 'select',
      defaultValue: 'sonstige',
      options: [
        { value: 'vectron',  label: 'Vectron' },
        { value: 'apro',     label: 'Apro' },
        { value: 'sonstige', label: 'Sonstige' },
      ],
    },
    { key: 'email', label: 'E-Mail', type: 'email' },
    { key: 'phone', label: 'Telefon' },
    { key: 'address', label: 'Straße + Nr.' },
    { key: 'postal_code', label: 'PLZ' },
    { key: 'city', label: 'Ort' },
  ]} />
}
