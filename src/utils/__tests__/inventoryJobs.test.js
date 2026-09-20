/**
 * Adjust Stock should list existing projects, with jobs that already
 * used this inventory item first so a count/remove can be charged there.
 */

import { filterJobs, jobsFromCustomers } from '../inventoryJobs';

const customers = [
  {
    _id: 'cust1',
    name: 'Job Co',
    projects: [
      {
        _id: 'proj1',
        name: 'Alarm',
        status: 'Scheduled',
        materials: [{ sku: 'LUM-2X4', item: '2x4 Lumber', quantity: 2 }],
      },
      {
        _id: 'proj2',
        name: 'Camera run',
        status: 'Pending',
        materials: [],
      },
    ],
  },
  {
    _id: 'cust2',
    name: 'Other Co',
    projects: [
      {
        _id: 'proj3',
        name: 'Gate',
        materials: [{ sku: 'OTHER', item: 'Siren', quantity: 1 }],
      },
    ],
  },
];

const lumber = { _id: 'item1', sku: 'LUM-2X4', name: '2x4 Lumber' };

describe('jobsFromCustomers', () => {
  test('puts projects that already used this item first', () => {
    const jobs = jobsFromCustomers(customers, lumber);
    expect(jobs[0]).toMatchObject({
      projectId: 'proj1',
      usedThisItem: true,
      usedQuantity: 2,
    });
    expect(jobs[0].label).toMatch(/already used 2/i);
    expect(jobs.filter((job) => job.usedThisItem)).toHaveLength(1);
    expect(jobs).toHaveLength(3);
  });
});

describe('filterJobs', () => {
  test('filters by customer or project name', () => {
    const jobs = jobsFromCustomers(customers, lumber);
    expect(filterJobs(jobs, 'alarm')).toHaveLength(1);
    expect(filterJobs(jobs, 'gate')[0].projectName).toBe('Gate');
    expect(filterJobs(jobs, '')).toHaveLength(3);
  });
});
