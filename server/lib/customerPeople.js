/**
 * A customer is a business or a private individual.
 * People are the individuals associated with a business.
 * A private individual is the person and their home, so that account has no people list.
 */

export const CUSTOMER_KINDS = [
  { value: 'business', label: 'Business' },
  { value: 'individual', label: 'Private individual' },
];

export function normalizeCustomerKind(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (raw === 'business' || raw === 'company') return 'business';
  if (raw === 'individual' || raw === 'private' || raw === 'person') return 'individual';
  return null;
}

export function customerKindLabel(kind) {
  const match = CUSTOMER_KINDS.find((item) => item.value === normalizeCustomerKind(kind));
  return match ? match.label : '';
}

export function validateCustomerPerson(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return { error: 'Person name is required' };
  return {
    value: {
      name,
      role: String(input.role || '').trim(),
      email: String(input.email || '').trim(),
      phone: String(input.phone || '').trim(),
    },
  };
}

export function registerCustomerPeopleRoutes(app, { Customer, authMiddleware, adminMiddleware }) {
  const guard = [authMiddleware, adminMiddleware];

  app.post('/api/customers/:customerId/people', ...guard, async (req, res) => {
    try {
      const customer = await Customer.findById(req.params.customerId);
      if (!customer) return res.status(404).json({ msg: 'Customer not found' });
      if (normalizeCustomerKind(customer.kind) !== 'business') {
        return res.status(400).json({
          msg: 'Add people on a business. A private individual is the person and their home.',
        });
      }
      const checked = validateCustomerPerson(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      customer.people.push(checked.value);
      await customer.save();
      res.status(201).json(customer.people[customer.people.length - 1]);
    } catch (err) {
      console.error('Error adding customer person:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.put('/api/customers/:customerId/people/:personId', ...guard, async (req, res) => {
    try {
      const customer = await Customer.findById(req.params.customerId);
      if (!customer) return res.status(404).json({ msg: 'Customer not found' });
      const person = customer.people.id(req.params.personId);
      if (!person) return res.status(404).json({ msg: 'Person not found' });
      const checked = validateCustomerPerson(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      person.set(checked.value);
      await customer.save();
      res.json(person);
    } catch (err) {
      console.error('Error updating customer person:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.delete('/api/customers/:customerId/people/:personId', ...guard, async (req, res) => {
    try {
      const customer = await Customer.findById(req.params.customerId);
      if (!customer) return res.status(404).json({ msg: 'Customer not found' });
      const person = customer.people.id(req.params.personId);
      if (!person) return res.status(404).json({ msg: 'Person not found' });
      customer.people.pull(person._id);
      await customer.save();
      res.json({ msg: 'Person removed' });
    } catch (err) {
      console.error('Error removing customer person:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
}
