import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import API_BASE_URL from '../config/api';
import {
  buildProposedSystemStatement,
  EQUIPMENT_CATEGORY_OPTIONS,
  emptyEquipmentCategories,
  formatEquipmentCategoriesLabels,
  normalizeEquipmentCategories
} from '../constants/equipmentCategories';
import { getNextBidQuoteNumber } from '../utils/bidQuoteSequence';
import { AlignedFormGrid, AlignedFormField } from './common/AlignedFormGrid';

/**
 * Company header block for generated bid PDFs (aligned with CHRISTIAN SECURITY SERVICES BID template).
 * Logo uses /logo.png with preserved aspect ratio; text fills the rest of the header row.
 */
const BID_PDF_COMPANY = {
  /** Stacked company name (3 lines, all caps) */
  nameLine1: 'CHRISTIAN',
  nameLine2: 'SECURITY',
  nameLine3: 'SERVICES',
  subtitle: 'ALARM SYSTEM CONTRACTOR',
  license: 'Tennessee Alarm Systems Contractor License #: 2622',
  phone: '801-851-0909'
};

function layoutBidPdfHeader(doc, headerLogo, left, right, headerY) {
  const maxLogoW = 42;
  const maxLogoH = 32;
  let drawW = 0;
  let drawH = 0;

  if (headerLogo?.naturalWidth && headerLogo?.naturalHeight) {
    const nw = headerLogo.naturalWidth;
    const nh = headerLogo.naturalHeight;
    const scale = Math.min(maxLogoW / nw, maxLogoH / nh);
    drawW = nw * scale;
    drawH = nh * scale;
    doc.addImage(headerLogo, 'PNG', left, headerY, drawW, drawH);
  }

  const textX = left + drawW + 5;
  const textMaxW = right - textX;
  let ty = headerY + 5;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(BID_PDF_COMPANY.nameLine1, textX, ty);
  ty += 6;
  doc.text(BID_PDF_COMPANY.nameLine2, textX, ty);
  ty += 6;
  doc.text(BID_PDF_COMPANY.nameLine3, textX, ty);
  ty += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const subLines = doc.splitTextToSize(BID_PDF_COMPANY.subtitle, textMaxW);
  subLines.forEach((ln) => {
    doc.text(ln, textX, ty);
    ty += 4.5;
  });
  const licLines = doc.splitTextToSize(BID_PDF_COMPANY.license, textMaxW);
  licLines.forEach((ln) => {
    doc.text(ln, textX, ty);
    ty += 4.5;
  });
  doc.text(BID_PDF_COMPANY.phone, textX, ty);
  ty += 6;

  const textBottom = ty;
  const logoBottom = headerY + drawH;
  return Math.max(textBottom, logoBottom) + 8;
}

