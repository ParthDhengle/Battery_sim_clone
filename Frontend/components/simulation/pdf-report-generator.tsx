import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportData {
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

const ENABLE_LIVE_PREVIEW = true;

let previewWindow: Window | null = null;
let currentPreviewUrl: string | null = null;

const PRIMARY_COLOR = { r: 14, g: 88, b: 165 } as const;
const ACCENT_COLOR = { r: 92, g: 152, b: 242 } as const;
const SUCCESS_COLOR = { r: 34, g: 197, b: 94 } as const;
const WARNING_COLOR = { r: 251, g: 146, b: 60 } as const;

export async function generatePDFReport(data: ReportData): Promise<void> {
  const doc = new jsPDF();
  let yPos = 0;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;

  const addCoverPage = () => {
    doc.setFillColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    doc.setFillColor(255, 255, 255, 0.1);
    doc.circle(pageWidth - 30, 40, 60, "F");
    doc.circle(40, pageHeight - 50, 80, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(40);
    doc.setFont("helvetica", "bold");
    const title = "BATTERY PACK";
    doc.text(title, pageWidth / 2, 80, { align: "center" });

    doc.setFontSize(36);
    doc.text("SIMULATION REPORT", pageWidth / 2, 100, { align: "center" });

    doc.setLineWidth(1);
    doc.setDrawColor(255, 255, 255);
    const lineY = 115;
    doc.line(pageWidth / 2 - 50, lineY, pageWidth / 2 + 50, lineY);

    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255, 0.9);
    doc.text(`Simulation ID: ${data.simulationId}`, pageWidth / 2, 140, { align: "center" });

    const infoBoxY = 165;
    const boxWidth = 150;
    const boxHeight = 60;
    const boxX = (pageWidth - boxWidth) / 2;

    doc.setFillColor(255, 255, 255, 0.15);
    doc.roundedRect(boxX, infoBoxY, boxWidth, boxHeight, 5, 5, "F");

    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Report Details", pageWidth / 2, infoBoxY + 12, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const generateDate = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    doc.text(`Generated: ${generateDate}`, pageWidth / 2, infoBoxY + 25, { align: "center" });
    doc.text(`Drive Cycle: ${data.driveCycleInfo.name}`, pageWidth / 2, infoBoxY + 35, { align: "center" });
    doc.text(`Data Points: ${data.simulationResults.total_points.toLocaleString()}`, pageWidth / 2, infoBoxY + 45, {
      align: "center",
    });

    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255, 0.7);
    doc.text("YCS Battery Simulator", pageWidth / 2, pageHeight - 20, { align: "center" });
    doc.text("Professional Simulation & Analysis Platform", pageWidth / 2, pageHeight - 13, { align: "center" });
  };

  const addHeader = (pageTitle: string) => {
    doc.setFillColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    doc.rect(0, 0, pageWidth, 25, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(pageTitle, margin, 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`ID: ${data.simulationId}`, pageWidth - margin, 15, { align: "right" });

    yPos = 35;
  };

  const addFooter = (pageNum: number) => {
    const footerY = pageHeight - 15;

    doc.setDrawColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Battery Pack Simulation Report`, margin, footerY);
    doc.text(`Page ${pageNum}`, pageWidth - margin, footerY, { align: "right" });
  };

  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 30) {
      const currentPage = (doc as any).internal.getNumberOfPages();
      addFooter(currentPage);
      doc.addPage();
      yPos = 35;
      return true;
    }
    return false;
  };

  const addSection = (title: string) => {
    checkPageBreak(25);

    doc.setFillColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
    doc.roundedRect(margin - 5, yPos - 2, contentWidth + 10, 14, 3, 3, "F");

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(247,247,247);
    doc.text(`${title}`, margin, yPos + 8);

    yPos += 20;
  };

  const addSubSection = (title: string) => {
    checkPageBreak(15);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(title, margin, yPos);

    doc.setDrawColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b, 0.3);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos + 2, margin + 60, yPos + 2);

    yPos += 12;
  };

  const addKeyValuePair = (key: string, value: string, indent: number = 0) => {
    checkPageBreak(8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(key + ":", margin + indent, yPos);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    const keyWidth = doc.getTextWidth(key + ": ");
    doc.text(value, margin + indent + keyWidth, yPos);

    yPos += 7;
  };

  const addKpiCard = (x: number, y: number, width: number, height: number, label: string, value: string, subtext: string, color: { r: number; g: number; b: number }) => {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, width, height, 4, 4, "F");

    doc.setDrawColor(color.r, color.g, color.b, 0.3);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, y, width, height, 4, 4, "S");

    doc.setFillColor(color.r, color.g, color.b, 0.1);
    doc.roundedRect(x, y, width, 8, 4, 4, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(label, x + width / 2, y + 6, { align: "center" });

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(40, 40, 40);
    doc.text(value, x + width / 2, y + height / 2 + 3, { align: "center" });

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(subtext, x + width / 2, y + height - 5, { align: "center" });
  };

  const addTable = (head: string[][], body: any[][], options: any = {}) => {
    checkPageBreak(40);

    autoTable(doc, {
      head,
      body,
      startY: yPos,
      theme: "grid",
      headStyles: {
        fillColor: [PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
        halign: "left",
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [60, 60, 60],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: contentWidth * 0.4, fontStyle: "bold", textColor: [80, 80, 80] },
        1: { cellWidth: contentWidth * 0.6, halign: "left" },
      },
      margin: { left: margin, right: margin },
      tableWidth: "auto",
      ...options,
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  };

  const drawMiniChart = (x: number, y: number, width: number, height: number, dataPoints: number[], label: string, unit: string, color: { r: number; g: number; b: number }) => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.rect(x, y, width, height);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(label, x + 3, y + 7);

    if (dataPoints.length === 0) return;

    const chartAreaY = y + 12;
    const chartAreaHeight = height - 20;
    const maxVal = Math.max(...dataPoints);
    const minVal = Math.min(...dataPoints);
    const range = maxVal - minVal || 1;

    const step = width / (dataPoints.length - 1 || 1);

    doc.setDrawColor(color.r, color.g, color.b);
    doc.setLineWidth(1.2);

    for (let i = 0; i < dataPoints.length - 1; i++) {
      const x1 = x + i * step;
      const y1 = chartAreaY + chartAreaHeight - ((dataPoints[i] - minVal) / range) * chartAreaHeight;
      const x2 = x + (i + 1) * step;
      const y2 = chartAreaY + chartAreaHeight - ((dataPoints[i + 1] - minVal) / range) * chartAreaHeight;
      doc.line(x1, y1, x2, y2);
    }

    doc.setFillColor(color.r, color.g, color.b, 0.1);
    doc.rect(x, chartAreaY, width, chartAreaHeight, "F");

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Min: ${minVal.toFixed(2)}${unit}`, x + 3, y + height - 3);
    doc.text(`Max: ${maxVal.toFixed(2)}${unit}`, x + width - 3, y + height - 3, { align: "right" });
  };

  addCoverPage();

  doc.addPage();
  addHeader("Executive Summary");

  addSection("Key Performance Indicators");

  const cardWidth = (contentWidth - 10) / 3;
  const cardHeight = 35;
  const cardY = yPos;

  addKpiCard(
    margin,
    cardY,
    cardWidth,
    cardHeight,
    "Final State of Charge",
    `${(data.simulationResults.summary.end_soc * 100).toFixed(1)}%`,
    "Remaining capacity",
    SUCCESS_COLOR
  );

  addKpiCard(
    margin + cardWidth + 5,
    cardY,
    cardWidth,
    cardHeight,
    "Peak Temperature",
    `${data.simulationResults.summary.max_temp.toFixed(1)}°C`,
    "Thermal maximum",
    WARNING_COLOR
  );

  addKpiCard(
    margin + 2 * (cardWidth + 5),
    cardY,
    cardWidth,
    cardHeight,
    "Capacity Degradation",
    `${data.simulationResults.summary.capacity_fade.toFixed(3)}%`,
    "Total fade",
    ACCENT_COLOR
  );

  yPos = cardY + cardHeight + 20;

  addSection("Performance Charts");

  const simData = data.simulationResults.data;
  const sampleSize = Math.min(100, simData.length);
  const sampleStep = Math.floor(simData.length / sampleSize);

  const voltages = simData.filter((_, i) => i % sampleStep === 0).map((d) => d.voltage || 0);
  const currents = simData.filter((_, i) => i % sampleStep === 0).map((d) => d.current || 0);
  const socs = simData.filter((_, i) => i % sampleStep === 0).map((d) => (d.soc || 0) * 100);
  const temps = simData.filter((_, i) => i % sampleStep === 0).map((d) => d.temp || 25);

  const chartWidth = (contentWidth - 5) / 2;
  const chartHeight = 45;

  drawMiniChart(margin, yPos, chartWidth, chartHeight, voltages, "Voltage Profile", "V", ACCENT_COLOR);
  drawMiniChart(margin + chartWidth + 5, yPos, chartWidth, chartHeight, currents, "Current Profile", "A", PRIMARY_COLOR);

  yPos += chartHeight + 10;

  drawMiniChart(margin, yPos, chartWidth, chartHeight, socs, "State of Charge", "%", SUCCESS_COLOR);
  drawMiniChart(margin + chartWidth + 5, yPos, chartWidth, chartHeight, temps, "Temperature", "°C", WARNING_COLOR);

  yPos += chartHeight + 20;

  doc.addPage();
  addHeader("Battery Pack Configuration");

  addSection("Cell Specifications");

  const cell = data.packInfo.cellDetails;
  const cellBody: any[][] = [
    ["Form Factor", cell.formFactor],
    ["Nominal Capacity", `${cell.capacity.toFixed(2)} Ah`],
    ["Nominal Voltage", "3.7 V"],
    ["Voltage Range", `${cell.voltage.min} V – ${cell.voltage.max} V`],
    ["Cell Mass", `${(cell.mass * 1000).toFixed(1)} g`],
  ];

  if (cell.formFactor === "cylindrical") {
    cellBody.push(["Diameter", `${(cell.dimensions.radius * 2).toFixed(1)} mm`]);
    cellBody.push(["Height", `${cell.dimensions.height.toFixed(1)} mm`]);
  } else {
    cellBody.push(["Dimensions (L×W×H)", `${cell.dimensions.length} × ${cell.dimensions.width} × ${cell.dimensions.height} mm`]);
  }

  addTable([["Parameter", "Value"]], cellBody);

  addSection("Pack Configuration");

  const elec = data.packInfo.packDetails.electrical;
  const mech = data.packInfo.packDetails.mechanical;
  const comm = data.packInfo.packDetails.commercial;

  const packBody = [
    ["Configuration", `${elec.nSeries}S × ${elec.nParallel}P (Series × Parallel)`],
    ["Total Cells", elec.nTotal.toLocaleString()],
    ["Pack Nominal Voltage", `${elec.packNominalVoltage?.toFixed(1)} V`],
    ["Pack Capacity", `${elec.packCapacity?.toFixed(1)} Ah`],
    ["Total Energy", `${elec.packEnergyWh?.toFixed(0)} Wh (${(elec.packEnergyWh / 1000).toFixed(2)} kWh)`],
    ["Specific Energy", mech.energyDensityGravimetric ? `${mech.energyDensityGravimetric.toFixed(1)} Wh/kg` : "—"],
    ["Energy Density", mech.energyDensityVolumetric ? `${mech.energyDensityVolumetric.toFixed(0)} Wh/L` : "—"],
    ["Total Pack Weight", `${mech.totalPackWeight?.toFixed(2)} kg`],
    ["Estimated Cost", comm.totalPackCost ? `$${comm.totalPackCost.toFixed(0)}` : "—"],
  ];

  addTable([["Parameter", "Value"]], packBody);

  doc.addPage();
  addHeader("Simulation Parameters");

  addSection("Drive Cycle Information");

  addTable(
    [["Parameter", "Value"]],
    [
      ["Drive Cycle Name", data.driveCycleInfo.name],
      ["Total Duration", `${data.driveCycleInfo.duration.toLocaleString()} seconds (${(data.driveCycleInfo.duration / 3600).toFixed(2)} hours)`],
      ["Time Step Frequency", `${data.driveCycleInfo.frequency} Hz`],
    ]
  );

  addSection("Initial Cell Conditions");

  const def = data.initialConditions.default;

  addTable(
    [["Parameter", "Value"]],
    [
      ["Temperature", `${def.temperature.toFixed(1)} K (${(def.temperature - 273.15).toFixed(1)}°C)`],
      ["State of Charge (SOC)", `${def.soc}%`],
      ["State of Health (SOH)", `${def.soh.toFixed(3)} (${(def.soh * 100).toFixed(1)}%)`],
      ["DCIR Aging Factor", def.dcir.toFixed(2)],
    ]
  );

  if (data.initialConditions.varying && data.initialConditions.varying.length > 0) {
    addSubSection("Cell-Specific Variations");

    data.initialConditions.varying.forEach((v, i) => {
      checkPageBreak(35);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
      doc.text(`Variation Group ${i + 1}`, margin, yPos);
      yPos += 10;

      addTable(
        [["Parameter", "Value"]],
        [
          ["Affected Cells", v.cellIds.join(", ")],
          ["Temperature", `${v.temp} K (${(v.temp - 273.15).toFixed(1)}°C)`],
          ["SOC", `${v.soc}%`],
          ["SOH", v.soh.toFixed(3)],
          ["DCIR Factor", v.dcir.toFixed(2)],
        ]
      );
    });
  }

  doc.addPage();
  addHeader("Detailed Results");

  addSection("Simulation Statistics");

  const voltageData = simData.map((d) => d.voltage).filter((v): v is number => v !== undefined);
  const currentData = simData.map((d) => d.current).filter((v): v is number => v !== undefined);
  const socData = simData.map((d) => d.soc).filter((v): v is number => v !== undefined);
  const tempData = simData.map((d) => d.temp).filter((v): v is number => v !== undefined);

  const statsBody: any[][] = [
    ["Total Data Points", data.simulationResults.total_points.toLocaleString()],
    ["Voltage Range", voltageData.length ? `${Math.min(...voltageData).toFixed(2)} V – ${Math.max(...voltageData).toFixed(2)} V` : "—"],
    ["Current Range", currentData.length ? `${Math.min(...currentData).toFixed(1)} A – ${Math.max(...currentData).toFixed(1)} A` : "—"],
    ["SOC Range", socData.length ? `${(Math.min(...socData) * 100).toFixed(1)}% – ${(Math.max(...socData) * 100).toFixed(1)}%` : "—"],
    ["Temperature Range", tempData.length ? `${Math.min(...tempData).toFixed(1)}°C – ${Math.max(...tempData).toFixed(1)}°C` : "—"],
  ];

  addTable([["Metric", "Value"]], statsBody);

  addSection("Performance Analysis");

  checkPageBreak(50);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const analysis = [
    `The simulation processed ${data.simulationResults.total_points.toLocaleString()} data points over ${(data.driveCycleInfo.duration / 3600).toFixed(2)} hours of operation.`,
    ``,
    `The battery pack maintained a final state of charge of ${(data.simulationResults.summary.end_soc * 100).toFixed(1)}%, indicating ${data.simulationResults.summary.end_soc > 0.2 ? "adequate" : "low"} remaining capacity.`,
    ``,
    `Peak temperature reached ${data.simulationResults.summary.max_temp.toFixed(1)}°C, which is ${data.simulationResults.summary.max_temp > 45 ? "above recommended" : "within acceptable"} operating limits.`,
    ``,
    `Total capacity degradation of ${data.simulationResults.summary.capacity_fade.toFixed(3)}% was observed during this cycle.`,
  ];

  const lineHeight = 6;
  analysis.forEach((line) => {
    checkPageBreak(lineHeight);
    if (line === "") {
      yPos += lineHeight / 2;
    } else {
      const splitText = doc.splitTextToSize(line, contentWidth);
      doc.text(splitText, margin, yPos);
      yPos += splitText.length * lineHeight;
    }
  });

  yPos += 10;

  doc.addPage();
  addHeader("Conclusion");

  addSection("Report Summary");

  checkPageBreak(60);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const conclusion = [
    `This comprehensive battery pack simulation report provides detailed insights into the performance characteristics of a ${elec.nSeries}S${elec.nParallel}P configuration under the ${data.driveCycleInfo.name} drive cycle.`,
    ``,
    `The ${elec.nTotal}-cell pack demonstrated ${data.simulationResults.summary.end_soc > 0.3 ? "reliable" : "concerning"} performance with key metrics falling ${data.simulationResults.summary.max_temp < 50 && data.simulationResults.summary.capacity_fade < 1 ? "within" : "outside"} expected operational parameters.`,
    ``,
    `For optimal performance and longevity, it is recommended to:`,
    `• Maintain operating temperatures below 45°C`,
    `• Avoid deep discharge cycles (SOC < 20%)`,
    `• Monitor capacity fade trends over extended use`,
    `• Implement thermal management strategies if peak temperatures exceed 50°C`,
  ];

  conclusion.forEach((line) => {
    checkPageBreak(lineHeight);
    if (line === "") {
      yPos += lineHeight / 2;
    } else {
      const splitText = doc.splitTextToSize(line, contentWidth);
      doc.text(splitText, margin, yPos);
      yPos += splitText.length * lineHeight;
    }
  });

  yPos += 15;

  doc.setFillColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b, 0.05);
  doc.roundedRect(margin, yPos, contentWidth, 30, 3, 3, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PRIMARY_COLOR.r, PRIMARY_COLOR.g, PRIMARY_COLOR.b);
  doc.text("Report Generated By", margin + 5, yPos + 10);

  doc.setFontSize(14);
  doc.text("YCS Battery Simulator", margin + 5, yPos + 18);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), margin + 5, yPos + 25);

  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(i - 1);
  }

  const pdfBlob = doc.output("blob");
  const blobUrl = URL.createObjectURL(pdfBlob);

  if (ENABLE_LIVE_PREVIEW) {
    if (previewWindow && !previewWindow.closed) {
      previewWindow.location.href = blobUrl;
    } else {
      previewWindow = window.open(blobUrl, "battery-pdf-preview");
    }

    if (currentPreviewUrl) {
      const prevUrl = currentPreviewUrl;
      setTimeout(() => {
        URL.revokeObjectURL(prevUrl);
      }, 1000);
    }
    currentPreviewUrl = blobUrl;
    previewWindow?.focus();
  } else {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Battery_Simulation_Report_${data.simulationId}.pdf`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }
}
