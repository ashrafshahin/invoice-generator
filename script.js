// Invoice Generator - Main Logic

// DOM Elements
const itemsBody = document.getElementById('itemsBody');
const addItemBtn = document.getElementById('addItemBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const previewBtn = document.getElementById('previewBtn');
const resetBtn = document.getElementById('resetBtn');
const themeToggle = document.getElementById('themeToggle');
const currencySelect = document.getElementById('currency');
const companyLogoInput = document.getElementById('companyLogo');

// Charges & payments elements
const chargesBody = document.getElementById('chargesBody');
const chargePreset = document.getElementById('chargePreset');
const addChargeBtn = document.getElementById('addChargeBtn');
const installmentsBody = document.getElementById('installmentsBody');
const addInstallmentBtn = document.getElementById('addInstallmentBtn');
const splitBtn = document.getElementById('splitBtn');
const splitCount = document.getElementById('splitCount');
const scheduleStatus = document.getElementById('scheduleStatus');
const advanceAmountInput = document.getElementById('advanceAmount');
const advanceDateInput = document.getElementById('advanceDate');

// Modal elements
const previewModal = document.getElementById('previewModal');
const previewArea = document.getElementById('previewArea');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const closePreviewBtn2 = document.getElementById('closePreviewBtn2');
const previewDownloadBtn = document.getElementById('previewDownloadBtn');

// Totals elements
const subtotalEl = document.getElementById('subtotal');
const totalEl = document.getElementById('total');
const chargeTotalsRows = document.getElementById('chargeTotalsRows');
const advancePaidEl = document.getElementById('advancePaid');
const dueAmountEl = document.getElementById('dueAmount');
const installmentSummaryRow = document.getElementById('installmentSummaryRow');
const installmentCountEl = document.getElementById('installmentCount');
const installmentScheduledEl = document.getElementById('installmentScheduled');
const installmentRemainingRow = document.getElementById('installmentRemainingRow');
const installmentRemainingEl = document.getElementById('installmentRemaining');

// Currency symbols
const CURRENCY_SYMBOLS = {
  USD: '$',
  GBP: '£',
  BDT: '৳',
};

// State
let currentCurrency = 'USD';
let logoDataUrl = null;

// Initialize date fields
function initDates() {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  document.getElementById('invoiceDate').value = todayStr;
  document.getElementById('dueDate').value = dueDateStr;
}

// Format currency
function formatCurrency(amount) {
  const symbol = CURRENCY_SYMBOLS[currentCurrency] || '$';
  return symbol + formatNumber(amount);
}

// Format plain number
function formatNumber(amount) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Trim a number to at most 2 decimals without thousands separators
function trimNumber(n) {
  return String(Math.round(n * 100) / 100);
}

// ===== Math expression evaluator =====
// Supports: + - * / ( ) % with calculator-style percentages (2000-10% = 1800).
// Safe alternative to eval() — only numbers and known operators are allowed.
function evaluateMath(expr) {
  const src = String(expr).replace(/,/g, '').replace(/×/g, '*').replace(/÷/g, '/');
  const tokens = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      if ((num.match(/\./g) || []).length > 1 || num === '.') return { ok: false };
      tokens.push({ t: 'num', v: parseFloat(num) });
      continue;
    }
    if ('+-*/%()'.includes(ch)) {
      tokens.push({ t: ch });
      i++;
      continue;
    }
    return { ok: false };
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (t) => { if (tokens[pos] && tokens[pos].t === t) { pos++; return true; } return false; };

  // primary := number | '(' expr ')'
  function primary() {
    const tk = peek();
    if (!tk) return null;
    if (tk.t === 'num') { pos++; return { v: tk.v, pct: false }; }
    if (tk.t === '(') {
      pos++;
      const e = additive();
      if (!e || !eat(')')) return null;
      return e;
    }
    return null;
  }

  // postfix '%' → value/100, flagged as a percentage term
  function postfix() {
    const e = primary();
    if (!e) return null;
    let node = e;
    while (peek() && peek().t === '%') {
      pos++;
      node = { v: node.v / 100, pct: true };
    }
    return node;
  }

  function unary() {
    if (peek() && (peek().t === '-' || peek().t === '+')) {
      const op = peek().t;
      pos++;
      const e = unary();
      if (!e) return null;
      return { v: op === '-' ? -e.v : e.v, pct: e.pct };
    }
    return postfix();
  }

  function multiplicative() {
    let left = unary();
    if (!left) return null;
    let single = true;
    while (peek() && (peek().t === '*' || peek().t === '/')) {
      const op = peek().t;
      pos++;
      const right = unary();
      if (!right) return null;
      if (op === '/') {
        if (right.v === 0) return null;
        left = { v: left.v / right.v, pct: false };
      } else {
        left = { v: left.v * right.v, pct: false };
      }
      single = false;
    }
    return { v: left.v, pct: single && left.pct };
  }

  function additive() {
    let left = multiplicative();
    if (!left) return null;
    while (peek() && (peek().t === '+' || peek().t === '-')) {
      const op = peek().t;
      pos++;
      const right = multiplicative();
      if (!right) return null;
      // Calculator-style: "2000+10%" → 2000 + (2000 × 0.1)
      const rv = right.pct ? left.v * right.v : right.v;
      left = { v: op === '+' ? left.v + rv : left.v - rv, pct: false };
    }
    return left;
  }

  const result = additive();
  if (!result || pos !== tokens.length) return { ok: false };
  if (!isFinite(result.v)) return { ok: false };
  return { ok: true, value: result.v };
}

