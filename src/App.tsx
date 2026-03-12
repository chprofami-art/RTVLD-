import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, X, AlertCircle, Sparkles, Loader2, CheckCircle2 } from 'lucide-react';
import { parseCIF, ParsedFile, PlotSettings } from './utils/parser';
import XRDPlot from './components/XRDPlot';
import { analyzeXRD, MaterialAnalysis } from './services/geminiService';

export default function App() {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [materialsInput, setMaterialsInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    setMaterialsInput('');
    setError(null);
  }, [activeFileIndex]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = event.target.files;
    if (!uploadedFiles) return;

    setError(null);
    const newParsedFiles: ParsedFile[] = [];
    let processedCount = 0;

    Array.from(uploadedFiles).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = parseCIF(content, file.name);
          if (parsed.data.length > 0) {
            newParsedFiles.push(parsed);
          } else {
            console.warn(`No valid data found in ${file.name}`);
          }
        } catch (err) {
          console.error(`Error parsing ${file.name}:`, err);
          setError(`Failed to parse ${file.name}. Ensure it's a valid CIF/XY file.`);
        }
        
        processedCount++;
        if (processedCount === uploadedFiles.length) {
          setFiles(prev => {
            const updated = [...prev, ...newParsedFiles];
            if (updated.length > 0 && activeFileIndex === null) {
              setActiveFileIndex(0);
            }
            return updated;
          });
        }
      };
      reader.readAsText(file);
    });
  }, [activeFileIndex]);

  const removeFile = (index: number) => {
    setFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (updated.length === 0) {
        setActiveFileIndex(null);
      } else if (activeFileIndex === index) {
        setActiveFileIndex(0);
      } else if (activeFileIndex !== null && activeFileIndex > index) {
        setActiveFileIndex(activeFileIndex - 1);
      }
      return updated;
    });
  };

  const updateFileRange = (index: number, min: number, max: number) => {
    setFiles(prev => {
      const updated = [...prev];
      const file = updated[index];
      updated[index] = { ...file, displayRange: [min, max] };
      return updated;
    });
  };

  const updateFileSettings = (index: number, settings: Partial<PlotSettings>) => {
    setFiles(prev => {
      const updated = [...prev];
      const file = updated[index];
      updated[index] = { ...file, plotSettings: { ...file.plotSettings, ...settings } };
      return updated;
    });
  };

  const updateFileDataPoint = useCallback((index: number, twoTheta: number, newCalc: number) => {
    setFiles(prev => {
      const updated = [...prev];
      const file = updated[index];
      const newData = [...file.data];
      
      const pointIndex = newData.findIndex(d => d.twoTheta === twoTheta);
      if (pointIndex !== -1) {
        const point = newData[pointIndex];
        newData[pointIndex] = {
          ...point,
          calc: newCalc,
          diff: point.exp - newCalc
        };
        updated[index] = { ...file, data: newData };
      }
      return updated;
    });
  }, []);

  const handleRenameFile = (index: number, newName: string) => {
    setFiles(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], name: newName };
      return updated;
    });
  };

  const toggleApproveMaterial = (index: number, material: MaterialAnalysis) => {
    setFiles(prev => {
      const updated = [...prev];
      const file = updated[index];
      const isApproved = file.approvedMaterials.some(m => m.name === material.name);
      
      let newApproved;
      if (isApproved) {
        newApproved = file.approvedMaterials.filter(m => m.name !== material.name);
      } else {
        newApproved = [...file.approvedMaterials, material];
      }
      
      updated[index] = { ...file, approvedMaterials: newApproved };
      return updated;
    });
  };

  const handleAnalyze = async () => {
    if (activeFileIndex === null) return;
    const file = files[activeFileIndex];
    const materialsList = materialsInput.split(',').map(s => s.trim()).filter(Boolean);
    
    if (materialsList.length === 0) {
      setError("Please enter at least one material name.");
      return;
    }
    
    setIsAnalyzing(true);
    setError(null);
    try {
      const results = await analyzeXRD(materialsList, file.observedPeaks);
      setFiles(prev => {
        const updated = [...prev];
        updated[activeFileIndex] = { ...file, geminiResults: results };
        return updated;
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to analyze with Gemini.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">XRD Analyzer</h1>
          <div className="text-sm text-gray-500">Rietveld Refinement Viewer</div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Area */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold whitespace-nowrap mr-4">Upload Data</h2>
              {activeFileIndex !== null && files[activeFileIndex] && (
                <input
                  type="text"
                  value={files[activeFileIndex].name}
                  onChange={(e) => handleRenameFile(activeFileIndex, e.target.value)}
                  className="text-sm border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent w-full text-right text-blue-600 truncate transition-colors"
                  placeholder="Sample Name"
                  title="Edit Sample Name"
                />
              )}
            </div>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                <p className="text-xs text-gray-500">.CIF or .XY files</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                multiple 
                accept=".cif,.xy,.txt" 
                onChange={handleFileUpload} 
              />
            </label>
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md flex items-start text-sm">
                <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-3 px-2">Uploaded Files</h2>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {files.map((file, idx) => (
                  <div 
                    key={`${file.name}-${idx}`}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      activeFileIndex === idx 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                    onClick={() => setActiveFileIndex(idx)}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <FileText className={`w-5 h-5 flex-shrink-0 ${activeFileIndex === idx ? 'text-blue-500' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded-md hover:bg-gray-200 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Plot Area */}
        <div className="lg:col-span-3">
          {activeFileIndex !== null && files[activeFileIndex] ? (
            <div className="space-y-4">
              {/* Range Controls */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min 2θ</label>
                  <input 
                    type="number" 
                    value={files[activeFileIndex].displayRange[0]} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) updateFileRange(activeFileIndex, val, files[activeFileIndex].displayRange[1]);
                    }}
                    className="block w-24 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max 2θ</label>
                  <input 
                    type="number" 
                    value={files[activeFileIndex].displayRange[1]} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) updateFileRange(activeFileIndex, files[activeFileIndex].displayRange[0], val);
                    }}
                    className="block w-24 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    step="1"
                  />
                </div>
                <div className="pb-2 text-sm text-gray-500">
                  Available range: {files[activeFileIndex].minTheta.toFixed(1)}° - {files[activeFileIndex].maxTheta.toFixed(1)}°
                </div>
              </div>

              <XRDPlot 
                file={files[activeFileIndex]} 
                onUpdateRange={(min, max) => updateFileRange(activeFileIndex, min, max)}
                onUpdateSettings={(settings) => updateFileSettings(activeFileIndex, settings)}
                onUpdateDataPoint={(twoTheta, newCalc) => updateFileDataPoint(activeFileIndex, twoTheta, newCalc)}
              />
              
              {/* Gemini Analysis Section */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mt-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Sparkles className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Phase Identification (Gemini AI)</h3>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Materials (comma-separated)
                    </label>
                    <input 
                      type="text" 
                      value={materialsInput}
                      onChange={(e) => setMaterialsInput(e.target.value)}
                      placeholder="e.g., Quartz, Rutile, Calcite"
                      className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !materialsInput.trim()}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    <span>{isAnalyzing ? 'Analyzing...' : 'Verify Phases'}</span>
                  </button>
                </div>

                {files[activeFileIndex].geminiResults && (
                  <div className="mt-6 space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-900">
                      <strong className="block mb-1">Overall Analysis:</strong>
                      {files[activeFileIndex].geminiResults.overallAnalysis}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {files[activeFileIndex].geminiResults.materials.map((mat, idx) => {
                        const isApproved = files[activeFileIndex].approvedMaterials.some(m => m.name === mat.name);
                        return (
                          <div key={idx} className={`p-4 border rounded-lg transition-colors ${isApproved ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-gray-800 flex items-center">
                                {mat.name}
                                {isApproved && <CheckCircle2 className="w-4 h-4 text-blue-600 ml-2" />}
                              </h4>
                              <div className="flex items-center space-x-2">
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                  mat.matchConfidence.toLowerCase() === 'high' ? 'bg-green-100 text-green-800' :
                                  mat.matchConfidence.toLowerCase() === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }`}>
                                  {mat.matchConfidence} Match
                                </span>
                                <button 
                                  onClick={() => toggleApproveMaterial(activeFileIndex, mat)}
                                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${
                                    isApproved 
                                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {isApproved ? 'Remove' : 'Add to Plot'}
                                </button>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{mat.analysis}</p>
                            <div className="text-xs text-gray-500">
                              <strong>Standard Peaks:</strong> {mat.standardPeaks.map(p => p.toFixed(1)).join(', ')}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Approved Materials List */}
                {files[activeFileIndex].approvedMaterials.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Phases Currently on Plot:</h4>
                    <div className="flex flex-wrap gap-2">
                      {files[activeFileIndex].approvedMaterials.map((mat, idx) => (
                        <span key={idx} className="inline-flex items-center bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1.5 rounded-full border border-blue-200">
                          {mat.name}
                          <button 
                            onClick={() => toggleApproveMaterial(activeFileIndex, mat)}
                            className="ml-2 text-blue-500 hover:text-blue-800 focus:outline-none"
                            title="Remove from plot"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="h-[600px] bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <FileText className="w-16 h-16 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">No file selected</p>
              <p className="text-sm">Upload a CIF file to view the Rietveld plot</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
