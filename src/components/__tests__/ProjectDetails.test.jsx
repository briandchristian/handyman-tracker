/**
 * Tests for ProjectDetails Component
 * Testing: Project display, Status updates, Materials management, Error handling
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import ProjectDetails from '../ProjectDetails';
import { jsPDF } from 'jspdf';
import { strToU8, zipSync } from 'fflate';
import { BID_QUOTE_LOCAL_STORAGE_KEY } from '../../utils/bidQuoteSequence';

jest.mock('axios');
jest.mock('jspdf', () => ({
  jsPDF: jest.fn()
}));

const renderWithRouter = (customerId = 'cust123', projectId = 'proj456') => {
  return render(
    <MemoryRouter initialEntries={[`/projects/${customerId}/${projectId}`]}>
      <Routes>
        <Route path="/projects/:customerId/:projectId" element={<ProjectDetails />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('ProjectDetails Component', () => {
  let mockPdfDoc;
  let OriginalImage;
  const mockCustomer = {
    _id: 'cust123',
    name: 'John Doe',
    projects: [
      {
        _id: 'proj456',
        name: 'Kitchen Remodel',
        description: 'Complete kitchen renovation',
        status: 'Pending',
        materials: [],
        bidAmount: 0,
        billAmount: 0
      }
    ]
  };

  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
    localStorage.removeItem(BID_QUOTE_LOCAL_STORAGE_KEY);
    jest.clearAllMocks();
    global.alert = jest.fn();
    global.URL.createObjectURL = jest.fn(() => 'blob:bid-pdf-url');
    window.open = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(0)
    });
    mockPdfDoc = {
      internal: {
        pageSize: {
          getWidth: jest.fn(() => 210),
          getHeight: jest.fn(() => 297)
        }
      },
      setFontSize: jest.fn(),
      setFont: jest.fn(),
      setFillColor: jest.fn(),
      setDrawColor: jest.fn(),
      setTextColor: jest.fn(),
      text: jest.fn(),
      line: jest.fn(),
      rect: jest.fn(),
      addPage: jest.fn(),
      addImage: jest.fn(),
      splitTextToSize: jest.fn((str) => [String(str)]),
      output: jest.fn(() => new Blob(['pdf'], { type: 'application/pdf' }))
    };
    jsPDF.mockImplementation(() => mockPdfDoc);

    OriginalImage = global.Image;
    global.Image = class {
      constructor() {
        this.naturalWidth = 0;
        this.naturalHeight = 0;
      }

      set src(_) {
        if (this.onerror) this.onerror(new Error('mock image load error'));
      }
    };
  });

  afterEach(() => {
    global.Image = OriginalImage;
  });

  describe('Loading and Display', () => {
    test('should fetch and display project details', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });

      renderWithRouter('cust123', 'proj456');

      await waitFor(() => {
        expect(axios.get).toHaveBeenCalledWith(
          expect.stringContaining('/api/customers/cust123'),
          expect.any(Object)
        );
      });
    });

    test('should show loading state', () => {
      axios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithRouter();

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    test('should handle project not found', async () => {
      const customerWithoutProject = {
        ...mockCustomer,
        projects: [{ _id: 'different-id', name: 'Other Project' }]
      };
      axios.get.mockResolvedValue({ data: customerWithoutProject });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/project not found/i)).toBeInTheDocument();
      });
    });

    test('should handle authentication error', async () => {
      localStorage.removeItem('token');
      axios.get.mockResolvedValue({ data: mockCustomer });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/not authenticated/i)).toBeInTheDocument();
      });
    });
  });

  describe('Project information and equipment', () => {
    test('should show None for equipment when no categories selected', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('project-equipment-display')).toHaveTextContent('None');
      });
    });

    test('should list selected equipment categories in project information', async () => {
      const customerWithEquip = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            equipmentCategories: {
              burglarAlarm: true,
              fireAlarm: false,
              accessControl: true,
              cctv: true,
              monitoring: true
            }
          }
        ]
      };
      axios.get.mockResolvedValue({ data: customerWithEquip });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('project-equipment-display')).toHaveTextContent('Burglar Alarm');
        expect(screen.getByTestId('project-equipment-display')).toHaveTextContent('Access Control');
        expect(screen.getByTestId('project-equipment-display')).toHaveTextContent('CCTV');
        expect(screen.getByTestId('project-equipment-display')).toHaveTextContent('Monitoring');
      });
    });

    test('should render proposed system statement above materials for selected categories', async () => {
      const customerWithEquip = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            equipmentCategories: {
              burglarAlarm: true,
              fireAlarm: true,
              accessControl: true,
              cctv: true,
              monitoring: false
            }
          }
        ]
      };
      axios.get.mockResolvedValue({ data: customerWithEquip });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('proposed-system-title')).toHaveTextContent('Proposed System:');
      });
      expect(screen.getByTestId('proposed-system-text')).toHaveTextContent(
        'Professional installation of a wireless/hardwired burglar alarm system, a fire alarm system, an access control system, and a CCTV system including:'
      );
    });

    test('should PUT project info when saving edit form', async () => {
      let afterSave = false;
      const updatedCustomer = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            description: 'Updated scope',
            equipmentCategories: {
              burglarAlarm: false,
              fireAlarm: true,
              accessControl: false,
              cctv: false,
              monitoring: false
            }
          }
        ]
      };
      axios.get.mockImplementation(() =>
        Promise.resolve({ data: afterSave ? updatedCustomer : mockCustomer })
      );
      axios.put.mockImplementation(async () => {
        afterSave = true;
        return { data: { msg: 'Project updated' } };
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('edit-project-info')).toBeInTheDocument();
      });

      await userEvent.click(screen.getByTestId('edit-project-info'));

      await waitFor(() => {
        expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
      });

      const desc = screen.getByLabelText(/^Description$/i);
      await userEvent.clear(desc);
      await userEvent.type(desc, 'Updated scope');
      await userEvent.click(screen.getByRole('checkbox', { name: /Fire Alarm/i }));

      await userEvent.click(screen.getByTestId('save-project-info'));

      await waitFor(() => {
        expect(axios.put).toHaveBeenCalledWith(
          expect.stringMatching(/\/api\/customers\/cust123\/projects\/proj456$/),
          expect.objectContaining({
            name: 'Kitchen Remodel',
            description: 'Updated scope',
            equipmentCategories: {
              burglarAlarm: false,
              fireAlarm: true,
              accessControl: false,
              cctv: false,
              monitoring: false
            }
          }),
          expect.any(Object)
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('project-equipment-display')).toHaveTextContent('Fire Alarm');
      });
    });

    test('should use yellow edit button styling for project information', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('edit-project-info')).toBeInTheDocument();
      });

      expect(screen.getByTestId('edit-project-info').className).toContain('bg-yellow-500');
    });
  });

  describe('Status Updates', () => {
    test('should update bid amount', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      axios.put.mockResolvedValue({ 
        data: { ...mockCustomer.projects[0], bidAmount: 5000, status: 'Bidded' }
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      const bidInput = screen.getByPlaceholderText(/Enter bid amount/i);
      await userEvent.type(bidInput, '5000');

      const bidButton = screen.getByText(/submit bid/i);
      
      // Mock the refresh call after bid update
      axios.get.mockResolvedValueOnce({ data: mockCustomer });
      
      await userEvent.click(bidButton);

      await waitFor(() => {
        expect(axios.put).toHaveBeenCalled();
      });
    });

    test('should size mark as completed button like add material button', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      const markCompletedButton = screen.getByRole('button', { name: /mark as completed/i });
      expect(markCompletedButton.className).toContain('px-4');
      expect(markCompletedButton.className).toContain('py-2');
      expect(markCompletedButton.className).toContain('font-medium');
      expect(markCompletedButton.className).not.toContain('w-full');
    });

    test('should align mark as completed button to the right', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      const { container } = renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      const markCompletedButton = screen.getByRole('button', { name: /mark as completed/i });
      const wrapper = markCompletedButton.parentElement;
      expect(wrapper).toBeTruthy();
      expect(wrapper.className).toContain('justify-end');

      // Ensure wrapper is still the completed-section container.
      expect(container.textContent).toContain('Mark as Completed');
    });
  });

  describe('Materials Management', () => {
    test('should add material to project', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      axios.post.mockResolvedValue({
        data: [{ _id: 'm1', item: 'Lumber', quantity: 100, cost: 500, markup: 0 }]
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      // Find material input fields
      const itemInput = screen.getByPlaceholderText('Item');
      const quantityInput = screen.getByPlaceholderText('Quantity');
      const costInput = screen.getByPlaceholderText(/Cost \(\$\)/i);
      const markupInput = screen.getByPlaceholderText(/Markup %/i);

      await userEvent.type(itemInput, 'Lumber');
      await userEvent.type(quantityInput, '100');
      await userEvent.type(costInput, '500');
      await userEvent.type(markupInput, '10');

      axios.get.mockResolvedValueOnce({ data: mockCustomer });
      
      const addButton = screen.getByText(/add material/i);
      await userEvent.click(addButton);

      await waitFor(() => {
        expect(axios.post).toHaveBeenCalled();
        expect(axios.post.mock.calls[0][1]).toEqual(
          expect.objectContaining({
            item: 'Lumber',
            quantity: 100,
            cost: 500,
            markup: 10
          })
        );
      });
    });

    test('should show labels above quantity, cost, and markup inputs', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Quantity')).toBeInTheDocument();
      expect(screen.getByLabelText('Cost')).toBeInTheDocument();
      expect(screen.getByLabelText('%Markup')).toBeInTheDocument();
    });

    test('should calculate total material cost using quantity', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              { _id: 'm1', item: 'Lumber', quantity: 4, cost: 10 }
            ]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMaterials });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      // Unit cost ($10) * quantity (4) => $40.00 total.
      expect(screen.getByText('$40.00')).toBeInTheDocument();
    });

    test('should edit an existing material line item', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              { _id: 'm1', item: 'Lumber', quantity: 4, cost: 10 }
            ]
          }
        ]
      };

      const customerWithMaterialsUpdated = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              { _id: 'm1', item: 'Lumber', quantity: 5, cost: 10 }
            ]
          }
        ]
      };

      axios.get.mockResolvedValueOnce({ data: customerWithMaterials });
      axios.put.mockResolvedValueOnce({ data: { msg: 'Material updated' } });
      axios.get.mockResolvedValueOnce({ data: customerWithMaterialsUpdated });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Lumber')).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole('button', { name: /^edit$/i });
      expect(editButtons.length).toBeGreaterThanOrEqual(2);
      await userEvent.click(editButtons[1]);

      const qtyInput = screen.getByLabelText(/edit quantity/i);
      await userEvent.clear(qtyInput);
      await userEvent.type(qtyInput, '5');

      const costInput = screen.getByLabelText(/edit cost/i);
      await userEvent.clear(costInput);
      await userEvent.type(costInput, '10');

      await userEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => {
        expect(axios.put).toHaveBeenCalled();
        const [url, body] = axios.put.mock.calls[0];
        expect(url).toContain('/materials/m1');
        expect(body).toEqual(
          expect.objectContaining({
            item: 'Lumber',
            quantity: 5,
            cost: 10,
            markup: 0
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByText('$50.00')).toBeInTheDocument();
      });
    });

    test('should keep materials table fixed and allow expanding long item text', async () => {
      const longItem = 'Premium moisture resistant pressure treated lumber board for exterior framing and structural reinforcement';
      const customerWithLongMaterial = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              { _id: 'm-long', item: longItem, quantity: 1, cost: 99.99 }
            ]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithLongMaterial });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      const table = screen.getByRole('table');
      expect(table.className).toContain('table-fixed');

      const showMoreBtn = screen.getByTestId('material-expand-m-long');
      expect(showMoreBtn).toHaveTextContent(/show more/i);

      await userEvent.click(showMoreBtn);
      expect(screen.getByTestId('material-expand-m-long')).toHaveTextContent(/show less/i);
    });

    test('should keep project details layout compact with constrained table wrapper', async () => {
      const customerWithLongMaterial = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              { _id: 'm1', item: 'Very long material description text that should stay contained in layout', quantity: 2, cost: 12.5 }
            ]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithLongMaterial });

      const { container } = renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      const root = container.firstChild;
      expect(root.className).toContain('max-w-6xl');
      expect(root.className).toContain('mx-auto');

      const wrapper = screen.getByTestId('materials-table-wrapper');
      expect(wrapper.className).toContain('overflow-x-auto');
    });

    test('should apply markup percent into total material cost', async () => {
      const customerWithMarkup = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              // (100 + 10%) * quantity 2 = 220
              { _id: 'm1', item: 'Lumber', quantity: 2, cost: 100, markup: 10 }
            ]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMarkup });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      expect(screen.getByText('$220.00')).toBeInTheDocument();
      expect(screen.getByText('10%')).toBeInTheDocument();
    });

    test('should show generate bid button near total material cost', async () => {
      const customerWithMarkup = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              { _id: 'm1', item: 'Lumber', quantity: 2, cost: 100, markup: 10 }
            ]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMarkup });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /regenerate bid/i })).toBeInTheDocument();
        expect(screen.getByLabelText(/include monitoring agreement/i)).toBeInTheDocument();
      });
    });

    test('should use mobile-safe wrapping layout for key project controls', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'Panel', quantity: 1, cost: 100, markup: 0 }]
          }
        ]
      };
      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('project-top-actions')).toBeInTheDocument();
      });

      expect(screen.getByTestId('project-top-actions').className).toContain('flex-col');
      expect(screen.getByTestId('bid-form-row').className).toContain('flex-col');
      expect(screen.getByTestId('bill-form-row').className).toContain('flex-col');
      expect(screen.getByTestId('schedule-form-row').className).toContain('flex-col');
      expect(screen.getByTestId('materials-total-controls').className).toContain('flex-wrap');
    });

    test('should render mobile material cards and keep desktop table responsive', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'Panel', quantity: 2, cost: 150, markup: 10 }]
          }
        ]
      };
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = jest.fn().mockImplementation(() => ({
        matches: true,
        media: '(max-width: 639px)',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }));
      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('materials-mobile-list')).toBeInTheDocument();
      });

      expect(screen.getByTestId('materials-mobile-list').className).toContain('sm:hidden');
      expect(screen.queryByTestId('materials-table-wrapper')).not.toBeInTheDocument();
      expect(screen.getByText('Panel')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /edit/i }).length).toBeGreaterThan(0);
      window.matchMedia = originalMatchMedia;
    });

    test('should generate and open bid pdf from project information', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        phone: '555-123-4567',
        address: '123 Main St',
        projects: [
          {
            ...mockCustomer.projects[0],
            description: 'Complete kitchen renovation',
            materials: [
              { _id: 'm1', item: 'Lumber', quantity: 2, cost: 100, markup: 10 }
            ]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));

      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
        expect(global.URL.createObjectURL).toHaveBeenCalled();
        expect(window.open).toHaveBeenCalledWith('blob:bid-pdf-url', '_blank');
      });
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/customers/cust123/projects/proj456/notes'),
        expect.objectContaining({
          text: expect.stringContaining('Last quote number issued: 1000')
        }),
        expect.any(Object)
      );

      const bidTitleCall = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line.startsWith('Bid:')
      );
      expect(bidTitleCall[0]).toContain('John Doe');
      const projectCall = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line.startsWith('Project:')
      );
      expect(projectCall[0]).toContain('Kitchen Remodel');

      const quoteMetaCall = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line.includes('Quote #:')
      );
      expect(quoteMetaCall[0]).toMatch(/Date:\s*\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(quoteMetaCall[0]).toContain('Quote #: 1000');
      expect(quoteMetaCall[0]).toContain('Valid for 30 days');

      const whatsIncludedTitle = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === "What's Included:"
      );
      expect(whatsIncludedTitle).toBeTruthy();
      expect(
        mockPdfDoc.text.mock.calls.some(
          ([line]) => typeof line === 'string' && line.includes('All equipment and materials')
        )
      ).toBe(true);

      const whatsNotIncludedTitle = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === "What's Not Included:"
      );
      expect(whatsNotIncludedTitle).toBeTruthy();
      expect(
        mockPdfDoc.text.mock.calls.some(
          ([line]) => typeof line === 'string' && line.includes('Monitoring (separate contract, ~$35 /month)')
        )
      ).toBe(true);

      const paymentTermsTitle = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Payment Terms:'
      );
      expect(paymentTermsTitle).toBeTruthy();
      const acceptedTitle = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Accepted & Agreed:'
      );
      expect(acceptedTitle).toBeTruthy();
      const clarificationsTitle = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Clarifications & Project Assumptions:'
      );
      expect(clarificationsTitle).toBeTruthy();
      const sectionOrder = mockPdfDoc.text.mock.calls
        .map(([line]) => line)
        .filter((line) => typeof line === 'string');
      const clarificationsIdx = sectionOrder.indexOf('Clarifications & Project Assumptions:');
      const nextStepsIdx = sectionOrder.indexOf('Next Steps:');
      const acceptedIdx = sectionOrder.indexOf('Accepted & Agreed:');
      expect(clarificationsIdx).toBeGreaterThan(-1);
      expect(nextStepsIdx).toBeGreaterThan(clarificationsIdx);
      expect(acceptedIdx).toBeGreaterThan(nextStepsIdx);
    });

    test('should render materials in Item/Description/Quantity table and wrap description', async () => {
      const customerWithLongMaterial = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [
              {
                _id: 'm1',
                item: 'Very long camera and wiring package description for rear parking lot and side doors',
                quantity: 12,
                cost: 35,
                markup: 0
              }
            ]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithLongMaterial });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));
      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
      });

      const itemHeader = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Item'
      );
      const descriptionHeader = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Description'
      );
      const quantityHeader = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Quantity'
      );
      expect(itemHeader).toBeTruthy();
      expect(descriptionHeader).toBeTruthy();
      expect(quantityHeader).toBeTruthy();

      expect(mockPdfDoc.splitTextToSize).toHaveBeenCalledWith(
        expect.stringContaining('Very long camera and wiring package description'),
        expect.any(Number)
      );
    });

    test('should include proposed system block on bid pdf when categories are selected', async () => {
      const customerWithEquip = {
        ...mockCustomer,
        phone: '555-123-4567',
        address: '123 Main St',
        projects: [
          {
            ...mockCustomer.projects[0],
            description: 'Security work',
            equipmentCategories: {
              burglarAlarm: true,
              fireAlarm: false,
              cctv: true,
              monitoring: false
            },
            materials: [{ _id: 'm1', item: 'Panel', quantity: 1, cost: 50, markup: 0 }]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithEquip });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));

      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
      });

      const proposedSystemTitleCall = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Proposed System:'
      );
      expect(proposedSystemTitleCall).toBeTruthy();

      const proposedSystemLineCall = mockPdfDoc.text.mock.calls.find(
        ([line]) =>
          typeof line === 'string' &&
          line.includes('Professional installation of a wireless/hardwired burglar alarm system') &&
          line.includes('a CCTV system including:')
      );
      expect(proposedSystemLineCall).toBeTruthy();
    });

    test('should place description above divider, with proposed system below divider and above materials', async () => {
      const customerWithEquip = {
        ...mockCustomer,
        phone: '555-123-4567',
        address: '123 Main St',
        projects: [
          {
            ...mockCustomer.projects[0],
            description: 'Security work',
            equipmentCategories: {
              burglarAlarm: true,
              fireAlarm: false,
              accessControl: false,
              cctv: true,
              monitoring: false
            },
            materials: [{ _id: 'm1', item: 'Panel', quantity: 1, cost: 50, markup: 0 }]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithEquip });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));
      await waitFor(() => {
        expect(jsPDF).toHaveBeenCalled();
      });

      const dividerCall = mockPdfDoc.line.mock.calls[0];
      const dividerY = dividerCall[1];

      const descriptionCall = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line.startsWith('Description:')
      );
      const proposedTitleCall = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Proposed System:'
      );
      const materialsCall = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line === 'Materials'
      );

      expect(descriptionCall[2]).toBeLessThan(dividerY);
      expect(proposedTitleCall[2]).toBeGreaterThan(dividerY);
      expect(materialsCall[2]).toBeGreaterThan(proposedTitleCall[2]);
    });

    test('should increment quote number on each generate bid', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'X', quantity: 1, cost: 1, markup: 0 }]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));
      await waitFor(() => expect(jsPDF).toHaveBeenCalled());

      const firstQuote = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line.includes('Quote #:')
      );
      expect(firstQuote[0]).toContain('Quote #: 1000');

      mockPdfDoc.text.mockClear();
      jsPDF.mockClear();

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));
      await waitFor(() => expect(jsPDF).toHaveBeenCalled());

      const secondQuote = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line.includes('Quote #:')
      );
      expect(secondQuote[0]).toContain('Quote #: 1001');
    });

    test('should regenerate bid with last quote number without incrementing', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'X', quantity: 1, cost: 1, markup: 0 }]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /regenerate bid/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));
      await waitFor(() => expect(jsPDF).toHaveBeenCalled());
      expect(
        mockPdfDoc.text.mock.calls.find(
          ([line]) => typeof line === 'string' && line.includes('Quote #:')
        )[0]
      ).toContain('Quote #: 1000');
      const postCallsAfterGenerate = axios.post.mock.calls.length;

      mockPdfDoc.text.mockClear();
      jsPDF.mockClear();

      await userEvent.click(screen.getByRole('button', { name: /regenerate bid/i }));
      await waitFor(() => expect(jsPDF).toHaveBeenCalled());

      const regeneratedQuote = mockPdfDoc.text.mock.calls.find(
        ([line]) => typeof line === 'string' && line.includes('Quote #:')
      );
      expect(regeneratedQuote[0]).toContain('Quote #: 1000');
      expect(axios.post.mock.calls.length).toBe(postCallsAfterGenerate);
    });

    test('should append monitoring agreement contract text when selected', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'X', quantity: 1, cost: 1, markup: 0 }]
          }
        ]
      };

      const agreementXml = `
        <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
          <w:body>
            <w:p><w:r><w:t>ALARM MONITORING SERVICES AGREEMENT</w:t></w:r></w:p>
            <w:p><w:r><w:t>Monitoring term is 36 months.</w:t></w:r></w:p>
          </w:body>
        </w:document>
      `;
      const zipped = zipSync({ 'word/document.xml': strToU8(agreementXml) });
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength)
      });

      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByLabelText(/include monitoring agreement/i));
      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));
      await waitFor(() => expect(jsPDF).toHaveBeenCalled());

      expect(global.fetch).toHaveBeenCalledWith('/ALARM MONITORING SERVICES AGREEMENT.docx');
      expect(mockPdfDoc.addPage).toHaveBeenCalled();
      expect(mockPdfDoc.rect).toHaveBeenCalled();
      expect(mockPdfDoc.line).toHaveBeenCalled();
      expect(
        mockPdfDoc.text.mock.calls.some(
          ([line]) => typeof line === 'string' && line === 'Monitoring Agreement Contract'
        )
      ).toBe(true);
      expect(
        mockPdfDoc.text.mock.calls.some(
          ([line]) => typeof line === 'string' && line === 'Attachment A'
        )
      ).toBe(true);
      expect(
        mockPdfDoc.text.mock.calls.some(
          ([line]) => typeof line === 'string' && line.includes('Attached to Bid')
        )
      ).toBe(true);
      expect(
        mockPdfDoc.text.mock.calls.some(
          ([line]) =>
            typeof line === 'string' &&
            (line.includes('Monitoring term is 36 months.') ||
              line.includes('Monitoring agreement source file could not be parsed.'))
        )
      ).toBe(true);
    });

    test('should add branding image to bid pdf header', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'Lumber', quantity: 1, cost: 50, markup: 0 }]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      global.Image = class {
        constructor() {
          this.naturalWidth = 200;
          this.naturalHeight = 200;
        }

        set src(_) {
          if (this.onload) this.onload();
        }
      };

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));

      await waitFor(() => {
        expect(mockPdfDoc.addImage).toHaveBeenCalled();
      });
      const addImageArgs = mockPdfDoc.addImage.mock.calls[0];
      expect(addImageArgs[4]).toBeLessThanOrEqual(42);
      expect(addImageArgs[5]).toBeLessThanOrEqual(32);
    });

    test('should place project information below header image without overlap', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        phone: '555-111-2222',
        address: '123 Main St',
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'Panel', quantity: 1, cost: 100, markup: 0 }]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      global.Image = class {
        constructor() {
          this.naturalWidth = 200;
          this.naturalHeight = 200;
        }

        set src(_) {
          if (this.onload) this.onload();
        }
      };

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));

      const textLines = mockPdfDoc.text.mock.calls
        .map(([line]) => (typeof line === 'string' ? line : ''));
      expect(textLines).toContain('CHRISTIAN');
      expect(textLines).toContain('SECURITY');
      expect(textLines).toContain('SERVICES');

      const projectLineCall = mockPdfDoc.text.mock.calls.find(
        ([firstArg]) => typeof firstArg === 'string' && firstArg.startsWith('Project:')
      );
      expect(projectLineCall).toBeTruthy();
      expect(projectLineCall[2]).toBeGreaterThanOrEqual(50);
    });

    test('should include license and phone in bid pdf header text', async () => {
      const customerWithMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: [{ _id: 'm1', item: 'Wire', quantity: 1, cost: 10, markup: 0 }]
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      global.Image = class {
        constructor() {
          this.naturalWidth = 200;
          this.naturalHeight = 200;
        }

        set src(_) {
          if (this.onload) this.onload();
        }
      };

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));

      const licenseCall = mockPdfDoc.text.mock.calls.some(
        ([line]) => typeof line === 'string' && line.includes('2622')
      );
      const phoneCall = mockPdfDoc.text.mock.calls.some(
        ([line]) => typeof line === 'string' && line.includes('801-851-0909')
      );
      expect(licenseCall).toBe(true);
      expect(phoneCall).toBe(true);
    });

    test('should add a new pdf page when materials exceed page height', async () => {
      const manyMaterials = Array.from({ length: 65 }).map((_, i) => ({
        _id: `m${i + 1}`,
        item: `Material item ${i + 1} with longer description text for pagination test`,
        quantity: 1,
        cost: 10,
        markup: 0
      }));
      const customerWithManyMaterials = {
        ...mockCustomer,
        projects: [
          {
            ...mockCustomer.projects[0],
            materials: manyMaterials
          }
        ]
      };

      axios.get.mockResolvedValue({ data: customerWithManyMaterials });
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /^generate bid$/i })).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', { name: /^generate bid$/i }));

      await waitFor(() => {
        expect(mockPdfDoc.addPage).toHaveBeenCalled();
      });
    });
  });

  describe('Facebook Pixel ViewContent', () => {
    test('should fire fbq ViewContent when project details are displayed', async () => {
      const fbq = jest.fn();
      window.fbq = fbq;

      axios.get.mockResolvedValue({ data: mockCustomer });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });

      expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', { value: 1 });

      delete window.fbq;
    });

    test('should not throw when fbq is undefined', async () => {
      delete window.fbq;
      axios.get.mockResolvedValue({ data: mockCustomer });

      expect(() => renderWithRouter()).not.toThrow();

      await waitFor(() => {
        expect(screen.getByText('Kitchen Remodel')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    test('should have back to customers link', async () => {
      axios.get.mockResolvedValue({ data: mockCustomer });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/back to customers/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle network error', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    test('should handle missing projects array', async () => {
      axios.get.mockResolvedValue({ data: { ...mockCustomer, projects: null } });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText(/no projects/i)).toBeInTheDocument();
      });
    });
  });
});

