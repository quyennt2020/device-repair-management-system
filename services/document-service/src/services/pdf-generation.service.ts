import * as puppeteer from 'puppeteer';
import { Document, DocumentType, UUID } from '../types';
import { DocumentTypeRepository } from '../repositories/document-type.repository';

export interface PDFGenerationOptions {
  format?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  headerTemplate?: string;
  footerTemplate?: string;
  displayHeaderFooter?: boolean;
}

export class PDFGenerationService {
  private documentTypeRepository: DocumentTypeRepository;

  constructor() {
    this.documentTypeRepository = new DocumentTypeRepository();
  }

  async generateDocumentPDF(document: Document, options: PDFGenerationOptions = {}): Promise<Buffer> {
    const documentType = await this.documentTypeRepository.findById(document.documentTypeId);
    if (!documentType) {
      throw new Error('Document type not found');
    }

    const html = await this.generateHTML(document, documentType);
    return this.generatePDFFromHTML(html, options);
  }

  async generatePreviewPDF(documentTypeId: UUID, content: any, options: PDFGenerationOptions = {}): Promise<Buffer> {
    const documentType = await this.documentTypeRepository.findById(documentTypeId);
    if (!documentType) {
      throw new Error('Document type not found');
    }

    const mockDocument: Document = {
      id: 'preview',
      caseId: 'preview',
      documentTypeId,
      status: 'draft',
      content,
      version: 1,
      createdBy: 'preview',
      createdAt: new Date(),
      updatedAt: new Date(),
      approvals: [],
      attachments: []
    };

    const html = await this.generateHTML(mockDocument, documentType);
    return this.generatePDFFromHTML(html, options);
  }

