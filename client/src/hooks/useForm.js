import { useCallback, useRef, useState } from 'react';
import { toFieldErrors } from '@shared/schemas/index.js';
import { ApiError } from '@/api/client.js';
import { useToast } from '@/context/ToastContext.jsx';

/**
 * Form state with validation by the same Zod schema the server uses, so the
 * user sees the same messages before and after submitting.
 *
 * Server validation errors (422 with field messages) are mapped back onto
 * the matching inputs; other errors are shown as a toast.
 */
export function useForm(schema, initialValues) {
  const toast = useToast();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const submittedOnce = useRef(false);

  const validate = useCallback(
    (next) => {
      const result = schema.safeParse(next);
      return result.success
        ? { data: result.data, fieldErrors: {} }
        : { data: null, fieldErrors: toFieldErrors(result.error) };
    },
    [schema],
  );

  const setValue = useCallback(
    (name, value) => {
      setValues((prev) => {
        const next = { ...prev, [name]: value };
        // After the first submit, keep messages in sync while the user corrects them.
        if (submittedOnce.current) setErrors(validate(next).fieldErrors);
        return next;
      });
    },
    [validate],
  );

  /** Props for a text-like input bound to a field. */
  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => setValue(name, e.target.type === 'checkbox' ? e.target.checked : e.target.value),
    error: errors[name],
  });

  const handleSubmit = (onValid) => async (event) => {
    event?.preventDefault?.();
    submittedOnce.current = true;
    const { data, fieldErrors } = validate(values);
    setErrors(fieldErrors);
    if (!data) return;

    setSubmitting(true);
    try {
      await onValid(data);
    } catch (error) {
      if (error instanceof ApiError && error.fields) {
        setErrors(error.fields);
        toast.error('Please check the form', error.message);
      } else {
        toast.fromError(error, 'Could not save');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const reset = useCallback((next) => {
    submittedOnce.current = false;
    setValues(next);
    setErrors({});
  }, []);

  return { values, errors, setValue, setValues, setErrors, bind, handleSubmit, submitting, reset };
}
