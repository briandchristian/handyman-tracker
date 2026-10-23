/**
 * Customer work routes: job tickets, bids, and optional projects.
 * A bid is stored on its own and does not create a job.
 */

import {
  nextCustomerRecordNumber,
  validateBid,
  validatePlan,
  validateServiceJob,
} from './customerWork.js';

async function loadCustomer(Customer, id, res) {
  const customer = await Customer.findById(id);
  if (!customer) {
    res.status(404).json({ msg: 'Customer not found' });
    return null;
  }
  return customer;
}

function storedNumbers(records, field) {
  return (Array.isArray(records) ? records : [])
    .map((record) => String(record?.[field] || '').trim())
    .filter(Boolean);
}

function issuedNumber(customer, kind, records, field, current = '') {
  const kept = String(current || '').trim();
  if (kept) return { value: kept };
  return nextCustomerRecordNumber(customer.accountNumber, kind, storedNumbers(records, field));
}

export function registerCustomerWorkRoutes(app, { Customer, authMiddleware, adminMiddleware }) {
  const guard = [authMiddleware, adminMiddleware];

  app.post('/api/customers/:customerId/service-jobs', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const checked = validateServiceJob(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      const assigned = issuedNumber(customer, 'job', customer.serviceJobs, 'jobNumber');
      if (assigned.error) return res.status(400).json({ msg: assigned.error });
      customer.serviceJobs.push({ ...checked.value, jobNumber: assigned.value });
      await customer.save();
      res.status(201).json(customer.serviceJobs[customer.serviceJobs.length - 1]);
    } catch (err) {
      console.error('Error creating service job:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.put('/api/customers/:customerId/service-jobs/:jobId', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const job = customer.serviceJobs.id(req.params.jobId);
      if (!job) return res.status(404).json({ msg: 'Job not found' });
      const checked = validateServiceJob(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      const assigned = issuedNumber(customer, 'job', customer.serviceJobs, 'jobNumber', job.jobNumber);
      if (assigned.error) return res.status(400).json({ msg: assigned.error });
      job.set({ ...checked.value, jobNumber: assigned.value });
      await customer.save();
      res.json(job);
    } catch (err) {
      console.error('Error updating service job:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.delete('/api/customers/:customerId/service-jobs/:jobId', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const job = customer.serviceJobs.id(req.params.jobId);
      if (!job) return res.status(404).json({ msg: 'Job not found' });
      customer.serviceJobs.pull(job._id);
      await customer.save();
      res.json({ msg: 'Job deleted' });
    } catch (err) {
      console.error('Error deleting service job:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.post('/api/customers/:customerId/bids', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const checked = validateBid(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      const assigned = issuedNumber(customer, 'bid', customer.bids, 'quoteNumber');
      if (assigned.error) return res.status(400).json({ msg: assigned.error });
      customer.bids.push({ ...checked.value, quoteNumber: assigned.value });
      await customer.save();
      res.status(201).json(customer.bids[customer.bids.length - 1]);
    } catch (err) {
      console.error('Error creating bid:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.put('/api/customers/:customerId/bids/:bidId', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const bid = customer.bids.id(req.params.bidId);
      if (!bid) return res.status(404).json({ msg: 'Bid not found' });
      const checked = validateBid(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      const assigned = issuedNumber(customer, 'bid', customer.bids, 'quoteNumber', bid.quoteNumber);
      if (assigned.error) return res.status(400).json({ msg: assigned.error });
      bid.set({ ...checked.value, quoteNumber: assigned.value });
      await customer.save();
      res.json(bid);
    } catch (err) {
      console.error('Error updating bid:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.delete('/api/customers/:customerId/bids/:bidId', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const bid = customer.bids.id(req.params.bidId);
      if (!bid) return res.status(404).json({ msg: 'Bid not found' });
      const id = String(bid._id);
      customer.serviceJobs.forEach((job) => {
        if (String(job.bidId) === id) job.bidId = '';
      });
      customer.bids.pull(bid._id);
      await customer.save();
      res.json({ msg: 'Bid deleted' });
    } catch (err) {
      console.error('Error deleting bid:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.post('/api/customers/:customerId/plans', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const checked = validatePlan(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      const assigned = issuedNumber(customer, 'project', customer.plans, 'planNumber');
      if (assigned.error) return res.status(400).json({ msg: assigned.error });
      customer.plans.push({ ...checked.value, planNumber: assigned.value });
      await customer.save();
      res.status(201).json(customer.plans[customer.plans.length - 1]);
    } catch (err) {
      console.error('Error creating project:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.put('/api/customers/:customerId/plans/:planId', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const plan = customer.plans.id(req.params.planId);
      if (!plan) return res.status(404).json({ msg: 'Project not found' });
      const checked = validatePlan(req.body || {});
      if (checked.error) return res.status(400).json({ msg: checked.error });
      const assigned = issuedNumber(customer, 'project', customer.plans, 'planNumber', plan.planNumber);
      if (assigned.error) return res.status(400).json({ msg: assigned.error });
      plan.set({ ...checked.value, planNumber: assigned.value });
      await customer.save();
      res.json(plan);
    } catch (err) {
      console.error('Error updating project:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });

  app.delete('/api/customers/:customerId/plans/:planId', ...guard, async (req, res) => {
    try {
      const customer = await loadCustomer(Customer, req.params.customerId, res);
      if (!customer) return;
      const plan = customer.plans.id(req.params.planId);
      if (!plan) return res.status(404).json({ msg: 'Project not found' });
      const id = String(plan._id);
      customer.serviceJobs.forEach((job) => {
        if (String(job.planId) === id) job.planId = '';
      });
      customer.bids.forEach((bid) => {
        if (String(bid.planId) === id) bid.planId = '';
      });
      customer.plans.pull(plan._id);
      await customer.save();
      res.json({ msg: 'Project deleted' });
    } catch (err) {
      console.error('Error deleting project:', err);
      res.status(500).json({ msg: 'Server error', error: err.message });
    }
  });
}
