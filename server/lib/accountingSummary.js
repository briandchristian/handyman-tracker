/**
 * Read-only accounting totals derived from jobs, POs, and payments.
 * Does not post new ledger rows — it summarizes source records.
 */

export function materialCost(project) {
  return (project?.materials || []).reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const cost = Number(line.cost) || 0;
    return sum + qty * cost;
  }, 0);
}

export function isOpenReceivable(project) {
  const billed = Number(project?.billAmount) || 0;
  if (billed <= 0) return false;
  const status = project?.status || '';
  return status === 'Billed' || status === 'Completed';
}

export function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function buildAccountingSummary({ projects = [], purchaseOrders = [], supplierPayments = [] } = {}) {
  const jobs = projects.map((project) => {
    const billed = Number(project.billAmount) || 0;
    const paid = Number(project.paidToDate) || 0;
    const cost = materialCost(project);
    const taxRate = Number(project.taxRate) || 0;
    const tax = roundMoney(billed * (taxRate / 100));
    return {
      customerName: project.customerName || '',
      projectName: project.name || '',
      status: project.status || '',
      billed: roundMoney(billed),
      paid: roundMoney(paid),
      balance: roundMoney(billed - paid),
      materialCost: roundMoney(cost),
      profit: roundMoney(billed - cost),
      tax,
    };
  });

  const receivableJobs = jobs.filter((job, index) => isOpenReceivable(projects[index]));
  const arBilled = roundMoney(receivableJobs.reduce((sum, job) => sum + job.billed, 0));
  const arPaid = roundMoney(receivableJobs.reduce((sum, job) => sum + job.paid, 0));

  const apPaid = roundMoney(
    supplierPayments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
  );
  const apOpen = roundMoney(
    purchaseOrders
      .filter((po) => po.status === 'Received')
      .reduce((sum, po) => sum + (Number(po.total) || 0), 0)
  );

  return {
    ar: {
      billed: arBilled,
      paid: arPaid,
      balance: roundMoney(arBilled - arPaid),
    },
    ap: {
      receivedUnpaid: apOpen,
      paid: apPaid,
      balance: apOpen,
    },
    taxCollected: roundMoney(receivableJobs.reduce((sum, job) => sum + job.tax, 0)),
    jobs,
  };
}
