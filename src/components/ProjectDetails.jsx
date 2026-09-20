import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import { strFromU8, unzipSync } from 'fflate';
import API_BASE_URL from '../config/api';
import {
  buildProposedSystemStatement,
  EQUIPMENT_CATEGORY_OPTIONS,
  emptyEquipmentCategories,
  formatEquipmentCategoriesLabels,
  normalizeEquipmentCategories
} from '../constants/equipmentCategories';
import { COST_CENTERS } from '../constants/costCenters';
import { JOB_LABOR_WORK_TYPES, LABOR_WORK_TYPES } from '../constants/laborWorkTypes';
import { PROJECT_WORK_TYPES, DEFAULT_PROJECT_WORK_TYPE, normalizeProjectWorkType } from '../constants/projectWorkTypes';
import { getLastIssuedBidQuoteNumber, getNextBidQuoteNumber } from '../utils/bidQuoteSequence';
import { jobQuotedAmount, bidWorksheetTotal } from '../../server/lib/accountingSummary.js';
import { formatCustomerLabel, formatJobLabel, jobLinesToDate } from '../constants/jobIdentity';
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
  phone: '(931) 279-7879'
};

const MONITORING_AGREEMENT_DOCX_URL = '/ALARM MONITORING SERVICES AGREEMENT.docx';

function extractDocxPlainText(arrayBuffer) {
  try {
    const files = unzipSync(new Uint8Array(arrayBuffer));
    const xmlBytes = files['word/document.xml'];
    if (!xmlBytes) return [];
    const xml = strFromU8(xmlBytes);
    const paragraphs = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
    return paragraphs
      .map((p) => {
        const texts = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1] || '');
        return texts.join('').replace(/\s+/g, ' ').trim();
      })
      .filter(Boolean);
  } catch (err) {
    console.error('Failed to parse monitoring agreement DOCX:', err);
    return [];
  }
}

function classifyContractLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return { type: 'blank', text: '' };
  if (/^[-*•]\s+/.test(trimmed)) return { type: 'bullet', text: trimmed.replace(/^[-*•]\s+/, '') };
  if (/^(\d+[\.\)]|[A-Za-z][\.\)])\s+/.test(trimmed)) return { type: 'numbered', text: trimmed };
  if (
    /:$/.test(trimmed) ||
    (trimmed.length <= 90 &&
      trimmed === trimmed.toUpperCase() &&
      /[A-Z]/.test(trimmed))
  ) {
    return { type: 'heading', text: trimmed };
  }
  return { type: 'paragraph', text: trimmed };
}

