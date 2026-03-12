import { GeminiAnalysisResult, MaterialAnalysis } from '../services/geminiService';

export interface XRDDataPoint {
  twoTheta: number;
  exp: number;
  calc: number;
  bkg: number;
  diff: number;
}

export interface PlotSettings {
  xStepSize: number;
  diffOffsetRatio: number;
  showFrame: boolean;
  legendPosition: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top' | 'bottom';
  expLineStyle: 'solid' | 'dashed' | 'dotted' | 'none';
  expLineWidth: number;
  expDotSize: number;
  calcLineStyle: 'solid' | 'dashed' | 'dotted';
  calcLineWidth: number;
}

export interface ParsedFile {
  name: string;
  data: XRDDataPoint[];
  observedPeaks: number[];
  minTheta: number;
  maxTheta: number;
  displayRange: [number, number];
  plotSettings: PlotSettings;
  geminiResults?: GeminiAnalysisResult;
  approvedMaterials: MaterialAnalysis[];
}

export function parseCIF(content: string, filename: string): ParsedFile {
  const lines = content.split('\n');
  const data: XRDDataPoint[] = [];
  
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) continue;
    
    // Check if line starts with a digit or a dot
    if (/^[\d.]/.test(stripped)) {
      const parts = stripped.split(/\s+/);
      if (parts.length >= 4) {
        const twoTheta = parseFloat(parts[0]);
        const exp = parseFloat(parts[1]);
        const calc = parseFloat(parts[2]);
        const bkg = parseFloat(parts[3]);
        
        if (!isNaN(twoTheta) && !isNaN(exp) && !isNaN(calc) && !isNaN(bkg)) {
          data.push({
            twoTheta,
            exp,
            calc,
            bkg,
            diff: exp - calc
          });
        }
      }
    }
  }
  
  // Simple peak finder (local maximum with threshold)
  const findPeaks = (arr: number[], threshold: number, distance: number = 5) => {
    const peaks: number[] = [];
    for (let i = 1; i < arr.length - 1; i++) {
      if (arr[i] > threshold && arr[i] > arr[i-1] && arr[i] > arr[i+1]) {
        if (peaks.length === 0 || (i - peaks[peaks.length - 1]) >= distance) {
          peaks.push(i);
        } else if (arr[i] > arr[peaks[peaks.length - 1]]) {
          peaks[peaks.length - 1] = i;
        }
      }
    }
    return peaks;
  };
  
  // Extract observed peaks from the calculated signal (minus background)
  const signal = data.map(d => Math.max(0, d.calc - d.bkg));
  const maxSignal = signal.length > 0 ? Math.max(...signal) : 0;
  const threshold = maxSignal * 0.05;
  
  const peakIndices = findPeaks(signal, threshold, 5);
  const observedPeaks = peakIndices
    .sort((a, b) => signal[b] - signal[a])
    .slice(0, 15) // Take top 15 peaks to avoid overwhelming the prompt
    .map(i => data[i].twoTheta)
    .sort((a, b) => a - b);
  
  const minTheta = data.length > 0 ? data[0].twoTheta : 0;
  const maxTheta = data.length > 0 ? data[data.length - 1].twoTheta : 0;
  
  // Default display range (10 to 60, or bounded by actual data)
  const defaultMin = Math.max(minTheta, 10);
  const defaultMax = Math.min(maxTheta, 60);
  
  return {
    name: filename,
    data,
    observedPeaks,
    minTheta,
    maxTheta,
    displayRange: [defaultMin, defaultMax],
    plotSettings: {
      xStepSize: 5,
      diffOffsetRatio: 0.30,
      showFrame: true,
      legendPosition: 'top-right',
      expLineStyle: 'none',
      expLineWidth: 1.5,
      expDotSize: 3,
      calcLineStyle: 'solid',
      calcLineWidth: 2,
    },
    approvedMaterials: []
  };
}