// Evaluate a math expression typed into a .calc-input field (blur / Enter)
function evaluateField(el) {
  const raw = el.value.trim();
  if (!raw) return;
  const cleaned = raw.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    if (cleaned !== raw) el.value = cleaned;
    return;
  }
  const res = evaluateMath(cleaned);
  if (res.ok) {
    const rounded = Math.round((res.value + Number.EPSILON) * 100) / 100;
    el.value = String(rounded);
    el.classList.remove('input-invalid');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    el.classList.add('input-invalid');
  }
}

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Form validation
function validateForm() {
  let isValid = true;

  const setValidation = (inputId, errorId, valid, message) => {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    input.classList.toggle('invalid', !valid);
    error.textContent = valid ? '' : message;
    if (!valid) isValid = false;
  };

  // Bill From
  const companyName = document.getElementById('companyName').value.trim();
  setValidation('companyName', 'companyNameError', companyName !== '', 'Company name is required');

  const companyEmail = document.getElementById('companyEmail').value.trim();
  setValidation('companyEmail', 'companyEmailError', isValidEmail(companyEmail),
    companyEmail === '' ? 'Company email is required' : 'Please enter a valid email address');

  // Invoice Details
  const invoiceNumber = document.getElementById('invoiceNumber').value.trim();
  setValidation('invoiceNumber', 'invoiceNumberError', invoiceNumber !== '', 'Invoice number is required');

  const invoiceDate = document.getElementById('invoiceDate').value;
  setValidation('invoiceDate', 'invoiceDateError', invoiceDate !== '', 'Invoice date is required');

  const dueDate = document.getElementById('dueDate').value;
  setValidation('dueDate', 'dueDateError', dueDate !== '', 'Due date is required');

  if (invoiceDate && dueDate && new Date(dueDate) < new Date(invoiceDate)) {
    setValidation('dueDate', 'dueDateError', false, 'Due date must be after invoice date');
  }

  // Bill To
  const clientName = document.getElementById('clientName').value.trim();
  setValidation('clientName', 'clientNameError', clientName !== '', 'Client name is required');

  const clientEmail = document.getElementById('clientEmail').value.trim();
  setValidation('clientEmail', 'clientEmailError', isValidEmail(clientEmail),
    clientEmail === '' ? 'Client email is required' : 'Please enter a valid email address');

  // Line items
  const rows = document.querySelectorAll('#itemsBody tr');
  let hasValidItem = false;
  let hasPartiallyFilledRow = false;

  rows.forEach((tr) => {
    const desc = tr.querySelector('.item-description');
    const qty = tr.querySelector('.item-qty');
    const price = tr.querySelector('.item-price');

    const descValid = desc.value.trim() !== '';
    const qtyValid = parseFloat(qty.value) > 0;
    const priceValid = parseFloat(price.value) >= 0;

    desc.classList.toggle('input-invalid', !descValid);
    qty.classList.toggle('input-invalid', !qtyValid);
    price.classList.toggle('input-invalid', !priceValid);

    if (descValid && qtyValid && priceValid) {
      hasValidItem = true;
    } else if (desc.value.trim() !== '' || qty.value !== '' || price.value !== '') {
      hasPartiallyFilledRow = true;
    }
  });

  if (hasPartiallyFilledRow) {
    isValid = false;
    alert('Please complete or remove partially filled line item rows.');
  }

  if (!hasValidItem) {
    isValid = false;
    const firstRow = document.querySelector('#itemsBody tr');
    if (firstRow) {
      firstRow.querySelector('.item-description').classList.add('input-invalid');
    }
    alert('Please add at least one complete line item with description, quantity and price.');
  }

  // Charges & adjustments
  let invalidCharges = 0;
  document.querySelectorAll('#chargesBody tr').forEach((tr) => {
    const val = tr.querySelector('.charge-value');
    const v = parseFloat(val.value);
    const ok = !isNaN(v) && v >= 0;
    val.classList.toggle('input-invalid', !ok);
    if (!ok) invalidCharges++;
  });
  if (invalidCharges > 0) {
    isValid = false;
    alert('Charge values must be 0 or greater. Use the Type and Basis columns to add or deduct.');
  }

  // Advance payment
  const advanceVal = parseFloat(advanceAmountInput.value);
  const advanceOk = !isNaN(advanceVal) && advanceVal >= 0;
  advanceAmountInput.classList.toggle('input-invalid', !advanceOk);
  document.getElementById('advanceAmountError').textContent =
    advanceOk ? '' : 'Advance payment must be 0 or greater';
  if (!advanceOk) isValid = false;

  // Installments
  let invalidInstallments = 0;
  document.querySelectorAll('#installmentsBody tr').forEach((tr) => {
    const amt = tr.querySelector('.installment-amount');
    const date = tr.querySelector('.installment-date');
    const a = parseFloat(amt.value);
    const amtOk = !isNaN(a) && a >= 0;
    const dateOk = a === 0 || date.value !== '';
    amt.classList.toggle('input-invalid', !amtOk);
    date.classList.toggle('input-invalid', !dateOk);
    if (!amtOk || !dateOk) invalidInstallments++;
  });
  if (invalidInstallments > 0) {
    isValid = false;
    alert('Installment amounts must be 0 or greater, and service dates are required for non-zero amounts.');
  }

  return isValid;
}

// Add a new line item row
function addLineItem(description = '', qty = 1, price = 0) {
  const tr = document.createElement('tr');

  tr.innerHTML = `
    <td>
      <input type="text" class="item-description" placeholder="Item description" value="${description}" />
    </td>
    <td>
      <input type="text" inputmode="decimal" class="item-qty calc-input" value="${qty}" placeholder="Qty" />
    </td>
    <td>
      <input type="text" inputmode="decimal" class="item-price calc-input" value="${price}" placeholder="0.00" />
    </td>
    <td class="amount-cell">${formatCurrency(0)}</td>
    <td>
      <button class="delete-btn" title="Remove item">&times;</button>
    </td>
  `;

  const qtyInput = tr.querySelector('.item-qty');
  const priceInput = tr.querySelector('.item-price');
  const descInput = tr.querySelector('.item-description');
  const deleteBtn = tr.querySelector('.delete-btn');

  qtyInput.addEventListener('input', () => {
    updateRowAmount(tr);
    qtyInput.classList.remove('input-invalid');
  });

  priceInput.addEventListener('input', () => {
    updateRowAmount(tr);
    priceInput.classList.remove('input-invalid');
  });

  descInput.addEventListener('input', () => descInput.classList.remove('input-invalid'));

  deleteBtn.addEventListener('click', () => {
    tr.remove();
    updateTotals();
  });

  itemsBody.appendChild(tr);
  updateRowAmount(tr);
  updateTotals();
}

