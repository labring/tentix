import { useRef, useEffect } from "react";
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

interface EChartsWrapperProps {
  option: EChartsOption;
  className?: string;
  style?: React.CSSProperties;
  renderer?: 'canvas' | 'svg';
  enableWindowResize?: boolean;
  enableResizeObserver?: boolean;
}

export function EChartsWrapper({
  option,
  className,
  style,
  renderer = 'svg',
  enableWindowResize = true,
  enableResizeObserver = false,
}: EChartsWrapperProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    const chart = echarts.init(chartRef.current, undefined, { renderer });
    chartInstanceRef.current = chart;

    // 监听窗口大小变化
    const handleResize = () => chart.resize();
    
    if (enableWindowResize) {
      window.addEventListener('resize', handleResize);
    }

    let resizeObserver: ResizeObserver | null = null;
    if (enableResizeObserver && chartRef.current) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(chartRef.current);
    }

    return () => {
      if (enableWindowResize) {
        window.removeEventListener('resize', handleResize);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      chart.dispose();
      chartInstanceRef.current = null;
    };
  }, [renderer, enableWindowResize, enableResizeObserver]);

  useEffect(() => {
    if (chartInstanceRef.current && option) {
      chartInstanceRef.current.setOption(option, true);
    }
  }, [option]);

  return <div ref={chartRef} className={className} style={style} />;
}

