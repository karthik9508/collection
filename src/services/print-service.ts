import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform, Alert } from 'react-native';
import { Bill, BillItem, Customer, BusinessProfile, saveBillHtmlSnapshot } from './db';

/**
 * Builds a highly-polished, professional, print-ready HTML template for invoices or quotes.
 */
export function generateDocumentHTML(
  bill: Bill,
  customer: Customer | null,
  items: BillItem[],
  bizProfile: BusinessProfile | null
): string {
  const currency = bizProfile?.currency || '₹';
  const isEstimate = bill.is_estimate;
  const docTypeLabel = isEstimate ? 'PROFORMA ESTIMATE' : 'TAX INVOICE';
  const docNumberLabel = isEstimate ? 'Estimate No' : 'Invoice No';
  
  // Format dates
  const dateFormatted = bill.bill_date;
  const dueDateFormatted = bill.due_date || 'N/A';

  // Calculations
  const subtotal = Number(bill.subtotal);
  const discount = Number(bill.discount);
  const taxAmount = Number(bill.tax_amount);
  const totalAmount = Number(bill.total_amount);
  const amountPaid = Number(bill.amount_paid);
  const outstanding = totalAmount - amountPaid;

  // Status Badge Logic
  let statusText = '';
  let statusClass = '';
  if (isEstimate) {
    statusText = 'ESTIMATE PROPOSAL';
    statusClass = 'status-estimate';
  } else if (outstanding <= 0) {
    statusText = 'PAID IN FULL';
    statusClass = 'status-paid';
  } else if (amountPaid > 0) {
    statusText = 'PARTIAL PAYMENT';
    statusClass = 'status-partial';
  } else {
    statusText = 'BALANCE DUE';
    statusClass = 'status-due';
  }

  // Accent Colors & Gradients depending on Estimate vs Invoice
  const accentColor = isEstimate ? '#7c3aed' : '#4f46e5'; // Violet vs Indigo
  const accentGradient = isEstimate 
    ? 'linear-gradient(90deg, #a78bfa 0%, #7c3aed 100%)' 
    : 'linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)';
  const headerBrandColor = isEstimate ? '#6d28d9' : '#4338ca';

  // Build items rows
  const itemRowsHTML = items
    .map(
      (item) => `
      <tr class="item-row">
        <td>
          <div class="item-name">${item.item_name}</div>
        </td>
        <td class="text-center bold" style="color: #0f172a;">${item.quantity}</td>
        <td class="text-right">${currency}${item.price.toFixed(2)}</td>
        <td class="text-right" style="color: #64748b;">${item.tax_rate}%</td>
        <td class="text-right" style="color: #10b981;">${item.discount_rate > 0 ? '-' + item.discount_rate + '%' : '0%'}</td>
        <td class="text-right bold" style="color: #0f172a;">${currency}${item.total.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>${docTypeLabel} - ${bill.bill_number}</title>
      <!-- Load Google Fonts (Inter) -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background-color: #ffffff;
          margin: 0;
          padding: 20px;
          line-height: 1.5;
          -webkit-font-smoothing: antialiased;
        }
        
        .invoice-box {
          max-width: 800px;
          margin: auto;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 40px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
        }

        /* Top colored bar representing premium brand strip */
        .brand-strip {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: ${accentGradient};
        }
        
        /* Layout structures */
        .flex-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .w-50 {
          width: 50%;
        }

        .w-100 {
          width: 100%;
        }

        .bold { font-weight: 600; }
        .extrabold { font-weight: 800; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        /* Status Badge Styling */
        .status-badge {
          display: inline-block;
          padding: 5px 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          border-radius: 9999px;
          letter-spacing: 0.05em;
          margin-top: 8px;
        }

        .status-paid {
          background-color: #d1fae5;
          color: #065f46;
        }

        .status-due {
          background-color: #fee2e2;
          color: #991b1b;
        }

        .status-partial {
          background-color: #fef3c7;
          color: #92400e;
        }

        .status-estimate {
          background-color: #f3e8ff;
          color: #6b21a8;
        }
        
        /* Company Details header */
        .company-branding {
          margin-bottom: 35px;
        }

        .biz-name {
          font-size: 26px;
          font-weight: 800;
          color: ${headerBrandColor};
          letter-spacing: -0.03em;
          margin: 0 0 6px 0;
        }

        .biz-details {
          font-size: 13px;
          color: #475569;
          line-height: 1.45;
        }

        /* Document Title Block */
        .doc-title-block {
          text-align: right;
        }

        .doc-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: ${accentColor};
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .doc-number {
          font-size: 22px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          margin-bottom: 8px;
        }
        
        /* Info cards */
        .info-cards-container {
          margin-top: 30px;
          margin-bottom: 40px;
          gap: 20px;
          display: flex;
        }

        .info-card {
          flex: 1;
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 20px;
        }

        .card-header-label {
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 10px;
          border-bottom: 1px dashed #e2e8f0;
          padding-bottom: 6px;
        }

        .card-client-name {
          font-size: 15px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 4px;
        }

        .summary-item-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: #475569;
          margin-bottom: 6px;
        }

        .summary-item-row.total-row {
          border-top: 1px dashed #cbd5e1;
          padding-top: 8px;
          margin-top: 8px;
          font-weight: 700;
          color: #0f172a;
        }
        
        /* Line Items Grid */
        .table-container {
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 35px;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .items-table th {
          background: #f8fafc;
          color: #475569;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .items-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 13px;
          color: #334155;
          vertical-align: middle;
        }

        .items-table tr:last-child td {
          border-bottom: none;
        }
        
        .item-name {
          font-weight: 700;
          color: #0f172a;
          font-size: 13.5px;
        }
        
        /* Calculations Breakdown Layout */
        .calculation-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 35px;
        }

        .totals-card {
          width: 320px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 16px 20px;
        }
        
        .totals-card table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .totals-card td {
          padding: 6px 0;
          font-size: 13px;
          color: #475569;
        }
        
        .totals-card tr.grand-total-row td {
          font-size: 16px;
          font-weight: 800;
          color: ${accentColor};
          border-top: 1px solid #cbd5e1;
          padding-top: 12px;
          margin-top: 8px;
        }

        .totals-card tr.outstanding-row td {
          color: #b91c1c;
          font-weight: 700;
        }
        
        /* Notes block */
        .notes-section {
          padding: 18px 22px;
          background: #f8fafc;
          border-left: 4px solid ${accentColor};
          border-radius: 0 8px 8px 0;
          font-size: 12.5px;
          color: #475569;
          margin-top: 30px;
        }
        
        .notes-title {
          font-weight: 700;
          color: #0f172a;
          font-size: 11px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        
        /* Creative branding footer */
        .footer-branding {
          margin-top: 60px;
          text-align: center;
          font-size: 12px;
          color: #94a3b8;
          border-top: 1px dashed #e2e8f0;
          padding-top: 25px;
        }
      </style>
    </head>
    <body>
      <div class="invoice-box">
        <div class="brand-strip"></div>
        
        <!-- Header Branding & Doc Metadata -->
        <div class="flex-row company-branding">
          <div class="w-50">
            <h1 class="biz-name">${bizProfile?.name || 'My Business ERP'}</h1>
            <div class="biz-details">
              ${bizProfile?.address || ''}<br>
              ${bizProfile?.phone ? '📞 ' + bizProfile.phone : ''} ${bizProfile?.email ? ' • ✉️ ' + bizProfile.email : ''}<br>
              ${bizProfile?.tax_number ? '<b>GSTIN/VAT:</b> ' + bizProfile.tax_number : ''}
            </div>
          </div>
          <div class="doc-title-block">
            <div class="doc-label">${docTypeLabel}</div>
            <div class="doc-number">${bill.bill_number}</div>
            <div class="biz-details">
              <b>Date:</b> ${dateFormatted}<br>
              <b>Due Date:</b> ${dueDateFormatted}
            </div>
            <div>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
          </div>
        </div>
        
        <!-- Billing Details info box -->
        <div class="info-cards-container">
          <div class="info-card">
            <div class="card-header-label">BILL TO:</div>
            <div class="card-client-name">${customer ? customer.name : 'Walk-in Customer'}</div>
            <div class="biz-details">
              ${customer?.address || ''}<br>
              ${customer?.phone ? '📞 ' + customer.phone : ''}<br>
              ${customer?.email ? '✉️ ' + customer.email : ''}
            </div>
          </div>
          <div class="info-card">
            <div class="card-header-label">SUMMARY DETAILS:</div>
            <div class="summary-values">
              <div class="summary-item-row">
                <span>Subtotal Amount:</span>
                <span class="bold">${currency}${subtotal.toFixed(2)}</span>
              </div>
              <div class="summary-item-row">
                <span>Tax Levy:</span>
                <span class="bold">${currency}${taxAmount.toFixed(2)}</span>
              </div>
              <div class="summary-item-row total-row">
                <span>Net Due:</span>
                <span class="bold" style="color: ${outstanding > 0 ? '#b91c1c' : '#059669'};">${currency}${outstanding.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Line Items Table -->
        <div class="table-container">
          <table class="items-table">
            <thead>
              <tr>
                <th style="text-align: left;">DESCRIPTION</th>
                <th style="width: 10%; text-align: center;">QTY</th>
                <th style="width: 16%; text-align: right;">RATE</th>
                <th style="width: 12%; text-align: right;">TAX %</th>
                <th style="width: 12%; text-align: right;">DISC %</th>
                <th style="width: 18%; text-align: right;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHTML}
            </tbody>
          </table>
        </div>
        
        <!-- Calculations breakdown block -->
        <div class="calculation-section">
          <div class="totals-card">
            <table>
              <tr>
                <td>Subtotal:</td>
                <td class="text-right bold">${currency}${subtotal.toFixed(2)}</td>
              </tr>
              ${
                discount > 0
                  ? `<tr>
                      <td style="color: #059669;">Item Discounts:</td>
                      <td class="text-right bold" style="color: #059669;">- ${currency}${discount.toFixed(2)}</td>
                    </tr>`
                  : ''
              }
              <tr>
                <td>Taxes (GST/VAT):</td>
                <td class="text-right bold" style="color: #d97706;">+ ${currency}${taxAmount.toFixed(2)}</td>
              </tr>
              <tr class="grand-total-row">
                <td>Grand Total:</td>
                <td class="text-right bold">${currency}${totalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="color: #4b5563;">Amount Paid:</td>
                <td class="text-right bold" style="color: #059669;">${currency}${amountPaid.toFixed(2)}</td>
              </tr>
              ${
                outstanding > 0
                  ? `<tr class="outstanding-row">
                      <td class="bold">Net Balance Due:</td>
                      <td class="text-right bold">${currency}${outstanding.toFixed(2)}</td>
                    </tr>`
                  : ''
              }
            </table>
          </div>
        </div>
        
        <!-- Footer Notes and Comments -->
        ${
          bill.notes
            ? `
            <div class="notes-section">
              <div class="notes-title">Terms & Conditions:</div>
              <div>${bill.notes}</div>
            </div>
          `
            : ''
        }
        
        <div class="footer-branding">
          Thank you for your business!<br>
          Generated dynamically by Mobile ERP
        </div>
        
      </div>
    </body>
    </html>
  `;
}

/**
 * Generates a PDF file from the invoice HTML and launches the OS sharing/save dialog.
 */
export async function exportDocumentAsPDF(
  bill: Bill,
  customer: Customer | null,
  items: BillItem[],
  bizProfile: BusinessProfile | null
): Promise<boolean> {
  try {
    let html = bill.pdf_html;
    if (!html) {
      html = generateDocumentHTML(bill, customer, items, bizProfile);
      
      // Freeze the generated creative HTML invoice layout in the database in the background
      saveBillHtmlSnapshot(bill.id, html).catch((err) => {
        console.warn('Failed to archive frozen HTML invoice snapshot:', err);
      });
    }

    if (Platform.OS === 'web') {
      // On Web, expo-print can print directly to browser window
      await Print.printAsync({ html });
      return true;
    } else {
      // On Mobile (iOS/Android), compile to a temporary PDF file
      const { uri } = await Print.printToFileAsync({ html });
      
      // Verify if sharing is available on the device
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${bill.is_estimate ? 'Quote' : 'Invoice'} - ${bill.bill_number}`,
          UTI: 'com.adobe.pdf',
        });
        return true;
      } else {
        console.warn('Native sharing dialog is not available on this mobile client.');
        return false;
      }
    }
  } catch (error) {
    console.error('Error generating/exporting PDF document:', error);
    return false;
  }
}

/**
 * Exports the invoice or estimate as a high-definition PNG image.
 * On Web, it compiles it directly using an HTML-to-Canvas compiler and downloads it.
 * On Mobile, it gracefully shares it as a high-quality vector PDF.
 */
export async function exportDocumentAsPNG(
  bill: Bill,
  customer: Customer | null,
  items: BillItem[],
  bizProfile: BusinessProfile | null
): Promise<boolean> {
  try {
    let html = bill.pdf_html;
    if (!html) {
      html = generateDocumentHTML(bill, customer, items, bizProfile);
      
      // Cache/freeze the creative layout in the DB
      saveBillHtmlSnapshot(bill.id, html).catch((err) => {
        console.warn('Failed to archive frozen HTML invoice snapshot during PNG export:', err);
      });
    }

    if (Platform.OS === 'web') {
      // Create a hidden iframe to render the invoice cleanly off-screen
      const iframe = document.createElement('iframe');
      iframe.style.position = 'absolute';
      iframe.style.width = '800px';
      iframe.style.height = '1100px';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      document.body.appendChild(iframe);

      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc) {
        document.body.removeChild(iframe);
        return false;
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Wait for font and layout computations
      await new Promise((r) => setTimeout(r, 600));

      const width = 800;
      const height = iframe.contentWindow?.document.body.scrollHeight || 1100;

      // Extract styles and body HTML content
      const styles = Array.from(doc.querySelectorAll('style'))
        .map(style => style.innerHTML)
        .join('\n');
      const bodyHtml = doc.body.innerHTML;

      // Wrap in inline SVG foreignObject
      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; font-family:'Inter', sans-serif; padding:0; margin:0; box-sizing:border-box; width:100%; height:100%;">
              <style>${styles}</style>
              ${bodyHtml}
            </div>
          </foreignObject>
        </svg>
      `;

      document.body.removeChild(iframe);

      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.src = blobURL;

      return new Promise<boolean>((resolve) => {
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (context) {
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, width, height);
            context.drawImage(image, 0, 0);

            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = `${bill.is_estimate ? 'Estimate' : 'Invoice'}_${bill.bill_number}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(blobURL);
            resolve(true);
          } else {
            URL.revokeObjectURL(blobURL);
            resolve(false);
          }
        };
        image.onerror = () => {
          URL.revokeObjectURL(blobURL);
          resolve(false);
        };
      });
    } else {
      // Mobile fallback: Compile to vector PDF and open Native Sharing sheet
      const { uri } = await Print.printToFileAsync({ html });
      
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `${bill.is_estimate ? 'Quote' : 'Invoice'} - ${bill.bill_number}`,
          UTI: 'com.adobe.pdf',
        });
        
        Alert.alert(
          "Export Image",
          "Your invoice has been exported as a professional vector PDF! Note: Raw PNG image download is fully optimized for web/desktop screens.",
          [{ text: "Great" }]
        );
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error('Error exporting PNG document:', error);
    return false;
  }
}

