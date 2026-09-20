/**
 * Build the Adjust Stock job picker: existing projects, with jobs that
 * already used this inventory item listed first.
 */

import { materialMatchesInventoryItem } from '../../server/lib/inventoryStock.js';
import { formatCustomerLabel, formatJobLabel } from '../../server/lib/jobIdentity.js';

export function jobsFromCustomers(customers = [], item) {
  const jobs = [];
  for (const customer of customers || []) {
    for (const project of customer.projects || []) {
      const usedQuantity = (project.materials || []).reduce((sum, material) => (
        materialMatchesInventoryItem(material, item)
          ? sum + (Number(material.quantity) || 0)
          : sum
      ), 0);
      const customerName = formatCustomerLabel({
        name: customer.name,
        accountNumber: customer.accountNumber,
      });
      const projectName = formatJobLabel({
        name: project.name,
        jobNumber: project.jobNumber,
      });
      jobs.push({
        customerId: String(customer._id),
        projectId: String(project._id),
        value: `${customer._id}:${project._id}`,
        customerName,
        projectName,
        jobNumber: project.jobNumber || '',
        accountNumber: customer.accountNumber || '',
        status: project.status || '',
        usedThisItem: usedQuantity > 0,
        usedQuantity,
        label: usedQuantity > 0
          ? `${projectName} (${customerName}, already used ${usedQuantity})`
          : `${projectName} (${customerName})`,
      });
    }
  }
  jobs.sort((a, b) => {
    if (a.usedThisItem !== b.usedThisItem) return a.usedThisItem ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  return jobs;
}

export function filterJobs(jobs = [], query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return jobs;
  return jobs.filter((job) =>
    String(job.label || '').toLowerCase().includes(q)
    || String(job.customerName || '').toLowerCase().includes(q)
    || String(job.projectName || '').toLowerCase().includes(q)
    || String(job.jobNumber || '').toLowerCase().includes(q)
    || String(job.accountNumber || '').toLowerCase().includes(q)
  );
}
