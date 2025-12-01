import React from 'react';

// PDF Report Generator for Battery Pack Simulation Results
// This component generates a comprehensive PDF report including pack info, drive cycle details,
// initial conditions, and simulation results with charts

interface ReportData {
  simulationId: string;
  packInfo: {
    cellDetails: {
      formFactor: string;
      dimensions: any;
      capacity: number;
      voltage: { max: number; min: number };
      mass: number;
    };
    packDetails: {
      electrical: any;
      mechanical: any;
      commercial: any;
    };
  };
  driveCycleInfo: {
    name: string;
    duration: number;
    frequency: number;
  };
  initialConditions: {
    default: {
      temperature: number;
      soc: number;
      soh: number;
      dcir: number;
    };
    varying?: Array<{
      cellIds: string[];
      temp: number;
      soc: number;
      soh: number;
      dcir: number;
    }>;
  };
  simulationResults: {
    summary: {
      end_soc: number;
      max_temp: number;
      capacity_fade: number;
    };
    total_points: number;
    data: Array<{
      time: number;
      voltage?: number;
      current?: number;
      soc?: number;
      temp?: number;
      qgen?: number;
    }>;
  };
}

export async function generatePDFReport(data: ReportData): Promise<void> {
  // Dynamic import to avoid bundling issues
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable');
  
  const doc = new jsPDF() as any;
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  // Helper function to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Helper to add section header
  const addSectionHeader = (title: string) => {
    checkPageBreak(15);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(37, 99, 235); // Blue color
    doc.text(title, margin, yPos);
    yPos += 3;
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');
  };

  // ========== TITLE PAGE ==========
  doc.setFontSize(24);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text('Battery Pack Simulation Report', pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100, 100, 100);
  doc.setFont(undefined, 'normal');
  doc.text(`Simulation ID: ${data.simulationId}`, pageWidth / 2, 75, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 85, { align: 'center' });
  
  // Add decorative line
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(1);
  doc.line(margin, 100, pageWidth - margin, 100);
  
  doc.addPage();
  yPos = 20;

  // ========== 1. PACK INFORMATION ==========
  addSectionHeader('1. Pack Information');
  
  // Cell Details Subsection
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Cell Details', margin, yPos);
  yPos += 8;
  
  const cellData = [
    ['Form Factor', data.packInfo.cellDetails.formFactor],
    ['Capacity', `${data.packInfo.cellDetails.capacity} Ah`],
    ['Max Voltage', `${data.packInfo.cellDetails.voltage.max} V`],
    ['Min Voltage', `${data.packInfo.cellDetails.voltage.min} V`],
    ['Cell Mass', `${(data.packInfo.cellDetails.mass * 1000).toFixed(2)} g`],
  ];
  
  // Add dimensions based on form factor
  const dims = data.packInfo.cellDetails.dimensions;
  if (data.packInfo.cellDetails.formFactor === 'cylindrical') {
    cellData.push(['Radius', `${dims.radius} mm`]);
    cellData.push(['Height', `${dims.height} mm`]);
  } else {
    cellData.push(['Length', `${dims.length} mm`]);
    cellData.push(['Width', `${dims.width} mm`]);
    cellData.push(['Height', `${dims.height} mm`]);
  }

  doc.autoTable({
    startY: yPos,
    head: [['Property', 'Value']],
    body: cellData,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });
  
  yPos = doc.lastAutoTable.finalY + 10;
  checkPageBreak(60);

  // Pack Details Subsection
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Pack Configuration', margin, yPos);
  yPos += 8;

  const elec = data.packInfo.packDetails.electrical;
  const mech = data.packInfo.packDetails.mechanical;
  const comm = data.packInfo.packDetails.commercial;

  const packData = [
    ['Series Cells', elec.nSeries],
    ['Parallel Cells', elec.nParallel],
    ['Total Cells', elec.nTotal],
    ['Nominal Voltage', `${elec.packNominalVoltage?.toFixed(2)} V`],
    ['Pack Capacity', `${elec.packCapacity?.toFixed(2)} Ah`],
    ['Pack Energy', `${elec.packEnergyWh?.toFixed(2)} Wh`],
    ['Total Weight', `${mech.totalPackWeight?.toFixed(3)} kg`],
    ['Pack Volume', `${mech.totalPackVolume?.toFixed(6)} m³`],
    ['Energy Density (Gravimetric)', `${mech.energyDensityGravimetric?.toFixed(2)} Wh/kg`],
    ['Energy Density (Volumetric)', `${mech.energyDensityVolumetric?.toFixed(2)} Wh/L`],
    ['Total Cost', `$${comm.totalPackCost?.toFixed(2)}`],
    ['Cost per kWh', `$${comm.costPerKwh?.toFixed(2)}/kWh`],
  ];

  doc.autoTable({
    startY: yPos,
    head: [['Property', 'Value']],
    body: packData,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // ========== 2. DRIVE CYCLE INFORMATION ==========
  checkPageBreak(50);
  addSectionHeader('2. Drive Cycle Information');

  const cycleData = [
    ['Drive Cycle Name', data.driveCycleInfo.name],
    ['Total Duration', `${data.driveCycleInfo.duration} seconds`],
    ['Simulation Frequency', `${data.driveCycleInfo.frequency} Hz`],
  ];

  doc.autoTable({
    startY: yPos,
    head: [['Property', 'Value']],
    body: cycleData,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // ========== 3. INITIAL CELL CONDITIONS ==========
  checkPageBreak(80);
  addSectionHeader('3. Initial Cell Conditions');

  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Default Conditions (All Cells)', margin, yPos);
  yPos += 8;

  const defaultConditions = [
    ['Temperature', `${data.initialConditions.default.temperature} K`],
    ['State of Charge (SOC)', `${data.initialConditions.default.soc}%`],
    ['State of Health (SOH)', data.initialConditions.default.soh],
    ['DCIR Aging Factor', data.initialConditions.default.dcir],
  ];

  doc.autoTable({
    startY: yPos,
    head: [['Parameter', 'Value']],
    body: defaultConditions,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // Varying Conditions
  if (data.initialConditions.varying && data.initialConditions.varying.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Cell-Specific Conditions', margin, yPos);
    yPos += 8;

    data.initialConditions.varying.forEach((condition, index) => {
      checkPageBreak(40);
      
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text(`Condition ${index + 1}`, margin, yPos);
      yPos += 6;

      const varyingData = [
        ['Affected Cells', condition.cellIds.join(', ')],
        ['Temperature', `${condition.temp} K`],
        ['SOC', `${condition.soc}%`],
        ['SOH', condition.soh],
        ['DCIR Aging Factor', condition.dcir],
      ];

      doc.autoTable({
        startY: yPos,
        body: varyingData,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: margin + 5, right: margin },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
        },
      });

      yPos = doc.lastAutoTable.finalY + 8;
    });
  }

  yPos += 5;

  // ========== 4. SIMULATION RESULTS ==========
  doc.addPage();
  yPos = 20;
  addSectionHeader('4. Simulation Results');

  // KPI Summary
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Key Performance Indicators', margin, yPos);
  yPos += 8;

  const kpiData = [
    ['Final State of Charge', `${(data.simulationResults.summary.end_soc * 100).toFixed(1)}%`],
    ['Maximum Temperature', `${data.simulationResults.summary.max_temp.toFixed(1)}°C`],
    ['Capacity Fade', `${data.simulationResults.summary.capacity_fade.toFixed(2)}%`],
    ['Total Data Points', data.simulationResults.total_points.toLocaleString()],
  ];

  doc.autoTable({
    startY: yPos,
    head: [['Metric', 'Value']],
    body: kpiData,
    theme: 'grid',
    headStyles: { fillColor: [34, 197, 94], fontSize: 10 },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: margin, right: margin },
  });

  yPos = doc.lastAutoTable.finalY + 15;

  // Chart Placeholders
  checkPageBreak(100);
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('Simulation Charts', margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(100, 100, 100);
  
  // Sample data statistics
  const voltages = data.simulationResults.data.map(d => d.voltage).filter(v => v !== undefined);
  const currents = data.simulationResults.data.map(d => d.current).filter(c => c !== undefined);
  const socs = data.simulationResults.data.map(d => d.soc).filter(s => s !== undefined);

  const chartStats = [
    ['Voltage Range', voltages.length > 0 ? `${Math.min(...voltages).toFixed(2)} - ${Math.max(...voltages).toFixed(2)} V` : 'N/A'],
    ['Current Range', currents.length > 0 ? `${Math.min(...currents).toFixed(2)} - ${Math.max(...currents).toFixed(2)} A` : 'N/A'],
    ['SOC Range', socs.length > 0 ? `${(Math.min(...socs) * 100).toFixed(1)} - ${(Math.max(...socs) * 100).toFixed(1)}%` : 'N/A'],
  ];

  doc.autoTable({
    startY: yPos,
    body: chartStats,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 2 },
    margin: { left: margin, right: margin },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
    },
  });

  yPos = doc.lastAutoTable.finalY + 10;

  // Add note about charts
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Note: Detailed interactive charts are available in the web interface.',
    margin,
    yPos
  );
  doc.text(
    'For full data analysis, please export the CSV file.',
    margin,
    yPos + 5
  );

  // Footer on last page
  yPos = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Report generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

  // Save the PDF
  doc.save(`simulation-report-${data.simulationId}.pdf`);
}

// React Component Wrapper
export default function PDFReportGenerator() {
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerateSample = async () => {
    setIsGenerating(true);
    
    // Sample data for demonstration
    const sampleData: ReportData = {
      simulationId: 'demo-12345',
      packInfo: {
        cellDetails: {
          formFactor: 'cylindrical',
          dimensions: { radius: 21, height: 70 },
          capacity: 5.0,
          voltage: { max: 4.2, min: 2.5 },
          mass: 0.07,
        },
        packDetails: {
          electrical: {
            nSeries: 96,
            nParallel: 3,
            nTotal: 288,
            packNominalVoltage: 355.2,
            packCapacity: 15.0,
            packEnergyWh: 5328.0,
          },
          mechanical: {
            totalPackWeight: 20.16,
            totalPackVolume: 0.0156,
            energyDensityGravimetric: 264.29,
            energyDensityVolumetric: 341538.46,
          },
          commercial: {
            totalPackCost: 864.0,
            costPerKwh: 162.16,
          },
        },
      },
      driveCycleInfo: {
        name: 'WLTP Class 3',
        duration: 1800,
        frequency: 1,
      },
      initialConditions: {
        default: {
          temperature: 298.15,
          soc: 100,
          soh: 1.0,
          dcir: 1.0,
        },
        varying: [
          {
            cellIds: ['R1C1L1', 'R1C2L1'],
            temp: 308.15,
            soc: 80,
            soh: 0.95,
            dcir: 1.1,
          },
        ],
      },
      simulationResults: {
        summary: {
          end_soc: 0.65,
          max_temp: 32.5,
          capacity_fade: 2.3,
        },
        total_points: 1800,
        data: Array.from({ length: 100 }, (_, i) => ({
          time: i * 18,
          voltage: 350 + Math.random() * 50,
          current: -20 + Math.random() * 40,
          soc: 1 - (i / 100) * 0.35,
          temp: 25 + Math.random() * 7.5,
          qgen: Math.random() * 500,
        })),
      },
    };

    try {
      await generatePDFReport(sampleData);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <svg
              className="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900">
            Battery Simulation PDF Report Generator
          </h1>
          
          <p className="text-gray-600">
            Generate comprehensive PDF reports for battery pack simulation results.
            Includes pack information, drive cycle details, initial conditions, and simulation results.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
            <h3 className="font-semibold text-blue-900 mb-2">Report Includes:</h3>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>✓ Cell and pack configuration details</li>
              <li>✓ Drive cycle information</li>
              <li>✓ Initial cell conditions (default & cell-specific)</li>
              <li>✓ Simulation results with KPIs</li>
              <li>✓ Data statistics and charts summary</li>
            </ul>
          </div>
          
          <button
            onClick={handleGenerateSample}
            disabled={isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Generating PDF...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Generate Sample PDF Report
              </>
            )}
          </button>
          
          <p className="text-xs text-gray-500">
            This will download a sample PDF report with demonstration data
          </p>
        </div>
        
        <div className="mt-8 border-t pt-6">
          <h3 className="font-semibold text-gray-900 mb-3">Integration Instructions:</h3>
          <div className="bg-gray-50 rounded-lg p-4 text-left">
            <code className="text-xs text-gray-800 block whitespace-pre-wrap">
{`// Import the function
import { generatePDFReport } from './pdf-report-generator'

// In your handleReport function:
const handleReport = async () => {
  const reportData = {
    simulationId: simulationId,
    packInfo: { /* your pack data */ },
    driveCycleInfo: { /* your drive cycle data */ },
    initialConditions: { /* your initial conditions */ },
    simulationResults: { /* your results data */ }
  }
  
  await generatePDFReport(reportData)
}`}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}