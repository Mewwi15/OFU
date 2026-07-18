import { Button, Result } from 'antd';
import { Component, type ReactNode } from 'react';

type Props = {
  /** Close the receipt and return to the till — also unmounts and resets this boundary. */
  onClose: () => void;
  children: ReactNode;
};
type State = { error: Error | null };

/**
 * A boundary scoped to the POS receipt ONLY, so a throw while rendering a
 * receipt can never take the whole till down again (H5). The global
 * ErrorBoundary catches such a throw but its only exit is a full page reload —
 * which is the exact mid-shift white-screen this bug was. The sale is already
 * committed by the time the receipt renders, so the right recovery is simply to
 * dismiss the receipt and keep selling, never to reload.
 *
 * Reset: the fallback's button calls `onClose`, which clears the receipt in
 * Pos.tsx and unmounts this boundary; the next sale mounts a fresh one, so there
 * is no stale error state to clear explicitly.
 */
export class ReceiptBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[ReceiptBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Result
        status="warning"
        title="แสดงใบเสร็จไม่สำเร็จ"
        subTitle="การขายถูกบันทึกเรียบร้อยแล้ว (ไม่ถูกตัดเงินซ้ำ) — ปิดใบเสร็จนี้แล้วขายต่อได้เลย"
        extra={
          <Button type="primary" onClick={this.props.onClose}>
            ปิดใบเสร็จและขายต่อ
          </Button>
        }
      />
    );
  }
}