// Update a single row's amount
function updateRowAmount(tr) {
  const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
  const price = parseFloat(tr.querySelector('.item-price').value) || 0;
  const amount = qty * price;
  tr.querySelector('.amount-cell').textContent = formatCurrency(amount);
  updateTotals();
}

// ===== Charges & payments: row builders =====

// Add a charge/adjustment row (e.g. VAT %, Service Charge, Honorarium)
function addCharge(label = 'Custom Charge', mode = 'add', basis = 'percent', value = 0) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <input type="text" class="charge-label" value="${escapeHtml(label)}" placeholder="Charge label" />
    </td>
    <td>
      <select class="charge-mode">
        <option value="add">+ Add</option>
        <option value="deduct">- Deduct</option>
      </select>
    </td>
    <td>
      <select class="charge-basis">
        <option value="percent">% of Subtotal</option>
        <option value="fixed">Fixed Amount</option>
      </select>
    </td>
    <td>
      <input type="text" inputmode="decimal" class="charge-value calc-input" value="${value}" />
    </td>
    <td class="charge-computed">$0.00</td>
    <td>
      <button class="delete-btn" title="Remove charge">&times;</button>
    </td>
  `;
  tr.querySelector('.charge-mode').value = mode;
  tr.querySelector('.charge-basis').value = basis;
  tr.querySelector('.delete-btn').addEventListener('click', () => {
    tr.remove();
    updateTotals();
  });
  chargesBody.appendChild(tr);
  updateTotals();
}

// Add an installment row with a short description and service date
function addInstallment(date = '', amount = 0, description = '') {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="installment-no"></td>
    <td>
      <input type="text" class="installment-desc" placeholder="e.g. Milestone 1" />
    </td>
    <td>
      <input type="date" class="installment-date" value="${date}" />
    </td>
    <td>
      <input type="text" inputmode="decimal" class="installment-amount calc-input" value="${amount}" />
    </td>
    <td>
      <button class="delete-btn" title="Remove installment">&times;</button>
    </td>
  `;
  tr.querySelector('.installment-desc').value = description;
  tr.querySelector('.delete-btn').addEventListener('click', () => {
    tr.remove();
    updateTotals();
  });
  installmentsBody.appendChild(tr);
  updateTotals();
}

// Split the due amount into N even installments between invoice date and due date
function splitDueEvenly() {
  const count = parseInt(splitCount.value, 10);
  if (isNaN(count) || count < 1) {
    alert('Enter the number of installments (1 or more).');
    return;
  }

  const t = computeTotals();
  const due = Math.round(t.due * 100) / 100;
  if (due <= 0) {
    alert('Due amount must be greater than 0 before splitting.');
    return;
  }

  const startStr = document.getElementById('invoiceDate').value;
  const endStr = document.getElementById('dueDate').value;
  const start = new Date(startStr + 'T00:00:00');
  const end = new Date(endStr + 'T00:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    alert('Set valid invoice and due dates first.');
    return;
  }

  const fmtDate = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = Math.round((end - start) / 86400000);
  const base = Math.floor((due / count) * 100) / 100;

  installmentsBody.innerHTML = '';
  let allocated = 0;
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 1 : i / (count - 1);
    const d = new Date(start);
    d.setDate(d.getDate() + Math.round(frac * days));
    const amount = i === count - 1 ? Math.round((due - allocated) * 100) / 100 : base;
    allocated = Math.round((allocated + amount) * 100) / 100;
    addInstallment(fmtDate(d), amount);
  }
}

// ===== Totals calculation =====

// Single source of truth for all invoice math
function computeTotals() {
  const items = [];
  let subtotal = 0;

  document.querySelectorAll('#itemsBody tr').forEach((tr) => {
    const description = tr.querySelector('.item-description').value.trim() || 'Item';
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    const amount = qty * price;
    subtotal += amount;
    items.push({ description, qty, price, amount });
  });

  const charges = [];
  let chargeSum = 0;

  document.querySelectorAll('#chargesBody tr').forEach((tr) => {
    const label = tr.querySelector('.charge-label').value.trim() || 'Charge';
    const mode = tr.querySelector('.charge-mode').value;
    const basis = tr.querySelector('.charge-basis').value;
    const value = parseFloat(tr.querySelector('.charge-value').value) || 0;
    const amount = basis === 'percent' ? subtotal * (value / 100) : value;
    const signed = mode === 'deduct' ? -amount : amount;
    chargeSum += signed;
    charges.push({ label, mode, basis, value, amount: signed });
  });

  const total = subtotal + chargeSum;
  const advance = Math.max(0, parseFloat(advanceAmountInput.value) || 0);
  const due = total - advance;

  const installments = [];
  let scheduled = 0;

  document.querySelectorAll('#installmentsBody tr').forEach((tr) => {
    const description = tr.querySelector('.installment-desc').value.trim();
    const date = tr.querySelector('.installment-date').value;
    const amount = Math.max(0, parseFloat(tr.querySelector('.installment-amount').value) || 0);
    scheduled += amount;
    installments.push({ description, date, amount });
  });

  scheduled = Math.round(scheduled * 100) / 100;
  const remaining = Math.round((due - scheduled) * 100) / 100;

  return { items, subtotal, charges, chargeSum, total, advance, due, installments, scheduled, remaining };
}

