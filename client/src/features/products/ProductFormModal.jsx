import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Percent, ScanBarcode } from 'lucide-react';
import { createProductSchema, updateProductSchema } from '@shared/schemas/index.js';
import { PART_TYPE_LABELS, UNIT_LABELS } from '@shared/constants.js';
import { markupPercent, priceFromMarkup } from '@shared/money.js';
import { api } from '@/api/client.js';
import { useForm } from '@/hooks/useForm.js';
import { useOptions } from '@/hooks/useOptions.js';
import { useToast } from '@/context/ToastContext.jsx';
import {
  Alert,
  Button,
  Loader,
  Modal,
  MoneyInput,
  SelectInput,
  Switch,
  TextArea,
  TextInput,
  toOptions,
} from '@/components/ui/index.js';

const EMPTY = {
  name: '',
  partNumber: '',
  barcode: '',
  categoryId: '',
  brandId: '',
  partType: 'AFTERMARKET',
  unit: 'PCS',
  costPrice: '',
  sellingPrice: '',
  openingStock: '0',
  reorderLevel: '2',
  rackLocation: '',
  warrantyMonths: '',
  description: '',
  isActive: true,
  fitments: [],
};

/** Maps an API product to form values (everything as strings for inputs). */
const toFormValues = (p) => ({
  name: p.name,
  partNumber: p.partNumber ?? '',
  barcode: p.barcode ?? '',
  categoryId: String(p.categoryId),
  brandId: p.brandId ? String(p.brandId) : '',
  partType: p.partType,
  unit: p.unit,
  costPrice: String(p.costPrice ?? ''),
  sellingPrice: String(p.sellingPrice),
  openingStock: '0',
  reorderLevel: String(p.reorderLevel),
  rackLocation: p.rackLocation ?? '',
  warrantyMonths: p.warrantyMonths != null ? String(p.warrantyMonths) : '',
  description: p.description ?? '',
  isActive: p.isActive,
  fitments: (p.fitments ?? []).map((f) => ({
    makeId: String(f.makeId),
    vehicleModelId: String(f.vehicleModelId),
    yearFrom: f.yearFrom ? String(f.yearFrom) : '',
    yearTo: f.yearTo ? String(f.yearTo) : '',
  })),
});

/** One "fits vehicle" row: make, model and optional year range. */
function FitmentRow({ fitment, makes, error, onChange, onRemove }) {
  const [models] = useOptions('/vehicle-models', {
    params: { makeId: fitment.makeId },
    enabled: Boolean(fitment.makeId),
  });
  return (
    <div className="fitment-row">
      <SelectInput
        label="Make"
        placeholder="Select"
        options={makes}
        value={fitment.makeId}
        onChange={(e) => onChange({ makeId: e.target.value, vehicleModelId: '' })}
      />
      <SelectInput
        label="Model"
        placeholder={fitment.makeId ? 'Select model' : 'Select make first'}
        options={models}
        value={fitment.vehicleModelId}
        onChange={(e) => onChange({ vehicleModelId: e.target.value })}
        disabled={!fitment.makeId}
        error={error?.vehicleModelId}
      />
      <TextInput
        label="From year"
        inputMode="numeric"
        placeholder="Any"
        value={fitment.yearFrom}
        onChange={(e) => onChange({ yearFrom: e.target.value })}
        error={error?.yearFrom}
      />
      <TextInput
        label="To year"
        inputMode="numeric"
        placeholder="Any"
        value={fitment.yearTo}
        onChange={(e) => onChange({ yearTo: e.target.value })}
        error={error?.yearTo}
      />
      <Button variant="ghost" iconOnly icon={Trash2} onClick={onRemove} aria-label="Remove vehicle" />
    </div>
  );
}

/**
 * Create or edit an item. Opening stock is entered only when creating;
 * afterwards stock changes through goods received, sales, returns and
 * adjustments so every change is traceable.
 */
