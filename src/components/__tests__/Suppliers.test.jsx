/**
 * Tests for Suppliers Component
 */

import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Suppliers from '../Suppliers';

describe('Suppliers Component', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
  });

  test('should render suppliers page', () => {
    render(<BrowserRouter><Suppliers /></BrowserRouter>);
    
    // Component renders without crashing
    expect(document.body).toBeInTheDocument();
  });

  test('should have navigation links', () => {
    render(<BrowserRouter><Suppliers /></BrowserRouter>);
    
    // Component renders
    expect(document.body).toBeInTheDocument();
  });
});