// Calculate and update all totals
function updateTotals() {
  const t = computeTotals();

  subtotalEl.textContent = formatCurrency(t.subtotal);

  // Charge rows in the totals card
  chargeTotalsRows.innerHTML = t.charges.map((c) => {
    const suffix = c.basis === 'percent' ? ` (${trimNumber(c.value)}%)` : '';
    const deduct = c.mode === 'deduct';
    const cls = deduct ? 'amount-negative' : '';
    return `<div class="total-row"><span>${escapeHtml(c.label)}${suffix}</span><span class="${cls}">${deduct ? '-' : '+'}${formatCurrency(Math.abs(c.amount))}</span></div>`;
  }).join('');

  totalEl.textContent = formatCurrency(t.total);
  advancePaidEl.textContent = t.advance > 0 ? `-${formatCurrency(t.advance)}` : formatCurrency(0);
  advancePaidEl.classList.toggle('amount-negative', t.advance > 0);
  dueAmountEl.textContent = formatCurrency(t.due);

  // Live computed amounts inside the charges table
  document.querySelectorAll('#chargesBody tr').forEach((tr, i) => {
    const c = t.charges[i];
    if (!c) return;
    const cell = tr.querySelector('.charge-computed');
    const deduct = c.mode === 'deduct';
    cell.textContent = `${deduct ? '-' : '+'}${formatCurrency(Math.abs(c.amount))}`;
    cell.classList.toggle('is-deduct', deduct);
  });

  // Installment summary rows + status line
  const count = t.installments.length;
  if (count > 0) {
    installmentSummaryRow.style.display = 'flex';
    installmentCountEl.textContent = count;
    installmentScheduledEl.textContent = formatCurrency(t.scheduled);
    installmentRemainingRow.style.display = 'flex';
    installmentRemainingEl.textContent =
      t.remaining < 0 ? `-${formatCurrency(Math.abs(t.remaining))}` : formatCurrency(t.remaining);
    installmentRemainingEl.classList.toggle('amount-negative', t.remaining !== 0);
    scheduleStatus.textContent = t.remaining < 0
      ? `Schedule exceeds due amount by ${formatCurrency(Math.abs(t.remaining))}.`
      : t.remaining === 0
        ? `Schedule covers the full due amount (${formatCurrency(t.due)}).`
        : `Scheduled ${formatCurrency(t.scheduled)} of ${formatCurrency(t.due)} due — remaining ${formatCurrency(t.remaining)}.`;
    scheduleStatus.classList.toggle('is-warn', t.remaining !== 0);
    scheduleStatus.classList.toggle('is-ok', t.remaining === 0);
  } else {
    installmentSummaryRow.style.display = 'none';
    installmentRemainingRow.style.display = 'none';
    scheduleStatus.textContent = '';
    scheduleStatus.classList.remove('is-warn', 'is-ok');
  }

  // Renumber installment rows
  document.querySelectorAll('#installmentsBody .installment-no').forEach((el, i) => {
    el.textContent = i + 1;
  });
}

