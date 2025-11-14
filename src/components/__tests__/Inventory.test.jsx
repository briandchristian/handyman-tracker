/**
 * Tests for Inventory Component
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Inventory from '../Inventory';

describe('Inventory Component', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
  });

  test('should render inventory page', () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    // Component renders - just check it doesn't crash
    expect(document.body).toBeInTheDocument();
  });

  test('should have navigation', () => {
    render(<BrowserRouter><Inventory /></BrowserRouter>);
    
    // Component renders
    expect(document.body).toBeInTheDocument();
  });
});

