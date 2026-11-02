'use client';
import { useForm, useWatch } from 'react-hook-form';
import { api } from '@/lib/api';
import { useAction, useApi, useSession } from '@/hooks/use-api';
import type { Employee, Metadata } from '@/lib/types';
import { fullName, isAdmin } from '@/lib/utils';
import { Button, Field, Modal } from '@/components/ui/core';

type Values = Record<
  | 'firstName'
  | 'lastName'
  | 'workEmail'
  | 'personalEmail'
  | 'phone'
  | 'title'
  | 'departmentId'
  | 'locationId'
  | 'managerId'
  | 'status'
  | 'startDate'
  | 'endDate'
  | 'birthDate'
  | 'emergencyName'
  | 'emergencyPhone'
  | 'customFieldsText',
  string
>;
export function EmployeeDialog({
  open,
  onOpenChange,
  employee,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  employee?: Employee;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={employee ? 'A few details, up to date.' : 'Make room for someone great.'}
      description={
        employee
          ? 'Keep this employee record accurate and useful.'
          : 'Add a teammate. Their onboarding checklist is created automatically.'
      }
      wide
    >
      <EmployeeForm
        key={employee?.id ?? 'new'}
        employee={employee}
        close={() => onOpenChange(false)}
      />
    </Modal>
  );
}
function EmployeeForm({ employee, close }: { employee?: Employee; close: () => void }) {
  const { data: session } = useSession();
  const admin = isAdmin(session?.role);
  const meta = useApi<Metadata>('/organization/metadata');
  const people = useApi<Employee[]>('/employees/org-tree', admin);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    defaultValues: {
      customFieldsText: Object.entries(employee?.customFields ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n'),
      ...Object.fromEntries(
        [
          'firstName',
          'lastName',
          'workEmail',
          'personalEmail',
          'phone',
          'title',
          'departmentId',
          'locationId',
          'managerId',
          'status',
          'startDate',
          'endDate',
          'birthDate',
          'emergencyName',
          'emergencyPhone',
        ].map((key) => [
          key,
          key === 'status'
            ? (employee?.status ?? 'ONBOARDING')
            : String(
                (employee as unknown as Record<string, unknown> | undefined)?.[key] ?? '',
              ).slice(0, ['startDate', 'endDate', 'birthDate'].includes(key) ? 10 : undefined),
        ]),
      ),
    },
  });
  const formValues = useWatch({ control });
  const save = useAction(
    async (values: Values) => {
      const keys = admin
        ? Object.keys(values).filter((key) => key !== 'customFieldsText')
        : ['personalEmail', 'phone', 'emergencyName', 'emergencyPhone'];
      const data = Object.fromEntries(
        keys
          .filter((key) => employee || values[key as keyof Values] !== '')
          .map((key) => [
            key,
            values[key as keyof Values] ||
              (['personalEmail', 'birthDate', 'startDate', 'endDate'].includes(key) ? null : ''),
          ]),
      );
      return (
        await (employee
          ? api.patch(`/employees/${employee.id}`, {
              ...data,
              ...(admin
                ? {
                    customFields: Object.fromEntries(
                      (values.customFieldsText ?? '')
                        .split('\n')
                        .filter((line) => line.trim())
                        .map((line) => {
                          const index = line.indexOf(':');
                          return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
                        }),
                    ),
                  }
                : {}),
            })
          : api.post('/employees', {
              ...data,
              customFields: Object.fromEntries(
                (values.customFieldsText ?? '')
                  .split('\n')
                  .filter((line) => line.trim())
                  .map((line) => {
                    const index = line.indexOf(':');
                    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
                  }),
              ),
            }))
      ).data;
    },
    {
      success: employee
        ? 'Employee details updated.'
        : 'Your new teammate is in. Onboarding is ready.',
      onSuccess: close,
    },
  );
  return (
    <form onSubmit={handleSubmit((values) => save.mutate(values))}>
      <div className="form-grid">
        {admin && (
          <>
            <Field label="First name" error={errors.firstName?.message}>
              <input
                autoComplete="given-name"
                {...register('firstName', { required: 'Enter a first name.', maxLength: 80 })}
              />
            </Field>
            <Field label="Last name" error={errors.lastName?.message}>
              <input
                autoComplete="family-name"
                {...register('lastName', { required: 'Enter a last name.', maxLength: 80 })}
              />
            </Field>
            <Field label="Work email" className="full" error={errors.workEmail?.message}>
              <input type="email" {...register('workEmail', { required: 'Enter a work email.' })} />
            </Field>
            <Field label="Job title">
              <input maxLength={120} {...register('title')} />
            </Field>
            <Field label="Department">
              <select value={formValues.departmentId ?? ''} {...register('departmentId')}>
                <option value="">Unassigned</option>
                {meta.data?.departments.map((dept) => (
                  <option value={dept.id} key={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <select value={formValues.locationId ?? ''} {...register('locationId')}>
                <option value="">Unassigned</option>
                {meta.data?.locations.map((location) => (
                  <option value={location.id} key={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reports to">
              <select value={formValues.managerId ?? ''} {...register('managerId')}>
                <option value="">No manager</option>
                {people.data
                  ?.filter((person) => person.id !== employee?.id)
                  .map((person) => (
                    <option key={person.id} value={person.id}>
                      {fullName(person)}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Start date">
              <input type="date" {...register('startDate')} />
            </Field>
            <Field label="Employment status">
              <select {...register('status')}>
                <option value="ONBOARDING">Onboarding</option>
                <option value="ACTIVE">Active</option>
                <option value="LEAVE">On leave</option>
                <option value="TERMINATED">Archived</option>
              </select>
            </Field>
            {employee && (
              <Field label="End date">
                <input type="date" {...register('endDate')} />
              </Field>
            )}
            <Field label="Date of birth">
              <input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                {...register('birthDate')}
              />
            </Field>
          </>
        )}
        <Field label="Personal email">
          <input type="email" {...register('personalEmail')} />
        </Field>
        <Field label="Phone number">
          <input type="tel" maxLength={40} {...register('phone')} />
        </Field>
        <Field label="Emergency contact name">
          <input maxLength={100} {...register('emergencyName')} />
        </Field>
        <Field label="Emergency phone">
          <input type="tel" maxLength={40} {...register('emergencyPhone')} />
        </Field>
        {admin && (
          <Field
            label="Additional details"
            className="full"
            hint="One field per line: T-shirt size: M. Visible to the employee and HR."
            error={errors.customFieldsText?.message}
          >
            <textarea
              rows={3}
              maxLength={11000}
              {...register('customFieldsText', {
                validate: (value) =>
                  !(value ?? '')
                    .split('\n')
                    .filter((line) => line.trim())
                    .some((line) => line.indexOf(':') < 1) ||
                  'Use a name followed by a colon and a value on each line.',
              })}
            />
          </Field>
        )}
      </div>
      <div className="dialog-footer">
        <Button type="button" variant="secondary" onClick={close}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {employee ? 'Save changes' : 'Add teammate'}
        </Button>
      </div>
    </form>
  );
}