// Get invoice data for PDF & preview
function getInvoiceData() {
  const t = computeTotals();

  return {
    invoiceNumber: document.getElementById('invoiceNumber').value.trim() || 'INV-001',
    invoiceDate: document.getElementById('invoiceDate').value,
    dueDate: document.getElementById('dueDate').value,
    companyName: document.getElementById('companyName').value.trim(),
    companyEmail: document.getElementById('companyEmail').value.trim(),
    companyPhone: document.getElementById('companyPhone').value.trim(),
    companyAddress: document.getElementById('companyAddress').value.trim(),
    clientName: document.getElementById('clientName').value.trim(),
    clientEmail: document.getElementById('clientEmail').value.trim(),
    clientPhone: document.getElementById('clientPhone').value.trim(),
    clientAddress: document.getElementById('clientAddress').value.trim(),
    items: t.items,
    subtotal: t.subtotal,
    charges: t.charges,
    total: t.total,
    advance: t.advance,
    advanceDate: advanceDateInput.value,
    due: t.due,
    installments: t.installments,
    scheduled: t.scheduled,
    remaining: t.remaining,
    currency: currentCurrency,
    year: new Date().getFullYear(),
  };
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// PDF design tokens — print-safe palette (dark text on light ground, hairline rules)
const PDF_THEME = {
  ink: [17, 24, 39], // #111827 headings & values
  body: [31, 41, 55], // #1F2937 table text
  muted: [107, 114, 128], // #6B7280 labels
  line: [209, 213, 219], // #D1D5DB hairlines & borders
  soft: [249, 250, 251], // #F9FAFB zebra rows & boxes
  accent: [79, 70, 229], // #4F46E5 brand indigo
  danger: [185, 28, 28], // #B91C1C deductions
  success: [21, 128, 61], // #15803D fully scheduled
  white: [255, 255, 255],
};

// Generate PDF using jsPDF directly
function generatePDF(data, logoDataUrl) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // --- Embedded fonts: Inter matches the web UI; falls back to Helvetica ---
  let family = 'helvetica';
  let takaFamily = null;
  if (window.PDF_FONTS) {
    try {
      pdf.addFileToVFS('Inter-Regular.ttf', PDF_FONTS.interRegular);
      pdf.addFont('Inter-Regular.ttf', 'Inter', 'normal');
      pdf.addFileToVFS('Inter-Bold.ttf', PDF_FONTS.interBold);
      pdf.addFont('Inter-Bold.ttf', 'Inter', 'bold');
      family = 'Inter';
    } catch (e) {
      family = 'helvetica';
    }
    try {
      pdf.addFileToVFS('Taka-Regular.ttf', PDF_FONTS.takaRegular);
      pdf.addFont('Taka-Regular.ttf', 'Taka', 'normal');
      pdf.addFileToVFS('Taka-Bold.ttf', PDF_FONTS.takaBold);
      pdf.addFont('Taka-Bold.ttf', 'Taka', 'bold');
      takaFamily = 'Taka';
    } catch (e) {
      takaFamily = null;
    }
  }

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const footerTop = pageHeight - 20;
  const T = PDF_THEME;
  const fill = (c) => pdf.setFillColor(c[0], c[1], c[2]);
  const ink = (c) => pdf.setTextColor(c[0], c[1], c[2]);
  const stroke = (c) => pdf.setDrawColor(c[0], c[1], c[2]);

  const currencySymbol = CURRENCY_SYMBOLS[currentCurrency] || '$';
  const fmt = (n) => `${currencySymbol}${formatNumber(n)}`;

  // Pick the face for a string: the Bengali Taka sign exists only in the Taka face
  const useFont = (weight, text) => {
    const isTaka = takaFamily && typeof text === 'string' && text.indexOf('৳') !== -1;
    pdf.setFont(isTaka ? takaFamily : family, weight);
  };

  // Draw one string in a single call (face chosen from the text itself)
  const put = (str, x, y, opts, style) => {
    useFont((style && style.weight) || 'normal', str);
    if (style && style.size) pdf.setFontSize(style.size);
    if (style && style.color) ink(style.color);
    pdf.text(str, x, y, opts || {});
  };

  // Truncate with an ellipsis so text never leaves its column
  const fit = (text, maxWidth, weight) => {
    const w = weight || 'normal';
    useFont(w, text);
    if (pdf.getTextWidth(text) <= maxWidth) return text;
    let s = String(text);
    while (s.length > 1) {
      useFont(w, s + '...');
      if (pdf.getTextWidth(`${s}...`) <= maxWidth) break;
      s = s.slice(0, -1);
    }
    return `${s}...`;
  };

  // Clean white ground on every page — consistent on screen and in print
  const paintPage = () => {
    fill(T.white);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  };
  paintPage();

  // ===== HEADER =====
  fill(T.accent);
  pdf.rect(margin, 12, contentWidth, 2.4, 'F'); // brand bar, kept inside print margins

  let logoWidth = 0;
  if (logoDataUrl) {
    try {
      pdf.addImage(logoDataUrl, 'PNG', margin, 18, 40, 15);
      logoWidth = 40;
    } catch (e) {
      logoWidth = 0;
    }
  }

  const titleX = margin + (logoWidth > 0 ? logoWidth + 8 : 0);
  put('INVOICE', titleX, 31, undefined, { weight: 'bold', size: 27, color: T.accent });
  put(`# ${data.invoiceNumber}`, titleX, 38.5, undefined, { size: 9.5, color: T.muted });

  // Meta block, right aligned: labels left, values right
  const metaLabelX = pageWidth - margin - 66;
  let metaY = 24;
  [
    ['INVOICE DATE', formatDate(data.invoiceDate)],
    ['DUE DATE', formatDate(data.dueDate)],
    ['CURRENCY', `${currencySymbol} ${data.currency || currentCurrency}`],
  ].forEach(([label, value]) => {
    put(label, metaLabelX, metaY, undefined, { weight: 'bold', size: 7.5, color: T.muted });
    put(fit(value, 46, 'normal'), pageWidth - margin, metaY, { align: 'right' }, { size: 9.5, color: T.ink });
    metaY += 6;
  });

  // Header double rule: brand accent over a hairline
  stroke(T.accent);
  pdf.setLineWidth(0.9);
  pdf.line(margin, 45, pageWidth - margin, 45);
  stroke(T.line);
  pdf.setLineWidth(0.25);
  pdf.line(margin, 46.8, pageWidth - margin, 46.8);
  // ===== BILL FROM / BILL TO — soft bordered boxes =====
  const partyTop = 53;
  const boxW = (contentWidth - 8) / 2;
  const innerW = boxW - 8;
  const fromX = margin;
  const toX = margin + boxW + 8;

  // Measure first so the boxes can be drawn behind the text
  const partyHeight = (name, details) => {
    let h = 13.5; // heading baseline offset + gap
    if (name) h += 5.5;
    useFont('normal');
    pdf.setFontSize(9);
    details.forEach((d) => {
      if (d) h += pdf.splitTextToSize(d, innerW).length * 4.7;
    });
    return h + 3.5;
  };

  const hFrom = partyHeight(data.companyName, [data.companyEmail, data.companyPhone, data.companyAddress]);
  const hTo = partyHeight(data.clientName, [data.clientEmail, data.clientPhone, data.clientAddress]);
  const boxH = Math.max(hFrom, hTo);

  fill(T.soft);
  stroke(T.line);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(fromX, partyTop, boxW, boxH, 2, 2, 'FD');
  pdf.roundedRect(toX, partyTop, boxW, boxH, 2, 2, 'FD');

  const drawParty = (x, heading, name, details) => {
    let baseY = partyTop + 7;
    put(heading, x + 4, baseY, { charSpace: 0.2 }, { weight: 'bold', size: 7.5, color: T.accent });
    baseY += 6.5;
    if (name) {
      put(fit(name, innerW, 'bold'), x + 4, baseY, undefined, { weight: 'bold', size: 11, color: T.ink });
      baseY += 5.5;
    }
    details.forEach((d) => {
      if (!d) return;
      pdf.splitTextToSize(d, innerW).forEach((ln) => {
        put(fit(ln, innerW, 'normal'), x + 4, baseY, undefined, { size: 9, color: T.body });
        baseY += 4.7;
      });
    });
  };

  drawParty(fromX, 'BILL FROM', data.companyName,
    [data.companyEmail, data.companyPhone, data.companyAddress]);
  drawParty(toX, 'BILL TO', data.clientName,
    [data.clientEmail, data.clientPhone, data.clientAddress]);
  // ===== LINE ITEMS TABLE =====
  const itemsTop = partyTop + boxH + 9;
  const headerH = 8;
  const rowH = 8;
  const amountR = pageWidth - margin - 4;
  const priceR = amountR - 40;
  const qtyR = priceR - 24;
  const descX = margin + 4;
  const descW = qtyR - 8 - descX;

  const itemHeaders = [
    ['DESCRIPTION', descX, 'left'],
    ['QTY', qtyR, 'right'],
    ['PRICE', priceR, 'right'],
    ['AMOUNT', amountR, 'right'],
  ];

  const drawTableHeader = (top, labels) => {
    fill(T.accent);
    pdf.rect(margin, top, contentWidth, headerH, 'F');
    labels.forEach(([text, x, align]) =>
      put(text, x, top + 5.3, { align }, { weight: 'bold', size: 8, color: T.white }));
  };

  const drawHairline = (y) => {
    stroke(T.line);
    pdf.setLineWidth(0.15);
    pdf.line(margin, y, pageWidth - margin, y);
  };

  drawTableHeader(itemsTop, itemHeaders);

  let rowY = itemsTop + headerH;
  data.items.forEach((item, i) => {
    if (rowY + rowH > footerTop) {
      pdf.addPage();
      paintPage();
      rowY = margin + 6;
      drawTableHeader(rowY, itemHeaders);
      rowY += headerH;
    }
    const baseline = rowY + 5.4;
    if (i % 2 === 1) {
      fill(T.soft);
      pdf.rect(margin, rowY, contentWidth, rowH, 'F');
    }
    put(fit(item.description, descW, 'normal'), descX, baseline, undefined, { size: 9.5, color: T.ink });
    put(String(item.qty), qtyR, baseline, { align: 'right' }, { size: 9.5, color: T.body });
    put(fmt(item.price), priceR, baseline, { align: 'right' }, { size: 9.5, color: T.body });
    put(fmt(item.amount), amountR, baseline, { align: 'right' }, { weight: 'bold', size: 9.5, color: T.ink });
    rowY += rowH;
    drawHairline(rowY);
  });
  // ===== TOTALS BOX =====
  const rowStep = 5.6;
  const bandH = 12;
  const boxW2 = 92;
  const boxX = pageWidth - margin - boxW2;
  const labelX = boxX + 5;
  const valueR = boxX + boxW2 - 5;
  const labelW = valueR - 34 - labelX;

  const nRows = 1 + data.charges.length; // subtotal + each charge
  const firstRowOff = 8;
  const lastRowOff = firstRowOff + (nRows - 1) * rowStep;
  const bandOff = lastRowOff + 2;
  const advOff = bandOff + bandH + 6;
  const dueOff = advOff + 7;
  const boxH2 = dueOff + 4;

  let totalsTop = rowY + 9;
  if (totalsTop + boxH2 > footerTop) {
    pdf.addPage();
    paintPage();
    totalsTop = margin + 6;
  }

  fill(T.soft);
  stroke(T.line);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(boxX, totalsTop, boxW2, boxH2, 2.5, 2.5, 'FD');

  // Subtotal + charge rows
  let tY = totalsTop + firstRowOff;
  put('Subtotal', labelX, tY, undefined, { size: 9.5, color: T.muted });
  put(fmt(data.subtotal), valueR, tY, { align: 'right' }, { weight: 'bold', size: 9.5, color: T.ink });

  data.charges.forEach((c) => {
    tY += rowStep;
    const label = `${c.label}${c.basis === 'percent' ? ` (${trimNumber(c.value)}%)` : ''}`;
    put(fit(label, labelW, 'normal'), labelX, tY, undefined, { size: 9.5, color: T.muted });
    put(`${c.mode === 'deduct' ? '-' : '+'}${fmt(Math.abs(c.amount))}`, valueR, tY, { align: 'right' },
      { weight: 'bold', size: 9.5, color: c.mode === 'deduct' ? T.danger : T.ink });
  });

  // Total invoice band
  const bandTop = totalsTop + bandOff;
  fill(T.accent);
  pdf.rect(boxX, bandTop, boxW2, bandH, 'F');
  put('TOTAL INVOICE AMOUNT', labelX, bandTop + 7.6, undefined, { weight: 'bold', size: 9.5, color: T.white });
  put(fmt(data.total), valueR, bandTop + 7.6, { align: 'right' }, { weight: 'bold', size: 12, color: T.white });

  // Advance paid
  tY = bandTop + bandH + 6;
  put('Advance Paid', labelX, tY, undefined, { size: 9.5, color: T.muted });
  if (data.advance > 0) {
    put(`-${fmt(data.advance)}`, valueR, tY, { align: 'right' }, { weight: 'bold', size: 9.5, color: T.danger });
  } else {
    put(fmt(0), valueR, tY, { align: 'right' }, { weight: 'bold', size: 9.5, color: T.muted });
  }

  // Due amount, emphasised behind a divider
  stroke(T.line);
  pdf.setLineWidth(0.25);
  pdf.line(labelX, tY + 2.8, valueR, tY + 2.8);
  tY += 7;
  put('DUE AMOUNT', labelX, tY, undefined, { weight: 'bold', size: 10, color: T.ink });
  put(fmt(data.due), valueR, tY, { align: 'right' }, { weight: 'bold', size: 11.5, color: T.ink });
  // ===== PAYMENT SCHEDULE =====
  if (data.installments.length > 0) {
    const sHeaderH = 8;
    const sRowH = 7.5;
    const schedAmountR = pageWidth - margin - 4;
    const schedDateX = margin + 72;
    const schedNumR = margin + 7;
    const schedDescX = margin + 12;
    const schedDescW = schedDateX - 6 - schedDescX;
    const schedHeaders = [
      ['#', schedNumR, 'right'],
      ['DESCRIPTION', schedDescX, 'left'],
      ['SERVICE DATE', schedDateX, 'left'],
      ['AMOUNT', schedAmountR, 'right'],
    ];

    const drawSchedHeader = (top) => {
      fill(T.accent);
      pdf.rect(margin, top, contentWidth, sHeaderH, 'F');
      schedHeaders.forEach(([text, x, align]) =>
        put(text, x, top + 5.3, { align }, { weight: 'bold', size: 8, color: T.white }));
    };

    let sTop = totalsTop + boxH2 + 10;
    const needed = 25 + sHeaderH + data.installments.length * sRowH + 7;
    if (sTop + needed > footerTop) {
      pdf.addPage();
      paintPage();
      sTop = margin + 6;
    }

    put('PAYMENT SCHEDULE', margin, sTop + 4, undefined, { weight: 'bold', size: 9.5, color: T.accent });
    stroke(T.accent);
    pdf.setLineWidth(0.8);
    pdf.line(margin, sTop + 6.5, margin + 14, sTop + 6.5);

    let sRowY = sTop + 10;
    drawSchedHeader(sRowY);
    sRowY += sHeaderH;

    data.installments.forEach((ins, i) => {
      if (sRowY + sRowH > footerTop) {
        pdf.addPage();
        paintPage();
        sRowY = margin + 6;
        drawSchedHeader(sRowY);
        sRowY += sHeaderH;
      }
      const baseline = sRowY + 5.1;
      if (i % 2 === 1) {
        fill(T.soft);
        pdf.rect(margin, sRowY, contentWidth, sRowH, 'F');
      }
      put(String(i + 1), schedNumR, baseline, { align: 'right' }, { size: 9, color: T.muted });
      put(fit(ins.description || '-', schedDescW, 'normal'), schedDescX, baseline, undefined, { size: 9.5, color: T.ink });
      put(ins.date ? formatDate(ins.date) : '-', schedDateX, baseline, undefined, { size: 9.5, color: T.body });
      put(fmt(ins.amount), schedAmountR, baseline, { align: 'right' }, { weight: 'bold', size: 9.5, color: T.ink });
      sRowY += sRowH;
      drawHairline(sRowY);
    });

    const summary =
      `Scheduled ${fmt(data.scheduled)}` +
      (data.remaining === 0
        ? ' - fully scheduled'
        : data.remaining < 0
          ? ` - over by ${fmt(Math.abs(data.remaining))}`
          : ` - remaining ${fmt(data.remaining)}`);
    put(summary, pageWidth - margin, sRowY + 5.5, { align: 'right' },
      { size: 8.5, color: data.remaining === 0 ? T.success : T.danger });
  }

  // ===== FOOTER (on every page) =====
  const pageCount = pdf.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p);
    stroke(T.line);
    pdf.setLineWidth(0.2);
    pdf.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
    put(`© ${data.year} Invoice Generator. All rights reserved.`, margin, pageHeight - 10,
      undefined, { size: 7.5, color: T.muted });
    if (pageCount > 1) {
      put(`Page ${p} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' },
        { size: 7.5, color: T.muted });
    }
    put('Powered by Md Ashraf Shahin', pageWidth - margin, pageHeight - 10, { align: 'right' },
      { weight: 'bold', size: 7.5, color: T.accent });
  }

  pdf.setProperties({
    title: `Invoice ${data.invoiceNumber}`,
    subject: 'Invoice',
    author: 'Invoice Generator',
    creator: 'Invoice Generator',
  });

  pdf.save(`${data.invoiceNumber}.pdf`);
}

// Download invoice as PDF
function downloadPdf() {
  if (!validateForm()) return;

  const btn = downloadPdfBtn;
  btn.disabled = true;
  btn.textContent = 'Generating PDF...';

  try {
    const data = getInvoiceData();
    setTimeout(() => {
      generatePDF(data, logoDataUrl);
      btn.disabled = false;
      btn.textContent = 'Download PDF';
    }, 50);
  } catch (error) {
    console.error('PDF generation failed:', error);
    alert('Failed to generate PDF. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Download PDF';
  }
}

// Open preview modal
function openPreview() {
  if (!validateForm()) return;

  try {
    const data = getInvoiceData();
    previewArea.innerHTML = buildPreviewHtml(data);
    previewModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } catch (error) {
    console.error('Preview generation failed:', error);
    alert('Failed to generate preview. Please try again.');
  }
}

// Build preview HTML
function buildPreviewHtml(data) {
  const currencySymbol = CURRENCY_SYMBOLS[currentCurrency] || '$';
  const format = (n) => `${currencySymbol}${formatNumber(n)}`;

  const itemsRows = data.items.map((item, i) => `
    <tr${i % 2 === 0 ? ' class="preview-row-alt"' : ''}>
      <td>${escapeHtml(item.description)}</td>
      <td>${item.qty}</td>
      <td>${format(item.price)}</td>
      <td class="preview-cell-amount">${format(item.amount)}</td>
    </tr>
  `).join('');

  const chargeRows = data.charges.map((c) => {
    const suffix = c.basis === 'percent' ? ` (${trimNumber(c.value)}%)` : '';
    const deduct = c.mode === 'deduct';
    return `<p><span>${escapeHtml(c.label)}${suffix}</span><span${deduct ? ' style="color:#dc2626;"' : ''}>${deduct ? '-' : '+'}${format(Math.abs(c.amount))}</span></p>`;
  }).join('');

  const installmentRows = data.installments.map((ins, i) => `
    <tr${i % 2 === 0 ? ' class="preview-row-alt"' : ''}>
      <td>${i + 1}</td>
      <td>${escapeHtml(ins.description) || '-'}</td>
      <td>${ins.date ? formatDate(ins.date) : '-'}</td>
      <td class="preview-cell-amount">${format(ins.amount)}</td>
    </tr>
  `).join('');

  const scheduleHtml = data.installments.length ? `
      <div class="preview-schedule-wrap">
        <h3 class="preview-schedule-title">Payment Schedule</h3>
        <table class="preview-table preview-schedule-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th>Service Date</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>${installmentRows}</tbody>
        </table>
        <p class="preview-schedule-note">Scheduled ${format(data.scheduled)}${
          data.remaining === 0
            ? ' — fully scheduled'
            : data.remaining < 0
              ? ` — over by ${format(Math.abs(data.remaining))}`
              : ` — remaining ${format(data.remaining)}`
        }</p>
      </div>` : '';

  const logoHtml = logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" class="preview-logo" />` : '';

  return `
    <div class="preview-invoice">
      <div class="preview-header">
        <div class="preview-company">
          ${logoHtml}
          <div>
            <h1>INVOICE</h1>
            <p># ${escapeHtml(data.invoiceNumber)}</p>
          </div>
        </div>
        <div class="preview-dates">
          <p><strong>Invoice Date:</strong> ${formatDate(data.invoiceDate)}</p>
          <p><strong>Due Date:</strong> ${formatDate(data.dueDate)}</p>
        </div>
      </div>
      <div class="preview-parties">
        <div class="preview-bill-from">
          <h3>Bill From</h3>
          ${data.companyName ? `<p>${escapeHtml(data.companyName)}</p>` : ''}
          ${data.companyEmail ? `<p>${escapeHtml(data.companyEmail)}</p>` : ''}
          ${data.companyPhone ? `<p>${escapeHtml(data.companyPhone)}</p>` : ''}
          ${data.companyAddress ? `<p>${escapeHtml(data.companyAddress)}</p>` : ''}
        </div>
        <div class="preview-bill-to">
          <h3>Bill To</h3>
          ${data.clientName ? `<p>${escapeHtml(data.clientName)}</p>` : ''}
          ${data.clientEmail ? `<p>${escapeHtml(data.clientEmail)}</p>` : ''}
          ${data.clientPhone ? `<p>${escapeHtml(data.clientPhone)}</p>` : ''}
          ${data.clientAddress ? `<p>${escapeHtml(data.clientAddress)}</p>` : ''}
        </div>
      </div>
      <table class="preview-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div class="preview-totals-wrap">
        <div class="preview-totals">
          <p><span>Subtotal</span><span>${format(data.subtotal)}</span></p>
          ${chargeRows}
          <p class="preview-grand"><span>Total Invoice Amount</span><span>${format(data.total)}</span></p>
          <p><span>Advance Payment</span>${data.advance > 0 ? `<span style="color:#dc2626;">-${format(data.advance)}</span>` : `<span>${format(0)}</span>`}</p>
          <p class="preview-due"><span>Due Amount</span><span>${format(data.due)}</span></p>
        </div>
      </div>
      ${scheduleHtml}
      <div class="preview-footer">
        <p>&copy; ${data.year} Invoice Generator. All rights reserved.</p>
        <p>Powered by <strong>Md Ashraf Shahin</strong></p>
      </div>
    </div>
  `;
}

// Escape HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Close preview modal
function closePreview() {
  previewModal.style.display = 'none';
  document.body.style.overflow = '';
  previewArea.innerHTML = '';
}

// Download from preview modal
function downloadFromPreview() {
  if (!validateForm()) return;

  const btn = previewDownloadBtn;
  btn.disabled = true;
  btn.textContent = 'Generating...';

  try {
    const data = getInvoiceData();
    setTimeout(() => {
      generatePDF(data, logoDataUrl);
      btn.disabled = false;
      btn.textContent = 'Download PDF';
    }, 50);
  } catch (error) {
    console.error('PDF generation failed:', error);
    alert('Failed to generate PDF. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Download PDF';
  }
}

// Reset the form
function resetForm() {
  itemsBody.innerHTML = '';

  document.getElementById('invoiceNumber').value = 'INV-001';
  initDates();

  document.getElementById('companyName').value = '';
  document.getElementById('companyEmail').value = '';
  document.getElementById('companyPhone').value = '';
  document.getElementById('companyAddress').value = '';
  document.getElementById('companyLogo').value = '';
  logoDataUrl = null;
  document.getElementById('logoPreview').innerHTML = '';

  document.getElementById('clientName').value = '';
  document.getElementById('clientEmail').value = '';
  document.getElementById('clientPhone').value = '';
  document.getElementById('clientAddress').value = '';

  advanceAmountInput.value = 0;
  advanceDateInput.value = '';
  chargesBody.innerHTML = '';
  addCharge('VAT', 'add', 'percent', 10);
  installmentsBody.innerHTML = '';
  splitCount.value = 3;

  document.querySelectorAll('.error-msg').forEach((el) => (el.textContent = ''));
  document.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
  document.querySelectorAll('.input-invalid').forEach((el) => el.classList.remove('input-invalid'));

  addLineItem();
  updateTotals();
}

// Theme toggle
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
    themeToggle.textContent = '🌙';
    localStorage.setItem('invoice-theme', 'light');
  } else {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
    localStorage.setItem('invoice-theme', 'dark');
  }
}