export function ProductFormModal({ open, productId, initialBarcode = '', onClose, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(productId);
  const form = useForm(isEdit ? updateProductSchema : createProductSchema, { ...EMPTY, barcode: initialBarcode ?? '' });
  const [loading, setLoading] = useState(isEdit);
  const [markupInput, setMarkupInput] = useState('');

  const [categories] = useOptions('/categories');
  const [brands] = useOptions('/brands');
  const [makes] = useOptions('/vehicle-makes');

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api
      .get(`/products/${productId}`)
      .then((p) => form.reset(toFormValues(p)))
      .catch((error) => {
        toast.fromError(error, 'Could not load item');
        onClose();
      })
      .finally(() => setLoading(false));
    // Loading happens once per opened item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const { values, setValue, errors } = form;
  const markup = useMemo(
    () => markupPercent(values.costPrice, values.sellingPrice),
    [values.costPrice, values.sellingPrice],
  );
  const belowCost = Number(values.sellingPrice) > 0 && Number(values.costPrice) > Number(values.sellingPrice);

  const fitmentErrors = (index) => ({
    vehicleModelId: errors[`fitments.${index}.vehicleModelId`],
    yearFrom: errors[`fitments.${index}.yearFrom`],
    yearTo: errors[`fitments.${index}.yearTo`],
  });

  const updateFitment = (index, patch) =>
    setValue(
      'fitments',
      values.fitments.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );

  const submit = form.handleSubmit(async (data) => {
    const saved = isEdit ? await api.put(`/products/${productId}`, data) : await api.post('/products', data);
    toast.success(isEdit ? 'Item updated' : 'Item added', `${saved.name} (${saved.itemCode})`);
    onSaved?.(saved);
  });

  const applyMarkup = () => {
    if (!values.costPrice || markupInput === '') return;
    setValue('sellingPrice', String(priceFromMarkup(values.costPrice, markupInput)));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={form.submitting}
      size="lg"
      title={isEdit ? 'Edit item' : 'Add new item'}
      description={
        isEdit
          ? 'Stock is changed through Receive stock or Stock adjustments.'
          : 'Scan the barcode into the barcode box, or leave it empty.'
      }
      footer={
        <>
          <Button onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={form.submitting}>
            {isEdit ? 'Save changes' : 'Add item'}
          </Button>
        </>
      }
    >
      {loading ? (
        <Loader />
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <div className="form-section-title">Item details</div>
          <div className="grid-3">
            <TextInput
              className="span-2"
              label="Item name"
              required
              placeholder="e.g. Oil filter"
              {...form.bind('name')}
            />
            <TextInput label="Part number (OEM)" placeholder="e.g. 90915-YZZE1" {...form.bind('partNumber')} />
          </div>
          <div className="grid-3">
            <TextInput
              label="Barcode"
              placeholder="Scan or type"
              data-scanner="ignore"
              {...form.bind('barcode')}
              onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
              hint={
                <>
                  <ScanBarcode size={12} style={{ verticalAlign: -2 }} /> Optional
                </>
              }
            />
            <SelectInput
              label="Category"
              required
              placeholder="Select category"
              options={categories}
              {...form.bind('categoryId')}
            />
            <SelectInput label="Brand" placeholder="No brand" options={brands} {...form.bind('brandId')} />
          </div>
          <div className="grid-4">
            <SelectInput label="Part type" required options={toOptions(PART_TYPE_LABELS)} {...form.bind('partType')} />
            <SelectInput label="Unit" required options={toOptions(UNIT_LABELS)} {...form.bind('unit')} />
            <TextInput label="Rack / shelf" placeholder="e.g. A-03" {...form.bind('rackLocation')} />
            <TextInput
              label="Warranty (months)"
              inputMode="numeric"
              placeholder="None"
              {...form.bind('warrantyMonths')}
            />
          </div>

          <div className="form-section-title">Pricing</div>
          <div className="grid-3">
            <MoneyInput label="Buying price" required {...form.bind('costPrice')} />
            <div className="field">
              <span className="field-label">Markup %</span>
              <div className="row">
                <div className="input-group grow">
                  <Percent size={14} />
                  <input
                    className="input input-num"
                    inputMode="decimal"
                    placeholder={markup != null ? String(markup) : '50'}
                    value={markupInput}
                    onChange={(e) => setMarkupInput(e.target.value.replace(/[^\d.]/g, ''))}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyMarkup())}
                  />
                </div>
                <Button onClick={applyMarkup} disabled={!values.costPrice || markupInput === ''}>
                  Apply
                </Button>
              </div>
              <span className="field-hint">Calculates the selling price from the buying price.</span>
            </div>
            <MoneyInput label="Selling price" required {...form.bind('sellingPrice')} />
          </div>
          <div className="row-wrap">
            {markup != null && (
              <span className="markup-pill">
                Markup <strong className="num">{markup}%</strong> · Profit per unit{' '}
                <strong className="num">
                  Rs. {(Number(values.sellingPrice) - Number(values.costPrice)).toFixed(2)}
                </strong>
              </span>
            )}
          </div>
          {belowCost && <Alert tone="warning">The selling price is lower than the buying price.</Alert>}

          <div className="form-section-title">Stock</div>
          <div className="grid-3">
            {!isEdit && <TextInput label="Opening stock" required inputMode="numeric" {...form.bind('openingStock')} />}
            <TextInput
              label="Low stock alert at"
              required
              inputMode="numeric"
              hint="Warn when stock falls to this level."
              {...form.bind('reorderLevel')}
            />
            {isEdit && (
              <div className="field" style={{ justifyContent: 'flex-end' }}>
                <Switch
                  checked={values.isActive}
                  onChange={(v) => setValue('isActive', v)}
                  label="Active"
                  description="Inactive items cannot be sold."
                />
              </div>
            )}
          </div>

          <div className="row-between">
            <div className="form-section-title">Fits vehicles</div>
            <Button
              size="sm"
              variant="soft"
              icon={Plus}
              onClick={() =>
                setValue('fitments', [...values.fitments, { makeId: '', vehicleModelId: '', yearFrom: '', yearTo: '' }])
              }
            >
              Add vehicle
            </Button>
          </div>
          {values.fitments.length === 0 && (
            <p className="small muted">Optional. Lets cashiers find the part by vehicle model, e.g. “Axio”.</p>
          )}
          {values.fitments.map((fitment, index) => (
            <FitmentRow
              key={index}
              fitment={fitment}
              makes={makes}
              error={fitmentErrors(index)}
              onChange={(patch) => updateFitment(index, patch)}
              onRemove={() =>
                setValue(
                  'fitments',
                  values.fitments.filter((_, i) => i !== index),
                )
              }
            />
          ))}

          <TextArea label="Notes" rows={2} placeholder="Optional description" {...form.bind('description')} />
          <button type="submit" hidden />
        </form>
      )}
    </Modal>
  );
}
