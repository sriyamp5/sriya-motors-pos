import { categorySchema, brandSchema, supplierSchema } from '@shared/schemas/index.js';
import { MasterDataPage } from './MasterDataPage.jsx';

const countColumn = (key, header) => ({
  key,
  header,
  align: 'right',
  render: (r) => <span className="num">{r[key] ?? 0}</span>,
});

export function CategoriesPage() {
  return (
    <MasterDataPage
      title="Categories"
      description="Group items, e.g. Filters, Brake System, Electrical."
      entityLabel="Category"
      basePath="/categories"
      schema={categorySchema}
      emptyValues={{ name: '', description: '' }}
      fields={[
        { name: 'name', label: 'Category name', required: true },
        { name: 'description', label: 'Description', type: 'textarea' },
      ]}
      columns={[
        { key: 'name', header: 'Name', render: (r) => <span className="strong">{r.name}</span> },
        { key: 'description', header: 'Description', render: (r) => <span className="text-2">{r.description}</span> },
        countColumn('productCount', 'Items'),
      ]}
    />
  );
}

export function BrandsPage() {
  return (
    <MasterDataPage
      title="Brands"
      description="Part manufacturers, e.g. Denso, Bosch, NGK, Toyota Genuine."
      entityLabel="Brand"
      basePath="/brands"
      schema={brandSchema}
      emptyValues={{ name: '', country: '' }}
      fields={[
        { name: 'name', label: 'Brand name', required: true },
        { name: 'country', label: 'Country of origin', placeholder: 'e.g. Japan' },
      ]}
      columns={[
        { key: 'name', header: 'Name', render: (r) => <span className="strong">{r.name}</span> },
        { key: 'country', header: 'Country' },
        countColumn('productCount', 'Items'),
      ]}
    />
  );
}

export function SuppliersPage() {
  return (
    <MasterDataPage
      title="Suppliers"
      description="Companies you buy stock from."
      entityLabel="Supplier"
      basePath="/suppliers"
      schema={supplierSchema}
      emptyValues={{ name: '', contactPerson: '', phone: '', email: '', address: '', notes: '' }}
      fields={[
        { name: 'name', label: 'Supplier name', required: true, span: 2 },
        { name: 'contactPerson', label: 'Contact person' },
        { name: 'phone', label: 'Phone', placeholder: '0112345678' },
        { name: 'email', label: 'Email' },
        { name: 'address', label: 'Address' },
        { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
      ]}
      columns={[
        { key: 'name', header: 'Name', render: (r) => <span className="strong">{r.name}</span> },
        { key: 'contactPerson', header: 'Contact' },
        { key: 'phone', header: 'Phone' },
        { key: 'email', header: 'Email' },
      ]}
    />
  );
}
