import {
  COMPANY_PHONE_DISPLAY,
  COMPANY_PHONE_TEL,
} from '../companyContact';

describe('companyContact', () => {
  test('exposes a tappable tel: URL for the Tennessee office number', () => {
    expect(COMPANY_PHONE_DISPLAY).toBe('(931) 279-7879');
    expect(COMPANY_PHONE_TEL).toBe('tel:+19312797879');
  });
});
