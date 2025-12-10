// Credit Commitment Editor - app.js
// This script contains a small set of templates (6 types) and UI wiring.

(function(){
  // Default templates (fallback if fetch not available when opening file://)
  const DEFAULT_TEMPLATES = [
  { id: 'pw3-7', name: 'Form PW3-7', html: true, templateHtml: `
<div class="pw3-container">
  <style>
    .pw3-container{font-family: 'Times New Roman', Times, serif; color:#000; max-width:800px; margin:0 auto; padding:24px}
  .header-row{display:flex; justify-content:space-between; align-items:flex-start}
  .header-right{font-size:11px; text-align:right}
  .pw3-title{font-weight:700; font-size:14px}
  .pw3-sub{font-size:10px; text-align:center; margin-bottom:12px}
  .pw3-body{margin-top:10px; font-size:12px; line-height:1.45; text-align:justify}
  .pw3-sign{margin-top:32px; display:flex; justify-content:space-between; align-items:flex-start}
  .pw3-sign .left, .pw3-sign .right{width:48%; text-align:center}
  .pw3-sign .name{display:block; font-weight:700; font-size:13px}
  .pw3-sign .title{display:block; font-size:11px; margin-top:6px}
  .pw3-sign .title{display:block; font-size:11px; margin-top:6px}
  .pw3-address{white-space:pre-wrap; margin-bottom:8px}
  </style>

  <div class="header-row">
    <div></div>
    <div class="header-right">
      <div>{{branchDetails}}</div>
    </div>
  </div>

  <div class="pw3-title" style="text-align:center">Letter of Commitment for Bank’s Undertaking for Line of Credit (Form PW3-7)</div>
  <div class="pw3-sub">[This is the format for the Credit Line to be issued by any scheduled Bank of Bangladesh in accordance with ITT Clause 32.1(d)]</div>

  <div class="pw3-body">
    <div><strong>Invitation for Tender No:</strong> APP ID : 204431</div>
    <div><strong>Tender ID:</strong> 1128414</div>
    <div><strong>Tender Package No:</strong> GSID-2/PAB/SDW-388</div>
    <div><strong>Lot No (when applicable):</strong> </div>

  <p><strong>To</strong><br>{{recipient}}</p>

    <h3 style="text-align:center">CREDIT COMMITMENT No: 427/2025 &nbsp;&nbsp; Date: 25.10.2025</h3>

  <p>We have been informed that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> (hereinafter called "the Tenderer") intends to submit to you its Tender (hereinafter called "the Tender") for the execution of the Works of "{{description}}", under the above Invitation for Tenders (hereinafter called "the IFT").</p>

    <p>Furthermore, we understand that, according to your conditions, the Tenderer's Financial Capacity i.e., Liquid Asset must be substantiated by a Letter of Commitment of Bank's Undertaking for Line of Credit.</p>

  <p>At the request of, and arrangement with, the Tenderer, we United Commercial Bank PLC do hereby agree and undertake that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> will be provided by us with a revolving line of credit, in case awarded the Contract, for execution of the Works viz. "{{description}}", for an amount not less than <strong>{{amount}} {{amountWordsBriket}}</strong> for the sole purpose of the execution of the above Contract. This Revolving Line of Credit will be maintained by us until issuance of "Taking-Over Certificate" by the Procuring Entity.</p>

    <p>In witness whereof, authorised representative of the Bank has hereunto signed and sealed this Letter of Commitment.</p>

    <div class="pw3-sign">
      <div class="left"><span class="name">{{leftSignName}}</span><span class="title">{{leftSignTitle}}</span></div>
      <div class="right"><span class="name">{{rightSignName}}</span><span class="title">{{rightSignTitle}}</span></div>
    </div>
  </div>
</div>
` },
  { id: 'pg2-5', name: 'Form PG2-5', html: true, templateHtml: `
<div class="pw3-container">
  <style>
    .pw3-container{font-family: 'Times New Roman', Times, serif; color:#000; max-width:800px; margin:0 auto; padding:24px}
  .header-row{display:flex; justify-content:space-between; align-items:flex-start}
  .header-right{font-size:11px; text-align:right}
  .pw3-title{font-weight:700; font-size:14px}
  .pw3-sub{font-size:10px; text-align:center; margin-bottom:12px}
  .pw3-body{margin-top:10px; font-size:12px; line-height:1.45; text-align:justify}
  .pw3-list{margin:12px 0 18px 20px}
  .pw3-sign{margin-top:32px; display:flex; justify-content:space-between; align-items:flex-start}
  .pw3-sign .left, .pw3-sign .right{width:48%; text-align:center}
  .pw3-sign .name{display:block; font-weight:700; font-size:13px}
  .pw3-sign .title{display:block; font-size:11px; margin-top:6px}
  </style>

  <div class="header-row">
    <div></div>
    <div class="header-right">
      <div>{{branchDetails}}</div>
    </div>
  </div>

  <div class="pw3-title" style="text-align:center">Letter of Commitment for Bank’s Undertaking for Line of Credit (Form PG2-5)</div>
  <div class="pw3-sub">[This is the format for the Credit Line to be issued by any scheduled Bank of Bangladesh in accordance with ITT Clause 17.1(d)]</div>

  <div class="pw3-body">
    <div><strong>Invitation for Tender No:</strong> APP ID : 204431</div>
    <div><strong>Tender ID:</strong> 1128414</div>
    <div><strong>Tender Package No:</strong> GSID-2/PAB/SDW-388</div>
    <div><strong>Lot No (when applicable):</strong> </div>
  <p><strong>To</strong><br>{{recipient}}</p>
    <h3 style="text-align:center">CREDIT COMMITMENT No: 427/2025 &nbsp;&nbsp; Date: 25.10.2025</h3>
  <p>We have been informed that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> (hereinafter called "the Tenderer") intends to submit to you its Tender (hereinafter called "the Tender") for the supply of Goods of "{{description}}", under the above Invitation for Tenders (hereinafter called "the IFT").</p>

    <p>Furthermore, we understand that, according to your conditions, the Tenderer’s Financial Capacity i.e., Liquid Asset must be substantiated by a Letter of Commitment of Bank’s Undertaking for Line of Credit.</p>

  <p>At the request of, and arrangement with, the Tenderer, we United Commercial Bank PLC do hereby agree and undertake that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> will be provided by us with a revolving line of credit, in case awarded the Contract, for delivery of Goods and related services for an amount not less than <strong>{{amount}} {{amountWordsBriket}}</strong> for the sole purpose of the supply of Goods and related services under the above Contract. This Revolving Line of Credit will be maintained by us until issuance of 'Acceptance Certificate' by the Procuring Entity.</p>

    <p>In witness whereof, authorised representative of the Bank has hereunto signed and sealed this Letter of Commitment.</p>

    <div class="pw3-sign">
      <div class="left"><span class="name">{{leftSignName}}</span><span class="title">{{leftSignTitle}}</span></div>
      <div class="right"><span class="name">{{rightSignName}}</span><span class="title">{{rightSignTitle}}</span></div>
    </div>
  </div>
</div>
` },
  { id: 'pw2b-3', name: 'Form PW2b-3', html: true, templateHtml: `
<div class="pw3-container">
  <style>
    .pw3-container{font-family: 'Times New Roman', Times, serif; color:#000; max-width:800px; margin:0 auto; padding:24px}
    .header-row{display:flex; justify-content:space-between; align-items:flex-start}
  .header-right{font-size:11px; text-align:right}
  .pw3-title{font-weight:700; font-size:14px}
  .pw3-sub{font-size:10px; text-align:center; margin-bottom:12px}
  .pw3-body{margin-top:10px; font-size:12px; line-height:1.45; text-align:justify}
    .pw3-list{margin:12px 0 18px 20px}
  .pw3-sign{margin-top:32px; display:flex; justify-content:space-between; align-items:flex-start}
  .pw3-sign .left, .pw3-sign .right{width:48%; text-align:center}
  .pw3-sign .name{display:block; font-weight:700; font-size:13px}
  .pw3-sign .title{display:block; font-size:11px; margin-top:6px}
  .pw3-address{white-space:pre-wrap; margin-bottom:8px}
  </style>

  <div class="header-row">
    <div></div>
    <div class="header-right">
      <div>{{branchDetails}}</div>
    </div>
  </div>

  <div class="pw3-title" style="text-align:center">Letter of Commitment for Bank’s Undertaking for Line of Credit (Form PW2b-3)</div>
  <div class="pw3-sub">[This is the format for the Credit Line to be issued by any scheduled Bank of Bangladesh in accordance with ITTClause 23.1(c)]</div>

  <div class="pw3-body">
    <div><strong>Invitation for Tender No:</strong> APP ID : 204431</div>
    <div><strong>Tender ID:</strong> 1128414</div>
    <div><strong>Tender Package No:</strong> GSID-2/PAB/SDW-388</div>
    <div><strong>Lot No (when applicable):</strong> </div>
  <p><strong>To</strong><br>{{recipient}}</p>
    <h3 style="text-align:center">CREDIT COMMITMENT No: 427/2025 &nbsp;&nbsp; Date: 25.10.2025</h3>
  <p>We have been informed that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> (hereinafter called "the Tenderer") intends to submit to you its Tender (hereinafter called "the Tender") for the execution of the Works of "{{description}}", under the above Invitation for Tenders (hereinafter called "the IFT").</p>

    <p>Furthermore, we understand that, according to your conditions, the Tenderer’s Financial Capacity i.e., Liquid Asset must be substantiated by a Letter of Commitment of Bank’s Undertaking for Line of Credit.</p>

  <p>At the request of, and arrangement with, the Tenderer, we United Commercial Bank PLC do hereby agree and undertake that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> will be provided by us with a revolving line of credit, in case awarded the Contract, for execution of the Works viz. "{{description}}", for an amount not less than <strong>{{amount}} {{amountWordsBriket}}</strong> for the sole purpose of the execution of the above Contract. This Revolving Line of Credit will be maintained by us until issuance of “Taking-Over Certificate” by the Procuring Entity.</p>

    <p>In witness whereof, authorised representative of the Bank has hereunto signed and sealed this Letter of Commitment.</p>

    <div class="pw3-sign">
      <div class="left"><span class="name">{{leftSignName}}</span><span class="title">{{leftSignTitle}}</span></div>
      <div class="right"><span class="name">{{rightSignName}}</span><span class="title">{{rightSignTitle}}</span></div>
    </div>
  </div>
</div>
` },
  { id: 'epw2a-3', name: 'Form e-PW2A-3', html: true, templateHtml: `
<div class="pw3-container">
  <style>
    .pw3-container{font-family: 'Times New Roman', Times, serif; color:#000; max-width:800px; margin:0 auto; padding:24px}
  .header-row{display:flex; justify-content:space-between; align-items:flex-start}
  .header-right{font-size:11px; text-align:right}
  .pw3-title{font-weight:700; font-size:14px}
  .pw3-sub{font-size:10px; text-align:center; margin-bottom:12px}
  .pw3-body{margin-top:10px; font-size:12px; line-height:1.45; text-align:justify}
  .pw3-sign{margin-top:32px; display:flex; justify-content:space-between; align-items:flex-start}
  .pw3-sign .left, .pw3-sign .right{width:48%; text-align:center}
  .pw3-sign .name{display:block; font-weight:700; font-size:13px}
  .pw3-sign .title{display:block; font-size:11px; margin-top:6px}
  </style>

  <div class="header-row">
    <div></div>
    <div class="header-right">
      <div>{{branchDetails}}</div>
    </div>
  </div>

  <div class="pw3-title" style="text-align:center">Letter of Commitment for Bank’s Undertaking for Line of Credit (Form e-PW2A-3)</div>
  <div class="pw3-sub">[This is the format for the Credit Line to be issued by any scheduled Bank of Bangladesh in accordance with ITT Clause 10.1(b)]</div>

  <div class="pw3-body">
    <div><strong>Invitation for Tender No:</strong> APP ID : 204431</div>
    <div><strong>Tender ID:</strong> 1128414</div>
    <div><strong>Tender Package No:</strong> GSID-2/PAB/SDW-388</div>
    <div><strong>Lot No (when applicable):</strong></div>
  <p><strong>To</strong><br>{{recipient}}</p>
    <h3 style="text-align:center">CREDIT COMMITMENT No: 427/2025 &nbsp;&nbsp; Date: 25.10.2025</h3>
    <p>We have been informed that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> (hereinafter called "the Tenderer") intends to submit to you its Tender (hereinafter called "the Tender") for the execution of the Works of "Improvement of Laxmikunda Baitul Amann Jam-E-Mosque at Laxmikunda Tatul Tola road under Laxmikunda Union [Latitude:24.03168 Longitude:89.06824] Upazila:Ishwardi, District: Pabna", under the above Invitation for Tenders (hereinafter called "the IFT").</p>
    <p>Furthermore, we understand that, according to your conditions, the Tenderer’s Financial Capacity i.e., Liquid Asset must be substantiated by a Letter of Commitment of Bank’s Undertaking for Line of Credit.</p>
  <p>At the request of, and arrangement with, the Tenderer, we United Commercial Bank PLC do hereby agree and undertake that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> will be provided by us with a revolving line of credit, in case awarded the Contract, for execution of the Works, for an amount not less than <strong>{{amount}} {{amountWordsBriket}}</strong> for the sole purpose of the execution of the above Contract. This Revolving Line of Credit will be maintained by us until issuance of "Taking-Over Certificate" by the Procuring Entity.</p>
    <p>In witness whereof, authorised representative of the Bank has hereunto signed and sealed this Letter of Commitment.</p>
    <div class="pw3-sign">
      <div class="left"><span class="name">{{leftSignName}}</span><span class="title">{{leftSignTitle}}</span></div>
      <div class="right"><span class="name">{{rightSignName}}</span><span class="title">{{rightSignTitle}}</span></div>
    </div>
  </div>
</div>
` },
  { id: 'pg3-11', name: 'Form PG3-11', html: true, templateHtml: `
<div class="pw3-container">
  <style>
    .pw3-container{font-family: 'Times New Roman', Times, serif; color:#000; max-width:800px; margin:0 auto; padding:24px}
    .header-row{display:flex; justify-content:space-between; align-items:flex-start}
  .header-right{font-size:12px; text-align:right}
  .pw3-title{font-weight:700; font-size:15px}
  .pw3-sub{font-size:11px; text-align:center; margin-bottom:12px}
  .pw3-body{margin-top:10px; font-size:13px; line-height:1.45; text-align:justify}
  .pw3-sign{margin-top:32px; display:flex; justify-content:space-between; align-items:flex-start}
  .pw3-sign .left, .pw3-sign .right{width:48%; text-align:center}
  .pw3-sign .name{display:block; font-weight:700; font-size:14px}
  .pw3-sign .title{display:block; font-size:12px; margin-top:6px}
  </style>

    <div class="header-row">
    <div></div>
    <div class="header-right">
      <div>{{branchDetails}}</div>
    </div>
  </div>

  <div class="pw3-title" style="text-align:center">Letter of Commitment for Bank’s Undertaking for Line of Credit (Form PG3-11)</div>
  <div class="pw3-sub">[This is the format for the Credit Line to be issued by any scheduled Bank of Bangladesh in accordance with ITT Clause28.1(d)]</div>

  <div class="pw3-body">
    <div><strong>Invitation for Tender No:</strong> APP ID : 204431</div>
    <div><strong>Tender ID:</strong> 1128414</div>
    <div><strong>Tender Package No:</strong> GSID-2/PAB/SDW-388</div>
    <div><strong>Lot No (when applicable):</strong></div>
  <p><strong>To</strong><br>{{recipient}}</p>
    <h3 style="text-align:center">CREDIT COMMITMENT No: 427/2025 &nbsp;&nbsp; Date: 25.10.2025</h3>
    <p>We have been informed that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> (hereinafter called "the Tenderer") intends to submit to you its Tender (hereinafter called "the Tender") for the supply of Goods of "Improvement of Laxmikunda Baitul Amann Jam-E-Mosque at Laxmikunda Tatul Tola road under Laxmikunda Union [Latitude:24.03168 Longitude:89.06824] Upazila:Ishwardi, District: Pabna", under the above Invitation for Tenders (hereinafter called "the IFT").</p>
    <p>Furthermore, we understand that, according to your conditions, the Tenderer’s Financial Capacity i.e., Liquid Asset must be substantiated by a Letter of Commitment of Bank’s Undertaking for Line of Credit.</p>
  <p>At the request of, and arrangement with, the Tenderer, we United Commercial Bank PLC do hereby agree and undertake that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> will be provided by us with a revolving line of credit, in case awarded the Contract, for the delivery of Goods and related services for an amount not less than <strong>{{amount}} {{amountWordsBriket}}</strong> for the sole purpose of the supply of Goods and related services under the above Contract. This Revolving Line of Credit will be maintained by us until issuance of "Acceptance Certificate" by the Procuring Entity.</p>
    <p>In witness whereof, authorised representative of the Bank has hereunto signed and sealed this Letter of Commitment.</p>
    <div class="pw3-sign">
      <div class="left"><span class="name">{{leftSignName}}</span><span class="title">{{leftSignTitle}}</span></div>
      <div class="right"><span class="name">{{rightSignName}}</span><span class="title">{{rightSignTitle}}</span></div>
    </div>
  </div>
</div>
` },
  { id: 'pw2a-3', name: 'Form PW2a-3', html: true, templateHtml: `
<div class="pw3-container">
  <style>
    .pw3-container{font-family: 'Times New Roman', Times, serif; color:#000; max-width:800px; margin:0 auto; padding:24px}
    .header-row{display:flex; justify-content:space-between; align-items:flex-start}
  .header-right{font-size:12px; text-align:right}
  .pw3-title{font-weight:700; font-size:15px}
  .pw3-sub{font-size:11px; text-align:center; margin-bottom:12px}
  .pw3-body{margin-top:10px; font-size:13px; line-height:1.45; text-align:justify}
  .pw3-sign{margin-top:32px; display:flex; justify-content:space-between; align-items:flex-start}
  .pw3-sign .left, .pw3-sign .right{width:48%; text-align:center}
  .pw3-sign .name{display:block; font-weight:700; font-size:14px}
  .pw3-sign .title{display:block; font-size:12px; margin-top:6px}
  </style>

  <div class="header-row">
    <div></div>
    <div class="header-right">
      <div>{{branchDetails}}</div>
    </div>
  </div>

  <div class="pw3-title" style="text-align:center">Letter of Commitment for Bank’s Undertaking for Line of Credit (Form PW2a-3)</div>
  <div class="pw3-sub">[This is the format for the Credit Line to be issued by any scheduled Bank of Bangladesh in accordance with ITT Clause23.1 (f)]</div>

  <div class="pw3-body">
    <div><strong>Invitation for Tender No:</strong> APP ID : 204431</div>
    <div><strong>Tender ID:</strong> 1128414</div>
    <div><strong>Tender Package No:</strong> GSID-2/PAB/SDW-388</div>
    <div><strong>Lot No (when applicable):</strong></div>
  <p><strong>To</strong><br>{{recipient}}</p>
    <h3 style="text-align:center">CREDIT COMMITMENT No: 427/2025 &nbsp;&nbsp; Date: 25.10.2025</h3>
    <p>We have been informed that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> (hereinafter called "the Tenderer") intends to submit to you its Tender (hereinafter called "the Tender") for the execution of the Works of "Improvement of Laxmikunda Baitul Amann Jam-E-Mosque at Laxmikunda Tatul Tola road under Laxmikunda Union [Latitude:24.03168 Longitude:89.06824] Upazila:Ishwardi, District: Pabna", under the above Invitation for Tenders (hereinafter called "the IFT").</p>
    <p>Furthermore, we understand that, according to your conditions, the Tenderer’s Financial Capacity i.e., Liquid Asset must be substantiated by a Letter of Commitment of Bank’s Undertaking for Line of Credit.</p>
  <p>At the request of, and arrangement with, the Tenderer, we United Commercial Bank PLC do hereby agree and undertake that <strong>{{customerName}}</strong>, Proprietor: <strong>{{proprietorName}}</strong>, Address: <strong>{{address}}</strong> will be provided by us with a revolving line of credit, in case awarded the Contract, for execution of the Works, for an amount not less than <strong>{{amount}} {{amountWordsBriket}}</strong> for the sole purpose of the execution of the above Contract. This Revolving Line of Credit will be maintained by us until issuance of "Taking-Over Certificate" by the Procuring Entity.</p>
    <p>In witness whereof, authorised representative of the Bank has hereunto signed and sealed this Letter of Commitment.</p>
    <div class="pw3-sign">
      <div class="left"><span class="name">{{leftSignName}}</span><span class="title">{{leftSignTitle}}</span></div>
      <div class="right"><span class="name">{{rightSignName}}</span><span class="title">{{rightSignTitle}}</span></div>
    </div>
  </div>
</div>
` },
  ];

  // Default customers (used when localStorage has no saved customers)
  const DEFAULT_CUSTOMERS = [
    { org: 'M/S Khan Traders', proprietor: 'Md Awlad Hossain', address: 'Sayedpur, Aminpur, Sujanagar, Pabna', email: '' }
  ];

  // Normalize any hard-coded demo values in templates into placeholders
  // This fixes templates that were using literal demo text so they update from editor fields
  function normalizeTemplates(templates){
    if (!Array.isArray(templates)) return;
  const fixes = [
      { from: '<strong>M/S Khan Traders</strong>', to: '<strong>{{customerName}}</strong>' },
      { from: '<strong>Md Awlad Hossain</strong>', to: '<strong>{{proprietorName}}</strong>' },
      { from: '<strong>Sayedpur, Aminpur, Sujanagar, Pabna</strong>', to: '<strong>{{address}}</strong>' },
      // common hard-coded tender/template values -> placeholders
      { from: 'APP ID : 204431', to: '{{ift}}' },
      { from: 'APP ID: 204431', to: '{{ift}}' },
      { from: 'APP ID - 204431', to: '{{ift}}' },
      { from: '1128414', to: '{{tenderId}}' },
      { from: 'GSID-2/PAB/SDW-388', to: '{{packageNo}}' },
  // package description / work text replacements -> use {{description}}
  { from: 'Improvement of Laxmikunda Baitul Amann Jam-E-Mosque at Laxmikunda Tatul Tola road under Laxmikunda Union [Latitude:24.03168 Longitude:89.06824] Upazila: Ishwardi, District: Pabna', to: '{{description}}' },
  { from: 'Improvement of Laxmikunda Baitul Amann Jam-E-Mosque', to: '{{description}}' },
  { from: 'Package Description : Work (Improvement of Laxmikunda Baitul Amann Jam-E-Mosque at Laxmikunda Tatul Tola road under Laxmikunda Union [Latitude:24.03168 Longitude:89.06824] Upazila: Ishwardi, District: Pabna).', to: 'Package Description : Work ({{description}}).' },
  { from: 'Package Description : Work (Improvement of Laxmikunda Baitul Amann Jam-E-Mosque).', to: 'Package Description : Work ({{description}}).' },
      { from: 'BDT. 2.00 Lac', to: '{{amount}}' },
      { from: 'BDT 2.00 Lac', to: '{{amount}}' },
  { from: 'BDT. 2.00 Lac ( Two Lakh Taka Only )', to: '{{amount}} {{amountWordsBriket}}' },
  { from: 'BDT. 2.00 Lac (Two Lakh Taka Only)', to: '{{amount}} {{amountWordsBriket}}' },
  { from: 'BDT. 2.00 Lac ( Two Lakh Only )', to: '{{amount}} {{amountWordsBriket}}' },
  { from: '(Two Lakh Taka Only)', to: '{{amountWordsBriket}}' },
  { from: '( Two Lakh Taka Only )', to: '{{amountWordsBriket}}' },
  { from: 'Two Lakh Taka Only', to: '{{amountWords}}' },
      { from: 'Taka 2.00 Lakh', to: '{{amount}}' },
      // credit commitment ref number/year -> placeholders
      { from: 'CREDIT COMMITMENT No: 427/2025', to: 'CREDIT COMMITMENT No: {{refNumber}}/{{year}}' },
      { from: 'CREDIT COMMITMENT No:427/2025', to: 'CREDIT COMMITMENT No: {{refNumber}}/{{year}}' },
  // keep the original 'Invitation for Tender No' label intact; do NOT inject an extra {{ift}}
  // { from: 'Invitation for Tender No', to: 'Invitation for Tender No: {{ift}}' }
    ];
    // also replace hard-coded date shown in templates with {{date}}
    fixes.push({ from: 'Date: 25.10.2025', to: 'Date: {{date}}' });
    fixes.push({ from: 'Date : 25.10.2025', to: 'Date: {{date}}' });
    function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    templates.forEach(t => {
      if (t && (t.html || t.templateHtml) && t.templateHtml) {
        fixes.forEach(f => {
          try{
            const pattern = new RegExp(escapeRegExp(f.from), 'gi');
            t.templateHtml = t.templateHtml.replace(pattern, f.to);
          }catch(e){
            // fallback to simple split/join
            if (t.templateHtml.indexOf(f.from) !== -1) {
              t.templateHtml = t.templateHtml.split(f.from).join(f.to);
            }
          }
        });
        // collapse accidental duplicate placeholders created by overlapping fixes
        try{
          // collect placeholder tokens from fixes (those that contain {{...}})
          const placeholders = Array.from(new Set(fixes.map(f=>f.to).filter(x=>typeof x==='string' && x.indexOf('{{')!==-1)));
          placeholders.forEach(ph => {
            const esc = escapeRegExp(ph);
            // match sequences like '{{ift}} : {{ift}}' or '{{ift}}{{ift}}' and reduce to single '{{ift}}'
            const dupRe = new RegExp('(' + esc + ')(?:[\\s:\\-\/,]*)+(?:' + esc + ')+','gi');
            t.templateHtml = t.templateHtml.replace(dupRe, ph);
          });
        }catch(e){ /* ignore dedupe errors */ }
      }
    });
  }
  // normalize built-in default templates
  normalizeTemplates(DEFAULT_TEMPLATES);

  const el = id => document.getElementById(id);

  const state = {
    templates: DEFAULT_TEMPLATES,
    currentType: DEFAULT_TEMPLATES[0].id
  };

  // Try to load templates.json only when served over http(s).
  // When opened via file:// many browsers block fetch; the app has built-in fallback templates
  function tryLoadTemplates() {
    try {
      if (!location || typeof location.protocol !== 'string' || !location.protocol.startsWith('http')) {
        // running via file:// — skip fetching templates.json to avoid CORS/file access issues
        return Promise.resolve();
      }
    } catch (e) {
      return Promise.resolve();
    }

    return fetch('templates.json').then(r => {
      if (!r.ok) throw new Error('no templates.json');
      return r.json();
    }).then(json => {
      if (Array.isArray(json) && json.length >= 1) {
        // normalize any hard-coded demo values in fetched templates as well
        try{
          normalizeTemplates(json);
        }catch(e){ /* ignore normalization errors */ }
        state.templates = json;
      }
    }).catch(_ => {
      // fallback to defaults
    });
  }

  function populateTemplateSelect() {
    const sel = el('templateSelect');
    sel.innerHTML = '';
    state.templates.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name || t.id;
      sel.appendChild(opt);
    });
    sel.value = state.currentType;
  }

  function getTemplateById(id){
    return state.templates.find(t=>t.id===id) || state.templates[0];
  }

  function escapeHtml(str){
    return String(str)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  // Convert integers (0..99999999) into words using Indian numbering (crore, lakh, thousand)
  function numberToWordsIndian(num){
    num = parseInt(num,10);
    if (isNaN(num) || num === 0) return 'Zero';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function twoDigit(n){
      if (n < 20) return ones[n];
      const t = Math.floor(n/10);
      const o = n % 10;
      return tens[t] + (o ? ' ' + ones[o] : '');
    }
    function threeDigit(n){
      const h = Math.floor(n/100);
      const rem = n % 100;
      return (h ? ones[h] + ' Hundred' + (rem ? ' ' : '') : '') + (rem ? twoDigit(rem) : '');
    }
    let out = '';
    const crore = Math.floor(num / 10000000);
    if (crore) { out += numberToWordsIndian(crore) + ' Crore'; num = num % 10000000; if (num) out += ' '; }
    const lakh = Math.floor(num / 100000);
    if (lakh) { out += (lakh < 100 ? twoDigit(lakh) : threeDigit(lakh)) + ' Lakh'; num = num % 100000; if (num) out += ' '; }
    const thousand = Math.floor(num / 1000);
    if (thousand) { out += (thousand < 100 ? twoDigit(thousand) : threeDigit(thousand)) + ' Thousand'; num = num % 1000; if (num) out += ' '; }
    if (num) { out += threeDigit(num); }
    return out.trim();
  }

  // Convert amount given in lakhs (e.g., '2.00' means 2.00 lac) into words like 'Two Lakh Taka Only'
  function takaAmountToWords(amountLac){
    if (amountLac === null || amountLac === undefined) return '';
    const val = parseFloat(String(amountLac).replace(/,/g,''));
    if (isNaN(val)) return '';
    const taka = Math.round(val * 100000); // 1 lac = 100,000 taka
    if (taka === 0) return 'Zero Taka Only';
    const words = numberToWordsIndian(taka);
    return words + ' Taka Only';
  }

  // Same as takaAmountToWords but wrapped in parentheses/brackets for templates that expect them
  function takaAmountToWordsBriket(amountLac){
    const w = takaAmountToWords(amountLac);
    if (!w) return '';
    return '(' + w + ')';
  }

  function renderPreview(){
    const tmplObj = getTemplateById(state.currentType);
    const data = {
      customerName: el('customerName').value || '—',
      address: el('address').value || '—',
      proprietorName: el('proprietorName').value || '—',
      recipient: (el('recipient') ? el('recipient').value : 'The Executive Engineer,\nLGED, Pabna'),
      // amount/purpose/date removed from editor; provide sensible defaults
      amount: '',
      amountWords: '',
      amountWordsBriket: '',
      purpose: '',
      date: new Date().toLocaleDateString(),
      branchDetails: (el('branchDetails') ? el('branchDetails').value : ''),
      leftSignName: (el('leftSignName') ? el('leftSignName').value : ''),
      leftSignTitle: (el('leftSignTitle') ? el('leftSignTitle').value : ''),
      rightSignName: (el('rightSignName') ? el('rightSignName').value : ''),
      rightSignTitle: (el('rightSignTitle') ? el('rightSignTitle').value : '')
      ,
      refNumber: '',
      year: new Date().getFullYear()
    };
    // preview: compute refNumber from editor input or saved payload; default to start value (no increment)
    try{
      const rawStart = getSavedEditorField('refStart') || '';
      let startNum = parseInt(String(rawStart||'').trim(), 10);
      if (isNaN(startNum)) startNum = '';
      data.refNumber = startNum ? String(startNum) : '';
    }catch(e){ data.refNumber = ''; }
    const preview = el('previewArea');
    if (tmplObj && tmplObj.html && tmplObj.templateHtml) {
      let out = tmplObj.templateHtml;
  const specialKeys = ['branchDetails','leftSignName','leftSignTitle','rightSignName','rightSignTitle','recipient'];
      // replace normal keys with escaped values
      Object.keys(data).forEach(k=>{
        if (specialKeys.indexOf(k) !== -1) return;
        const re = new RegExp('{{\\s*'+k+'\\s*}}','g');
        out = out.replace(re, escapeHtml(data[k]));
      });
      // replace special keys with HTML-friendly values (branchDetails may contain newlines)
      specialKeys.forEach(k=>{
        const val = data[k] || '';
        // if replacing signatory NAME placeholders, show signature image above the name
        if (k === 'leftSignName'){
          const leftSig = (el('leftSignSig') || {}).value || '';
          const leftHtml = leftSig ? ('<div style="margin-top:6px"><img src="'+leftSig+'" style="max-width:140px; max-height:80px"/></div>') : '';
          const safeName = escapeHtml(val).replace(/\n/g, '<br/>');
          const re = new RegExp('{{\\s*'+k+'\\s*}}','g');
          out = out.replace(re, leftHtml + safeName);
          return;
        }
        if (k === 'rightSignName'){
          const rightSig = (el('rightSignSig') || {}).value || '';
          const rightHtml = rightSig ? ('<div style="margin-top:6px"><img src="'+rightSig+'" style="max-width:140px; max-height:80px"/></div>') : '';
          const safeName = escapeHtml(val).replace(/\n/g, '<br/>');
          const re = new RegExp('{{\\s*'+k+'\\s*}}','g');
          out = out.replace(re, rightHtml + safeName);
          return;
        }
        const safe = escapeHtml(val).replace(/\n/g, '<br/>');
        const re = new RegExp('{{\\s*'+k+'\\s*}}','g');
        out = out.replace(re, safe);
      });
  // signatures: also make raw signature placeholders available if templates use them explicitly
      try{
        const leftSig = (el('leftSignSig') || {}).value || '';
        const rightSig = (el('rightSignSig') || {}).value || '';
        const leftHtml = leftSig ? ('<div style="margin-top:6px"><img src="'+leftSig+'" style="max-width:140px; max-height:80px"/></div>') : '';
        const rightHtml = rightSig ? ('<div style="margin-top:6px"><img src="'+rightSig+'" style="max-width:140px; max-height:80px"/></div>') : '';
        out = out.replace(/{{\s*leftSignSignature\s*}}/g, leftHtml);
        out = out.replace(/{{\s*rightSignSignature\s*}}/g, rightHtml);
      }catch(e){ /* ignore */ }
      // inject header logo into the left side of header-row if available
      try{
        const logoData = getSavedEditorField('headerLogoData') || '';
        if (logoData) {
          out = out.replace(/(<div\s+class=["']header-row["'][^>]*>\s*)<div>\s*<\/div>/i, '$1<div><img src="' + logoData + '" style="max-width:160px; max-height:80px"/></div>');
        }
      }catch(e){}
      // remove any existing footer blocks inside the template to avoid duplicates
      try{ out = removeTemplateFooter(out); }catch(e){}
      // inject footer text into the preview as a normal block so it is always visible
      try{
        const footerVal = getSavedEditorField('footerText') || '';
        if (footerVal) {
          const footerHtml = escapeHtml(footerVal).replace(/\n/g, '<br/>');
          // wrap content and append footer as a normal block (not absolute) so preview shows it
          out = '<div style="position:relative; padding-bottom:12px;">' + out + '</div>' + '<div style="margin-top:8px; font-size:12px; white-space:pre-wrap; color:#333">' + footerHtml + '</div>';
        }
      }catch(e){}
      preview.innerHTML = out;
    } else {
      const template = (tmplObj && tmplObj.template) ? tmplObj.template : '';
      let out = template;
      Object.keys(data).forEach(k=>{
        const re = new RegExp('{{\\s*'+k+'\\s*}}','g');
        out = out.replace(re, data[k]);
      });
      preview.textContent = out;
    }
  }

  function saveCurrent(){
    const key = 'cc_editor:' + state.currentType;
    const payload = {
      customerName: el('customerName').value,
      address: el('address').value,
      proprietorName: el('proprietorName').value,
      // new editor-level fields
  recipient: (el('recipient') ? el('recipient').value : ''),
      branchDetails: (el('branchDetails') ? el('branchDetails').value : ''),
      leftSignName: (el('leftSignName') ? el('leftSignName').value : ''),
      leftSignTitle: (el('leftSignTitle') ? el('leftSignTitle').value : ''),
      rightSignName: (el('rightSignName') ? el('rightSignName').value : ''),
  rightSignTitle: (el('rightSignTitle') ? el('rightSignTitle').value : ''),
  // header logo data (data URL)
      headerLogoData: (el('headerLogoData') ? el('headerLogoData').value : ''),
  // footer text
  footerText: (el('footerText') ? el('footerText').value : ''),
    // reference start number
    refStart: (el('refStart') ? el('refStart').value : ''),
      // signature images (data URLs) - optional
      leftSignSig: (el('leftSignSig') ? el('leftSignSig').value : ''),
      rightSignSig: (el('rightSignSig') ? el('rightSignSig').value : ''),
      // date intentionally not stored - always use current date
      updated: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(payload));
    alert('Saved locally for ' + state.currentType);
  }

  // Merge arbitrary updates into the saved payload for the current template
  // This helper is used when UI elements (like footer textarea) may not exist
  // so we can still persist headerLogoData/footerText into localStorage.
  function updateEditorPayload(updates){
    try{
      const key = 'cc_editor:' + state.currentType;
      let p = {};
      const raw = localStorage.getItem(key);
      if (raw) {
        try{ p = JSON.parse(raw); }catch(e){ p = {}; }
      }
      p = Object.assign({}, p, updates, { updated: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(p));
    }catch(e){ /* ignore storage errors */ }
  }

  // Read a saved editor field value; prefer DOM element value if present,
  // otherwise read from the per-template saved payload in localStorage.
  function getSavedEditorField(field){
    try{
      if (el(field)) return (el(field).value || '');
      const key = 'cc_editor:' + state.currentType;
      const raw = localStorage.getItem(key);
      if (!raw) return '';
      try{ const p = JSON.parse(raw); return (p && p[field]) ? p[field] : ''; }catch(e){ return ''; }
    }catch(e){ return ''; }
  }

  function loadCurrent(){
    const key = 'cc_editor:' + state.currentType;
    const raw = localStorage.getItem(key);
    if (!raw) { alert('No saved data for this template'); return; }
    try{
      const p = JSON.parse(raw);
  el('customerName').value = p.customerName || '';
      el('address').value = p.address || '';
      el('proprietorName').value = p.proprietorName || '';
  if (el('recipient')) el('recipient').value = p.recipient || '';
      if (el('branchDetails')) el('branchDetails').value = p.branchDetails || '';
  if (el('headerLogoData')) el('headerLogoData').value = p.headerLogoData || '';
  if (el('footerText')) el('footerText').value = p.footerText || '';
  if (el('refStart')) el('refStart').value = p.refStart || '';
  if (el('footerText')) el('footerText').value = p.footerText || '';
    if (el('refStart')) el('refStart').value = p.refStart || '';
      if (el('leftSignName')) el('leftSignName').value = p.leftSignName || '';
      if (el('leftSignTitle')) el('leftSignTitle').value = p.leftSignTitle || '';
      if (el('rightSignName')) el('rightSignName').value = p.rightSignName || '';
      if (el('rightSignTitle')) el('rightSignTitle').value = p.rightSignTitle || '';
      if (el('leftSignSig')) el('leftSignSig').value = p.leftSignSig || '';
      if (el('rightSignSig')) el('rightSignSig').value = p.rightSignSig || '';
      renderPreview();
    }catch(e){ alert('Unable to read saved data'); }
  }

  // silent loader used at init to populate fields from storage without alerts
  function loadCurrentSilent(){
    const key = 'cc_editor:' + state.currentType;
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    try{
      const p = JSON.parse(raw);
  if (el('customerName')) el('customerName').value = p.customerName || '';
      if (el('address')) el('address').value = p.address || '';
      if (el('proprietorName')) el('proprietorName').value = p.proprietorName || '';
  if (el('recipient')) el('recipient').value = p.recipient || '';
      if (el('branchDetails')) el('branchDetails').value = p.branchDetails || '';
    if (el('headerLogoData')) el('headerLogoData').value = p.headerLogoData || '';
    if (el('footerText')) el('footerText').value = p.footerText || '';
      if (el('leftSignName')) el('leftSignName').value = p.leftSignName || '';
      if (el('leftSignTitle')) el('leftSignTitle').value = p.leftSignTitle || '';
      if (el('rightSignName')) el('rightSignName').value = p.rightSignName || '';
      if (el('rightSignTitle')) el('rightSignTitle').value = p.rightSignTitle || '';
      if (el('leftSignSig')) el('leftSignSig').value = p.leftSignSig || '';
      if (el('rightSignSig')) el('rightSignSig').value = p.rightSignSig || '';
      return true;
    }catch(e){ return false; }
  }

  function resetForm(){
    el('customerName').value = '';
    el('address').value = '';
    el('proprietorName').value = '';
    if (el('branchDetails')) el('branchDetails').value = '';
    if (el('leftSignName')) el('leftSignName').value = '';
    if (el('leftSignTitle')) el('leftSignTitle').value = '';
    if (el('rightSignName')) el('rightSignName').value = '';
    if (el('rightSignTitle')) el('rightSignTitle').value = '';
    if (el('leftSignSig')) el('leftSignSig').value = '';
    if (el('rightSignSig')) el('rightSignSig').value = '';
    renderPreview();
  }

  function printPreview(){
    const tmplObj = getTemplateById(state.currentType);
    const w = window.open('', '_blank');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Print - '+state.currentType+'</title>');
    w.document.write('<style>body{font-family:Segoe UI, Roboto, Arial, sans-serif; padding:20px}</style>');
    w.document.write('</head><body>');
    w.document.write('<h2>' + (tmplObj.name || state.currentType) + '</h2>');
    if (tmplObj && tmplObj.html) {
      // use the preview innerHTML which already contains replaced, escaped values
      w.document.write(el('previewArea').innerHTML);
    } else {
      const previewHtml = '<pre style="white-space:pre-wrap; font-family:inherit;">'+ el('previewArea').textContent + '</pre>';
      w.document.write(previewHtml);
    }
    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    // give it a moment to render then call print
    setTimeout(()=>{ w.print(); }, 300);
  }

  function downloadHTML(){
    const tmplObj = getTemplateById(state.currentType);
    let html;
    if (tmplObj && tmplObj.html) {
      html = '<!doctype html><html><head><meta charset="utf-8"><title>Filled - '+state.currentType+'</title></head><body>' + el('previewArea').innerHTML + '</body></html>';
    } else {
      html = '<!doctype html><html><head><meta charset="utf-8"><title>Filled - '+state.currentType+'</title></head><body><pre style="white-space:pre-wrap">'+ el('previewArea').textContent + '</pre></body></html>';
    }
    const blob = new Blob([html], {type:'text/html'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.currentType + '-filled.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Convert small HTML snippet into readable plain text for email bodies
  function htmlToPlain(html){
    if (!html) return '';
    // replace <br> with newlines
    let s = html.replace(/<br\s*\/?/gi, '\n');
    // block-level tags to newlines
    s = s.replace(/<(\/)?(div|p|li|tr|h[1-6]|td|th)[^>]*>/gi, '\n');
    // remove remaining tags
    s = s.replace(/<[^>]+>/g, '');
    // decode HTML entities
    try{
      const ta = document.createElement('textarea');
      ta.innerHTML = s;
      return ta.value;
    }catch(e){ return s; }
  }

  // Collapse duplicated IFT / APP ID sequences that may be introduced by overlapping
  // normalization rules (e.g. 'Invitation for Tender No: {{ift}}: {{ift}}' -> '...: {{ift}}').
  // Also collapse literal repeated APP ID values like 'APP ID : 204431: APP ID : 204431'.
  function collapseDuplicateIft(html){
    if (!html) return html;
    try{
      // 1) collapse duplicated placeholder tokens like '{{ift}} : {{ift}}' -> '{{ift}}'
      html = html.replace(/({{\s*ift\s*}})(?:[\s:\-\/,]*)+(?:\1)+/gi, '$1');
      // 2) collapse duplicated literal APP ID occurrences like 'APP ID : 204431: APP ID : 204431' -> 'APP ID : 204431'
      html = html.replace(/(APP\s*ID\s*[:\-]\s*\d+)(?:[\s:\-\/,]*)+(?:\1)+/gi, '$1');
      // 3) as a fallback, collapse obvious duplicated sequences where the same phrase repeats twice separated by punctuation
      html = html.replace(/(Invitation for Tender No\s*[:\-]?.{0,80}?)(?:[\s:\-\/,]*)+\1/gi, '$1');
    }catch(e){ /* ignore any regex errors */ }
    return html;
  }

  // Remove existing footer-like blocks from a template HTML string so we don't
  // end up with duplicate footers when auto-adding our UCB footer.
  function removeTemplateFooter(html){
    if (!html) return html;
    try{
      // 1) remove elements with class or id containing 'footer'
      html = html.replace(/<div[^>]+(?:class|id)=["'][^"']*footer[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '');
      // 2) remove divs that contain the UCB footer literal (first 200 chars match)
      html = html.replace(/<div[^>]*>[\s\S]{0,500}?United Commercial Bank PLC[\s\S]*?<\/div>/gi, '');
      // 3) remove absolutely positioned bottom-left blocks (heuristic)
      html = html.replace(/<div[^>]*style=["'][^"']*(?:position\s*:\s*absolute)[^"']*(?:bottom\s*:\s*\d+px)[^"']*(?:left\s*:\s*\d+px)[^"']*[^>]*>[\s\S]*?<\/div>/gi, '');
    }catch(e){ /* ignore */ }
    return html;
  }

  // Remove the currently-set footer from the editor and preview, persist the change.
  function removeFooter(){
    try{
      if (el('footerText')) el('footerText').value = '';
      // also remove any footer nodes currently present in the preview
      try{
        const p = el('previewArea');
        if (p){
          // remove any element that contains the UCB footer text
          Array.from(p.querySelectorAll('div')).forEach(d=>{
            try{
              if (d.textContent && d.textContent.indexOf('United Commercial Bank PLC') !== -1) d.remove();
            }catch(e){}
          });
        }
      }catch(e){}
      try{ saveCurrent(); }catch(e){}
      try{ renderPreview(); }catch(e){}
    }catch(e){ /* ignore */ }
  }

  function sendMail(){
    // Option A workflow: generate the full commitments print (one page per commitment)
    // so the saved PDF contains filled values like {{ift}}, {{tenderId}}, {{packageNo}}, {{description}}.
    try{ renderPreview(); }catch(e){}
    const tmplObj = getTemplateById(state.currentType) || {};
    // Get organization name for subject
    const orgName = el('customerName') ? el('customerName').value : '';
    const subject = 'CREDIT COMMITTMENT OF ' + (orgName || 'organization');

    // Trigger the print for all commitments (this opens a new window and print dialog)
    try{ printCommitmentsUsingTemplate(); }catch(e){ try{ printPreview(); }catch(_){} }

    // Build a plain-text summary of commitments (including ift, tenderId, packageNo, description)
    const list = loadEditorList();
    let summary = '';
    if (Array.isArray(list) && list.length){
      list.forEach((r, idx)=>{
        const i = idx + 1;
        const tid = r.tenderId || '';
        const pkg = r.packageNo || '';
        const ift = r.ift || '';
        const desc = r.description || '';
        const amt = r.amountLac || '';
        summary += `Commitment ${i}:\n`;
        if (ift) summary += `IFT: ${ift}\n`;
        if (tid) summary += `Tender ID: ${tid}\n`;
        if (pkg) summary += `Package No: ${pkg}\n`;
        if (desc) summary += `Description: ${desc}\n`;
        if (amt) summary += `Amount (Lac): ${amt}\n`;
        summary += '\n';
      });
    } else {
      // Fallback: generate from current preview/template
      const previewEl = el('previewArea');
      const html = (previewEl && previewEl.innerHTML) ? previewEl.innerHTML : (tmplObj.templateHtml || '');
      summary = htmlToPlain(html).trim();
    }

    // Copy full summary to clipboard for convenience (if allowed)
    try{ if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(summary); }catch(e){ /* ignore */ }

    const shortBody = 'Dear Sir,\n\nPlease find the attachment.\n\n';

    // Open mail client after a small delay so print dialog has time to start
    setTimeout(()=>{
      // try to determine recipient email from selected organization or cust_email field
      let recipientEmail = '';
      try{
        const sel = el('orgSelect');
        if (sel && sel.value && sel.value !== '-1'){
          const customers = loadCustomers();
          const idx = parseInt(String(sel.value), 10);
          if (!isNaN(idx) && customers && customers[idx] && customers[idx].email) recipientEmail = (customers[idx].email || '').trim();
        }
      }catch(e){ /* ignore */ }
      // fallback: explicit cust_email input (if present in the UI)
      try{ if (!recipientEmail && el('cust_email') && el('cust_email').value) recipientEmail = (el('cust_email').value || '').trim(); }catch(e){}

      // build mailto: include recipient if available
      let mailto = '';
      if (recipientEmail) {
        // do not percent-encode the recipient email address itself (some mail clients expect raw address)
        mailto = 'mailto:' + recipientEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(shortBody);
      } else {
        mailto = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(shortBody);
      }

      window.location.href = mailto;
      try{ alert('Print dialog opened. After saving the PDF, attach it to the email that will open. Full summary copied to clipboard.'); }catch(e){}
    }, 800);
  }

  // --- Customer list management ---
  const CUSTOMERS_KEY = 'cc_customers';
  let customerEditIndex = -1;

  function loadCustomers(){
    try{
      const raw = localStorage.getItem(CUSTOMERS_KEY);
      // If there are no saved customers, return the DEFAULT_CUSTOMERS so the dropdown has entries
      if (!raw) return DEFAULT_CUSTOMERS.slice();
      return JSON.parse(raw);
    } catch(e){ return DEFAULT_CUSTOMERS.slice(); }
  }

  function saveCustomers(list){
    localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list || []));
  }

  function renderCustomers(){
    const body = el('customerTableBody');
    if (!body) return;
    const list = loadCustomers();
    body.innerHTML = '';
    list.forEach((c, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(c.org||'')}</td><td>${escapeHtml(c.proprietor||'')}</td><td>${escapeHtml(c.address||'')}</td><td>${escapeHtml(c.email||'')}</td><td style="text-align:right"><button data-idx="${idx}" class="cust-edit">Edit</button> <button data-idx="${idx}" class="cust-del">Delete</button></td>`;
      body.appendChild(tr);
    });
    // wire row buttons
    body.querySelectorAll('.cust-edit').forEach(b=>b.addEventListener('click', (e)=>{
      const i = Number(e.target.dataset.idx); editCustomer(i);
    }));
    body.querySelectorAll('.cust-del').forEach(b=>b.addEventListener('click', (e)=>{
      const i = Number(e.target.dataset.idx); if(confirm('Delete this customer?')) deleteCustomer(i);
    }));
    // refresh organization dropdown in editor
    try { populateOrgSelect(); } catch (e) { /* ignore if not present */ }
  }

  function clearCustomerForm(){
    el('cust_org').value = '';
    el('cust_prop').value = '';
    el('cust_addr').value = '';
    el('cust_email').value = '';
    customerEditIndex = -1;
    el('custAddBtn').textContent = 'Add / Save';
  }

  function addOrUpdateCustomer(){
    const org = el('cust_org').value.trim();
    const proprietor = el('cust_prop').value.trim();
    const address = el('cust_addr').value.trim();
    const email = el('cust_email').value.trim();
    if (!org){ alert('Organization name is required'); return; }
    const list = loadCustomers();
    const item = { org, proprietor, address, email };
    if (customerEditIndex >= 0 && customerEditIndex < list.length){
      list[customerEditIndex] = item;
    } else {
      list.push(item);
    }
    saveCustomers(list);
    renderCustomers();
    clearCustomerForm();
  }

  function editCustomer(i){
    const list = loadCustomers();
    const c = list[i];
    if (!c) return;
    el('cust_org').value = c.org || '';
    el('cust_prop').value = c.proprietor || '';
    el('cust_addr').value = c.address || '';
    el('cust_email').value = c.email || '';
    customerEditIndex = i;
    el('custAddBtn').textContent = 'Save';
  }

  function deleteCustomer(i){
    const list = loadCustomers();
    if (i < 0 || i >= list.length) return;
    list.splice(i,1);
    saveCustomers(list);
    renderCustomers();
  }

  function populateOrgSelect(){
    const sel = el('orgSelect');
    if (!sel) return;
    const list = loadCustomers();
    const current = sel.value;
    sel.innerHTML = '<option value="-1">— Select organization —</option>';
    list.forEach((c, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = (c.org || '') + (c.proprietor ? ' — ' + c.proprietor : '');
      sel.appendChild(opt);
    });
    // try to restore previous selection if still valid
    if (current && sel.querySelector('option[value="'+current+'"]')) sel.value = current;
  }

  // --- Editor right-side list (persisted) ---
  const EDITOR_LIST_KEY = 'cc_editor_list';
  let editorEditIndex = -1;

  const DEFAULT_EDITOR_LIST = [
    { tenderId: '1128414', amountLac: '2.00', packageNo: 'GSID-2/PAB/SDW-388', ift: 'APP ID : 204431', description: 'Improvement of Laxmikunda Baitul Amann Jam-E-Mosque' }
  ];

  function loadEditorList(){
    try{
      const raw = localStorage.getItem(EDITOR_LIST_KEY);
      if (!raw) return DEFAULT_EDITOR_LIST.slice();
      return JSON.parse(raw);
    }catch(e){ return DEFAULT_EDITOR_LIST.slice(); }
  }

  function saveEditorList(list){
    localStorage.setItem(EDITOR_LIST_KEY, JSON.stringify(list || []));
  }

  function clearEditorForm(){
    const ids = ['el_tenderId','el_packageNo','el_amount','el_ift','el_description'];
    ids.forEach(id=>{ const eln = document.getElementById(id); if(eln) eln.value = ''; });
    editorEditIndex = -1;
    const form = document.getElementById('editorListForm'); if(form) form.style.display = '';
  }

  function showEditorForm(editIdx){
    const form = document.getElementById('editorListForm'); if(!form) return;
    // keep form visible (always editable)
    if (typeof editIdx === 'number' && editIdx >= 0){
      const list = loadEditorList(); const r = list[editIdx];
      if (r){
        document.getElementById('el_tenderId').value = r.tenderId || '';
        document.getElementById('el_amount').value = r.amountLac || '';
        document.getElementById('el_packageNo').value = r.packageNo || '';
        document.getElementById('el_ift').value = r.ift || '';
        document.getElementById('el_description').value = r.description || '';
        editorEditIndex = editIdx;
      }
    } else {
      clearEditorForm();
    }
    form.style.display = '';
  }

  function addOrUpdateEditorRow(){
    const tenderId = (document.getElementById('el_tenderId') || {}).value || '';
    const amountLac = (document.getElementById('el_amount') || {}).value || '';
    const packageNo = (document.getElementById('el_packageNo') || {}).value || '';
    const ift = (document.getElementById('el_ift') || {}).value || '';
    const description = (document.getElementById('el_description') || {}).value || '';
    if (!tenderId){ alert('Tender ID is required'); return; }
    const list = loadEditorList();
    const item = { tenderId, amountLac, packageNo, ift, description };
    if (editorEditIndex >=0 && editorEditIndex < list.length){
      list[editorEditIndex] = item;
    } else {
      list.push(item);
    }
    saveEditorList(list);
    renderEditorList();
    clearEditorForm();
  }

  function editEditorRow(i){
    showEditorForm(i);
  }

  function deleteEditorRow(i){
    const list = loadEditorList(); if (i<0 || i>=list.length) return; if(!confirm('Delete this row?')) return;
    list.splice(i,1); saveEditorList(list); renderEditorList();
  }

  function useEditorRow(i){
    const list = loadEditorList(); const r = list[i]; if(!r) return;
    // populate editor fields
    const cName = (document.getElementById('customerName') || {});
    const addr = (document.getElementById('address') || {});
    const prop = (document.getElementById('proprietorName') || {});
    if (r.description) cName.value = r.description; // if you prefer a different mapping change here
    if (r.packageNo) addr.value = r.packageNo;
    if (r.tenderId) prop.value = r.tenderId;
    // also set amount/purpose/date if present
    renderPreview();
  }

  function renderEditorList(){
    const body = document.getElementById('editorListBody');
    if (!body) return;
    body.innerHTML = '';
    const list = loadEditorList();
    list.forEach((r, idx) => {
      const tr = document.createElement('tr');
      // Render row including Amount column
      tr.innerHTML = `<td style="width:48px">${idx+1}</td><td>${escapeHtml(r.tenderId||'')}</td><td>${escapeHtml(r.packageNo||'')}</td><td style="text-align:right">${escapeHtml(r.amountLac||'')}</td><td>${escapeHtml(r.ift||'')}</td><td>${escapeHtml(r.description||'')}</td><td style="text-align:right"><button data-idx="${idx}" class="elist-edit">Edit</button> <button data-idx="${idx}" class="elist-del">Delete</button></td>`;
      body.appendChild(tr);
    });
    // wire row buttons
  body.querySelectorAll('.elist-edit').forEach(b=>b.addEventListener('click', (e)=>{ editEditorRow(Number(e.target.dataset.idx)); }));
  body.querySelectorAll('.elist-del').forEach(b=>b.addEventListener('click', (e)=>{ deleteEditorRow(Number(e.target.dataset.idx)); }));
  }

  


  function wire(){
    el('templateSelect').addEventListener('change', e => {
      state.currentType = e.target.value;
      // try load existing data into fields (without alerts)
      const key = 'cc_editor:' + state.currentType;
      const raw = localStorage.getItem(key);
      if (raw) {
        try{
          const p = JSON.parse(raw);
          el('customerName').value = p.customerName || '';
          el('address').value = p.address || '';
          el('proprietorName').value = p.proprietorName || '';
          if (el('branchDetails')) el('branchDetails').value = p.branchDetails || '';
          if (el('leftSignName')) el('leftSignName').value = p.leftSignName || '';
          if (el('leftSignTitle')) el('leftSignTitle').value = p.leftSignTitle || '';
          if (el('rightSignName')) el('rightSignName').value = p.rightSignName || '';
          if (el('rightSignTitle')) el('rightSignTitle').value = p.rightSignTitle || '';
          if (el('leftSignSig')) el('leftSignSig').value = p.leftSignSig || '';
          if (el('rightSignSig')) el('rightSignSig').value = p.rightSignSig || '';
        }catch(_){
          el('customerName').value = '';
          el('address').value = '';
          el('proprietorName').value = '';
        }
      } else {
        el('customerName').value = '';
        el('address').value = '';
        el('proprietorName').value = '';
        if (el('branchDetails')) el('branchDetails').value = '';
        if (el('leftSignName')) el('leftSignName').value = '';
        if (el('leftSignTitle')) el('leftSignTitle').value = '';
        if (el('rightSignName')) el('rightSignName').value = '';
        if (el('rightSignTitle')) el('rightSignTitle').value = '';
      }
      renderPreview();
    });

    ['customerName','address','proprietorName','recipient','branchDetails','leftSignName','leftSignTitle','rightSignName','rightSignTitle','footerText'].forEach(id => {
      if (el(id)) el(id).addEventListener('input', ()=>{
        try{ renderPreview(); }catch(e){}
      });
    });

    // footer remove button
    if (el('footerRemoveBtn')) el('footerRemoveBtn').addEventListener('click', ()=>{ removeFooter(); });

  if (el('saveBtn')) el('saveBtn').addEventListener('click', saveCurrent);
  if (el('loadBtn')) el('loadBtn').addEventListener('click', loadCurrent);
  if (el('resetBtn')) el('resetBtn').addEventListener('click', () => { if(confirm('Clear fields?')) resetForm(); });
  if (el('branchEditBtn')) el('branchEditBtn').addEventListener('click', openBranchModal);
  if (el('signEditBtn')) el('signEditBtn').addEventListener('click', openSignModal);
    if (el('printBtn')) el('printBtn').addEventListener('click', async ()=>{
      // when Print / Export PDF clicked, print all commitments using the selected template (one page per commitment)
      try{ await printCommitmentsUsingTemplate(); }catch(e){ /* fallback */ printPreview(); }
    });
    if (el('sendMailBtn')) el('sendMailBtn').addEventListener('click', sendMail);
    if (el('downloadBtn')) el('downloadBtn').addEventListener('click', downloadHTML);
    // showTemplateBtn removed from UI; keep handler only if element exists (defensive)
    if (el('showTemplateBtn')) el('showTemplateBtn').addEventListener('click', ()=>{
      const tmpl = getTemplateById(state.currentType) || {};
      const html = tmpl.templateHtml || tmpl.template || '';
      const w = window.open('', '_blank');
      if (!w) { alert('Unable to open window to show template. Allow popups.'); return; }
      w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Template HTML</title></head><body><pre style="white-space:pre-wrap">' + escapeHtml(html) + '</pre></body></html>');
      w.document.close();
    });
    // navigation
    const showPage = (p)=>{
      const editor = document.getElementById('editorPage');
      const cust = document.getElementById('customerPage');
      const navEditor = document.getElementById('navEditor');
      const navCustomers = document.getElementById('navCustomers');
      if (p==='customers'){
        if (editor) editor.style.display = 'none';
        if (cust) cust.style.display = '';
        if (navEditor) navEditor.classList.remove('active');
        if (navCustomers) navCustomers.classList.add('active');
        renderCustomers();
      } else {
        if (editor) editor.style.display = '';
        if (cust) cust.style.display = 'none';
        if (navEditor) navEditor.classList.add('active');
        if (navCustomers) navCustomers.classList.remove('active');
      }
    };
    const navEditor = document.getElementById('navEditor');
    const navCustomers = document.getElementById('navCustomers');
    if (navEditor) navEditor.addEventListener('click', ()=> showPage('editor'));
    if (navCustomers) navCustomers.addEventListener('click', ()=> showPage('customers'));

    // customer handlers
    if (el('custAddBtn')) el('custAddBtn').addEventListener('click', addOrUpdateCustomer);
    if (el('custClearBtn')) el('custClearBtn').addEventListener('click', clearCustomerForm);
      // import/export buttons (top-right header)
      if (el('exportCommitBtn')) el('exportCommitBtn').addEventListener('click', exportCommitments);
      if (el('importCommitBtn')) el('importCommitBtn').addEventListener('click', ()=>{ if (el('importCommitFile')) el('importCommitFile').click(); });
      if (el('exportCustBtn')) el('exportCustBtn').addEventListener('click', exportCustomers);
      if (el('importCustBtn')) el('importCustBtn').addEventListener('click', ()=>{ if (el('importCustFile')) el('importCustFile').click(); });
      // wire hidden file inputs
      if (el('importCommitFile')) el('importCommitFile').addEventListener('change', e=>{ handleImportCommitFile(e.target.files && e.target.files[0]); });
      if (el('importCustFile')) el('importCustFile').addEventListener('change', e=>{ handleImportCustFile(e.target.files && e.target.files[0]); });
  // editor list form handlers (Save / Cancel)
  if (el('editorAddSaveBtn')) el('editorAddSaveBtn').addEventListener('click', addOrUpdateEditorRow);
  if (el('editorAddCancelBtn')) el('editorAddCancelBtn').addEventListener('click', clearEditorForm);
    // ensure initial nav state
    if (navEditor) navEditor.classList.add('active');
    // organization dropdown in editor: populate and wire
    if (el('orgSelect')){
      populateOrgSelect();
      el('orgSelect').addEventListener('change', e=>{
        const v = e.target.value;
        if (!v || v === '-1'){
          // clear editor fields
          el('customerName').value = '';
          el('address').value = '';
          el('proprietorName').value = '';
          renderPreview();
          return;
        }
        const i = Number(v);
        const list = loadCustomers();
        const c = list[i];
        if (!c) return;
        // populate editor fields
        el('customerName').value = c.org || '';
        el('address').value = c.address || '';
        el('proprietorName').value = c.proprietor || '';
        renderPreview();
      });
    }
  }

  // --- Branch & Signatory modal handlers ---
  function openBranchModal(){
    // parse existing branchDetails into fields (split by newline)
    const val = (el('branchDetails') || {}).value || '';
    const parts = val.split('\n');
    if (el('modal_branch_name')) el('modal_branch_name').value = parts[0] || '';
    if (el('modal_branch_address')) el('modal_branch_address').value = parts[1] || '';
    if (el('modal_branch_contact')) el('modal_branch_contact').value = parts[2] || '';
    if (el('modal_branch_website')) el('modal_branch_website').value = parts[3] || '';
    const m = el('branchModal'); if (m) m.style.display = 'flex';
  }

  function closeBranchModal(){ const m = el('branchModal'); if (m) m.style.display = 'none'; }

  // Helper function to close Branch Modal when clicking on backdrop (outside the modal content)
  function closeBranchModalOnBackdrop(event){
    if (event.target.id === 'branchModal'){
      closeBranchModal();
    }
  }

  function openSignModal(){
    if (el('modal_left_name')) el('modal_left_name').value = (el('leftSignName')||{}).value || '';
    if (el('modal_left_title')) el('modal_left_title').value = (el('leftSignTitle')||{}).value || '';
    if (el('modal_right_name')) el('modal_right_name').value = (el('rightSignName')||{}).value || '';
    if (el('modal_right_title')) el('modal_right_title').value = (el('rightSignTitle')||{}).value || '';
    // load previews from hidden inputs
    const leftSig = (el('leftSignSig')||{}).value || '';
    const rightSig = (el('rightSignSig')||{}).value || '';
    if (el('modal_left_sig_preview')) el('modal_left_sig_preview').innerHTML = leftSig ? '<img src="'+leftSig+'" style="max-width:180px; max-height:120px"/>' : '';
    if (el('modal_right_sig_preview')) el('modal_right_sig_preview').innerHTML = rightSig ? '<img src="'+rightSig+'" style="max-width:180px; max-height:120px"/>' : '';
    // populate header logo preview and footer text in modal (if present)
    try{
      const hdr = (el('headerLogoData')||{}).value || '';
      if (el('headerLogoPreview')) el('headerLogoPreview').innerHTML = hdr ? ('<img src="'+hdr+'" style="max-width:160px; max-height:80px"/>') : (el('headerLogoPreview').innerHTML || '');
      if (el('footerText')){
        // prefer the saved payload if any
        const f = getSavedEditorField('footerText') || '';
        el('footerText').value = f;
      }
    }catch(e){}
    const m = el('signModal'); if (m) m.style.display = 'flex';
    // Allow clicking outside the modal content (on the overlay) to close it,
    // and also allow Escape key to close. Wire handlers once and store them
    // on the element so they can be removed cleanly by closeSignModal().
    try{
      if (m){
        if (!m._outsideHandler){
          m._outsideHandler = function(e){ if (e.target === m) closeSignModal(); };
          m.addEventListener('click', m._outsideHandler);
        }
        if (!m._escHandler){
          m._escHandler = function(e){ if (e.key === 'Escape' || e.key === 'Esc') closeSignModal(); };
          document.addEventListener('keydown', m._escHandler);
        }
      }
    }catch(e){}
    // Ensure Save/Cancel buttons are visible in the modal (we want explicit save)
    try{
      const saveBtn = el('modal_sign_save'); if (saveBtn) saveBtn.style.display = '';
      const cancelBtn = el('modal_sign_cancel'); if (cancelBtn) cancelBtn.style.display = '';
    }catch(e){}
    // (X close button injection removed per UX request.)
  }

  function closeSignModal(){
    const m = el('signModal');
    if (m){
      m.style.display = 'none';
      try{
        if (m._outsideHandler){ m.removeEventListener('click', m._outsideHandler); m._outsideHandler = null; }
        if (m._escHandler){ document.removeEventListener('keydown', m._escHandler); m._escHandler = null; }
      }catch(e){}
    }
  }

  // file input change handlers for signature images
  function setupSignatureFileHandlers(){
    const leftFile = el('modal_left_sigfile');
    const rightFile = el('modal_right_sigfile');
    if (leftFile) leftFile.addEventListener('change', e=>{ handleFileSelect(e.target.files && e.target.files[0], 'left'); });
    if (rightFile) rightFile.addEventListener('change', e=>{ handleFileSelect(e.target.files && e.target.files[0], 'right'); });
  }

  // header logo file handlers
  function setupLogoFileHandlers(){
    const logoFile = el('headerLogoFile');
    if (logoFile) logoFile.addEventListener('change', e=>{ handleHeaderLogoFile(e.target.files && e.target.files[0]); });
    const addBtn = el('headerLogoAdd');
    if (addBtn && logoFile) addBtn.addEventListener('click', ()=>{
      // Try to auto-load a known file from the app directory first (if present).
      // Browsers will block arbitrary local file access, so this works when the file
      // is served alongside the app (e.g. via local web server) or bundled in the repo.
      const autoName = 'Screenshot 2025-10-25 203250.png';
      const tryAuto = () => {
        try{
          fetch(encodeURI('./' + autoName)).then(r=>{
            if (!r.ok) throw new Error('not found');
            return r.blob();
          }).then(b=>{
            const reader = new FileReader();
            reader.onload = function(ev){
              const data = ev.target.result;
              if (el('headerLogoData')) el('headerLogoData').value = data;
              // header logo preview removed — only persist data URL
              // set default footer when a logo is added. Persist into localStorage even
              // when the footer textarea does not exist in the current HTML copy.
              try{
                const defaultFooter = 'United Commercial Bank PLC\nCorporate Office: Plot-CWS(A)-1, Road No-34\nGulshan Avenue, Dhaka-1212, Bangladesh,\nPhone: +880-2-55668070, +8809610999999, E-mail: info@ucb.com.bd';
                // update visible textarea if present
                if (el('footerText')) el('footerText').value = defaultFooter;
                // persist headerLogoData + footerText into saved payload
                try{ updateEditorPayload({ headerLogoData: data, footerText: defaultFooter }); }catch(e){}
              }catch(e){}
              try{ renderPreview(); }catch(e){}
            };
            reader.readAsDataURL(b);
          }).catch(_=>{
            // fallback to opening file picker if auto file not available
            try{ logoFile.click(); }catch(e){}
          });
        }catch(e){ try{ logoFile.click(); }catch(_){} }
      };
      tryAuto();
    });
    const rem = el('headerLogoRemove');
    if (rem) rem.addEventListener('click', ()=>{
      if (el('headerLogoData')) el('headerLogoData').value = '';
      // when logo removed, also remove the auto-set footer (persist cleared value)
      try{
        if (el('footerText')) el('footerText').value = '';
      }catch(e){}
      try{ updateEditorPayload({ headerLogoData: '', footerText: '' }); }catch(e){}
      try{ renderPreview(); }catch(e){}
    });
  }

  function handleHeaderLogoFile(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const data = ev.target.result;
      if (el('headerLogoData')) el('headerLogoData').value = data;
      // header logo preview removed — persist headerLogoData and footer text only
      try{
        const defaultFooter = 'United Commercial Bank PLC\nCorporate Office: Plot-CWS(A)-1, Road No-34\nGulshan Avenue, Dhaka-1212, Bangladesh,\nPhone: +880-2-55668070, +8809610999999, E-mail: info@ucb.com.bd';
        if (el('footerText')) el('footerText').value = defaultFooter;
        try{ updateEditorPayload({ headerLogoData: data, footerText: defaultFooter }); }catch(e){}
  }catch(e){}
  try{ renderPreview(); }catch(e){}
    };
    reader.readAsDataURL(file);
  }


  function handleFileSelect(file, side){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const data = ev.target.result;
      // Store the data in the hidden input
      if (side === 'left'){
        if (el('modal_left_sig_preview')) el('modal_left_sig_preview').innerHTML = '<img src="'+data+'" style="max-width:180px; max-height:120px"/>';
        if (el('leftSignSig')) el('leftSignSig').value = data;
        // Also persist immediately to localStorage
        try{ updateEditorPayload({ leftSignSig: data }); }catch(e){}
      } else {
        if (el('modal_right_sig_preview')) el('modal_right_sig_preview').innerHTML = '<img src="'+data+'" style="max-width:180px; max-height:120px"/>';
        if (el('rightSignSig')) el('rightSignSig').value = data;
        // Also persist immediately to localStorage
        try{ updateEditorPayload({ rightSignSig: data }); }catch(e){}
      }
      // Refresh preview so signature appears immediately
      try{ renderPreview(); }catch(e){}
    };
    reader.readAsDataURL(file);
  }

  // modal save/cancel wiring
  function wireModals(){
    // Branch modal close handlers
    if (el('branchModalClose')) el('branchModalClose').addEventListener('click', closeBranchModal);
    if (el('branchModalCancel')) el('branchModalCancel').addEventListener('click', closeBranchModal);
    
    if (el('modal_branch_save')) el('modal_branch_save').addEventListener('click', ()=>{
      const name = (el('modal_branch_name')||{}).value || '';
      const address = (el('modal_branch_address')||{}).value || '';
      const contact = (el('modal_branch_contact')||{}).value || '';
      const website = (el('modal_branch_website')||{}).value || '';
      // always keep four lines: Branch name, Address, Contact, Website
      const full = [name || '', address || '', contact || '', website || ''].join('\n');
      if (el('branchDetails')) el('branchDetails').value = full;
      // persist changes immediately for the current template
      try{ saveCurrent(); }catch(e){}
      closeBranchModal(); renderPreview();
    });

    // Sign modal close handlers
    if (el('signModalClose')) el('signModalClose').addEventListener('click', closeSignModal);
    if (el('signModalCancel')) el('signModalCancel').addEventListener('click', closeSignModal);
    setupLogoFileHandlers();
    setupSignatureFileHandlers();  // Wire file input handlers for signatures
    // wire sign modal save/cancel handlers
    if (el('modal_sign_cancel')) el('modal_sign_cancel').addEventListener('click', ()=>{ closeSignModal(); });
    if (el('modal_sign_save')) el('modal_sign_save').addEventListener('click', ()=>{
      try{
        // copy modal fields into hidden editor fields
        const lName = (el('modal_left_name')||{}).value || '';
        const lTitle = (el('modal_left_title')||{}).value || '';
        const rName = (el('modal_right_name')||{}).value || '';
        const rTitle = (el('modal_right_title')||{}).value || '';
        if (el('leftSignName')) el('leftSignName').value = lName;
        if (el('leftSignTitle')) el('leftSignTitle').value = lTitle;
        if (el('rightSignName')) el('rightSignName').value = rName;
        if (el('rightSignTitle')) el('rightSignTitle').value = rTitle;
        // header logo data and signature image data are stored in hidden inputs by file handlers
        const headerData = (el('headerLogoData')||{}).value || '';
        const leftSig = (el('leftSignSig')||{}).value || '';
        const rightSig = (el('rightSignSig')||{}).value || '';
        if (el('leftSignSig')) el('leftSignSig').value = leftSig;
        if (el('rightSignSig')) el('rightSignSig').value = rightSig;
        // footer text (may be present in modal)
        const footerVal = (el('footerText')||{}).value || '';

        // persist into per-template payload so preview and print pick it up
        try{ updateEditorPayload({ headerLogoData: headerData, footerText: footerVal, leftSignSig: leftSig, rightSignSig: rightSig, leftSignName: lName, leftSignTitle: lTitle, rightSignName: rName, rightSignTitle: rTitle }); }catch(e){}

        // also save into visible hidden inputs and call saveCurrent to persist normal fields
        try{ saveCurrent(); }catch(e){}
      }catch(e){ /* ignore */ }
      closeSignModal();
      try{ renderPreview(); }catch(e){}  // Refresh preview with signature images
      try{ renderPreview(); }catch(e){}
    });

    // wire remove-signature buttons (clear hidden inputs, persist and refresh preview)
    const leftSigRem = el('modal_left_sig_remove');
    if (leftSigRem) leftSigRem.addEventListener('click', ()=>{
      try{
        if (el('leftSignSig')) el('leftSignSig').value = '';
        if (el('modal_left_sig_preview')) el('modal_left_sig_preview').innerHTML = '';
        try{ updateEditorPayload({ leftSignSig: '' }); }catch(e){}
        try{ saveCurrent(); }catch(e){}
        try{ renderPreview(); }catch(e){}
      }catch(e){}
    });

    const rightSigRem = el('modal_right_sig_remove');
    if (rightSigRem) rightSigRem.addEventListener('click', ()=>{
      try{
        if (el('rightSignSig')) el('rightSignSig').value = '';
        if (el('modal_right_sig_preview')) el('modal_right_sig_preview').innerHTML = '';
        try{ updateEditorPayload({ rightSignSig: '' }); }catch(e){}
        try{ saveCurrent(); }catch(e){}
        try{ renderPreview(); }catch(e){}
      }catch(e){}
    });
  }

  // Print each commitment in its own print dialog (one window per commitment).
  // Note: browsers may block multiple popups; allow popups and be prepared to confirm multiple print dialogs.
  async function printCommitmentsUsingTemplate(){
    const list = loadEditorList();
    if (!list || !list.length){ printPreview(); return; }

  const tmplObj = getTemplateById(state.currentType) || {};
  // load any persisted editor payload for the current template as a fallback
  const editorKey = 'cc_editor:' + state.currentType;
  let _savedPayload = {};
  try{
    const _raw = localStorage.getItem(editorKey);
    if (_raw) _savedPayload = JSON.parse(_raw) || {};
  }catch(e){ _savedPayload = {}; }
  // Ensure the chosen template has been normalized (in case it came from fetched JSON or was edited)
  try{ normalizeTemplates([tmplObj]); }catch(e){ /* ignore */ }
    const pageCss = `
      <style>
        body{font-family:Segoe UI, Roboto, Arial, sans-serif; color:#111; margin:0; padding:18px}
        .page{position:relative; box-sizing:border-box; width:100%; padding:18px; page-break-after:always}
        .page:last-child{page-break-after:auto}
        /* Fixed footer positioned bottom-left inside each printed page */
        .cc-footer{position:absolute; left:18px; bottom:18px; font-size:12px; white-space:pre-wrap; text-align:left; color:#333}
      </style>`;

    let bodyHtml = '';
    list.forEach((r, idx)=>{
      // prepare data for template replacements
      const data = {
        customerName: (el('customerName') ? el('customerName').value : '') || '',
        proprietorName: (el('proprietorName') ? el('proprietorName').value : '') || '',
        address: (el('address') ? el('address').value : '') || '',
        recipient: (el('recipient') ? el('recipient').value : '') || '',
        // commitment amount/purpose/date removed from editor; provide values from commitment where appropriate
        amount: '',
        amountWords: '',
        purpose: escapeHtml(r.description || ''),
        date: new Date().toLocaleDateString(),
        branchDetails: (el('branchDetails') ? el('branchDetails').value : ''),
        leftSignName: (el('leftSignName') ? el('leftSignName').value : ''),
        leftSignTitle: (el('leftSignTitle') ? el('leftSignTitle').value : ''),
        rightSignName: (el('rightSignName') ? el('rightSignName').value : ''),
        rightSignTitle: (el('rightSignTitle') ? el('rightSignTitle').value : '')
        ,
        // compute refNumber for preview/print; default is empty and will be handled later
        refNumber: '',
        year: new Date().getFullYear()
      };

        // Determine starting reference number (may be stored in editor payload or entered in DOM)
        try{
          const rawStart = getSavedEditorField('refStart') || ((_savedPayload && _savedPayload.refStart) ? String(_savedPayload.refStart) : '');
          let startNum = parseInt(String(rawStart||'').trim(), 10);
          if (isNaN(startNum)) startNum = 1;
          data.refNumber = String(startNum + idx);
        }catch(e){ data.refNumber = String(idx + 1); }

      // render template content (if html template exists) or fallback to simple block
      let contentHtml = '';
      if (tmplObj && tmplObj.html && tmplObj.templateHtml){
        contentHtml = tmplObj.templateHtml;
        // If rendering multiple commitments (one page per commitment), avoid repeating
        // the 'Invitation for Tender No' block on subsequent pages — show it only on the first page.
        if (idx > 0) {
          try{
            // Keep the label 'Invitation for Tender No:' and include a single {{ift}} placeholder
            // so the IFT value is shown on every page. collapseDuplicateIft will remove any accidental duplicates.
            contentHtml = contentHtml.replace(/<div>\s*<strong>\s*Invitation for Tender No\s*:?[\s<\/strong>]*<\/strong>.*?<\/div>/ig, '<div><strong>Invitation for Tender No:</strong> {{ift}}</div>');
          }catch(e){ /* ignore regex errors */ }
        }
        // combine editor-level data and commitment-level fields for replacement
        // compute amount fields from commitment (amountLac stored in list)
        const amtVal = (r.amountLac || '').toString().trim();
        const formattedAmount = amtVal ? ('BDT. ' + amtVal + ' Lac') : '';
        const amountWords = amtVal ? takaAmountToWords(amtVal) : '';
        const amountWordsBriket = amtVal ? takaAmountToWordsBriket(amtVal) : '';
        const leftSigData = (el('leftSignSig') || {}).value || '';
        const rightSigData = (el('rightSignSig') || {}).value || '';
        const leftSigHtml = leftSigData ? ('<div style="margin-top:6px"><img src="'+leftSigData+'" style="max-width:140px; max-height:80px"/></div>') : '';
        const rightSigHtml = rightSigData ? ('<div style="margin-top:6px"><img src="'+rightSigData+'" style="max-width:140px; max-height:80px"/></div>') : '';

        const replacer = Object.assign({}, data, {
          tenderId: escapeHtml(r.tenderId || ''),
          packageNo: escapeHtml(r.packageNo || ''),
          ift: escapeHtml(r.ift || ''),
          description: escapeHtml(r.description || ''),
          amount: escapeHtml(formattedAmount),
          amountWords: escapeHtml(amountWords),
          amountWordsBriket: escapeHtml(amountWordsBriket)
        });
          // ensure refNumber/year are available in replacer (escapeHtml for safety)
          replacer.refNumber = escapeHtml(data.refNumber || '');
          replacer.year = escapeHtml(String(data.year || new Date().getFullYear()));
        // attach signature HTML (raw) so templates can include {{leftSignSignature}} / {{rightSignSignature}}
        replacer.leftSignSignature = leftSigHtml;
        replacer.rightSignSignature = rightSigHtml;
        // sanitize special placeholders (escape HTML then convert newlines to <br/>)
        // For signatory NAME placeholders, show the signature image above the name
        ['branchDetails','recipient','leftSignTitle','rightSignName','rightSignTitle'].forEach(k=>{
          if (replacer[k]) replacer[k] = escapeHtml(replacer[k]).replace(/\n/g,'<br/>');
        });
        // left sign name: include signature image above name
        if (replacer.leftSignName !== undefined){
          const nameVal = replacer.leftSignName || '';
          const safeName = escapeHtml(nameVal).replace(/\n/g,'<br/>');
          replacer.leftSignName = leftSigHtml + safeName;
        }
        // right sign name: include signature image above name
        if (replacer.rightSignName !== undefined){
          const nameVal = replacer.rightSignName || '';
          const safeName = escapeHtml(nameVal).replace(/\n/g,'<br/>');
          replacer.rightSignName = rightSigHtml + safeName;
        }
        Object.keys(replacer).forEach(k=>{
          const re = new RegExp('{{\\s*'+k+'\\s*}}','g');
          contentHtml = contentHtml.replace(re, replacer[k]);
        });
      } else if (tmplObj && tmplObj.template){
        contentHtml = escapeHtml(tmplObj.template);
      } else {
        contentHtml = `<div><h2>Commitment</h2><p>${data.purpose}</p></div>`;
      }

  // Do not prepend metadata header; include only the rendered template content per page
  // Inject header logo into the left of header-row for this page if available
  try{
    const logoData = getSavedEditorField('headerLogoData') || (_savedPayload && _savedPayload.headerLogoData) || '';
    if (logoData) {
      try{
        contentHtml = contentHtml.replace(/(<div\s+class=["']header-row["'][^>]*>\s*)<div>\s*<\/div>/i, '$1<div><img src="' + logoData + '" style="max-width:160px; max-height:80px"/></div>');
      }catch(e){}
    }
  }catch(e){}
  // Inject header logo into the left of header-row for this page if available
  try{
    const logoData = getSavedEditorField('headerLogoData') || (_savedPayload && _savedPayload.headerLogoData) || '';
    if (logoData) {
      try{
        contentHtml = contentHtml.replace(/(<div\s+class=["']header-row["'][^>]*>\s*)<div>\s*<\/div>/i, '$1<div><img src="' + logoData + '" style="max-width:160px; max-height:80px"/></div>');
      }catch(e){}
    }
  }catch(e){}

  // Inject footer (bottom-left) for this page if provided.
  // Use a non-absolute appended block so the footer is not clipped by browser print margins
  try{
    const footerVal = getSavedEditorField('footerText') || (_savedPayload && _savedPayload.footerText) || '';
    if (footerVal) {
      const footerHtml = escapeHtml(footerVal).replace(/\n/g,'<br/>');
  try{ contentHtml = removeTemplateFooter(contentHtml); }catch(e){}
  // Insert a fixed-position footer element inside the page. The page container
  // is positioned relative, so this absolute footer will be placed bottom-left.
  const footerDiv = '<div class="cc-footer">' + footerHtml + '</div>';
  // reserve 96px at the bottom so footer does not overlap page content
  contentHtml = '<div style="box-sizing:border-box; padding-bottom:206px;">' + contentHtml + '</div>' + footerDiv;
    }
  }catch(e){}

  // Aggressive per-page dedupe to remove any duplicated IFT / APP ID tokens introduced
  // during normalization or replacement for this specific page.
  try{ contentHtml = collapseDuplicateIft(contentHtml); }catch(e){}
  bodyHtml += `<div class="page">${contentHtml}</div>`;
    });

  // Create a filename/title that includes the organization name where possible so
  // browsers use a meaningful default when saving as PDF (Save as PDF uses the document title in many browsers).
  const orgNameRaw = (el('customerName') ? (el('customerName').value || '') : '') || '';
  // sanitize filename/title: remove problematic characters
  const orgSafe = orgNameRaw.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const pageTitle = orgSafe ? ('CREDIT COMMITTMENT OF ' + orgSafe) : ('CREDIT COMMITTMENT - ' + (tmplObj.name || state.currentType));
  const full = '<!doctype html><html><head><meta charset="utf-8"><title>' + escapeHtml(pageTitle) + '</title>' + pageCss + '</head><body>' + bodyHtml + '</body></html>';

  // run targeted dedupe to prevent duplicated IFT / APP ID tokens from appearing
  const cleaned = collapseDuplicateIft(full);

  // Print without opening a visible new window: write into a hidden iframe and trigger print
  try{
    const iframe = document.createElement('iframe');
    // keep it off-screen and as small as possible
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    // Use srcdoc when available for simpler write
    if ('srcdoc' in iframe) {
      iframe.srcdoc = cleaned;
    } else {
      // fallback: write to iframe document after attaching
      iframe.onload = function(){
        try{
          const idoc = iframe.contentDocument || iframe.contentWindow.document;
          idoc.open(); idoc.write(cleaned); idoc.close();
        }catch(e){}
      };
    }
    document.body.appendChild(iframe);
    const doPrint = ()=>{
      try{
        const iwin = iframe.contentWindow || iframe;
        try{ iwin.focus(); }catch(e){}
        // Trigger print
        iwin.print();
      }catch(e){
        // fallback to opening a new window if iframe-print is blocked
        try{ const w = window.open('', '_blank'); if (w){ w.document.write(cleaned); w.document.close(); w.focus(); setTimeout(()=>{ try{ w.print(); }catch(_){} }, 200); } else { alert('Unable to start print. Allow popups or try again.'); } }catch(err){ alert('Unable to start print: ' + (err && err.message)); }
      } finally {
        // remove iframe after short delay to allow print dialog to start
        setTimeout(()=>{ try{ document.body.removeChild(iframe); }catch(_){ } }, 1500);
      }
    };
    // If iframe has loaded content, call print. Use a short timeout to ensure resources (images) load.
    if (iframe.srcdoc) {
      iframe.onload = function(){ setTimeout(doPrint, 250); };
      // In some browsers onload may not fire for srcdoc; ensure fallback
      setTimeout(()=>{ try{ doPrint(); }catch(_){} }, 1000);
    } else {
      // content was written in onload fallback; wait then print
      setTimeout(doPrint, 500);
    }
  }catch(e){
    // last-resort fallback: open window
    try{ const w = window.open('', '_blank'); if (!w){ alert('Unable to open new window — allow popups for this page.'); return; } w.document.write(cleaned); w.document.close(); w.focus(); setTimeout(()=>{ try{ w.print(); }catch(_){} }, 200); }catch(err){ alert('Print failed: ' + (err && err.message)); }
  }
  }

  // init
  // --- Import / Export helpers for commitments and customers ---
  function downloadJSON(obj, filename){
    try{
      const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 5000);
    }catch(e){ alert('Failed to prepare download: ' + (e && e.message)); }
  }

  function exportCommitments(){
    const list = loadEditorList() || [];
    const d = new Date();
    const yy = String(d.getFullYear());
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const filename = 'commitments-' + yy + mm + dd + '.json';
    downloadJSON(list, filename);
  }

  function handleImportCommitFile(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      try{
        const text = ev.target.result || '';
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) { alert('Invalid file format: expected an array of commitments'); return; }
        if (!confirm('Replace existing commitments with imported list? Click OK to replace, Cancel to abort.')) return;
        saveEditorList(parsed);
        try{ renderEditorList(); }catch(e){}
        alert('Imported ' + parsed.length + ' commitments.');
      }catch(e){ alert('Failed to import commitments: ' + (e && e.message)); }
    };
    reader.onerror = function(){ alert('Failed to read the selected file.'); };
    reader.readAsText(file);
    // clear file input so re-selecting same file will fire change event next time
    if (el('importCommitFile')) el('importCommitFile').value = '';
  }

  function exportCustomers(){
    const list = loadCustomers() || [];
    const d = new Date();
    const yy = String(d.getFullYear());
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    const filename = 'customers-' + yy + mm + dd + '.json';
    downloadJSON(list, filename);
  }

  function handleImportCustFile(file){
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      try{
        const text = ev.target.result || '';
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) { alert('Invalid file format: expected an array of customers'); return; }
        // basic validation: each item should have an 'org' property
        const invalid = parsed.find(x => !x || (typeof x.org !== 'string'));
        if (invalid){ alert('Invalid customer entry found. Each customer must have an "org" name.'); return; }
        if (!confirm('Replace existing saved customers with imported list? Click OK to replace, Cancel to abort.')) return;
        saveCustomers(parsed);
        try{ renderCustomers(); }catch(e){}
        try{ populateOrgSelect(); }catch(e){}
        alert('Imported ' + parsed.length + ' customers.');
      }catch(e){ alert('Failed to import customers: ' + (e && e.message)); }
    };
    reader.onerror = function(){ alert('Failed to read the selected file.'); };
    reader.readAsText(file);
    if (el('importCustFile')) el('importCustFile').value = '';
  }
  tryLoadTemplates().finally(()=>{
    populateTemplateSelect();
    wire();
    // load saved editor data for the selected template (silent)
    try{ loadCurrentSilent(); }catch(e){}
    wireModals();
    renderPreview();
    // render editor side list
    try{ renderEditorList(); }catch(e){ /* ignore if not present */ }
    // set sensible defaults for branch and signatory fields if empty
    try{
      const defBranch = 'Kashinathpur Branch\n1st Floor, Khan Plaza, Kashinathpurbazar, Santhia, Pabna, Bangladesh\nContact: 01713 108762, E-mail: knb@ucb.com.bd\nWebsite: www.ucb.com.bd';
      if (el('branchDetails') && !el('branchDetails').value) el('branchDetails').value = defBranch;
      if (el('leftSignName') && !el('leftSignName').value) el('leftSignName').value = 'Md. Abdullah Al Mamun';
      if (el('leftSignTitle') && !el('leftSignTitle').value) el('leftSignTitle').value = 'Senior Officer';
      if (el('rightSignName') && !el('rightSignName').value) el('rightSignName').value = 'Md. Delowar Hossain';
      if (el('rightSignTitle') && !el('rightSignTitle').value) el('rightSignTitle').value = 'SEO & Operation Manager';
      renderPreview();
    }catch(e){ /* ignore */ }
  // renderEditorList already places the list; keep it in-flow (non-floating) by CSS
  });

  // Expose functions to global scope for inline onclick handlers in HTML
  window.closeBranchModalOnBackdrop = closeBranchModalOnBackdrop;
  window.closeBranchModal = closeBranchModal;
  window.openBranchModal = openBranchModal;

})();
