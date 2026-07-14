import { Button, Result, Typography } from 'antd';
import { Component, type ReactNode } from 'react';

const { Paragraph, Text } = Typography;

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Root error boundary for the whole admin/POS app. React only catches
 * render-time throws in a class component (getDerivedStateFromError /
 * componentDidCatch — no hook equivalent) — without this, a throw in any page
 * (most sensitively Pos.tsx mid-sale) white-screens the till with zero
 * recovery UI and no indication whether the in-progress sale went through.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // No remote error tracking is wired up yet — at least land it in devtools.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reload = () => window.location.reload();

  copyDetails = () => {
    const { error } = this.state;
    if (!error) return;
    void navigator.clipboard.writeText(`${error.message}\n\n${error.stack ?? ''}`);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <Result
        status="error"
        title="เกิดข้อผิดพลาด"
        subTitle='หน้านี้ขัดข้องกะทันหัน หากเพิ่งกดขายไปแล้ว รายการอาจถูกบันทึกไว้แล้ว — ตรวจสอบที่หน้า "บิลขาย" ก่อนขายซ้ำ'
        style={{ paddingTop: 64 }}
        extra={[
          <Button type="primary" key="reload" onClick={this.reload}>
            โหลดหน้าใหม่
          </Button>,
          <Button key="copy" onClick={this.copyDetails}>
            คัดลอกรายละเอียดข้อผิดพลาด
          </Button>,
        ]}>
        <Paragraph type="secondary" style={{ textAlign: 'center' }}>
          <Text code>{error.message}</Text>
        </Paragraph>
      </Result>
    );
  }
}
