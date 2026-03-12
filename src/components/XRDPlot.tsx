import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
  ReferenceArea
} from 'recharts';
import { toPng } from 'html-to-image';
import { Download, Loader2, Settings2, ZoomIn, Edit3 } from 'lucide-react';
import { ParsedFile, PlotSettings } from '../utils/parser';

interface XRDPlotProps {
  file: ParsedFile;
  onUpdateRange: (min: number, max: number) => void;
  onUpdateSettings: (settings: Partial<PlotSettings>) => void;
  onUpdateDataPoint: (twoTheta: number, newCalc: number) => void;
}

const MATERIAL_COLORS = ['#e81cff', '#00d215', '#ff9500', '#00d2ff', '#ff003c', '#8a2be2'];

export default function XRDPlot({ file, onUpdateRange, onUpdateSettings, onUpdateDataPoint }: XRDPlotProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Interaction state
  const [interactionMode, setInteractionMode] = useState<'zoom' | 'adjust'>('zoom');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);

  const settings = file.plotSettings;
  const materials = file.approvedMaterials || [];

  const { plotData, diffOffset, tickYBase, tickYStep, rangeY, ticks, domainYMin, domainYMax } = useMemo(() => {
    const [minT, maxT] = file.displayRange;
    
    // Calculate custom ticks based on step size
    const ticks = [];
    for (let i = Math.ceil(minT / settings.xStepSize) * settings.xStepSize; i <= maxT; i += settings.xStepSize) {
      ticks.push(i);
    }

    // Filter data to only include points within the display range
    const visibleData = file.data.filter(d => d.twoTheta >= minT && d.twoTheta <= maxT);

    if (visibleData.length === 0) {
      return { plotData: [], diffOffset: 0, tickYBase: 0, tickYStep: 0, rangeY: 0, ticks: [], domainYMin: 0, domainYMax: 100 };
    }

    // Recalculate min and max Y based on visible experimental data to keep domain stable during dragging
    const minExp = Math.min(...visibleData.map(d => d.exp));
    const maxExp = Math.max(...visibleData.map(d => d.exp));
    const rY = maxExp - minExp;
    
    // Calculate the offset for the difference curve based on user setting
    const dOffset = minExp - rY * settings.diffOffsetRatio;
    const tYBase = minExp - rY * 0.05;
    const tYStep = rY * 0.08;

    const bPadding = Math.max(rY * 0.25, (materials.length * tYStep) + (rY * 0.1));
    const dYMin = minExp - bPadding;
    const dYMax = maxExp + rY * 0.05;

    const processed = visibleData.map(d => ({
      ...d,
      diffShifted: d.diff + dOffset
    }));

    // Downsample data for performance if there are too many points
    let finalData = processed;
    if (finalData.length > 3000) {
      const step = Math.ceil(finalData.length / 3000);
      finalData = finalData.filter((_, i) => i % step === 0);
    }

    return {
      plotData: finalData,
      diffOffset: dOffset,
      tickYBase: tYBase,
      tickYStep: tYStep,
      rangeY: rY,
      ticks,
      domainYMin: dYMin,
      domainYMax: dYMax
    };
  }, [file.data, file.displayRange, settings.xStepSize, settings.diffOffsetRatio, materials.length]);

  const handleDownload = async () => {
    if (!plotRef.current) return;
    try {
      setIsDownloading(true);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const dataUrl = await toPng(plotRef.current, { 
        backgroundColor: '#ffffff', 
        pixelRatio: 4,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      
      const link = document.createElement('a');
      link.download = `${file.name.replace(/\.[^/.]+$/, "")}_publication_plot.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to download image', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const zoom = () => {
    if (refAreaLeft === refAreaRight || refAreaRight === null || refAreaLeft === null) {
      setRefAreaLeft(null);
      setRefAreaRight(null);
      return;
    }

    let [left, right] = [refAreaLeft, refAreaRight];
    if (left > right) [left, right] = [right, left];

    onUpdateRange(left, right);
    setRefAreaLeft(null);
    setRefAreaRight(null);
  };

  const zoomOut = () => {
    onUpdateRange(file.minTheta, file.maxTheta);
  };

  const handleAdjustPoint = useCallback((e: any) => {
    if (e.activeLabel === undefined || e.chartY === undefined) return;
    const chartHeight = 330; // 350 height - 10 top margin - 10 bottom margin
    const clampedY = Math.max(10, Math.min(e.chartY, 340));
    const newCalc = domainYMax - ((clampedY - 10) / chartHeight) * (domainYMax - domainYMin);
    onUpdateDataPoint(e.activeLabel as number, newCalc);
  }, [domainYMax, domainYMin, onUpdateDataPoint]);

  const handleMouseDown = (e: any) => {
    if (!e) return;
    if (interactionMode === 'zoom') {
      setRefAreaLeft(e.activeLabel as number);
    } else if (interactionMode === 'adjust') {
      setIsAdjusting(true);
      handleAdjustPoint(e);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!e) return;
    if (interactionMode === 'zoom' && refAreaLeft !== null) {
      setRefAreaRight(e.activeLabel as number);
    } else if (interactionMode === 'adjust' && isAdjusting) {
      handleAdjustPoint(e);
    }
  };

  const handleMouseUp = () => {
    if (interactionMode === 'zoom') {
      zoom();
    } else if (interactionMode === 'adjust') {
      setIsAdjusting(false);
    }
  };

  const handleMouseLeave = () => {
    if (interactionMode === 'adjust') {
      setIsAdjusting(false);
    }
  };

  // Legend position mapping
  const getLegendProps = () => {
    const props: any = { wrapperStyle: { fontWeight: 'bold' } };
    switch (settings.legendPosition) {
      case 'top-right':
        props.verticalAlign = 'top';
        props.align = 'right';
        break;
      case 'top-left':
        props.verticalAlign = 'top';
        props.align = 'left';
        break;
      case 'bottom-right':
        props.verticalAlign = 'bottom';
        props.align = 'right';
        break;
      case 'bottom-left':
        props.verticalAlign = 'bottom';
        props.align = 'left';
        break;
      case 'top':
        props.verticalAlign = 'top';
        props.align = 'center';
        break;
      case 'bottom':
        props.verticalAlign = 'bottom';
        props.align = 'center';
        break;
    }
    return props;
  };

  const getLineDashArray = (style: string) => {
    if (style === 'dashed') return '5 5';
    if (style === 'dotted') return '2 2';
    return undefined;
  };

  const numMaterials = materials.length;
  const bottomPadding = Math.max(rangeY * 0.4, (numMaterials * tickYStep) + (rangeY * 0.15));

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800">{file.name}</h3>
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 p-1 rounded-lg mr-2">
            <button
              onClick={() => setInteractionMode('zoom')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${interactionMode === 'zoom' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              title="Zoom Mode"
            >
              <ZoomIn className="w-4 h-4" />
              <span className="hidden sm:inline">Zoom</span>
            </button>
            <button
              onClick={() => setInteractionMode('adjust')}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${interactionMode === 'adjust' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
              title="Refine Y_cal Mode"
            >
              <Edit3 className="w-4 h-4" />
              <span className="hidden sm:inline">Refine</span>
            </button>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${showSettings ? 'bg-gray-200 text-gray-800' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
          >
            <Settings2 className="w-4 h-4" />
            <span>Settings</span>
          </button>
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Download PNG</span>
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Axis Settings */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 border-b pb-1">Axis & Layout</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-1">2θ Step Size</label>
              <input 
                type="number" 
                value={settings.xStepSize} 
                onChange={e => onUpdateSettings({ xStepSize: Number(e.target.value) || 1 })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
                min="0.1" step="1"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Diff Curve Offset Ratio</label>
              <input 
                type="number" 
                value={settings.diffOffsetRatio} 
                onChange={e => onUpdateSettings({ diffOffsetRatio: Number(e.target.value) })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
                min="0" max="1" step="0.05"
              />
            </div>
            <div className="flex items-center space-x-2 pt-2">
              <input 
                type="checkbox" 
                id="showFrame"
                checked={settings.showFrame} 
                onChange={e => onUpdateSettings({ showFrame: e.target.checked })}
                className="rounded text-blue-600 w-4 h-4"
              />
              <label htmlFor="showFrame" className="text-sm text-gray-600">Show Plot Frame</label>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Legend Position</label>
              <select 
                value={settings.legendPosition}
                onChange={e => onUpdateSettings({ legendPosition: e.target.value as any })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
              >
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top">Top Center</option>
                <option value="bottom">Bottom Center</option>
              </select>
            </div>
          </div>

          {/* Exp Line Settings */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 border-b pb-1">Experimental Curve (Y_obs)</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Line Style</label>
              <select 
                value={settings.expLineStyle}
                onChange={e => onUpdateSettings({ expLineStyle: e.target.value as any })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
              >
                <option value="none">None (Scatter only)</option>
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Line Width</label>
              <input 
                type="number" 
                value={settings.expLineWidth} 
                onChange={e => onUpdateSettings({ expLineWidth: Number(e.target.value) })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
                min="0" step="0.5"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Dot Size</label>
              <input 
                type="number" 
                value={settings.expDotSize} 
                onChange={e => onUpdateSettings({ expDotSize: Number(e.target.value) })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
                min="0" step="0.5"
              />
            </div>
          </div>

          {/* Calc Line Settings */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 border-b pb-1">Calculated Curve (Y_cal)</h4>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Line Style</label>
              <select 
                value={settings.calcLineStyle}
                onChange={e => onUpdateSettings({ calcLineStyle: e.target.value as any })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
              >
                <option value="solid">Solid</option>
                <option value="dashed">Dashed</option>
                <option value="dotted">Dotted</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Line Width</label>
              <input 
                type="number" 
                value={settings.calcLineWidth} 
                onChange={e => onUpdateSettings({ calcLineWidth: Number(e.target.value) })}
                className="w-full rounded border-gray-300 px-2 py-1 text-sm border bg-white"
                min="0" step="0.5"
              />
            </div>
          </div>
        </div>
      )}
      
      <div className="text-sm text-gray-500 mb-2 flex justify-between">
        <span>
          {interactionMode === 'zoom' 
            ? 'Tip: Click and drag on the chart to zoom in.' 
            : 'Tip: Click and drag on the chart to manually adjust the Calculated Curve (Y_cal).'}
        </span>
        {(file.displayRange[0] > file.minTheta || file.displayRange[1] < file.maxTheta) && (
          <button onClick={zoomOut} className="text-blue-600 hover:underline font-medium">Reset Zoom</button>
        )}
      </div>

      <div 
        ref={plotRef} 
        className={`w-full h-[350px] bg-white p-2 ${settings.showFrame ? 'border-2 border-black' : ''} ${interactionMode === 'adjust' ? 'cursor-crosshair' : ''}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={plotData}
            margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="twoTheta" 
              type="number" 
              domain={file.displayRange} 
              ticks={ticks}
              label={{ value: '2θ (degree)', position: 'insideBottom', offset: -20, fontWeight: 'bold' }} 
              tick={{ fontWeight: 'bold', fontSize: 14 }}
              allowDataOverflow
            />
            <YAxis 
              domain={[domainYMin, domainYMax]} 
              label={{ value: 'Intensity (a.u.)', angle: -90, position: 'insideLeft', fontWeight: 'bold', offset: 0 }}
              tick={false}
              axisLine={{ strokeWidth: 2 }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              labelFormatter={(label) => `2θ: ${Number(label).toFixed(3)}°`}
              formatter={(value: number, name: string) => [value.toFixed(2), name]}
            />
            <Legend 
              {...getLegendProps()}
              iconType="plainline"
            />
            
            <ReferenceLine y={diffOffset} stroke="blue" strokeOpacity={0.5} strokeWidth={0.5} />

            {/* Difference Curve */}
            <Line 
              type="monotone" 
              dataKey="diffShifted" 
              stroke="blue" 
              dot={false} 
              strokeWidth={1.2} 
              name="Y_obs - Y_cal" 
              isAnimationActive={false}
            />
            
            {/* Experimental Scatter */}
            <Line 
              type="monotone" 
              dataKey="exp" 
              stroke={settings.expLineStyle !== 'none' ? 'black' : 'none'} 
              strokeWidth={settings.expLineWidth}
              strokeDasharray={getLineDashArray(settings.expLineStyle)}
              dot={settings.expDotSize > 0 ? { stroke: 'black', fill: 'none', strokeWidth: 1.5, r: settings.expDotSize } : false} 
              activeDot={{ r: settings.expDotSize + 2, fill: 'black' }}
              name="Y_obs" 
              isAnimationActive={false}
            />

            {/* Calculated Curve */}
            <Line 
              type="monotone" 
              dataKey="calc" 
              stroke="red" 
              dot={false} 
              strokeWidth={interactionMode === 'adjust' ? settings.calcLineWidth + 1 : settings.calcLineWidth} 
              strokeDasharray={getLineDashArray(settings.calcLineStyle)}
              name="Y_cal" 
              isAnimationActive={false}
              activeDot={interactionMode === 'adjust' ? { r: 5, fill: 'red', stroke: 'white', strokeWidth: 2 } : false}
            />

            {/* Dynamic Material Peaks */}
            {materials.map((mat, matIdx) => {
              const color = MATERIAL_COLORS[matIdx % MATERIAL_COLORS.length];
              const tickY = tickYBase - (matIdx * tickYStep);
              const visiblePeaks = mat.standardPeaks.filter(p => p >= file.displayRange[0] && p <= file.displayRange[1]);
              
              return (
                <React.Fragment key={`mat-${matIdx}`}>
                  {/* Dummy line for legend */}
                  <Line 
                    type="monotone" 
                    dataKey={`dummy-${matIdx}`} 
                    stroke={color} 
                    strokeWidth={2} 
                    name={mat.name} 
                    dot={false} 
                    isAnimationActive={false} 
                  />
                  
                  {visiblePeaks.map((pos, i) => (
                    <ReferenceDot 
                      key={`peak-${matIdx}-${i}`} 
                      x={pos} 
                      y={tickY} 
                      r={0} 
                      shape={(props: any) => {
                        const { cx, cy } = props;
                        return <line x1={cx} y1={cy - 10} x2={cx} y2={cy + 10} stroke={color} strokeWidth={2} />;
                      }}
                    />
                  ))}
                </React.Fragment>
              );
            })}

            {refAreaLeft && refAreaRight ? (
              <ReferenceArea x1={refAreaLeft} x2={refAreaRight} strokeOpacity={0.3} fill="#8884d8" fillOpacity={0.3} />
            ) : null}
            
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