// Load saved theme
function loadTheme() {
  const savedTheme = localStorage.getItem('invoice-theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    themeToggle.textContent = '☀️';
  }
}

// Logo upload handler
companyLogoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    logoDataUrl = event.target.result;
    const preview = document.getElementById('logoPreview');
    preview.innerHTML = `<img src="${logoDataUrl}" alt="Company Logo" />`;
  };
  reader.readAsDataURL(file);
});

// Event listeners
addItemBtn.addEventListener('click', () => addLineItem());
downloadPdfBtn.addEventListener('click', downloadPdf);
previewBtn.addEventListener('click', openPreview);
resetBtn.addEventListener('click', resetForm);
themeToggle.addEventListener('click', toggleTheme);

closePreviewBtn.addEventListener('click', closePreview);
closePreviewBtn2.addEventListener('click', closePreview);
previewDownloadBtn.addEventListener('click', downloadFromPreview);

previewModal.addEventListener('click', (e) => {
  if (e.target === previewModal) {
    closePreview();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && previewModal.style.display === 'flex') {
    closePreview();
  }
});

currencySelect.addEventListener('change', (e) => {
  currentCurrency = e.target.value;
  document.querySelectorAll('#itemsBody tr').forEach((tr) => updateRowAmount(tr));
  updateTotals();
});

