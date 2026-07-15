import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RiDraggable } from '@remixicon/react';
import { Table } from 'antd';
import type { TableProps } from 'antd';
import { createContext, useContext, useMemo, type CSSProperties, type HTMLAttributes } from 'react';

// A reusable drag-to-reorder antd Table (dnd-kit). Rows are reordered by dragging
// the handle; onReorder receives the new full array (persist display_order server-side).

type RowContext = {
  setActivatorNodeRef?: (el: HTMLElement | null) => void;
  listeners?: Record<string, unknown>;
};
const RowCtx = createContext<RowContext>({});

export function DragHandle() {
  const { setActivatorNodeRef, listeners } = useContext(RowCtx);
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...listeners}
      className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-tremor-brand p-1 -ml-1 touch-none"
      aria-label="ลากเพื่อจัดลำดับ">
      <RiDraggable className="w-5 h-5" />
    </button>
  );
}

function DraggableRow(props: HTMLAttributes<HTMLTableRowElement> & { 'data-row-key': string }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: props['data-row-key'] });
  const style: CSSProperties = {
    ...props.style,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 9, background: '#FAFAFA' } : {}),
  };
  const ctx = useMemo<RowContext>(() => ({ setActivatorNodeRef, listeners }), [setActivatorNodeRef, listeners]);
  return (
    <RowCtx.Provider value={ctx}>
      <tr {...props} ref={setNodeRef} style={style} {...attributes} />
    </RowCtx.Provider>
  );
}

export function DndTable<T extends { id: string }>({
  items,
  onReorder,
  ...tableProps
}: { items: T[]; onReorder: (next: T[]) => void } & Omit<TableProps<T>, 'dataSource' | 'components' | 'rowKey' | 'pagination'>) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 1 } }));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) {
      const from = items.findIndex((i) => i.id === active.id);
      const to = items.findIndex((i) => i.id === over.id);
      if (from !== -1 && to !== -1) onReorder(arrayMove(items, from, to));
    }
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <Table<T>
          rowKey="id"
          dataSource={items}
          pagination={false}
          components={{ body: { row: DraggableRow } }}
          {...tableProps}
        />
      </SortableContext>
    </DndContext>
  );
}