export default function ProjectDetails() {
  const { customerId, projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bidAmount, setBidAmount] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [newMaterial, setNewMaterial] = useState({ item: '', quantity: 0, cost: 0, markup: 0 });
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [editMaterial, setEditMaterial] = useState({ item: '', quantity: '', cost: '', markup: '' });
  const [expandedMaterialIds, setExpandedMaterialIds] = useState(new Set());
  const [newNote, setNewNote] = useState('');
  const [editingProjectInfo, setEditingProjectInfo] = useState(false);
  const [editProjectInfo, setEditProjectInfo] = useState({
    name: '',
    description: '',
    equipmentCategories: emptyEquipmentCategories()
  });

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated. Please login again.');
        return;
      }
      
      // Debug: Log the customerId being used
      console.log('Fetching customer with ID:', customerId);
      console.log('Customer ID type:', typeof customerId);
      
      const res = await axios.get(`${API_BASE_URL}/api/customers/${customerId}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      const cust = res.data;
      
      // Ensure projects array exists
      if (!cust.projects || !Array.isArray(cust.projects)) {
        setError('Customer has no projects');
        setCustomer(null);
        return;
      }
      
      // Debug: log project IDs for troubleshooting
      console.log('Looking for projectId:', projectId);
      console.log('Available project IDs:', cust.projects.map(p => p._id));
      
      const proj = cust.projects.find(p => {
        // Try both string and ObjectId comparison
        return p._id === projectId || String(p._id) === String(projectId);
      });
      
      if (!proj) {
        const projectNames = cust.projects.map(p => `${p.name} (${p._id})`).join(', ');
        setError(`Project not found. Looking for: ${projectId}. Available projects: ${projectNames}`);
        setCustomer(null);
      } else {
        setProject(proj);
        setCustomer({ name: cust.name, phone: cust.phone || '', address: cust.address || '' });
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      if (err.response?.status === 401) {
        setError('Authentication failed. Please login again.');
        localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (err.response?.status === 404) {
        const errorData = err.response?.data;
        if (errorData?.availableCustomers) {
          const customerList = errorData.availableCustomers.map(c => `${c.name} (${c.id})`).join(', ');
          setError(`Customer not found (ID: ${customerId}). Available customers: ${customerList}`);
        } else {
          setError(`Customer not found (ID: ${customerId})`);
        }
      } else if (err.response?.status === 400) {
        setError(`Invalid customer ID format: ${customerId}`);
      } else {
        setError(err.response?.data?.msg || err.response?.data?.error || 'Failed to load project. Please check the console for details.');
      }
    } finally {
      setLoading(false);
    }
  }, [customerId, projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Facebook Pixel: fire ViewContent when project details are displayed (content/details page)
  useEffect(() => {
    if (project && typeof window.fbq === 'function') {
      window.fbq('track', 'ViewContent', { value: 1 });
    }
  }, [project]);

  const submitBid = async () => {
    if (!bidAmount || bidAmount <= 0) {
      alert('Please enter a valid bid amount');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/bid`, 
        { bidAmount: parseFloat(bidAmount) }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setBidAmount('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting bid:', err);
      alert('Failed to submit bid: ' + (err.response?.data?.msg || err.message));
    }
  };

  const submitBill = async () => {
    if (!billAmount || billAmount <= 0) {
      alert('Please enter a valid bill amount');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/bill`, 
        { billAmount: parseFloat(billAmount) }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setBillAmount('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting bill:', err);
      alert('Failed to submit bill: ' + (err.response?.data?.msg || err.message));
    }
  };

  const submitSchedule = async () => {
    if (!scheduleDate) {
      alert('Please select a date');
      return;
    }
    try {
      await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/schedule`, 
        { scheduleDate }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setScheduleDate('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting schedule:', err);
      alert('Failed to schedule job: ' + (err.response?.data?.msg || err.message));
    }
  };

  const markCompleted = async () => {
    if (window.confirm('Mark this project as completed?')) {
      try {
        await axios.put(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/complete`, 
          {}, 
          { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
        );
        fetchProject();
      } catch (err) {
        console.error('Error marking project as completed:', err);
        alert('Failed to mark project as completed: ' + (err.response?.data?.msg || err.message));
      }
    }
  };

  const addMaterial = async () => {
    if (!newMaterial.item || !newMaterial.quantity || !newMaterial.cost) {
      alert('Please fill in all material fields');
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/materials`,
        { 
          item: newMaterial.item, 
          quantity: parseFloat(newMaterial.quantity), 
          cost: parseFloat(newMaterial.cost),
          markup: parseFloat(newMaterial.markup || 0)
        }, 
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setNewMaterial({ item: '', quantity: 0, cost: 0, markup: 0 });
      fetchProject();
    } catch (err) {
      console.error('Error adding material:', err);
      alert('Failed to add material: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteMaterial = async (materialId) => {
    if (window.confirm('Are you sure you want to delete this material?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/materials/${materialId}`, { 
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } 
        });
        fetchProject();
      } catch (err) {
        console.error('Error deleting material:', err);
        alert('Failed to delete material: ' + (err.response?.data?.msg || err.message));
      }
    }
  };

  const startEditMaterial = (mat) => {
    setEditingMaterialId(mat._id);
    setEditMaterial({
      item: mat.item || '',
      quantity: String(mat.quantity ?? ''),
      cost: String(mat.cost ?? ''),
      markup: String(mat.markup ?? 0)
    });
  };

  const cancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditMaterial({ item: '', quantity: '', cost: '', markup: '' });
  };

  const toggleMaterialExpansion = (materialId) => {
    setExpandedMaterialIds((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const updateMaterial = async (materialId) => {
    if (!editMaterial.item || !editMaterial.item.trim()) {
      alert('Please fill in all material fields');
      return;
    }

    const qty = parseFloat(editMaterial.quantity);
    const unitCost = parseFloat(editMaterial.cost);
    const markupPct = parseFloat(editMaterial.markup || 0);

    if (Number.isNaN(qty) || Number.isNaN(unitCost) || Number.isNaN(markupPct)) {
      alert('Please fill in all material fields');
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/materials/${materialId}`,
        {
          item: editMaterial.item.trim(),
          quantity: qty,
          cost: unitCost,
          markup: markupPct
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );

      cancelEditMaterial();
      fetchProject();
    } catch (err) {
      console.error('Error updating material:', err);
      alert('Failed to update material: ' + (err.response?.data?.msg || err.message));
    }
  };

  const totalMaterialCost = (project?.materials || []).reduce((sum, mat) => {
    const qty = parseFloat(mat.quantity || 0);
    const unitCost = parseFloat(mat.cost || 0);
    const markupPct = parseFloat(mat.markup || 0);
    return sum + qty * (unitCost * (1 + markupPct / 100));
  }, 0);

  /**
   * Phase 1 Bid PDF:
   * Includes project information + materials list summary (without individual pricing)
   * and uses computed total material cost.
   */
  const loadBidHeaderImage = () => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/logo.png';
  });

  const generateBidPdf = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const left = 14;
    const right = pageWidth - 14;
    const headerY = 10;
    const bottomMargin = 14;
    const defaultTopY = 20;

    const headerLogo = await loadBidHeaderImage();
    let y = layoutBidPdfHeader(doc, headerLogo, left, right, headerY);
    const ensurePageSpace = (neededHeight = 8) => {
      if (y + neededHeight > pageHeight - bottomMargin) {
        doc.addPage();
        y = defaultTopY;
      }
    };

    /** Phase 3: quote metadata (matches standard bid template line). */
    const quoteNum = getNextBidQuoteNumber();
    // Keep a project note with the issued quote number for audit/history.
    try {
      await axios.post(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/notes`,
        { text: `Last quote number issued: ${quoteNum}` },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      fetchProject();
    } catch (err) {
      console.error('Error saving bid quote note:', err);
    }
    const quoteMetaLine = `Date: ${format(new Date(), 'M/d/yyyy')} | Quote #: ${quoteNum} | Valid for 30 days`;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(8);
    doc.text(quoteMetaLine, left, y);
    y += 8;

    doc.setFontSize(18);
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(9);
    doc.text(`Bid: ${customer?.name || 'N/A'}`, left, y);
    y += 9;

    doc.setFontSize(11);
    ensurePageSpace(28);
    doc.text(`Project: ${project?.name || 'N/A'}`, left, y); y += 7;
    doc.text(`Address: ${customer?.address || 'N/A'}`, left, y); y += 7;
    doc.text(`Phone: ${customer?.phone || 'N/A'}`, left, y); y += 7;
    doc.text(`Description: ${project?.description || 'No description'}`, left, y); y += 7;
    doc.setDrawColor(38, 131, 198);
    doc.line(left, y, right, y);
    y += 8;
    const proposedSystemText = buildProposedSystemStatement(project?.equipmentCategories);
    if (proposedSystemText) {
      ensurePageSpace(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Proposed System:', left, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      const proposedLines = doc.splitTextToSize(proposedSystemText, right - left);
      proposedLines.forEach((line) => {
        ensurePageSpace(6);
        doc.text(line, left, y);
        y += 5;
      });
      y += 6;
    }

    ensurePageSpace(12);
    doc.setFontSize(13);
    doc.text('Materials', left, y);
    y += 8;
    doc.setFontSize(10.5);

    const materials = project?.materials || [];
    const tableLeft = left;
    const tableRight = right;
    const tableWidth = tableRight - tableLeft;
    const itemColW = 20;
    const qtyColW = 22;
    const descColW = tableWidth - itemColW - qtyColW;
    const itemX = tableLeft + 2;
    const descX = tableLeft + itemColW + 2;
    const qtyX = tableRight - 4;
    const rowPadY = 3;
    const lineH = 5;
    const headerH = 8;
    const headerBlue = [38, 131, 198];
    const stripeBlue = [230, 240, 249];

    const drawMaterialsHeader = () => {
      ensurePageSpace(headerH + 2);
      // Header row: dark blue background with white text.
      doc.setFont('helvetica', 'normal');
      doc.setFillColor(...headerBlue);
      doc.rect(tableLeft, y, tableWidth, headerH, 'F');
      doc.setDrawColor(38, 131, 198);
      doc.rect(tableLeft, y, tableWidth, headerH);
      doc.line(tableLeft + itemColW, y, tableLeft + itemColW, y + headerH);
      doc.line(tableRight - qtyColW, y, tableRight - qtyColW, y + headerH);
      doc.setTextColor(255, 255, 255);
      doc.text('Item', itemX, y + 5.3);
      doc.text('Description', descX, y + 5.3);
      doc.text('Quantity', qtyX, y + 5.3, { align: 'right' });
      doc.setTextColor(0, 0, 0);
      y += headerH;
    };
    drawMaterialsHeader();

    if (materials.length === 0) {
      const rowH = rowPadY * 2 + lineH;
      doc.rect(tableLeft, y, tableWidth, rowH);
      doc.line(tableLeft + itemColW, y, tableLeft + itemColW, y + rowH);
      doc.line(tableRight - qtyColW, y, tableRight - qtyColW, y + rowH);
      doc.text('-', itemX, y + rowPadY + 3.8);
      doc.text('No materials listed', descX, y + rowPadY + 3.8);
      doc.text('0', qtyX, y + rowPadY + 3.8, { align: 'right' });
      y += rowH;
    } else {
      materials.forEach((mat, idx) => {
        const descText = mat.item || 'Material';
        const descLines = doc.splitTextToSize(descText, descColW - 4);
        const rowH = Math.max(rowPadY * 2 + (descLines.length * lineH), rowPadY * 2 + lineH);
        if (y + rowH > pageHeight - bottomMargin) {
          doc.addPage();
          y = defaultTopY;
          drawMaterialsHeader();
        }

        if (idx % 2 === 0) {
          doc.setFillColor(...stripeBlue);
          doc.rect(tableLeft, y, tableWidth, rowH, 'F');
        }
        doc.rect(tableLeft, y, tableWidth, rowH);
        doc.line(tableLeft + itemColW, y, tableLeft + itemColW, y + rowH);
        doc.line(tableRight - qtyColW, y, tableRight - qtyColW, y + rowH);

        doc.text(String(idx + 1), itemX, y + rowPadY + 3.8);
        descLines.forEach((ln, lnIdx) => {
          doc.text(ln, descX, y + rowPadY + 3.8 + (lnIdx * lineH));
        });
        doc.text(String(mat.quantity || 0), qtyX, y + rowPadY + 3.8, { align: 'right' });
        y += rowH;
      });
    }

    y += 8;
    doc.setFontSize(12);
    ensurePageSpace(8);
    doc.setTextColor(38, 131, 198);
    doc.text(`Total Material Cost: $${totalMaterialCost.toFixed(2)}`, left, y);
    doc.setTextColor(0, 0, 0);
    y += 6;
    ensurePageSpace(10);
    doc.setDrawColor(38, 131, 198);
    doc.line(left, y, right, y);
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    ensurePageSpace(8);
    doc.text("What's Included:", left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(6);
    doc.text('- All equipment and materials', left + 2, y);
    y += 5;
    ensurePageSpace(6);
    doc.text('- Professional installation (typically 1 day)', left + 2, y);
    y += 5;
    ensurePageSpace(6);
    doc.text('- Testing and walkthrough', left + 2, y);
    y += 5;
    ensurePageSpace(6);
    doc.text('- Full programming, testing, and on-site training', left + 2, y);
    y += 5;
    ensurePageSpace(6);
    doc.text('- 1-year equipment warranty + lifetime installation labor warranty', left + 2, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    ensurePageSpace(8);
    doc.text("What's Not Included:", left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(6);
    doc.text('- Monitoring (separate contract, ~$35 /month)', left + 2, y);
    y += 5;
    ensurePageSpace(6);
    doc.text('- Any electrical upgrades or drywall repairs', left + 2, y);
    y += 5;
    ensurePageSpace(6);
    doc.text('- Local permits (if required beyond low-voltage)', left + 2, y);
    y += 8;
    doc.setFont('helvetica', 'bold');
    ensurePageSpace(8);
    doc.text('Payment Terms:', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(6);
    doc.text('- 50% deposit to schedule and order equipment', left + 2, y);
    y += 5;
    ensurePageSpace(6);
    doc.text('- Balance due on completion (after testing and your approval)', left + 2, y);
    y += 8;

    doc.setFont('helvetica', 'bold');
    ensurePageSpace(8);
    doc.text('Clarifications & Project Assumptions:', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');

    const clarifications = [
      'Limitation of Liability: Contractor’s total liability for any claims arising from this project is capped at the total contract value.',
      'Waiver of Damages: Contractor is not liable for any indirect, incidental, or consequential damages, including loss of profits or business interruption.',
      'Pricing & Validity: This bid is an estimate based on provided specifications and remains valid for 30 days. Final pricing is subject to a mutually signed agreement and may be adjusted for unforeseen site conditions or scope changes.'
    ];
    clarifications.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, right - left);
      wrapped.forEach((ln) => {
        ensurePageSpace(6);
        doc.text(ln, left, y);
        y += 5;
      });
      y += 2;
    });
    y += 4;

    doc.setFont('helvetica', 'bold');
    ensurePageSpace(8);
    doc.text('Next Steps:', left, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(8);
    const nextStepsLine = "Accept by signing below or contacting us. We'll schedule a final walkthrough if needed. We look forward to protecting you!";
    const nextStepsLines = doc.splitTextToSize(nextStepsLine, right - left);
    nextStepsLines.forEach((ln) => {
      ensurePageSpace(6);
      doc.text(ln, left, y);
      y += 5;
    });
    y += 6;

    doc.setFont('helvetica', 'bold');
    ensurePageSpace(8);
    doc.text('Accepted & Agreed:', left, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(8);
    doc.text('Customer Signature: ____________________________ Date: _______________', left, y);
    y += 7;
    ensurePageSpace(8);
    doc.text('Contractor:', left, y);
    y += 6;
    ensurePageSpace(8);
    doc.text('Name/Title ____________________________ Date: _______________', left, y);
    y += 7;
    ensurePageSpace(8);
    doc.text('Phone: 801-851-0909 | Email: brian_christian@hotmail.com', left, y);

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  const addNote = async () => {
    const text = (newNote || '').trim();
    if (!text) {
      alert('Please enter a note');
      return;
    }
    try {
      await axios.post(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/notes`,
        { text },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setNewNote('');
      fetchProject();
    } catch (err) {
      console.error('Error adding note:', err);
      const msg = err.response?.data?.msg || err.response?.data?.error;
      const hint = err.response?.status === 404 && !msg
        ? ' If using a deployed API, redeploy so the notes route is live. If local, restart the backend (npm start).'
        : '';
      alert('Failed to add note: ' + (msg || err.message) + hint);
    }
  };

  const deleteProject = async () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
        navigate('/customers');
      } catch (err) {
        console.error('Error deleting project:', err);
        alert('Failed to delete project');
      }
    }
  };

  const startEditProjectInfo = () => {
    if (!project) return;
    setEditProjectInfo({
      name: project.name || '',
      description: project.description || '',
      equipmentCategories: normalizeEquipmentCategories(project.equipmentCategories)
    });
    setEditingProjectInfo(true);
  };

  const cancelEditProjectInfo = () => {
    setEditingProjectInfo(false);
    setEditProjectInfo({
      name: '',
      description: '',
      equipmentCategories: emptyEquipmentCategories()
    });
  };

  const saveProjectInfo = async () => {
    if (!editProjectInfo.name.trim()) {
      alert('Please enter a project name');
      return;
    }
    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}`,
        {
          name: editProjectInfo.name.trim(),
          description: editProjectInfo.description.trim(),
          equipmentCategories: {
            burglarAlarm: !!editProjectInfo.equipmentCategories.burglarAlarm,
            fireAlarm: !!editProjectInfo.equipmentCategories.fireAlarm,
            accessControl: !!editProjectInfo.equipmentCategories.accessControl,
            cctv: !!editProjectInfo.equipmentCategories.cctv,
            monitoring: !!editProjectInfo.equipmentCategories.monitoring
          }
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setEditingProjectInfo(false);
      fetchProject();
    } catch (err) {
      console.error('Error updating project:', err);
      alert('Failed to update project: ' + (err.response?.data?.msg || err.message));
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4">Back to Customers</Link>
        <div className="text-xl">Loading project details...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4">Back to Customers</Link>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <h2 className="text-xl font-bold mb-2">Error Loading Project</h2>
          <p>{error}</p>
        </div>
        <button 
          onClick={() => navigate('/customers')} 
          className="bg-blue-500 text-white p-2 rounded"
        >
          Return to Customers
        </button>
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 inline-block mb-4">Back to Customers</Link>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <h2 className="text-xl font-bold mb-2">Project Not Found</h2>
          <p>Unable to find the requested project.</p>
        </div>
        <button 
          onClick={() => navigate('/customers')} 
          className="bg-blue-500 text-white p-2 rounded"
        >
          Return to Customers
        </button>
      </div>
    );
  }

  const equipmentDisplayLabels = formatEquipmentCategoriesLabels(project.equipmentCategories);
  const proposedSystemStatement = buildProposedSystemStatement(project.equipmentCategories);

  return (
    <div className="p-6 text-black max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <Link to="/customers" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Back to Customers</Link>
        <Link to="/" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Dashboard
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-6 text-black">
        {editingProjectInfo ? (editProjectInfo.name.trim() || project.name) : project.name}
      </h1>
      
      {/* Project Information */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
          <h2 className="text-xl font-semibold">Project Information</h2>
          {!editingProjectInfo ? (
            <button
              type="button"
              data-testid="edit-project-info"
              onClick={startEditProjectInfo}
              className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 shrink-0"
            >
              Edit
            </button>
          ) : (
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                data-testid="save-project-info"
                onClick={saveProjectInfo}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                Save
              </button>
              <button
                type="button"
                data-testid="cancel-project-info"
                onClick={cancelEditProjectInfo}
                className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {customer && (
            <>
              <div>
                <p className="text-gray-600 mb-1">Customer Name:</p>
                <p className="text-black font-medium">{customer.name || '—'}</p>
              </div>
              <div>
                <p className="text-gray-600 mb-1">Customer Phone:</p>
                <p className="text-black font-medium">{customer.phone || '—'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-600 mb-1">Customer Address:</p>
                <p className="text-black font-medium">{customer.address || '—'}</p>
              </div>
            </>
          )}
          {editingProjectInfo ? (
            <>
              <div className="md:col-span-2">
                <label htmlFor="edit-project-name" className="text-gray-600 mb-1 block">Project name</label>
                <input
                  id="edit-project-name"
                  value={editProjectInfo.name}
                  onChange={(e) => setEditProjectInfo({ ...editProjectInfo, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="edit-project-description" className="text-gray-600 mb-1 block">Description</label>
                <textarea
                  id="edit-project-description"
                  rows={3}
                  value={editProjectInfo.description}
                  onChange={(e) => setEditProjectInfo({ ...editProjectInfo, description: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                />
              </div>
              <div className="md:col-span-2" data-testid="edit-project-equipment-categories">
                <p className="text-gray-600 mb-2">Equipment categories</p>
                <div className="flex flex-wrap gap-4">
                  {EQUIPMENT_CATEGORY_OPTIONS.map(({ key, label }) => (
                    <label
                      key={key}
                      htmlFor={`edit-project-equip-${key}`}
                      className="flex items-center gap-2 cursor-pointer text-black text-sm"
                    >
                      <input
                        id={`edit-project-equip-${key}`}
                        type="checkbox"
                        checked={!!editProjectInfo.equipmentCategories[key]}
                        onChange={(e) =>
                          setEditProjectInfo({
                            ...editProjectInfo,
                            equipmentCategories: {
                              ...editProjectInfo.equipmentCategories,
                              [key]: e.target.checked
                            }
                          })
                        }
                        className="rounded border-gray-300"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="md:col-span-2">
                <p className="text-gray-600 mb-1">Description:</p>
                <p className="text-black font-medium">{project.description || 'No description'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-gray-600 mb-1">Equipment:</p>
                <p className="text-black font-medium" data-testid="project-equipment-display">
                  {equipmentDisplayLabels.length > 0 ? equipmentDisplayLabels.join(', ') : 'None'}
                </p>
              </div>
            </>
          )}
          <div>
            <p className="text-gray-600 mb-1">Status:</p>
            <p className="text-black font-medium">
              <span className={`px-2 py-1 rounded ${
                project.status === 'Completed' ? 'bg-green-100 text-green-800' :
                project.status === 'Billed' ? 'bg-blue-100 text-blue-800' :
                project.status === 'Scheduled' ? 'bg-yellow-100 text-yellow-800' :
                project.status === 'Bidded' ? 'bg-purple-100 text-purple-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status || 'Pending'}
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Bid Amount:</p>
            <p className="text-black font-medium text-lg">${project.bidAmount ? project.bidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Bill Amount:</p>
            <p className="text-black font-medium text-lg">${project.billAmount ? project.billAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Not set'}</p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Schedule Date:</p>
            <p className="text-black font-medium">
              {project.scheduleDate ? format(new Date(project.scheduleDate), 'PPP') : 'Not scheduled'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Actions Section */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Update Project</h2>
        
        {/* Bid Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Bid Amount ($)</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              step="0.01"
              placeholder="Enter bid amount" 
              value={bidAmount} 
              onChange={e => setBidAmount(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitBid} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Submit Bid</button>
          </div>
        </div>
        
        {/* Bill Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Bill Amount ($)</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              step="0.01"
              placeholder="Enter bill amount" 
              value={billAmount} 
              onChange={e => setBillAmount(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitBill} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Submit Bill</button>
          </div>
        </div>
        
        {/* Schedule Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Schedule Date</label>
          <div className="flex gap-2">
            <input 
              type="date" 
              value={scheduleDate} 
              onChange={e => setScheduleDate(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitSchedule} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">Schedule Job</button>
          </div>
        </div>

        {/* Mark as Completed */}
        <div className="pt-4 border-t border-gray-200 flex justify-end">
          <button 
            onClick={markCompleted} 
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium"
            disabled={project.status === 'Completed'}
          >
            {project.status === 'Completed' ? '✓ Project Completed' : 'Mark as Completed'}
          </button>
        </div>
      </div>
      
      {/* Materials List */}
      {proposedSystemStatement && (
        <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
          <p className="font-semibold text-black" data-testid="proposed-system-title">Proposed System:</p>
          <p className="text-black mt-1" data-testid="proposed-system-text">{proposedSystemStatement}</p>
        </div>
      )}
      <h2 className="text-xl mt-6 text-black">Materials</h2>
      <div data-testid="materials-table-wrapper" className="mt-2 overflow-x-auto">
        <table className="w-full table-fixed border-collapse border">
          <colgroup>
            <col className="w-[40%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead>
            <tr className="text-black bg-gray-50">
              <th className="text-black text-left p-3 border-b">Item</th>
              <th className="text-black text-left p-3 border-b">Quantity</th>
              <th className="text-black text-left p-3 border-b">Cost</th>
              <th className="text-black text-left p-3 border-b">%Markup</th>
              <th className="text-black text-left p-3 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {project.materials && project.materials.length > 0 ? (
              project.materials.map(mat => (
                <tr key={mat._id} className="text-black border-b">
                  <td className="text-black p-2 align-top">
                    {expandedMaterialIds.has(mat._id) ? (
                      <div className="break-words whitespace-normal">
                        {mat.item}
                      </div>
                    ) : (
                      <div className="max-w-full truncate" title={mat.item}>
                        {mat.item}
                      </div>
                    )}
                    {mat.item && mat.item.length > 60 && (
                      <button
                        type="button"
                        data-testid={`material-expand-${mat._id}`}
                        onClick={() => toggleMaterialExpansion(mat._id)}
                        className="mt-1 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        {expandedMaterialIds.has(mat._id) ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </td>
                  <td className="text-black p-2">{mat.quantity}</td>
                  <td className="text-black p-2">${parseFloat(mat.cost).toFixed(2)}</td>
                  <td className="text-black p-2">{parseFloat(mat.markup || 0).toFixed(0)}%</td>
                  <td className="p-2 whitespace-nowrap">
                    {editingMaterialId === mat._id ? (
                      <div className="flex gap-2 flex-wrap items-center">
                        <input
                          aria-label="Edit Item"
                          placeholder="Item"
                          value={editMaterial.item}
                          onChange={(e) => setEditMaterial({ ...editMaterial, item: e.target.value })}
                          className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1 min-w-[140px]"
                        />
                        <input
                          type="number"
                          step="1"
                          aria-label="Edit Quantity"
                          placeholder="Quantity"
                          value={editMaterial.quantity}
                          onChange={(e) => setEditMaterial({ ...editMaterial, quantity: e.target.value })}
                          className="p-2 border border-gray-300 rounded bg-gray-100 text-black w-24"
                        />
                        <input
                          type="number"
                          step="0.01"
                          aria-label="Edit Cost ($)"
                          placeholder="Cost ($)"
                          value={editMaterial.cost}
                          onChange={(e) => setEditMaterial({ ...editMaterial, cost: e.target.value })}
                          className="p-2 border border-gray-300 rounded bg-gray-100 text-black w-24"
                        />
                        <input
                          type="number"
                          step="0.01"
                          aria-label="Edit Markup (%)"
                          placeholder="Markup %"
                          value={editMaterial.markup}
                          onChange={(e) => setEditMaterial({ ...editMaterial, markup: e.target.value })}
                          className="p-2 border border-gray-300 rounded bg-gray-100 text-black w-24"
                        />
                        <button
                          onClick={() => updateMaterial(mat._id)}
                          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelEditMaterial}
                          className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteMaterial(mat._id)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEditMaterial(mat)}
                          className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMaterial(mat._id)}
                          className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="5" className="text-black text-center p-4">No materials added yet</td></tr>
            )}
          </tbody>
          {project.materials && project.materials.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="text-black p-3 border-t-2" colSpan="3">
                  <div className="flex items-center gap-3">
                    <span>Total Material Cost:</span>
                    <button
                      onClick={generateBidPdf}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm font-medium"
                    >
                      Generate Bid
                    </button>
                  </div>
                </td>
                <td className="text-black p-3 border-t-2 text-lg">
                  ${totalMaterialCost.toFixed(2)}
                </td>
                <td className="border-t-2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      
      {/* Add Material Form */}
      <div className="mt-4 bg-white border border-gray-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-black">Add New Material</h3>
        <AlignedFormGrid testId="add-material-grid">
          <AlignedFormField label="Item" htmlFor="new-material-item" className="col-span-12 md:col-span-5">
            <input
              id="new-material-item"
              placeholder="Item"
              value={newMaterial.item}
              onChange={e => setNewMaterial({ ...newMaterial, item: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Quantity" htmlFor="new-material-quantity" className="col-span-6 md:col-span-2">
            <input
              id="new-material-quantity"
              type="number"
              step="1"
              placeholder="Quantity"
              value={newMaterial.quantity}
              onChange={e => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Cost" htmlFor="new-material-cost" className="col-span-6 md:col-span-2">
            <input
              id="new-material-cost"
              type="number"
              step="0.01"
              placeholder="Cost ($)"
              value={newMaterial.cost}
              onChange={e => setNewMaterial({ ...newMaterial, cost: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="%Markup" htmlFor="new-material-markup" className="col-span-6 md:col-span-1">
            <input
              id="new-material-markup"
              type="number"
              step="0.01"
              placeholder="Markup %"
              value={newMaterial.markup}
              onChange={e => setNewMaterial({ ...newMaterial, markup: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <div className="col-span-6 md:col-span-2">
            <button
              onClick={addMaterial}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium"
            >
              Add Material
            </button>
          </div>
        </AlignedFormGrid>
      </div>

      {/* Notes */}
      <div className="mt-6 bg-white border border-gray-300 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4 text-black">Notes</h2>
        {project.notes && project.notes.length > 0 ? (
          <ul className="space-y-2 mb-4">
            {project.notes.map((note, i) => (
              <li key={note._id ? String(note._id) : `note-${i}`} className="text-black border-l-4 border-blue-400 pl-3 py-1">
                <p className="whitespace-pre-wrap">{note.text}</p>
                {note.addedAt && (
                  <p className="text-sm text-gray-500 mt-1">{format(new Date(note.addedAt), 'PPp')}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600 mb-4">No notes yet.</p>
        )}
        <div className="flex gap-2 flex-wrap">
          <textarea
            placeholder="Add a note..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            rows={2}
            className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1 min-w-[200px]"
          />
          <button
            onClick={addNote}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 font-medium self-end"
          >
            Add Note
          </button>
        </div>
      </div>
      
      <button onClick={deleteProject} className="mt-6 bg-red-500 text-white p-2 rounded">Delete Project</button>
    </div>
  );
}