// Math expression inputs (delegated so dynamically added rows are covered)
document.addEventListener('focusout', (e) => {
  if (e.target.classList && e.target.classList.contains('calc-input')) evaluateField(e.target);
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('calc-input')) {
    e.preventDefault();
    evaluateField(e.target);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.classList) return;
  if (el.classList.contains('calc-input')) el.classList.remove('input-invalid');
  if (el.closest('#chargesBody') || el.closest('#installmentsBody') || el.id === 'advanceAmount') {
    updateTotals();
  }
});

document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.classList && (el.classList.contains('charge-mode') || el.classList.contains('charge-basis'))) {
    updateTotals();
  }
});

addChargeBtn.addEventListener('click', () => {
  const preset = chargePreset.value;
  if (preset === 'custom') {
    addCharge('', 'add', 'percent', 0);
    chargesBody.lastElementChild.querySelector('.charge-label').focus();
  } else if (preset === 'Discount') {
    addCharge(preset, 'deduct', 'percent', 0);
  } else {
    addCharge(preset, 'add', 'percent', preset === 'VAT' ? 10 : 0);
  }
});

addInstallmentBtn.addEventListener('click', () => addInstallment('', 0));
splitBtn.addEventListener('click', splitDueEvenly);

// Set current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Initialize the app
initDates();
loadTheme();
addCharge('VAT', 'add', 'percent', 10);
addLineItem('Web Design Services', 1, 500);
addLineItem('Hosting (Monthly)', 1, 25);