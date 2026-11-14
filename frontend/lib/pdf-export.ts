import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, SummaryData, User } from './types';

export function generateFinancialStatementPDF(
  user: User,
  summary: SummaryData,
  transactions: Transaction[],
  period: string
) {
  const doc = new jsPDF();

  // Primary colors
  const primaryColor: [number, number, number] = [16, 185, 129]; // Emerald 500
  const darkColor: [number, number, number] = [15, 23, 42]; // Slate 900
  const grayColor: [number, number, number] = [100, 116, 139]; // Slate 500

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('CashFlow — Financial Statement', 14, 16);

  // Metadata
  doc.setTextColor(...darkColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`User: ${user.full_name || 'Active User'} (${user.email})`, 14, 34);
  doc.text(`Period: ${period.replace('_', ' ').toUpperCase()}`, 14, 40);
  doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 46);
  doc.text(`Currency: ${user.currency}`, 14, 52);

  // Summary Metrics Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 58, 182, 28, 3, 3, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 58, 182, 28, 3, 3, 'S');

  // Total Cash In
  doc.setFontSize(9);
  doc.setTextColor(16, 185, 129);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL CASH IN', 24, 68);
  doc.setFontSize(13);
  doc.text(`+${user.currency} ${summary.total_income.toFixed(2)}`, 24, 78);

  // Total Cash Out
  doc.setFontSize(9);
  doc.setTextColor(239, 68, 68);
  doc.text('TOTAL CASH OUT', 88, 68);
  doc.setFontSize(13);
  doc.text(`-${user.currency} ${summary.total_expense.toFixed(2)}`, 88, 78);

  // Net Balance
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('NET BALANCE', 148, 68);
  doc.setFontSize(13);
  const netPrefix = summary.net_balance >= 0 ? '+' : '-';
  doc.text(`${netPrefix}${user.currency} ${Math.abs(summary.net_balance).toFixed(2)}`, 148, 78);

  // Transactions Table
  const tableRows = transactions.map((t) => [
    new Date(t.date).toLocaleDateString(),
    t.type.toUpperCase(),
    t.category?.name || 'General',
    t.payment_method || 'Cash',
    t.note || '-',
    `${t.type === 'income' ? '+' : '-'}${user.currency} ${t.amount.toFixed(2)}`,
  ]);

  autoTable(doc, {
    startY: 94,
    head: [['Date', 'Type', 'Category', 'Method', 'Note', 'Amount']],
    body: tableRows,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: darkColor,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 20 },
      2: { cellWidth: 32 },
      3: { cellWidth: 26 },
      4: { cellWidth: 46 },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.column.index === 5 && data.section === 'body') {
        const text = String(data.cell.raw);
        if (text.startsWith('+')) {
          data.cell.styles.textColor = [16, 185, 129];
        } else {
          data.cell.styles.textColor = [239, 68, 68];
        }
      }
    },
  });

  // Footer Note
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `CashFlow Personal Finance — Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    );
  }

  // Save the PDF file
  const fileName = `Financial_Statement_${period}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
