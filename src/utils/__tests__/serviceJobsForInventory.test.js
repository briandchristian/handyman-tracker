/**
 * The inventory page adds a part to a service job, not to an older project.
 */

import { filterJobs, serviceJobsForInventory } from '../inventoryJobs';

const customers = [
  {
    _id: 'cust1',
    name: 'Job Co',
    accountNumber: 'A-1001',
    projects: [{ _id: 'proj1', name: 'Old project' }],
    serviceJobs: [
      { _id: 'job1', name: 'Cameras', jobNumber: 'A-1001-J0001' },
      { _id: 'job2', name: 'Gate' },
    ],
  },
];

describe('serviceJobsForInventory', () => {
  test('lists service jobs and leaves older projects out', () => {
    const jobs = serviceJobsForInventory(customers);
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.jobId).sort()).toEqual(['job1', 'job2']);
    expect(jobs.find((job) => job.jobId === 'job1')).toMatchObject({
      customerId: 'cust1',
      value: 'cust1:job1',
      label: 'A-1001-J0001 · Cameras (Job Co · A-1001)',
    });
    expect(jobs.some((job) => String(job.label).includes('Old project'))).toBe(false);
  });

  test('filters by the job name', () => {
    const jobs = serviceJobsForInventory(customers);
    expect(filterJobs(jobs, 'gate')).toHaveLength(1);
    expect(filterJobs(jobs, 'gate')[0].jobName).toBe('Gate');
  });
});