function getLastIssuedQuoteFromNotes(notes = []) {
  if (!Array.isArray(notes)) return null;
  for (let i = notes.length - 1; i >= 0; i -= 1) {
    const note = notes[i];
    const text = typeof note === 'string' ? note : note?.text;
    if (!text) continue;
    const match = String(text).match(/Last quote number issued:\s*(\d+)/i);
    if (match) {
      const parsed = parseInt(match[1], 10);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return null;
}

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
  const [taxRateAmount, setTaxRateAmount] = useState('');
  const [paidToDateAmount, setPaidToDateAmount] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [newMaterial, setNewMaterial] = useState({ item: '', quantity: 0, cost: 0, markup: 0 });
  const [newBidMaterial, setNewBidMaterial] = useState({ item: '', quantity: '', estimate: '' });
  const [catalogItems, setCatalogItems] = useState([]);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState(null);
  const [editMaterial, setEditMaterial] = useState({ item: '', quantity: '', cost: '', markup: '', taxable: true });
  const [expandedMaterialIds, setExpandedMaterialIds] = useState(new Set());
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteText, setEditNoteText] = useState('');
  const [includeMonitoringAgreement, setIncludeMonitoringAgreement] = useState(false);
  const [editingProjectInfo, setEditingProjectInfo] = useState(false);
  const [editProjectInfo, setEditProjectInfo] = useState({
    name: '',
    description: '',
    jobNumber: '',
    equipmentCategories: emptyEquipmentCategories(),
    workType: DEFAULT_PROJECT_WORK_TYPE,
  });
  const [jobExpenses, setJobExpenses] = useState([]);
  const [jobLabor, setJobLabor] = useState([]);
  const [newExpense, setNewExpense] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    payee: '',
    costCenterCode: 'FUEL',
    description: '',
  });
  const [newLabor, setNewLabor] = useState({
    date: new Date().toISOString().slice(0, 10),
    hours: '',
    hourlyCost: '',
    workType: 'install',
    notes: '',
  });
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editExpense, setEditExpense] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    payee: '',
    costCenterCode: 'FUEL',
    description: '',
  });
  const [editingLaborId, setEditingLaborId] = useState(null);
  const [editLabor, setEditLabor] = useState({
    date: new Date().toISOString().slice(0, 10),
    hours: '',
    hourlyCost: '',
    workType: 'install',
    notes: '',
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
        const headers = { Authorization: `Bearer ${token}` };
        const [expRes, laborRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/expenses?customerId=${customerId}&projectId=${projectId}`, { headers }).catch(() => ({ data: [] })),
          axios.get(`${API_BASE_URL}/api/labor-entries?customerId=${customerId}&projectId=${projectId}`, { headers }).catch(() => ({ data: [] })),
        ]);
        setJobExpenses(Array.isArray(expRes.data) ? expRes.data : []);
        setJobLabor(Array.isArray(laborRes.data) ? laborRes.data : []);
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

  const submitPaidToDate = async () => {
    if (paidToDateAmount === '' || Number(paidToDateAmount) < 0) {
      alert('Please enter a valid paid amount');
      return;
    }
    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/paid`,
        { paidToDate: parseFloat(paidToDateAmount) },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setPaidToDateAmount('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting paid amount:', err);
      alert('Failed to record payment: ' + (err.response?.data?.msg || err.message));
    }
  };

  const submitTaxRate = async () => {
    if (taxRateAmount === '' || Number(taxRateAmount) < 0) {
      alert('Please enter a valid tax rate');
      return;
    }
    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/tax-rate`,
        { taxRate: parseFloat(taxRateAmount) },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setTaxRateAmount('');
      fetchProject();
    } catch (err) {
      console.error('Error submitting tax rate:', err);
      alert('Failed to save tax rate: ' + (err.response?.data?.msg || err.message));
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

  const addBidMaterial = async () => {
    if (!newBidMaterial.item || !newBidMaterial.quantity) {
      alert('Please enter a worksheet item and quantity');
      return;
    }
    try {
      await axios.post(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/bid-materials`,
        {
          item: newBidMaterial.item,
          quantity: parseFloat(newBidMaterial.quantity),
          estimate: parseFloat(newBidMaterial.estimate || 0),
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setNewBidMaterial({ item: '', quantity: '', estimate: '' });
      fetchProject();
    } catch (err) {
      console.error('Error adding bid worksheet line:', err);
      alert('Failed to add bid worksheet line: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteBidMaterial = async (bidMaterialId) => {
    if (!window.confirm('Remove this line from the bid worksheet?')) return;
    try {
      await axios.delete(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/bid-materials/${bidMaterialId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      fetchProject();
    } catch (err) {
      console.error('Error deleting bid worksheet line:', err);
      alert('Failed to delete bid worksheet line: ' + (err.response?.data?.msg || err.message));
    }
  };

  const copyBidWorksheetToJob = async () => {
    if (!window.confirm('Copy bid worksheet lines onto Materials used? Job Profit will then include those costs until you edit them.')) {
      return;
    }
    try {
      await axios.post(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/bid-materials/copy-to-job`,
        {},
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      fetchProject();
    } catch (err) {
      console.error('Error copying bid worksheet:', err);
      alert('Failed to copy bid worksheet: ' + (err.response?.data?.msg || err.message));
    }
  };

  const addJobExpense = async () => {
    if (!newExpense.amount) {
      alert('Please enter an expense amount');
      return;
    }
    try {
      await axios.post(
        `${API_BASE_URL}/api/expenses`,
        {
          date: newExpense.date,
          amount: parseFloat(newExpense.amount),
          payee: newExpense.payee,
          description: newExpense.description,
          costCenterCode: newExpense.costCenterCode,
          customerId,
          projectId,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setNewExpense({
        date: new Date().toISOString().slice(0, 10),
        amount: '',
        payee: '',
        costCenterCode: 'FUEL',
        description: '',
      });
      fetchProject();
    } catch (err) {
      console.error('Error adding job expense:', err);
      alert('Failed to add expense: ' + (err.response?.data?.msg || err.message));
    }
  };

  const addJobLabor = async () => {
    if (!newLabor.hours) {
      alert('Please enter hours');
      return;
    }
    try {
      const payload = {
        date: newLabor.date,
        hours: parseFloat(newLabor.hours),
        workType: newLabor.workType,
        notes: newLabor.notes,
        customerId,
        projectId,
      };
      if (newLabor.hourlyCost !== '') payload.hourlyCost = parseFloat(newLabor.hourlyCost);
      await axios.post(`${API_BASE_URL}/api/labor-entries`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setNewLabor({
        date: new Date().toISOString().slice(0, 10),
        hours: '',
        hourlyCost: '',
        workType: 'install',
        notes: '',
      });
      fetchProject();
    } catch (err) {
      console.error('Error adding job hours:', err);
      alert('Failed to add hours: ' + (err.response?.data?.msg || err.message));
    }
  };

  const toDateInputValue = (value) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    const str = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
    return parsed.toISOString().slice(0, 10);
  };

  const startEditExpense = (expense) => {
    setEditingExpenseId(expense._id);
    setEditExpense({
      date: toDateInputValue(expense.date),
      amount: String(expense.amount ?? ''),
      payee: expense.payee || '',
      costCenterCode: expense.costCenterCode || 'FUEL',
      description: expense.description || '',
    });
  };

  const cancelEditExpense = () => {
    setEditingExpenseId(null);
    setEditExpense({
      date: new Date().toISOString().slice(0, 10),
      amount: '',
      payee: '',
      costCenterCode: 'FUEL',
      description: '',
    });
  };

  const updateJobExpense = async (expenseId) => {
    const amount = parseFloat(editExpense.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Please enter an expense amount');
      return;
    }
    try {
      await axios.put(
        `${API_BASE_URL}/api/expenses/${expenseId}`,
        {
          date: editExpense.date,
          amount,
          payee: editExpense.payee,
          description: editExpense.description,
          costCenterCode: editExpense.costCenterCode,
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      cancelEditExpense();
      fetchProject();
    } catch (err) {
      console.error('Error updating job expense:', err);
      alert('Failed to update expense: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteJobExpense = async (expenseId) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/expenses/${expenseId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (editingExpenseId === expenseId) cancelEditExpense();
      fetchProject();
    } catch (err) {
      console.error('Error deleting job expense:', err);
      alert('Failed to delete expense: ' + (err.response?.data?.msg || err.message));
    }
  };

  const startEditLabor = (entry) => {
    setEditingLaborId(entry._id);
    setEditLabor({
      date: toDateInputValue(entry.date),
      hours: String(entry.hours ?? ''),
      hourlyCost: entry.hourlyCost == null ? '' : String(entry.hourlyCost),
      workType: entry.workType || 'install',
      notes: entry.notes || '',
    });
  };

  const cancelEditLabor = () => {
    setEditingLaborId(null);
    setEditLabor({
      date: new Date().toISOString().slice(0, 10),
      hours: '',
      hourlyCost: '',
      workType: 'install',
      notes: '',
    });
  };

  const updateJobLabor = async (laborId) => {
    const hours = parseFloat(editLabor.hours);
    if (!Number.isFinite(hours) || hours <= 0) {
      alert('Please enter hours');
      return;
    }
    try {
      const payload = {
        date: editLabor.date,
        hours,
        workType: editLabor.workType,
        notes: editLabor.notes,
      };
      if (editLabor.hourlyCost !== '') payload.hourlyCost = parseFloat(editLabor.hourlyCost);
      else payload.hourlyCost = '';
      await axios.put(`${API_BASE_URL}/api/labor-entries/${laborId}`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      cancelEditLabor();
      fetchProject();
    } catch (err) {
      console.error('Error updating job hours:', err);
      alert('Failed to update hours: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteJobLabor = async (laborId) => {
    if (!window.confirm('Are you sure you want to delete this labor entry?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/labor-entries/${laborId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (editingLaborId === laborId) cancelEditLabor();
      fetchProject();
    } catch (err) {
      console.error('Error deleting job hours:', err);
      alert('Failed to delete hours: ' + (err.response?.data?.msg || err.message));
    }
  };

  const applyCatalogItemToMaterialForm = () => {
    const picked = catalogItems.find((entry) => entry.value === selectedCatalogItem);
    if (!picked) return;
    const itemLabel = picked.sku
      ? `${picked.sku} - ${picked.description}`
      : picked.description;
    setNewMaterial((prev) => ({
      ...prev,
      item: itemLabel,
      quantity: prev.quantity && Number(prev.quantity) > 0 ? prev.quantity : 1,
      cost: picked.price
    }));
  };

  const loadSupplierCatalogItems = async () => {
    if (catalogLoading || catalogItems.length > 0) return;
    try {
      setCatalogLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API_BASE_URL}/api/suppliers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const suppliers = Array.isArray(res.data) ? res.data : (res.data?.suppliers || []);
      const flattened = suppliers.flatMap((supplier) =>
        (supplier.catalog || []).map((item, idx) => ({
          value: `${supplier._id || supplier.name || 'supplier'}::${idx}`,
          supplierName: supplier.name || 'Unknown supplier',
          sku: item.sku || '',
          description: item.description || '',
          unit: item.unit || 'each',
          price: parseFloat(item.price) || 0
        }))
      );
      setCatalogItems(flattened);
    } catch (err) {
      console.error('Error loading supplier catalogs for project materials:', err);
      alert('Could not load catalog items right now.');
    } finally {
      setCatalogLoading(false);
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
      markup: String(mat.markup ?? 0),
      taxable: mat.taxable !== false,
    });
  };

  const cancelEditMaterial = () => {
    setEditingMaterialId(null);
    setEditMaterial({ item: '', quantity: '', cost: '', markup: '', taxable: true });
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
          markup: markupPct,
          taxable: editMaterial.taxable !== false,
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

  const toggleMaterialTaxable = async (material) => {
    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/materials/${material._id}`,
        { taxable: material.taxable === false },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      fetchProject();
    } catch (err) {
      console.error('Error updating material taxable flag:', err);
      alert('Failed to update taxable status: ' + (err.response?.data?.msg || err.message));
    }
  };

  const totalMaterialCost = (project?.materials || []).reduce((sum, mat) => {
    const qty = parseFloat(mat.quantity || 0);
    const unitCost = parseFloat(mat.cost || 0);
    const markupPct = parseFloat(mat.markup || 0);
    return sum + qty * (unitCost * (1 + markupPct / 100));
  }, 0);
  const taxableMaterialCost = (project?.materials || []).reduce((sum, mat) => {
    if (mat?.taxable === false) return sum;
    const qty = parseFloat(mat.quantity || 0);
    const unitCost = parseFloat(mat.cost || 0);
    const markupPct = parseFloat(mat.markup || 0);
    return sum + qty * (unitCost * (1 + markupPct / 100));
  }, 0);
  const effectiveTaxRate = (() => {
    const parsedRate = parseFloat(project?.taxRate || 0);
    if (Number.isNaN(parsedRate) || parsedRate < 0) return 0;
    return parsedRate;
  })();
  const salesTaxAmount = taxableMaterialCost * (effectiveTaxRate / 100);
  // Invoice PDF only. Job Profit materialCost uses qty × unit cost and never this sell total.
  const invoiceSubtotal = (() => {
    const parsedBillAmount = parseFloat(project?.billAmount || 0);
    return parsedBillAmount > 0 ? parsedBillAmount : totalMaterialCost;
  })();
  const originalInvoiceTotal = (() => {
    return invoiceSubtotal + salesTaxAmount;
  })();
  const paidToDateTotal = (() => {
    const parsedPaid = parseFloat(project?.paidToDate || 0);
    if (Number.isNaN(parsedPaid) || parsedPaid < 0) return 0;
    return Math.min(parsedPaid, originalInvoiceTotal);
  })();
  const totalRemaining = Math.max(originalInvoiceTotal - paidToDateTotal, 0);

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

  const generateBidPdf = async (options = {}) => {
    const { incrementQuote = true } = options;
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
    const noteQuoteNum = getLastIssuedQuoteFromNotes(project?.notes);
    const quoteNum = incrementQuote
      ? getNextBidQuoteNumber()
      : (noteQuoteNum ?? getLastIssuedBidQuoteNumber());
    if (incrementQuote) {
      // Keep a project note with the newly issued quote number for audit/history.
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

    const materials = project?.bidMaterials || [];
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
    doc.text(`Bid Amount: $${jobQuotedAmount(project).toFixed(2)}`, left, y);
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
    doc.text(`Phone: ${BID_PDF_COMPANY.phone} | Email: brian_christian@hotmail.com`, left, y);

    if (includeMonitoringAgreement) {
      let agreementLines = [];
      try {
        const response = await fetch(MONITORING_AGREEMENT_DOCX_URL);
        if (response.ok) {
          const agreementBuffer = await response.arrayBuffer();
          agreementLines = extractDocxPlainText(agreementBuffer);
        } else {
          console.error('Monitoring agreement download failed:', response.status);
        }
      } catch (err) {
        console.error('Monitoring agreement fetch failed:', err);
      }

      doc.addPage();
      y = 20;

      // Contract attachment header to visually separate from bid content.
      doc.setFillColor(235, 241, 252);
      doc.setDrawColor(22, 58, 120);
      doc.rect(left, y - 6, right - left, 22, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Attachment A', left + (right - left) / 2, y + 1, { align: 'center' });
      doc.setFontSize(11);
      doc.text('Monitoring Agreement Contract', left + (right - left) / 2, y + 8, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text('Attached to Bid - Optional Addendum', left + (right - left) / 2, y + 14, { align: 'center' });
      y += 24;
      doc.setDrawColor(22, 58, 120);
      doc.line(left, y, right, y);
      y += 8;

      doc.setFont('helvetica', 'bold');
      ensurePageSpace(8);
      doc.text('Monitoring Agreement Contract', left, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      const linesToRender = agreementLines.length > 0
        ? agreementLines
        : ['Monitoring agreement source file could not be parsed.'];

      linesToRender.forEach((line) => {
        const classified = classifyContractLine(line);
        if (classified.type === 'blank') {
          y += 2;
          return;
        }

        if (classified.type === 'heading') {
          ensurePageSpace(8);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10.5);
          doc.text(classified.text, left, y);
          y += 6;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          return;
        }

        const text = classified.type === 'bullet'
          ? `• ${classified.text}`
          : classified.text;
        const x = classified.type === 'bullet' || classified.type === 'numbered' ? left + 2 : left;
        const width = classified.type === 'bullet' || classified.type === 'numbered' ? right - left - 2 : right - left;
        const wrapped = doc.splitTextToSize(text, width);
        wrapped.forEach((ln) => {
          ensurePageSpace(6);
          doc.text(ln, x, y);
          y += 5;
        });
        y += 1;
      });
    }

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  };

  /**
   * Invoice PDF uses bid styling, but summarizes totals only.
   */
  const generateInvoicePdf = async () => {
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

    // Keep invoice number aligned with the most recently issued quote number for this project.
    const noteQuoteNum = getLastIssuedQuoteFromNotes(project?.notes);
    const invoiceNumber = noteQuoteNum ?? getLastIssuedBidQuoteNumber();
    const invoiceMetaLine = `Date: ${format(new Date(), 'M/d/yyyy')} | Invoice #: ${invoiceNumber}`;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    ensurePageSpace(8);
    doc.text(invoiceMetaLine, left, y);
    y += 8;

    doc.setFontSize(18);
    ensurePageSpace(9);
    doc.text(`Invoice: ${customer?.name || 'N/A'}`, left, y);
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

    ensurePageSpace(24);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Subtotal: $${invoiceSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      left,
      y
    );
    y += 8;
    doc.text(
      `Sales Tax (${effectiveTaxRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%): $${salesTaxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      left,
      y
    );
    y += 8;
    doc.text(
      `Original Total: $${originalInvoiceTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      left,
      y
    );
    y += 8;
    doc.text(
      `Paid to Date: $${paidToDateTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      left,
      y
    );
    y += 8;
    doc.setTextColor(38, 131, 198);
    doc.text(
      `Total Remaining: $${totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      left,
      y
    );
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    y += 6;
    ensurePageSpace(10);
    doc.setDrawColor(38, 131, 198);
    doc.line(left, y, right, y);
    y += 8;

    doc.setFontSize(10.5);
    ensurePageSpace(7);
    doc.text('Thank you for your business!', left, y);
    y += 6;
    ensurePageSpace(7);
    doc.text('Payment due upon receipt unless otherwise agreed in writing.', left, y);

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

  const startEditNote = (note) => {
    setEditingNoteId(String(note?._id || ''));
    setEditNoteText(note?.text || '');
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditNoteText('');
  };

  const saveEditedNote = async (noteId) => {
    const text = (editNoteText || '').trim();
    if (!text) {
      alert('Please enter a note');
      return;
    }

    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/notes/${noteId}`,
        { text },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      cancelEditNote();
      fetchProject();
    } catch (err) {
      console.error('Error updating note:', err);
      alert('Failed to update note: ' + (err.response?.data?.msg || err.message));
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}/notes/${noteId}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (editingNoteId === String(noteId)) {
        cancelEditNote();
      }
      fetchProject();
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('Failed to delete note: ' + (err.response?.data?.msg || err.message));
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
      jobNumber: project.jobNumber || '',
      equipmentCategories: normalizeEquipmentCategories(project.equipmentCategories),
      workType: normalizeProjectWorkType(project.workType),
    });
    setEditingProjectInfo(true);
  };

  const cancelEditProjectInfo = () => {
    setEditingProjectInfo(false);
    setEditProjectInfo({
      name: '',
      description: '',
      jobNumber: '',
      equipmentCategories: emptyEquipmentCategories(),
      workType: DEFAULT_PROJECT_WORK_TYPE,
    });
  };

  const saveProjectInfo = async () => {
    if (!editProjectInfo.name.trim()) {
      alert('Please enter a job name');
      return;
    }
    try {
      await axios.put(
        `${API_BASE_URL}/api/customers/${customerId}/projects/${projectId}`,
        {
          name: editProjectInfo.name.trim(),
          description: editProjectInfo.description.trim(),
          jobNumber: editProjectInfo.jobNumber.trim(),
          equipmentCategories: {
            burglarAlarm: !!editProjectInfo.equipmentCategories.burglarAlarm,
            fireAlarm: !!editProjectInfo.equipmentCategories.fireAlarm,
            accessControl: !!editProjectInfo.equipmentCategories.accessControl,
            cctv: !!editProjectInfo.equipmentCategories.cctv,
            monitoring: !!editProjectInfo.equipmentCategories.monitoring
          },
          workType: normalizeProjectWorkType(editProjectInfo.workType),
        },
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      setEditingProjectInfo(false);
      fetchProject();
    } catch (err) {
      console.error('Error updating project:', err);
      alert('Failed to update job: ' + (err.response?.data?.msg || err.message));
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="btn-staff inline-block mb-4">Back to Customers</Link>
        <div className="text-xl">Loading project details...</div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6 text-black">
        <Link to="/customers" className="btn-staff inline-block mb-4">Back to Customers</Link>
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
        <Link to="/customers" className="btn-staff inline-block mb-4">Back to Customers</Link>
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
    <div className="p-4 sm:p-6 text-black max-w-6xl mx-auto min-w-0 overflow-x-hidden">
      <div data-testid="project-top-actions" className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 mb-4">
        <Link to="/customers" className="btn-staff text-center">Back to Customers</Link>
        <Link to="/dashboard" className="btn-staff text-center">
          Dashboard
        </Link>
      </div>
      <h1 className="text-2xl sm:text-3xl leading-tight break-words font-bold mb-6 text-black">
        {editingProjectInfo
          ? formatJobLabel({ name: editProjectInfo.name.trim() || project.name, jobNumber: editProjectInfo.jobNumber || project.jobNumber })
          : formatJobLabel(project)}
      </h1>
      
      {/* Project Information */}
      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap justify-between items-start gap-2 mb-4">
          <h2 className="text-lg sm:text-xl font-semibold">Job information</h2>
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
                <p className="text-black font-medium">{formatCustomerLabel(customer)}</p>
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
                <label htmlFor="edit-project-name" className="text-gray-600 mb-1 block">Job name</label>
                <input
                  id="edit-project-name"
                  value={editProjectInfo.name}
                  onChange={(e) => setEditProjectInfo({ ...editProjectInfo, name: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                />
              </div>
              <div>
                <label htmlFor="edit-job-number" className="text-gray-600 mb-1 block">Job number</label>
                <input
                  id="edit-job-number"
                  value={editProjectInfo.jobNumber}
                  onChange={(e) => setEditProjectInfo({ ...editProjectInfo, jobNumber: e.target.value })}
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
              <div>
                <label htmlFor="edit-project-work-type" className="text-gray-600 mb-1 block">Work type</label>
                <select
                  id="edit-project-work-type"
                  value={editProjectInfo.workType || DEFAULT_PROJECT_WORK_TYPE}
                  onChange={(e) => setEditProjectInfo({ ...editProjectInfo, workType: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                >
                  {PROJECT_WORK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-gray-600 mb-1">Job number:</p>
                <p className="text-black font-medium">{project.jobNumber || '—'}</p>
              </div>
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
              <div>
                <p className="text-gray-600 mb-1">Work type:</p>
                <p className="text-black font-medium" data-testid="project-work-type-display">
                  {PROJECT_WORK_TYPES.find((type) => type.value === normalizeProjectWorkType(project.workType))?.label
                    || 'Installation'}
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
            <p className="text-gray-600 mb-1">Paid to Date:</p>
            <p className="text-black font-medium text-lg">
              ${(parseFloat(project.paidToDate || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Tax Rate:</p>
            <p className="text-black font-medium text-lg">
              {effectiveTaxRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Sales Tax (on Items):</p>
            <p className="text-black font-medium text-lg">
              ${salesTaxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div>
            <p className="text-gray-600 mb-1">Total Remaining:</p>
            <p className="text-black font-medium text-lg">
              ${totalRemaining.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
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
        <h2 className="text-lg sm:text-xl font-semibold mb-4">Update Project</h2>
        
        {/* Bid Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Bid Amount ($)</label>
          <div data-testid="bid-form-row" className="flex flex-col sm:flex-row gap-2">
            <input 
              type="number" 
              step="0.01"
              placeholder="Enter bid amount" 
              value={bidAmount} 
              onChange={e => setBidAmount(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitBid} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 w-full sm:w-auto">Submit Bid</button>
          </div>
        </div>
        
        {/* Bill Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Bill Amount ($)</label>
          <div data-testid="bill-form-row" className="flex flex-col sm:flex-row gap-2">
            <input 
              type="number" 
              step="0.01"
              placeholder="Enter bill amount" 
              value={billAmount} 
              onChange={e => setBillAmount(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitBill} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 w-full sm:w-auto">Submit Bill</button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Sales Tax Rate (%)</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Enter tax rate"
              value={taxRateAmount}
              onChange={e => setTaxRateAmount(e.target.value)}
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1"
            />
            <button onClick={submitTaxRate} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 w-full sm:w-auto">
              Save Tax Rate
            </button>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Paid to Date ($)</label>
          <div data-testid="paid-form-row" className="flex flex-col sm:flex-row gap-2">
            <input
              type="number"
              step="0.01"
              placeholder="Enter paid amount"
              value={paidToDateAmount}
              onChange={e => setPaidToDateAmount(e.target.value)}
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1"
            />
            <button onClick={submitPaidToDate} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 w-full sm:w-auto">
              Record Payment
            </button>
          </div>
        </div>
        
        {/* Schedule Form */}
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Schedule Date</label>
          <div data-testid="schedule-form-row" className="flex flex-col sm:flex-row gap-2">
            <input 
              type="date" 
              value={scheduleDate} 
              onChange={e => setScheduleDate(e.target.value)} 
              className="p-2 border border-gray-300 rounded bg-gray-100 text-black flex-1" 
            />
            <button onClick={submitSchedule} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 w-full sm:w-auto">Schedule Job</button>
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
      <h2 className="text-lg sm:text-xl mt-6 text-black">Bid worksheet</h2>
      <p className="text-sm text-slate-600 mt-1 mb-2">
        Equipment you proposed on the quote. This does not affect Job Profit. Bid Amount is still the customer quote.
      </p>

      <div data-testid="quote-document-controls" className="mt-2 mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => generateBidPdf({ incrementQuote: true })}
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-sm font-medium"
        >
          Generate Bid
        </button>
        <button
          type="button"
          onClick={() => generateBidPdf({ incrementQuote: false })}
          className="bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 text-sm font-medium"
        >
          Regenerate Bid
        </button>
        <button
          type="button"
          onClick={generateInvoicePdf}
          className="bg-indigo-600 text-white px-3 py-1 rounded hover:bg-indigo-700 text-sm font-medium"
        >
          Generate Invoice
        </button>
        <button
          type="button"
          onClick={copyBidWorksheetToJob}
          className="bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-900 text-sm font-medium"
          disabled={!(project.bidMaterials && project.bidMaterials.length)}
        >
          Copy bid worksheet to materials used
        </button>
        <label className="inline-flex items-center gap-2 text-sm text-black">
          <input
            type="checkbox"
            checked={includeMonitoringAgreement}
            onChange={(e) => setIncludeMonitoringAgreement(e.target.checked)}
          />
          Include Monitoring Agreement
        </label>
      </div>

      <div data-testid="bid-worksheet-list" className="mt-2 space-y-3 max-w-full min-w-0 mb-4">
        {(project.bidMaterials || []).length > 0 ? (
          <>
            {(project.bidMaterials || []).map((line) => (
              <div key={line._id} className="bg-white border border-gray-300 rounded-lg p-3 min-w-0 flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-medium text-black">{line.item}</p>
                  <p className="text-sm text-gray-600">
                    Qty {line.quantity || 0}
                    {line.estimate != null ? ` · Estimate $${Number(line.estimate).toFixed(2)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteBidMaterial(line._id)}
                  className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
            <p className="font-semibold text-black">
              Worksheet estimate: ${bidWorksheetTotal(project).toFixed(2)}
            </p>
          </>
        ) : (
          <div className="bg-white border border-gray-300 rounded-lg p-4 text-black text-center">
            No bid worksheet lines yet
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-300 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-3 text-black">Add to bid worksheet</h3>
        <AlignedFormGrid testId="bid-worksheet-grid">
          <AlignedFormField label="Worksheet item" htmlFor="bid-worksheet-item" className="col-span-12 md:col-span-6">
            <input
              id="bid-worksheet-item"
              value={newBidMaterial.item}
              onChange={(e) => setNewBidMaterial({ ...newBidMaterial, item: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Worksheet quantity" htmlFor="bid-worksheet-qty" className="col-span-6 md:col-span-3">
            <input
              id="bid-worksheet-qty"
              type="number"
              step="1"
              min="0"
              value={newBidMaterial.quantity}
              onChange={(e) => setNewBidMaterial({ ...newBidMaterial, quantity: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Estimate ($)" htmlFor="bid-worksheet-estimate" className="col-span-6 md:col-span-3">
            <input
              id="bid-worksheet-estimate"
              type="number"
              step="0.01"
              min="0"
              value={newBidMaterial.estimate}
              onChange={(e) => setNewBidMaterial({ ...newBidMaterial, estimate: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
        </AlignedFormGrid>
        <button type="button" onClick={addBidMaterial} className="mt-3 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          Add to bid worksheet
        </button>
      </div>

      <section data-testid="job-lines" className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-2">
          <div>
            <h2 className="text-lg sm:text-xl text-black">Job lines</h2>
            <p className="text-sm text-slate-600">
              Additive materials, time, and expenses on this job. The bid worksheet above is quote-only.
            </p>
          </div>
          <div className="border border-slate-200 rounded p-3 min-w-[10rem]">
            <p className="text-sm text-slate-600">Lines to date</p>
            <p data-testid="job-lines-total" className="font-semibold">
              {`$${jobLinesToDate({
                materials: project.materials,
                laborEntries: jobLabor,
                expenses: jobExpenses,
              }).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          </div>
        </div>
      <h2 className="text-lg sm:text-xl mt-4 text-black">Materials used</h2>
      <p className="text-sm text-slate-600 mt-1 mb-2">
        Actual materials on the job. Qty × cost is Job Profit material cost. Leave empty on labor-only jobs.
      </p>

      <div data-testid="materials-list" className="mt-2 space-y-3 max-w-full min-w-0">
        {project.materials && project.materials.length > 0 ? (
          <>
            {project.materials.map((mat) => (
              <div key={mat._id} className="bg-white border border-gray-300 rounded-lg p-3 min-w-0">
                {editingMaterialId === mat._id ? (
                  <div className="space-y-2">
                    <input
                      aria-label="Edit Item"
                      placeholder="Item"
                      value={editMaterial.item}
                      onChange={(e) => setEditMaterial({ ...editMaterial, item: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="number"
                        step="1"
                        aria-label="Edit Quantity"
                        placeholder="Quantity"
                        value={editMaterial.quantity}
                        onChange={(e) => setEditMaterial({ ...editMaterial, quantity: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                      <input
                        type="number"
                        step="0.01"
                        aria-label="Edit Cost ($)"
                        placeholder="Cost ($)"
                        value={editMaterial.cost}
                        onChange={(e) => setEditMaterial({ ...editMaterial, cost: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                      <input
                        type="number"
                        step="0.01"
                        aria-label="Edit Markup (%)"
                        placeholder="Markup %"
                        value={editMaterial.markup}
                        onChange={(e) => setEditMaterial({ ...editMaterial, markup: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black sm:col-span-2"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm text-black">
                      <input
                        type="checkbox"
                        checked={editMaterial.taxable !== false}
                        onChange={(e) => setEditMaterial({ ...editMaterial, taxable: e.target.checked })}
                      />
                      Taxable
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateMaterial(mat._id)}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditMaterial}
                        className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMaterial(mat._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1">
                      {expandedMaterialIds.has(mat._id) ? (
                        <p className="text-black font-semibold break-words">{mat.item}</p>
                      ) : (
                        <p className="text-black font-semibold break-words line-clamp-3" title={mat.item}>
                          {mat.item}
                        </p>
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
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <p className="text-gray-600">
                          Qty: <span className="text-black">{mat.quantity}</span>
                        </p>
                        <p className="text-gray-600">
                          Cost: <span className="text-black">${parseFloat(mat.cost).toFixed(2)}</span>
                        </p>
                        <p className="text-gray-600">
                          Markup: <span className="text-black">{parseFloat(mat.markup || 0).toFixed(0)}%</span>
                        </p>
                        <p className="text-gray-600">
                          Taxable: <span className="text-black">{mat.taxable === false ? 'No' : 'Yes'}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEditMaterial(mat)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleMaterialTaxable(mat)}
                        className="bg-indigo-500 text-white px-3 py-1 rounded hover:bg-indigo-600 text-sm"
                      >
                        {mat.taxable === false ? 'Add to Taxable' : 'Remove from Taxable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMaterial(mat._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="bg-gray-100 border border-gray-300 rounded-lg p-3 min-w-0">
              <div data-testid="materials-total-controls" className="flex flex-wrap items-center gap-3 mb-2">
                <span className="font-bold text-black">Total Material Cost:</span>
              </div>
              <p className="text-black text-lg font-bold">${totalMaterialCost.toFixed(2)}</p>
            </div>
          </>
        ) : (
          <div className="bg-white border border-gray-300 rounded-lg p-4 text-black text-center">
            No materials added yet
          </div>
        )}
      </div>

      {/* Add Material Form */}
      <div className="mt-4 bg-white border border-gray-300 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-black">Add New Material</h3>
        <div className="mb-3">
          <button
            type="button"
            onClick={loadSupplierCatalogItems}
            disabled={catalogLoading || catalogItems.length > 0}
            className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-indigo-300"
          >
            {catalogItems.length > 0 ? 'Catalog Loaded' : (catalogLoading ? 'Loading Catalog...' : 'Load Catalog Items')}
          </button>
        </div>
        {catalogItems.length > 0 && (
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <label htmlFor="material-catalog-select" className="block text-sm font-medium text-black mb-2">
              Add from Catalog
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <select
                id="material-catalog-select"
                value={selectedCatalogItem}
                onChange={(e) => setSelectedCatalogItem(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded bg-white text-black"
              >
                <option value="">-- Select supplier catalog item --</option>
                {catalogItems.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.supplierName}: {(entry.sku || 'NO-SKU')} - {entry.description} (${entry.price.toFixed(2)})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={applyCatalogItemToMaterialForm}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 whitespace-nowrap"
              >
                Use Selected Item
              </button>
            </div>
          </div>
        )}
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

      <div className="mt-6 bg-white border border-gray-300 rounded-lg p-4">
        <h2 className="text-lg sm:text-xl font-semibold mb-2 text-black">Job expenses</h2>
        <p className="text-sm text-gray-600 mb-3">Direct costs on this job (fuel, permits, consumables charged here).</p>
        {jobExpenses.length > 0 ? (
          <div className="mb-4 space-y-3">
            {jobExpenses.map((expense) => (
              <div
                key={expense._id}
                data-testid={`job-expense-${expense._id}`}
                className="bg-white border border-gray-300 rounded-lg p-3 min-w-0"
              >
                {editingExpenseId === expense._id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="date"
                        aria-label="Edit Date"
                        value={editExpense.date}
                        onChange={(e) => setEditExpense({ ...editExpense, date: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                      <input
                        type="number"
                        step="0.01"
                        aria-label="Edit Amount"
                        value={editExpense.amount}
                        onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                      <select
                        aria-label="Edit Cost center"
                        value={editExpense.costCenterCode}
                        onChange={(e) => setEditExpense({ ...editExpense, costCenterCode: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      >
                        {COST_CENTERS.map((center) => (
                          <option key={center.code} value={center.code}>{center.name}</option>
                        ))}
                      </select>
                      <input
                        aria-label="Edit Payee"
                        placeholder="Payee"
                        value={editExpense.payee}
                        onChange={(e) => setEditExpense({ ...editExpense, payee: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                    </div>
                    <input
                      aria-label="Edit Description"
                      placeholder="Description"
                      value={editExpense.description}
                      onChange={(e) => setEditExpense({ ...editExpense, description: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateJobExpense(expense._id)}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditExpense}
                        className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-job-expense-${expense._id}`}
                        onClick={() => deleteJobExpense(expense._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1 text-black text-sm">
                      <p className="font-semibold">
                        ${Number(expense.amount || 0).toFixed(2)} · {expense.costCenterCode}
                      </p>
                      <p className="text-gray-600 mt-1">
                        {expense.payee || expense.description || 'Expense'}
                        {expense.payee && expense.description ? ` · ${expense.description}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`edit-job-expense-${expense._id}`}
                        onClick={() => startEditExpense(expense)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-job-expense-${expense._id}`}
                        onClick={() => deleteJobExpense(expense._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 mb-3">No job expenses yet.</p>
        )}
        <AlignedFormGrid testId="add-job-expense-grid">
          <AlignedFormField label="Date" htmlFor="job-expense-date" className="col-span-12 md:col-span-3">
            <input
              id="job-expense-date"
              type="date"
              value={newExpense.date}
              onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Amount" htmlFor="job-expense-amount" className="col-span-6 md:col-span-2">
            <input
              id="job-expense-amount"
              type="number"
              step="0.01"
              value={newExpense.amount}
              onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Cost center" htmlFor="job-expense-center" className="col-span-6 md:col-span-3">
            <select
              id="job-expense-center"
              value={newExpense.costCenterCode}
              onChange={(e) => setNewExpense({ ...newExpense, costCenterCode: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            >
              {COST_CENTERS.map((center) => (
                <option key={center.code} value={center.code}>{center.name}</option>
              ))}
            </select>
          </AlignedFormField>
          <AlignedFormField label="Payee" htmlFor="job-expense-payee" className="col-span-12 md:col-span-4">
            <input
              id="job-expense-payee"
              value={newExpense.payee}
              onChange={(e) => setNewExpense({ ...newExpense, payee: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <div className="col-span-12 md:col-span-2">
            <button type="button" onClick={addJobExpense} className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium">
              Add expense
            </button>
          </div>
        </AlignedFormGrid>
      </div>

      <div className="mt-6 bg-white border border-gray-300 rounded-lg p-4">
        <h2 className="text-lg sm:text-xl font-semibold mb-2 text-black">Job hours</h2>
        <p className="text-sm text-gray-600 mb-3">Install, service, consult, and warranty time on this job. Bidding time is recorded in Accounting.</p>
        <p data-testid="job-hours-hourly-cost-help" className="text-sm text-gray-600 mb-3">
          Billed labor is already on Bill Amount. This field is your internal cost for contribution, not the customer labor rate.
        </p>
        {jobLabor.length > 0 ? (
          <div className="mb-4 space-y-3">
            {jobLabor.map((entry) => (
              <div
                key={entry._id}
                data-testid={`job-labor-${entry._id}`}
                className="bg-white border border-gray-300 rounded-lg p-3 min-w-0"
              >
                {editingLaborId === entry._id ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="date"
                        aria-label="Edit Date"
                        value={editLabor.date}
                        onChange={(e) => setEditLabor({ ...editLabor, date: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                      <input
                        type="number"
                        step="0.25"
                        aria-label="Edit Hours"
                        value={editLabor.hours}
                        onChange={(e) => setEditLabor({ ...editLabor, hours: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                      <input
                        type="number"
                        step="0.01"
                        aria-label="Edit your cost per hour (not the customer labor rate)"
                        placeholder="Staff rate if blank"
                        value={editLabor.hourlyCost}
                        onChange={(e) => setEditLabor({ ...editLabor, hourlyCost: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      />
                      <select
                        aria-label="Edit Work type"
                        value={editLabor.workType}
                        onChange={(e) => setEditLabor({ ...editLabor, workType: e.target.value })}
                        className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                      >
                        {JOB_LABOR_WORK_TYPES.map((value) => (
                          <option key={value} value={value}>
                            {LABOR_WORK_TYPES.find((type) => type.value === value)?.label || value}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      aria-label="Edit Notes"
                      placeholder="Notes"
                      value={editLabor.notes}
                      onChange={(e) => setEditLabor({ ...editLabor, notes: e.target.value })}
                      className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateJobLabor(entry._id)}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditLabor}
                        className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-job-labor-${entry._id}`}
                        onClick={() => deleteJobLabor(entry._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 min-w-0">
                    <div className="min-w-0 flex-1 text-black text-sm">
                      <p className="font-semibold">
                        {entry.hours} hrs · {LABOR_WORK_TYPES.find((type) => type.value === entry.workType)?.label || entry.workType} · ${Number(entry.hourlyCost || 0).toFixed(2)}/hr
                      </p>
                      {entry.notes ? <p className="text-gray-600 mt-1">{entry.notes}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`edit-job-labor-${entry._id}`}
                        onClick={() => startEditLabor(entry)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-job-labor-${entry._id}`}
                        onClick={() => deleteJobLabor(entry._id)}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 mb-3">No hours logged yet.</p>
        )}
        <AlignedFormGrid testId="add-job-labor-grid">
          <AlignedFormField label="Date" htmlFor="job-labor-date" className="col-span-12 md:col-span-3">
            <input
              id="job-labor-date"
              type="date"
              value={newLabor.date}
              onChange={(e) => setNewLabor({ ...newLabor, date: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Hours" htmlFor="job-labor-hours" className="col-span-6 md:col-span-2">
            <input
              id="job-labor-hours"
              type="number"
              step="0.25"
              value={newLabor.hours}
              onChange={(e) => setNewLabor({ ...newLabor, hours: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Your cost per hour (not the customer labor rate)" htmlFor="job-labor-rate" className="col-span-6 md:col-span-2">
            <input
              id="job-labor-rate"
              type="number"
              step="0.01"
              placeholder="Staff rate if blank"
              value={newLabor.hourlyCost}
              onChange={(e) => setNewLabor({ ...newLabor, hourlyCost: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            />
          </AlignedFormField>
          <AlignedFormField label="Work type" htmlFor="job-labor-type" className="col-span-12 md:col-span-3">
            <select
              id="job-labor-type"
              value={newLabor.workType}
              onChange={(e) => setNewLabor({ ...newLabor, workType: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
            >
              {JOB_LABOR_WORK_TYPES.map((value) => (
                <option key={value} value={value}>
                  {LABOR_WORK_TYPES.find((type) => type.value === value)?.label || value}
                </option>
              ))}
            </select>
          </AlignedFormField>
          <div className="col-span-12 md:col-span-2">
            <button type="button" onClick={addJobLabor} className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 font-medium">
              Add hours
            </button>
          </div>
        </AlignedFormGrid>
      </div>
      </section>

      {/* Notes */}
      <div className="mt-6 bg-white border border-gray-300 rounded-lg p-4">
        <h2 className="text-xl font-semibold mb-4 text-black">Notes</h2>
        {project.notes && project.notes.length > 0 ? (
          <ul className="space-y-2 mb-4">
            {project.notes.map((note, i) => (
              <li key={note._id ? String(note._id) : `note-${i}`} className="text-black border-l-4 border-blue-400 pl-3 py-1">
                {editingNoteId === String(note._id) ? (
                  <div className="space-y-2">
                    <textarea
                      aria-label="Edit note text"
                      rows={3}
                      value={editNoteText}
                      onChange={(e) => setEditNoteText(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-black"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => saveEditedNote(String(note._id))}
                        className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                      >
                        Save Note
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditNote}
                        className="bg-gray-200 text-black px-3 py-1 rounded hover:bg-gray-300"
                      >
                        Cancel Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap">{note.text}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => startEditNote(note)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm"
                      >
                        Edit Note
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteNote(String(note._id))}
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                      >
                        Delete Note
                      </button>
                    </div>
                    {note.addedAt && (
                      <p className="text-sm text-gray-500 mt-1">{format(new Date(note.addedAt), 'PPp')}</p>
                    )}
                  </>
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