'use client';
import { useMemo } from 'react';
import { createColumnHelper, createSortedRowModel, rowSortingFeature, sortFn_basic, sortFn_text, tableFeatures, useTable, type SortingState, type OnChangeFn } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { text: sortFn_text, basic: sortFn_basic } });
export interface TableColumn<T> { id: string; header: string; accessor: (row: T) => string | number; cell?: (row: T) => React.ReactNode; sortable?: boolean; numeric?: boolean }
export function DataTable<T extends { id: string }>({ data, columns, sorting, onSortingChange, caption }: { data: T[]; columns: TableColumn<T>[]; sorting?: SortingState; onSortingChange?: OnChangeFn<SortingState>; caption: string }) {
  const definitions = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    return columns.map(column => helper.accessor((row: T): unknown => column.accessor(row), { id: column.id, header: column.header, enableSorting: column.sortable ?? false, sortFn: column.numeric ? 'basic' : 'text', cell: ctx => column.cell ? column.cell(ctx.row.original) : String(ctx.getValue() ?? '—') }));
  }, [columns]);
  const table = useTable({ features, data, columns: definitions, getRowId: row => row.id, manualSorting: !!onSortingChange, ...(sorting ? { state: { sorting } } : {}), ...(onSortingChange ? { onSortingChange } : {}) });
  return <div className="table-scroll"><table className="data-table"><caption className="sr-only">{caption}</caption><thead>{table.getHeaderGroups().map(group => <tr key={group.id}>{group.headers.map(header => <th scope="col" key={header.id} aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : undefined}>{header.column.getCanSort() ? <button onClick={header.column.getToggleSortingHandler()}><table.FlexRender header={header} />{header.column.getIsSorted() === 'asc' ? <ArrowUp size={14} /> : header.column.getIsSorted() === 'desc' ? <ArrowDown size={14} /> : <ArrowUpDown size={14} />}</button> : <table.FlexRender header={header} />}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row => <tr key={row.id}>{row.getAllCells().map(cell => <td key={cell.id}><table.FlexRender cell={cell} /></td>)}</tr>)}</tbody></table></div>;
}
