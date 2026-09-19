import { render, screen } from '@testing-library/react';
import FormStatus from '../FormStatus';

describe('FormStatus', () => {
  test('renders nothing when there is no message', () => {
    const { container } = render(<FormStatus message="" />);
    expect(container).toBeEmptyDOMElement();
  });

  test('exposes the message as an alert', () => {
    render(<FormStatus message="Invalid email or password." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByTestId('form-status')).toBeInTheDocument();
  });
});
