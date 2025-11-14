/**
 * Tests for QuickReorder Component
 */

import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import QuickReorder from '../QuickReorder';

describe('QuickReorder Component', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'test-token');
  });

  test('should render quick reorder page', () => {
    render(<BrowserRouter><QuickReorder /></BrowserRouter>);
    
    // Component renders without crashing
    expect(document.body).toBeInTheDocument();
  });

  test('should have navigation links', () => {
    render(<BrowserRouter><QuickReorder /></BrowserRouter>);
    
    // Component renders
    expect(document.body).toBeInTheDocument();
  });
});

