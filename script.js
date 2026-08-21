// Invoice Generator - Main Logic

// DOM Elements
const itemsBody = document.getElementById('itemsBody');
const addItemBtn = document.getElementById('addItemBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const previewBtn = document.getElementById('previewBtn');
const resetBtn = document.getElementById('resetBtn');
const themeToggle = document.getElementById('themeToggle');
const currencySelect = document.getElementById('currency');
const taxRateInput = document.getElementById('taxRate');
const discountTypeSelect = document.getElementById('discountType');
const discountValueInput = document.getElementById('discountValue');
const companyLogoInput = document.getElementById('companyLogo');

// Modal elements
const previewModal = document.getElementById('previewModal');
const previewArea = document.getElementById('previewArea');
const closePreviewBtn = document.getElementById('closePreviewBtn');
const closePreviewBtn2 = document.getElementById('closePreviewBtn2');
const previewDownloadBtn = document.getElementById('previewDownloadBtn');

// Totals elements
const subtotalEl = document.getElementById('subtotal');
const taxEl = document.getElementById('tax');
const totalEl = document.getElementById('total');
const discountRow = document.getElementById('discountRow');
const discountAmountEl = document.getElementById('discountAmount');
const taxRateLabel = document.getElementById('taxRateLabel');

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

  // Tax rate
  const taxRate = parseFloat(taxRateInput.value);
  if (isNaN(taxRate) || taxRate < 0 || taxRate > 100) {
    taxRateInput.classList.add('invalid');
    isValid = false;
  } else {
    taxRateInput.classList.remove('invalid');
  }

  // Discount value
  if (discountTypeSelect.value !== 'none') {
    const discountVal = parseFloat(discountValueInput.value);
    if (isNaN(discountVal) || discountVal < 0) {
      discountValueInput.classList.add('invalid');
      isValid = false;
    } else {
      discountValueInput.classList.remove('invalid');
    }
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
      <input type="number" class="item-qty" min="0" step="1" value="${qty}" />
    </td>
    <td>
      <input type="number" class="item-price" min="0" step="0.01" value="${price}" />
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

// Calculate and update all totals
function updateTotals() {
  let subtotal = 0;

  document.querySelectorAll('#itemsBody tr').forEach((tr) => {
    const qty = parseFloat(tr.querySelector('.item-qty').value) || 0;
    const price = parseFloat(tr.querySelector('.item-price').value) || 0;
    subtotal += qty * price;
  });

  const discountType = discountTypeSelect.value;
  const discountValue = parseFloat(discountValueInput.value) || 0;
  let discount = 0;

  if (discountType === 'percent') {
    discount = subtotal * (discountValue / 100);
  } else if (discountType === 'fixed') {
    discount = Math.min(discountValue, subtotal);
  }

  const taxRate = parseFloat(taxRateInput.value) || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal - discount + tax;

  subtotalEl.textContent = formatCurrency(subtotal);
  taxEl.textContent = formatCurrency(tax);
  totalEl.textContent = formatCurrency(total);
  taxRateLabel.textContent = taxRate;

  if (discount > 0) {
    discountRow.style.display = 'flex';
    discountAmountEl.textContent = `-${formatCurrency(discount)}`;
  } else {
    discountRow.style.display = 'none';
  }
}

// Get invoice data for PDF & preview
function getInvoiceData() {
  // Line items
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

  // Discount
  const discountType = discountTypeSelect.value;
  const discountValue = parseFloat(discountValueInput.value) || 0;
  let discount = 0;

  if (discountType === 'percent') {
    discount = subtotal * (discountValue / 100);
  } else if (discountType === 'fixed') {
    discount = Math.min(discountValue, subtotal);
  }

  // Tax
  const taxRate = parseFloat(taxRateInput.value) || 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal - discount + tax;

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
    items,
    subtotal,
    discount,
    taxRate,
    tax,
    total,
    year: new Date().getFullYear(),
  };
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// Generate PDF using jsPDF directly
function generatePDF(data, logoDataUrl) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const currencySymbol = CURRENCY_SYMBOLS[currentCurrency] || '$';
  const fmt = (n) => `${currencySymbol}${formatNumber(n)}`;

  let y = margin;

  // ===== HEADER (Logo LEFT + INVOICE + Dates) =====
  let logoWidth = 0;
  if (logoDataUrl) {
    try {
      const logoHeight = 16;
      logoWidth = 40;
      pdf.addImage(logoDataUrl, 'PNG', margin, y - 4, logoWidth, logoHeight);
    } catch (e) {
      logoWidth = 0;
    }
  }

  const titleX = margin + (logoWidth > 0 ? logoWidth + 8 : 0);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(79, 70, 229);
  pdf.text('INVOICE', titleX, y + 2);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(107, 114, 128);
  pdf.text(`# ${data.invoiceNumber}`, titleX, y + 9);

  // Dates aligned right
  pdf.setFontSize(9.5);
  pdf.setTextColor(55, 65, 81);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Invoice Date:', pageWidth - margin - 80, y - 1);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatDate(data.invoiceDate), pageWidth - margin, y - 1, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.text('Due Date:', pageWidth - margin - 80, y + 5);
  pdf.setFont('helvetica', 'normal');
  pdf.text(formatDate(data.dueDate), pageWidth - margin, y + 5, { align: 'right' });

  // Header underline
  y += 18;
  pdf.setDrawColor(79, 70, 229);
  pdf.setLineWidth(1.5);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 12;

  // ===== BILL FROM / BILL TO =====
  const sectionTopY = y;
  const rightColX = margin + contentWidth * 0.52;

  // Bill From
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(79, 70, 229);
  pdf.text('BILL FROM', margin, y);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(17, 24, 39);
  let fromY = y + 5;
  if (data.companyName) { pdf.setFont('helvetica', 'bold'); pdf.text(data.companyName, margin, fromY); fromY += 5; pdf.setFont('helvetica', 'normal'); }
  if (data.companyEmail) { pdf.text(data.companyEmail, margin, fromY); fromY += 5; }
  if (data.companyPhone) { pdf.text(data.companyPhone, margin, fromY); fromY += 5; }
  if (data.companyAddress) {
    const addrLines = pdf.splitTextToSize(data.companyAddress, contentWidth * 0.48);
    addrLines.forEach((line) => { pdf.text(line, margin, fromY); fromY += 5; });
  }

  // Bill To
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(79, 70, 229);
  pdf.text('BILL TO', rightColX, sectionTopY);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(10);
  pdf.setTextColor(17, 24, 39);
  let toY = sectionTopY + 5;
  if (data.clientName) { pdf.setFont('helvetica', 'bold'); pdf.text(data.clientName, rightColX, toY); toY += 5; pdf.setFont('helvetica', 'normal'); }
  if (data.clientEmail) { pdf.text(data.clientEmail, rightColX, toY); toY += 5; }
  if (data.clientPhone) { pdf.text(data.clientPhone, rightColX, toY); toY += 5; }
  if (data.clientAddress) {
    const addrLines = pdf.splitTextToSize(data.clientAddress, contentWidth * 0.48);
    addrLines.forEach((line) => { pdf.text(line, rightColX, toY); toY += 5; });
  }

  // ===== ITEMS TABLE =====
  const tableY = Math.max(fromY, toY) + 8;

  // Table header
  pdf.setFillColor(79, 70, 229);
  pdf.rect(margin, tableY - 6, contentWidth, 9, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(255, 255, 255);

  const colDescrX = margin + 4;
  const colQtyX = margin + contentWidth * 0.52;
  const colPriceX = margin + contentWidth * 0.65;
  const colAmountX = pageWidth - margin - 4;

  pdf.text('DESCRIPTION', colDescrX, tableY);
  pdf.text('QTY', colQtyX, tableY);
  pdf.text('PRICE', colPriceX, tableY);
  pdf.text('AMOUNT', colAmountX, tableY, { align: 'right' });

  // Table rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(17, 24, 39);
  let rowY = tableY + 7;

  data.items.forEach((item, i) => {
    if (rowY > pageHeight - 60) {
      pdf.addPage();
      rowY = margin + 10;
    }

    if (i % 2 === 0) {
      pdf.setFillColor(249, 250, 251);
      pdf.rect(margin, rowY - 5, contentWidth, 9, 'F');
    }

    pdf.text(item.description, colDescrX, rowY);
    pdf.text(String(item.qty), colQtyX, rowY);
    pdf.text(fmt(item.price), colPriceX, rowY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(fmt(item.amount), colAmountX, rowY, { align: 'right' });
    pdf.setFont('helvetica', 'normal');

    rowY += 9;
  });

  // ===== TOTALS =====
  const totalsTop = rowY + 10;
  const totalsX = pageWidth - margin - 95;
  const totalsWidth = 95;
  const totalsHeight = data.discount > 0 ? 50 : 38;

  pdf.setFillColor(249, 250, 251);
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(totalsX, totalsTop, totalsWidth, totalsHeight, 3, 3, 'FD');

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  let tY = totalsTop + 8;

  // Subtotal
  pdf.setTextColor(107, 114, 128);
  pdf.text('Subtotal', totalsX + 5, tY);
  pdf.setTextColor(17, 24, 39);
  pdf.setFont('helvetica', 'bold');
  pdf.text(fmt(data.subtotal), totalsX + totalsWidth - 5, tY, { align: 'right' });
  tY += 6;
  pdf.setFont('helvetica', 'normal');

  // Discount
  if (data.discount > 0) {
    pdf.setTextColor(107, 114, 128);
    pdf.text('Discount', totalsX + 5, tY);
    pdf.setTextColor(220, 38, 38);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`-${fmt(data.discount)}`, totalsX + totalsWidth - 5, tY, { align: 'right' });
    tY += 6;
    pdf.setFont('helvetica', 'normal');
  }

  // Tax
  pdf.setTextColor(107, 114, 128);
  pdf.text(`Tax (${data.taxRate}%)`, totalsX + 5, tY);
  pdf.setTextColor(17, 24, 39);
  pdf.setFont('helvetica', 'bold');
  pdf.text(fmt(data.tax), totalsX + totalsWidth - 5, tY, { align: 'right' });
  tY += 6;
  pdf.setFont('helvetica', 'normal');

  // ===== GRAND TOTAL =====
  pdf.setFillColor(79, 70, 229);
  pdf.roundedRect(totalsX, tY + 2, totalsWidth, 12, 3, 3, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(255, 255, 255);
  pdf.text('TOTAL DUE', totalsX + 5, tY + 10);
  pdf.setFontSize(11);
  pdf.text(fmt(data.total), totalsX + totalsWidth - 5, tY + 10, { align: 'right' });

  // ===== FOOTER =====
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(107, 114, 128);
  pdf.text(`© ${data.year} Invoice Generator. All rights reserved.`, pageWidth / 2, pageHeight - 14, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(79, 70, 229);
  pdf.text('Powered by Md Ashraf Shahin', pageWidth / 2, pageHeight - 8, { align: 'center' });

  // Save
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
          ${data.discount > 0 ? `<p><span>Discount</span><span style="color:#dc2626;">-${format(data.discount)}</span></p>` : ''}
          <p><span>Tax (${data.taxRate}%)</span><span>${format(data.tax)}</span></p>
          <p class="preview-grand"><span>Total Due</span><span>${format(data.total)}</span></p>
        </div>
      </div>
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

  taxRateInput.value = 10;
  discountTypeSelect.value = 'none';
  discountValueInput.value = 0;

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

taxRateInput.addEventListener('input', updateTotals);
discountTypeSelect.addEventListener('change', updateTotals);
discountValueInput.addEventListener('input', updateTotals);

// Set current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Initialize the app
initDates();
loadTheme();
addLineItem('Web Design Services', 1, 500);
addLineItem('Hosting (Monthly)', 1, 25);