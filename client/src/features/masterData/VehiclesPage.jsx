import { useState } from 'react';
import { vehicleMakeSchema, vehicleModelSchema } from '@shared/schemas/index.js';
import { VEHICLE_TYPE_LABELS } from '@shared/constants.js';
import { useOptions } from '@/hooks/useOptions.js';
import { PageHeader, Tabs, toOptions } from '@/components/ui/index.js';
import { MasterDataPage } from './MasterDataPage.jsx';

/** Vehicle makes and models used to record which vehicles a part fits. */
export function VehiclesPage() {
  const [tab, setTab] = useState('models');
  const [makeFilter, setMakeFilter] = useState('');
  const [makes, reloadMakes] = useOptions('/vehicle-makes');

  return (
    <div className="page">
      <PageHeader title="Vehicles" description="Makes and models used to match parts to vehicles." />
      <div>
        <Tabs
          value={tab}
          onChange={(value) => {
            setTab(value);
            reloadMakes();
          }}
          tabs={[
            { value: 'models', label: 'Models' },
            { value: 'makes', label: 'Makes' },
          ]}
        />
        {tab === 'makes' ? (
          <MasterDataPage
            embedded
            title="Vehicle makes"
            entityLabel="Make"
            basePath="/vehicle-makes"
            schema={vehicleMakeSchema}
            emptyValues={{ name: '' }}
            fields={[{ name: 'name', label: 'Make name', required: true, placeholder: 'e.g. Toyota' }]}
            columns={[
              { key: 'name', header: 'Make', render: (r) => <span className="strong">{r.name}</span> },
              {
                key: 'modelCount',
                header: 'Models',
                align: 'right',
                render: (r) => <span className="num">{r.modelCount}</span>,
              },
            ]}
          />
        ) : (
          <MasterDataPage
            embedded
            title="Vehicle models"
            entityLabel="Model"
            basePath="/vehicle-models"
            schema={vehicleModelSchema}
            filters={{ makeId: makeFilter }}
            toolbarExtra={
              <select className="select" value={makeFilter} onChange={(e) => setMakeFilter(e.target.value)}>
                <option value="">All makes</option>
                {makes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            }
            emptyValues={{ makeId: makeFilter, name: '', vehicleType: 'CAR' }}
            fields={[
              { name: 'makeId', label: 'Make', required: true, type: 'select', options: makes },
              { name: 'name', label: 'Model name', required: true, placeholder: 'e.g. Axio, Wagon R, Hilux' },
              {
                name: 'vehicleType',
                label: 'Vehicle type',
                required: true,
                type: 'select',
                options: toOptions(VEHICLE_TYPE_LABELS),
              },
            ]}
            columns={[
              { key: 'makeName', header: 'Make' },
              { key: 'name', header: 'Model', render: (r) => <span className="strong">{r.name}</span> },
              { key: 'vehicleType', header: 'Type', render: (r) => VEHICLE_TYPE_LABELS[r.vehicleType] },
            ]}
          />
        )}
      </div>
    </div>
  );
}
