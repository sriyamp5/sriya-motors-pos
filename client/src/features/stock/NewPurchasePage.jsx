import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Save, ArrowLeft, Truck } from 'lucide-react';
import { createPurchaseSchema, toFieldErrors } from '@shared/schemas/index.js';
import { fromCents, markupPercent, toCents } from '@shared/money.js';
import { api } from '@/api/client.js';
import { useOptions } from '@/hooks/useOptions.js';
import { useToast } from '@/context/ToastContext.jsx';
import { formatMoney, todayIso } from '@/lib/format.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SelectInput,
  TextArea,
  TextInput,
} from '@/components/ui/index.js';
import { ProductSearch } from '@/features/pos/ProductSearch.jsx';

const numeric = (value) => value.replace(/[^\d.]/g, '');

/**
 * Goods received note. Each line records quantity and buying price; the
 * selling price can be updated at the same time (e.g. to keep the markup).
 */
export function NewPurchasePage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [suppliers] = useOptions('/suppliers');
  const [header, setHeader] = useState({ supplierId: '', supplierInvoiceNo: '', purchaseDate: todayIso(), notes: '' });
  const [lines, setLines] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const addProduct = (product) => {
    if (lines.some((l) => l.productId === product.id)) {
      toast.info('Already added', `${product.name} is already on this list. Change its quantity instead.`);
      return;
    }
    setLines((list) => [
      ...list,
      {
        productId: product.id,
        name: product.name,
        itemCode: product.itemCode,
        partNumber: product.partNumber,
        currentStock: product.stockQty,
        previousCost: product.costPrice,
        currentPrice: product.sellingPrice,
        quantity: '1',
        unitCost: String(product.costPrice || ''),
        sellingPrice: '',
      },
    ]);
  };

  const lookupCode = async (code) => {
    try {
      const { product } = await api.get(`/products/lookup/${encodeURIComponent(code)}`);
      if (product) addProduct(product);
      else toast.warning('Item not found', `No item has the code "${code}". Add it in Items first.`);
    } catch (error) {
      toast.fromError(error);
    }
  };

  const updateLine = (index, patch) => setLines((list) => list.map((l, i) => (i === index ? { ...l, ...patch } : l)));

  const totalCents = lines.reduce((sum, l) => sum + toCents(l.unitCost) * (Number(l.quantity) || 0), 0);

  const save = async () => {
    const payload = {
      ...header,
      items: lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitCost: l.unitCost,
        sellingPrice: l.sellingPrice,
      })),
    };
    const parsed = createPurchaseSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      toast.warning('Please check the form', Object.values(toFieldErrors(parsed.error))[0]);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const grn = await api.post('/purchases', parsed.data);
      toast.success('Stock received', `${grn.grnNo} · ${formatMoney(grn.totalAmount)}`);
      navigate('/purchases');
    } catch (error) {
      toast.fromError(error, 'Could not save');
      if (error.fields) setErrors(error.fields);
    } finally {
      setSaving(false);
    }
  };

  const lineError = (index, field) => errors[`items.${index}.${field}`];

  return (
    <div className="page">
      <PageHeader
        title="Receive stock"
        description="Record goods received from a supplier. Stock and buying prices update when you save."
        actions={
          <>
            <Button icon={ArrowLeft} onClick={() => navigate('/purchases')}>
              Back
            </Button>
            <Button variant="primary" icon={Save} onClick={save} loading={saving} disabled={!lines.length}>
              Save · {formatMoney(fromCents(totalCents))}
            </Button>
          </>
        }
      />

      <Card>
        <div className="grid-4">
          <SelectInput
            label="Supplier"
            required
            placeholder="Select supplier"
            options={suppliers}
            value={header.supplierId}
            onChange={(e) => setHeader({ ...header, supplierId: e.target.value })}
            error={errors.supplierId}
            hint={!suppliers.length ? 'Add suppliers under Inventory → Suppliers.' : undefined}
          />
          <TextInput
            label="Supplier invoice no"
            value={header.supplierInvoiceNo}
            onChange={(e) => setHeader({ ...header, supplierInvoiceNo: e.target.value })}
            error={errors.supplierInvoiceNo}
          />
          <TextInput
            label="Received date"
            required
            type="date"
            max={todayIso()}
            value={header.purchaseDate}
            onChange={(e) => setHeader({ ...header, purchaseDate: e.target.value })}
            error={errors.purchaseDate}
          />
          <TextArea
            label="Notes"
            rows={1}
            value={header.notes}
            onChange={(e) => setHeader({ ...header, notes: e.target.value })}
          />
        </div>
      </Card>

      <div className="card">
        <div className="card-header" style={{ display: 'block' }}>
          <ProductSearch
            onSelect={addProduct}
            onCodeEntered={lookupCode}
            allowOutOfStock
            autoFocus={false}
            placeholder="Scan or search an item to add it to this delivery"
          />
        </div>
        {lines.length === 0 ? (
          <EmptyState icon={Truck} title="No items yet" message="Scan or search the items in this delivery." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">In stock</th>
                  <th style={{ width: 110 }}>Qty received</th>
                  <th style={{ width: 150 }}>Buying price</th>
                  <th style={{ width: 170 }}>New selling price</th>
                  <th className="text-right">Line total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const newMarkup = markupPercent(line.unitCost, line.sellingPrice || line.currentPrice);
                  const costChanged = line.unitCost !== '' && toCents(line.unitCost) !== toCents(line.previousCost);
                  return (
                    <tr key={line.productId}>
                      <td>
                        <div className="strong">{line.name}</div>
                        <div className="small muted">
                          {[line.itemCode, line.partNumber].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="text-right num">{line.currentStock}</td>
                      <td>
                        <input
                          className="input input-num"
                          value={line.quantity}
                          inputMode="numeric"
                          onChange={(e) => updateLine(index, { quantity: e.target.value.replace(/\D/g, '') })}
                        />
                        {lineError(index, 'quantity') && (
                          <div className="field-error">{lineError(index, 'quantity')}</div>
                        )}
                      </td>
                      <td>
                        <input
                          className="input input-num"
                          value={line.unitCost}
                          inputMode="decimal"
                          onChange={(e) => updateLine(index, { unitCost: numeric(e.target.value) })}
                        />
                        {costChanged && <div className="small muted">was {formatMoney(line.previousCost, false)}</div>}
                        {lineError(index, 'unitCost') && (
                          <div className="field-error">{lineError(index, 'unitCost')}</div>
                        )}
                      </td>
                      <td>
                        <input
                          className="input input-num"
                          value={line.sellingPrice}
                          placeholder={`Keep ${formatMoney(line.currentPrice, false)}`}
                          inputMode="decimal"
                          onChange={(e) => updateLine(index, { sellingPrice: numeric(e.target.value) })}
                        />
                        {newMarkup != null && (
                          <div className={`small ${newMarkup < 0 ? 'text-danger' : 'muted'}`}>Markup {newMarkup}%</div>
                        )}
                      </td>
                      <td className="text-right num strong">
                        {formatMoney(fromCents(toCents(line.unitCost) * (Number(line.quantity) || 0)), false)}
                      </td>
                      <td>
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={Trash2}
                          onClick={() => setLines((list) => list.filter((_, i) => i !== index))}
                          aria-label="Remove"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right">
                    Total
                  </td>
                  <td className="text-right num">{formatMoney(fromCents(totalCents))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      {errors.items && <Alert tone="danger">{errors.items}</Alert>}
    </div>
  );
}
