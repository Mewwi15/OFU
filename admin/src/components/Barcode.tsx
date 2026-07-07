import JsBarcode from 'jsbarcode';
import { useEffect, useRef } from 'react';

/** Code128 barcode of a sale number, rendered as crisp SVG for thermal print. */
export function Barcode({ value, height = 22 }: { value: string; height?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        displayValue: false,
        margin: 0,
        height,
        width: 1.3,
        background: 'transparent',
        lineColor: '#000',
      });
    } catch {
      /* invalid value — skip */
    }
  }, [value, height]);
  return <svg ref={ref} className="mx-auto block max-w-full" />;
}