  private async generateHTML(document: Document, documentType: DocumentType): Promise<string> {
    const { content } = document;
    const { templateConfig } = documentType;

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${documentType.name}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #2c3e50;
          }
          .header .document-info {
            margin-top: 10px;
            font-size: 10px;
            color: #666;
          }
          .section {
            margin-bottom: 25px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #2c3e50;
            border-bottom: 1px solid #bdc3c7;
            padding-bottom: 5px;
            margin-bottom: 15px;
          }
          .field-group {
            margin-bottom: 15px;
          }
          .field-label {
            font-weight: bold;
            color: #34495e;
            margin-bottom: 5px;
          }
          .field-value {
            margin-left: 10px;
            padding: 5px;
            background-color: #f8f9fa;
            border-left: 3px solid #3498db;
          }
          .table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .table th,
          .table td {
            border: 1px solid #bdc3c7;
            padding: 8px;
            text-align: left;
          }
          .table th {
            background-color: #ecf0f1;
            font-weight: bold;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #bdc3c7;
            font-size: 10px;
            color: #666;
          }
          .signature-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 200px;
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #333;
            margin-top: 40px;
            padding-top: 5px;
          }
          @media print {
            body { margin: 0; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${documentType.name}</h1>
          <div class="document-info">
            Document ID: ${document.id} | Version: ${document.version} | 
            Created: ${document.createdAt.toLocaleDateString()} | 
            Status: ${document.status.toUpperCase()}
          </div>
        </div>
    `;

    // Generate sections based on template configuration
    if (templateConfig.sections) {
      for (const sectionName of templateConfig.sections) {
        html += this.generateSection(sectionName, content, templateConfig);
      }
    } else {
      // Fallback: generate all content fields
      html += this.generateGenericContent(content);
    }

    // Add signature section for certain document types
    if (['quotation', 'repair_report'].includes(documentType.category)) {
      html += this.generateSignatureSection();
    }

    html += `
        <div class="footer">
          Generated on ${new Date().toLocaleString()} | 
          Device Repair Management System
        </div>
      </body>
      </html>
    `;

    return html;
  }

  private generateSection(sectionName: string, content: any, templateConfig: any): string {
    let sectionHtml = `<div class="section">`;
    sectionHtml += `<div class="section-title">${this.formatSectionTitle(sectionName)}</div>`;

    // Get fields for this section
    const sectionFields = this.getSectionFields(sectionName, templateConfig);
    
    for (const fieldName of sectionFields) {
      const fieldValue = content[fieldName];
      if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '') {
        sectionHtml += this.generateField(fieldName, fieldValue);
      }
    }

    sectionHtml += `</div>`;
    return sectionHtml;
  }

  private generateField(fieldName: string, fieldValue: any): string {
    const label = this.formatFieldLabel(fieldName);
    
    if (Array.isArray(fieldValue)) {
      return this.generateArrayField(label, fieldValue);
    } else if (typeof fieldValue === 'object') {
      return this.generateObjectField(label, fieldValue);
    } else {
      return `
        <div class="field-group">
          <div class="field-label">${label}:</div>
          <div class="field-value">${this.formatFieldValue(fieldValue)}</div>
        </div>
      `;
    }
  }

  private generateArrayField(label: string, values: any[]): string {
    if (values.length === 0) return '';

    let html = `<div class="field-group">`;
    html += `<div class="field-label">${label}:</div>`;
    
    // Check if it's a table-like structure
    if (values.length > 0 && typeof values[0] === 'object') {
      html += this.generateTable(values);
    } else {
      html += `<div class="field-value">`;
      html += `<ul>`;
      for (const value of values) {
        html += `<li>${this.formatFieldValue(value)}</li>`;
      }
      html += `</ul>`;
      html += `</div>`;
    }
    
    html += `</div>`;
    return html;
  }

  private generateObjectField(label: string, obj: any): string {
    let html = `<div class="field-group">`;
    html += `<div class="field-label">${label}:</div>`;
    html += `<div class="field-value">`;
    
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && value !== '') {
        html += `<div><strong>${this.formatFieldLabel(key)}:</strong> ${this.formatFieldValue(value)}</div>`;
      }
    }
    
    html += `</div>`;
    html += `</div>`;
    return html;
  }

  private generateTable(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    
    let html = `<table class="table">`;
    html += `<thead><tr>`;
    for (const header of headers) {
      html += `<th>${this.formatFieldLabel(header)}</th>`;
    }
    html += `</tr></thead>`;
    
    html += `<tbody>`;
    for (const row of data) {
      html += `<tr>`;
      for (const header of headers) {
        html += `<td>${this.formatFieldValue(row[header])}</td>`;
      }
      html += `</tr>`;
    }
    html += `</tbody>`;
    html += `</table>`;
    
    return html;
  }

  private generateGenericContent(content: any): string {
    let html = `<div class="section">`;
    html += `<div class="section-title">Document Content</div>`;
    
    for (const [key, value] of Object.entries(content)) {
      if (value !== undefined && value !== null && value !== '') {
        html += this.generateField(key, value);
      }
    }
    
    html += `</div>`;
    return html;
  }

  private generateSignatureSection(): string {
    return `
      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">Technician Signature</div>
        </div>
        <div class="signature-box">
          <div class="signature-line">Customer Signature</div>
        </div>
      </div>
    `;
  }

  private async generatePDFFromHTML(html: string, options: PDFGenerationOptions): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfOptions: puppeteer.PDFOptions = {
        format: options.format || 'A4',
        landscape: options.orientation === 'landscape',
        margin: options.margin || {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        printBackground: true,
        displayHeaderFooter: options.displayHeaderFooter || false,
        headerTemplate: options.headerTemplate || '',
        footerTemplate: options.footerTemplate || ''
      };

      const pdf = await page.pdf(pdfOptions);
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private getSectionFields(sectionName: string, templateConfig: any): string[] {
    // This would be more sophisticated in a real implementation
    // For now, return all fields
    return templateConfig.requiredFields || [];
  }

  private formatSectionTitle(sectionName: string): string {
    return sectionName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatFieldLabel(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    
    if (typeof value === 'number') {
      return value.toLocaleString();
    }
    
    return String(value);
  }
}