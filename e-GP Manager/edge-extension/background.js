// Background Service Worker for e-GP Auto Fetcher (Manifest V3)
// Handles direct CORS-free API calls to https://www.eprocure.gov.bd

function stripTags(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanLines(html) {
  if (!html) return [];
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map(s => stripTags(s).replace(/,$/, ''))
    .filter(Boolean);
}

function extractKeyValuePairsFromHtml(html) {
  const kv = {};
  if (!html) return kv;
  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const tdMatches = tr.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
    if (tdMatches.length >= 2) {
      for (let i = 0; i < tdMatches.length - 1; i += 2) {
        const key = stripTags(tdMatches[i]).replace(/[:\s]+$/, '').trim().toLowerCase();
        const val = stripTags(tdMatches[i + 1]).trim();
        if (key && val && !kv[key]) {
          kv[key] = val;
        }
      }
    }
  }
  return kv;
}

function parseEgpSearchHtml(html, tenderId) {
  const result = {
    success: true,
    tenderId: String(tenderId || '').trim(),
    packageNo: '',
    ift: '',
    description: '',
    amountLac: '',
    securityAmount: '',
    documentFees: '',
    recipient: '',
    ministry: '',
    organization: '',
    officialDesignation: '',
    peOffice: '',
    status: 'Live',
    closingDate: '',
    docLastDate: '',
    securitySubmissionDate: '',
    procType: '',
    appId: ''
  };

  const trMatches = html.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
    if (tdMatches.length >= 4) {
      // td 1: ID, Ref, Status
      const col1Lines = cleanLines(tdMatches[1]);
      if (col1Lines.length >= 2) {
        result.ift = col1Lines[1];
        result.packageNo = col1Lines[1];
      }
      if (col1Lines.length >= 3) {
        result.status = col1Lines[2];
      }

      // td 2: Procurement nature & description
      const pMatch = tdMatches[2].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      result.description = pMatch ? stripTags(pMatch[1]) : stripTags(tdMatches[2]);

      // td 3: Ministry, Division, Organization, PE Office
      const col3Lines = cleanLines(tdMatches[3]);
      if (col3Lines.length > 0) {
        let ministryCandidate = '';
        let organizationCandidate = '';
        let peOfficeCandidate = '';

        for (let i = 0; i < col3Lines.length; i++) {
          const line = col3Lines[i];
          const lLower = line.toLowerCase();

          if (lLower.includes('ministry') && !ministryCandidate) {
            ministryCandidate = line;
          } else if ((lLower.includes('department') || lLower.includes('board') || lLower.includes('directorate') || lLower.includes('authority') || lLower.includes('corporation') || lLower.includes('commission') || lLower.includes('(lged)') || lLower.includes('(rhd)') || lLower.includes('(pwd)') || lLower.includes('(bwdb)') || lLower.includes('(dphe)') || lLower.includes('(breb)') || lLower.includes('(biwta)')) && !lLower.includes('office of the') && !organizationCandidate) {
            organizationCandidate = line;
          } else if (lLower.includes('office of') || lLower.includes('division') || lLower.includes('circle') || lLower.includes('zone') || lLower.includes('pourashava') || lLower.includes('upazila') || lLower.includes('sadar') || lLower.includes('district') || i === col3Lines.length - 1) {
            peOfficeCandidate = line;
          }
        }

        result.ministry = ministryCandidate || col3Lines[0];
        if (!organizationCandidate) {
          if (col3Lines.length >= 4) organizationCandidate = col3Lines[2];
          else if (col3Lines.length === 3) organizationCandidate = col3Lines[1];
          else if (col3Lines.length === 2 && !col3Lines[1].toLowerCase().includes('office')) organizationCandidate = col3Lines[1];
        }
        result.organization = organizationCandidate || result.ministry;

        if (!peOfficeCandidate || peOfficeCandidate === result.organization) {
          peOfficeCandidate = col3Lines[col3Lines.length - 1];
        }
        result.peOffice = peOfficeCandidate;

        if (result.peOffice) {
          if (result.peOffice.toLowerCase().startsWith('office of the')) {
            result.recipient = 'The ' + result.peOffice.replace(/^office of the\s*/i, '');
          } else {
            result.recipient = 'The Executive Engineer,\n' + result.peOffice;
          }
        }
      }

      // td 4: Proc Type
      if (tdMatches.length >= 5) {
        const c4 = stripTags(tdMatches[4]);
        if (c4) result.procType = c4;
      }

      // td 5: Closing Date
      if (tdMatches.length >= 6) {
        const col5Lines = cleanLines(tdMatches[5]);
        if (col5Lines.length >= 2) result.closingDate = col5Lines[1];
        else if (col5Lines.length === 1) result.closingDate = col5Lines[0];
      }
      break;
    }
  }

  return result;
}

function enrichWithViewTenderHtml(result, viewHtml) {
  if (!viewHtml || !result) return;

  const kv = extractKeyValuePairsFromHtml(viewHtml);

  // App ID
  if (kv['app id']) {
    result.appId = kv['app id'];
    if (!result.ift || result.ift.includes('APP ID')) {
      result.ift = (result.packageNo ? result.packageNo + ' / ' : '') + 'APP ID : ' + kv['app id'];
    }
  } else {
    const appIdMatch = viewHtml.match(/App ID\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (appIdMatch) {
      const raw = stripTags(appIdMatch[1]);
      if (raw) {
        result.appId = raw;
        if (!result.ift || result.ift.includes('APP ID')) {
          result.ift = (result.packageNo ? result.packageNo + ' / ' : '') + 'APP ID : ' + raw;
        }
      }
    }
  }

  // Package No & Description
  const pkgMatch = viewHtml.match(/Tender\s*\/\s*Proposal\s*Package\s*No\.?(?:\s*(?:and|&)\s*Description)?\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (pkgMatch) {
    const parts = pkgMatch[1].split(/<br\s*\/?>/i);
    if (parts.length >= 2) {
      const pNo = stripTags(parts[0]);
      const pDesc = stripTags(parts.slice(1).join(' '));
      if (pNo) result.packageNo = pNo;
      if (pDesc) result.description = pDesc;
    } else if (parts.length === 1) {
      const full = stripTags(parts[0]);
      const spaceIdx = full.indexOf(' ');
      if (spaceIdx > 0 && !result.packageNo) {
        result.packageNo = full.slice(0, spaceIdx).trim();
        if (!result.description) result.description = full.slice(spaceIdx + 1).trim();
      }
    }
  } else {
    for (const k in kv) {
      if (k.includes('package no')) {
        const val = kv[k];
        if (val) {
          const spaceIdx = val.indexOf(' ');
          if (spaceIdx > 0) {
            result.packageNo = val.slice(0, spaceIdx).trim();
            if (!result.description) result.description = val.slice(spaceIdx + 1).trim();
          } else {
            result.packageNo = val;
          }
        }
        break;
      }
    }
  }

  // Document Fees (Tender/Proposal Document Price (In BDT))
  let docFee = kv['tender/proposal document price (in bdt)'] || kv['tender/proposal document price'] || kv['document price'] || kv['document fees'];
  if (!docFee) {
    for (const k in kv) {
      if (k.includes('document price') || k.includes('document fee')) {
        docFee = kv[k];
        break;
      }
    }
  }
  if (!docFee) {
    const docFeeMatch = viewHtml.match(/Tender\s*\/\s*Proposal\s*Document\s*Price(?:\s*\([^)]*\))?\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (docFeeMatch) docFee = stripTags(docFeeMatch[1]);
  }
  if (docFee) {
    result.documentFees = String(docFee).replace(/,/g, '').trim();
  }

  // Security Amount (Lot Table / Key-Value): Tender/Proposal security (Amount in BDT)
  let secTxt = '';

  // 1. Column-aware Lot Table parser
  const tables = viewHtml.match(/<table[^>]*>[\s\S]*?<\/table>/gi) || [];
  for (const tbl of tables) {
    if (/security/i.test(tbl)) {
      const rows = tbl.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      let secColIdx = -1;
      let headerFound = false;

      for (const row of rows) {
        const headers = row.match(/<(?:th|td)[^>]*>([\s\S]*?)<\/(?:th|td)>/gi) || [];
        if (!headerFound && /security/i.test(row)) {
          for (let i = 0; i < headers.length; i++) {
            const hText = stripTags(headers[i]);
            if (/security/i.test(hText)) {
              secColIdx = i;
              headerFound = true;
              break;
            }
          }
          continue;
        }

        if (headerFound) {
          const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
          if (cells.length > 0) {
            if (secColIdx >= 0 && secColIdx < cells.length) {
              const val = stripTags(cells[secColIdx]).replace(/,/g, '').trim();
              if (/^\d+(\.\d+)?$/.test(val) && parseFloat(val) > 0) {
                secTxt = val;
                break;
              }
            }
            for (let j = 0; j < cells.length; j++) {
              if (j === 0 && cells.length > 2) continue; // Skip Lot number
              const val = stripTags(cells[j]).replace(/,/g, '').trim();
              if (/^\d+(\.\d+)?$/.test(val) && parseFloat(val) >= 100) {
                secTxt = val;
                break;
              }
            }
            if (secTxt) break;
          }
        }
      }
      if (secTxt) break;
    }
  }

  // 2. Key-Value TD match
  if (!secTxt) {
    for (const k in kv) {
      if (k.includes('security') && k.includes('amount')) {
        const val = kv[k].replace(/,/g, '').trim();
        if (/^\d+(\.\d+)?$/.test(val)) {
          secTxt = val;
          break;
        }
      }
    }
  }
  if (!secTxt) {
    const secMatch2 = viewHtml.match(/Tender\s*\/\s*Proposal\s*security\s*(?:\([^)]*\))?\s*:\s*<\/td>\s*<td[^>]*>(.*?)<\/td>/i);
    if (secMatch2) {
      const txt = stripTags(secMatch2[1]).replace(/,/g, '').trim();
      if (/^\d+(\.\d+)?$/.test(txt)) secTxt = txt;
    }
  }
  if (!secTxt) {
    const looseMatch = viewHtml.match(/security\s*(?:\([^)]*\))?[\s\S]{1,500}?<td>([\d,]+(?:\.\d+)?)<\/td>/i);
    if (looseMatch) {
      const val = stripTags(looseMatch[1]).replace(/,/g, '').trim();
      if (/^\d+(\.\d+)?$/.test(val) && parseFloat(val) > 0) secTxt = val;
    }
  }

  if (secTxt) {
    result.securityAmount = secTxt;
    const num = parseFloat(secTxt);
    const inLac = (num / 100000.0).toFixed(2);
    result.amountLac = parseFloat(inLac) >= 0.01 ? inLac.replace(/\.00$/, '') : String(num);
  }

  // Organization
  let orgVal = kv['organization'] || kv['organization name'] || kv['agency / organization'];
  if (!orgVal) {
    for (const k in kv) {
      if (k.startsWith('organization') || (k.includes('organization') && !k.includes('ministry'))) {
        orgVal = kv[k];
        break;
      }
    }
  }
  if (!orgVal) {
    const orgMatch = viewHtml.match(/(?:Organization|Agency)[\s\S]*?:\s*<\/(?:td|th|b|span|label|strong)[^>]*>\s*<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/i);
    if (orgMatch) orgVal = stripTags(orgMatch[1]);
  }
  if (!orgVal) {
    const orgMatch2 = viewHtml.match(/Organization\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (orgMatch2) orgVal = stripTags(orgMatch2[1]);
  }
  if (orgVal) result.organization = orgVal;

  // Ministry / Division
  let minVal = kv['ministry / division'] || kv['ministry'] || kv['division'];
  if (!minVal) {
    for (const k in kv) {
      if (k.includes('ministry')) {
        minVal = kv[k];
        break;
      }
    }
  }
  if (!minVal) {
    const minMatch = viewHtml.match(/Ministry\s*(?:\/\s*Division)?\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (minMatch) minVal = stripTags(minMatch[1]);
  }
  if (minVal && !result.ministry) result.ministry = minVal;

  // Procuring Entity Name / PE Office
  let peVal = kv['procuring entity name'] || kv['procuring entity'] || kv['procuring entity office'] || kv['name of procuring entity'] || kv['pe office'];
  if (!peVal) {
    for (const k in kv) {
      if (k.includes('procuring entity') && !k.includes('code') && !k.includes('district')) {
        peVal = kv[k];
        break;
      }
    }
  }
  if (!peVal) {
    const peMatch = viewHtml.match(/Procuring\s*Entity\s*(?:Name|Office)?\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (peMatch) peVal = stripTags(peMatch[1]);
  }
  if (peVal) result.peOffice = peVal;

  // Designation & Office Address of Official Inviting
  let desigVal = kv['designation of official inviting tender/proposal'] || kv['designation of official inviting tender'] || kv['designation of official inviting proposal'] || kv['designation of official inviting'];
  if (!desigVal) {
    for (const k in kv) {
      if (k.includes('designation') && k.includes('official inviting')) {
        desigVal = kv[k];
        break;
      }
    }
  }
  if (!desigVal) {
    const desigMatch = viewHtml.match(/Designation\s*of\s*Official\s*Inviting\s*Tender\s*\/\s*Proposal\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (desigMatch) desigVal = stripTags(desigMatch[1]);
  }
  if (desigVal) result.officialDesignation = desigVal;

  let addrVal = kv['address of official inviting tender/proposal'] || kv['address of official inviting tender'] || kv['address of official inviting'];
  if (!addrVal) {
    for (const k in kv) {
      if (k.includes('address') && k.includes('official inviting')) {
        addrVal = kv[k];
        break;
      }
    }
  }
  if (!addrVal) {
    const addrMatch = viewHtml.match(/Address\s*of\s*Official\s*Inviting\s*Tender\s*\/\s*Proposal\s*:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
    if (addrMatch) addrVal = stripTags(addrMatch[1]);
  }

  let officeAddr = result.peOffice;
  if (addrVal) {
    const am = addrVal.match(/Address\s*:\s*([^,\n<]+)/i);
    if (am && am[1].trim()) {
      officeAddr = am[1].trim();
    } else if (addrVal) {
      officeAddr = addrVal;
    }
  }

  const effectiveDesig = result.officialDesignation || desigVal || '';
  if (effectiveDesig) {
    if (officeAddr && officeAddr.toLowerCase().startsWith('office of the ' + effectiveDesig.toLowerCase())) {
      result.recipient = 'The ' + officeAddr.replace(/^office of the\s*/i, '');
    } else {
      result.recipient = 'The ' + effectiveDesig + (officeAddr ? ',\n' + officeAddr : '');
    }
  } else if (officeAddr && !result.recipient) {
    if (officeAddr.toLowerCase().startsWith('office of the')) {
      result.recipient = 'The ' + officeAddr.replace(/^office of the\s*/i, '');
    } else {
      result.recipient = 'The Executive Engineer,\n' + officeAddr;
    }
  }

  // 1. Document last selling / downloading Date and Time
  let docDateVal = '';
  for (const k in kv) {
    if ((k.includes('selling') || k.includes('downloading')) && k.includes('date') && !k.includes('office') && !k.includes('address')) {
      docDateVal = kv[k];
      break;
    }
  }
  if (!docDateVal) {
    const docDateMatch = viewHtml.match(/(?:Tender\s*\/\s*Proposal\s*)?Document\s*last\s*selling\s*\/\s*downloading\s*Date\s*and\s*Time\s*:\s*<\/(?:td|th|b|span|label|strong)[^>]*>\s*<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/i);
    if (docDateMatch) docDateVal = stripTags(docDateMatch[1]);
  }
  if (docDateVal) {
    result.docLastDate = docDateVal.trim();
  }

  // 2. Last Date and Time for Tender/Proposal Security Submission
  let secSubDateVal = '';

  // Direct regex on viewHtml for exact pattern from e-GP table
  const directSecMatch = viewHtml.match(/Last\s*Date\s*and\s*Time\s*for\s*(?:Tender\s*\/\s*Proposal\s*)?Security\s*Submission[\s\S]*?:\s*<\/(?:td|th|b|span|label|strong)[^>]*>\s*<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/i);
  if (directSecMatch) {
    const raw = stripTags(directSecMatch[1]);
    if (raw && /\d{1,2}-[A-Za-z]{3}-\d{4}/.test(raw)) {
      secSubDateVal = raw;
    }
  }

  // Fallback to kv search
  if (!secSubDateVal) {
    for (const k in kv) {
      if (k.includes('security') && k.includes('submission') && !k.includes('office') && !k.includes('address') && !k.includes('name')) {
        const val = kv[k];
        if (val && /\d{1,2}-[A-Za-z]{3}-\d{4}/.test(val)) {
          secSubDateVal = val;
          break;
        }
      }
    }
  }

  // Broad date-time regex fallback if not matched yet
  if (!secSubDateVal) {
    const fallbackMatch = viewHtml.match(/Security\s*Submission[\s\S]{1,200}?(\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}:\d{2})/i);
    if (fallbackMatch) {
      secSubDateVal = fallbackMatch[1];
    }
  }

  if (secSubDateVal) {
    result.securitySubmissionDate = secSubDateVal.trim();
  }
}

async function getEgpCookieHeader() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: 'eprocure.gov.bd' });
    if (cookies && cookies.length) {
      return cookies.map(c => `${c.name}=${c.value}`).join('; ');
    }
  } catch (e) {
    console.warn('Cookie retrieval error:', e);
  }
  return '';
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label || ('Timeout after ' + ms + 'ms'))), ms))
  ]);
}

async function fetchFromEgpInTab(tabId, tenderId) {
  try {
    const results = await withTimeout(chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: async (tid) => {
        const out = { searchHtml: '', viewHtml: '' };

        // 0. If current tab is ALREADY on ViewTender.jsp for this tender ID
        try {
          if (window.location.href.includes('ViewTender.jsp') && window.location.href.includes(tid)) {
            const html = document.documentElement ? document.documentElement.outerHTML : '';
            if (html && (html.includes('Tender/Proposal') || html.includes('App ID') || html.includes('Document Price'))) {
              out.viewHtml = html;
              return out;
            }
          }
        } catch (_) {}

        // 1. Try ViewTender.jsp POST in the active session
        try {
          const vResp = await fetch('/resources/common/ViewTender.jsp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: `id=${encodeURIComponent(tid)}&h=t`,
            credentials: 'include'
          });
          if (vResp.ok) {
            const html = await vResp.text();
            if (html && !html.includes('un-authorized') && (html.includes('Tender/Proposal') || html.includes('App ID') || html.includes('Document Price'))) {
              out.viewHtml = html;
            }
          }
        } catch (_) {}

        // 2. Try ViewTender.jsp GET
        if (!out.viewHtml) {
          try {
            const vResp2 = await fetch(`/resources/common/ViewTender.jsp?id=${encodeURIComponent(tid)}&h=t`, {
              credentials: 'include'
            });
            if (vResp2.ok) {
              const html = await vResp2.text();
              if (html && !html.includes('un-authorized') && (html.includes('Tender/Proposal') || html.includes('App ID') || html.includes('Document Price'))) {
                out.viewHtml = html;
              }
            }
          } catch (_) {}
        }

        // 3. Try Servlet
        for (const vt of ['AllTenders', 'Live', 'Archive']) {
          try {
            const postBody = `funName=AllTenders&departmentId=&viewType=${vt}&office=&procNature=&procType=&procMethod=0&tenderId=${encodeURIComponent(tid)}&refNo=&pubDtFrm=&pubDtTo=&closeDtFrm=&closeDtTo=&cpvCategory=&isFrame=&pageNo=1&size=5&h=t`;
            const resp = await fetch('/TenderDetailsServlet', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
              },
              body: postBody,
              credentials: 'include'
            });
            if (resp.ok) {
              const text = await resp.text();
              if (text && !text.includes('No records found') && text.includes('<td')) {
                out.searchHtml = text;
                break;
              }
            }
          } catch (_) {}
        }

        return out;
      },
      args: [tenderId]
    }), 18000, 'e-GP tab fetch timeout');

    if (results && results[0] && results[0].result) {
      return results[0].result;
    }
  } catch (err) {
    console.warn('executeScript in tab error:', err);
  }
  return null;
}

async function fetchFromEgp(tenderId) {
  const tid = String(tenderId || '').trim();
  if (!tid || !/^\d+$/.test(tid)) {
    throw new Error('Valid numeric Tender ID is required');
  }

  let searchHtml = '';
  let viewHtml = '';

  // Strategy 1: Check if user has an open e-GP tab (authenticated login session)
  try {
    const tabs = await chrome.tabs.query({ url: '*://www.eprocure.gov.bd/*' });
    if (tabs && tabs.length > 0) {
      for (const t of tabs) {
        const res = await fetchFromEgpInTab(t.id, tid);
        if (res) {
          if (res.viewHtml) viewHtml = res.viewHtml;
          if (res.searchHtml) searchHtml = res.searchHtml;
          if (viewHtml || searchHtml) break;
        }
      }
    }
  } catch (e) {
    console.warn('Tab query error:', e);
  }

  // Strategy 2: If not found in tab, fetch with credentials and session cookies
  if (!viewHtml && !searchHtml) {
    const cookieHeader = await getEgpCookieHeader();
    const baseHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://www.eprocure.gov.bd/partner/SearchTenPayment.jsp',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };
    if (cookieHeader) {
      baseHeaders['Cookie'] = cookieHeader;
    }

    try {
      const vResp = await fetch('https://www.eprocure.gov.bd/resources/common/ViewTender.jsp', {
        method: 'POST',
        headers: {
          ...baseHeaders,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: `id=${encodeURIComponent(tid)}&h=t`,
        credentials: 'include'
      });
      if (vResp.ok) {
        const text = await vResp.text();
        if (text && !text.includes('un-authorized') && (text.includes('Tender/Proposal') || text.includes('App ID') || text.includes('Document Price'))) {
          viewHtml = text;
        }
      }
    } catch (_) {}

    if (!viewHtml) {
      try {
        const vResp2 = await fetch(`https://www.eprocure.gov.bd/resources/common/ViewTender.jsp?id=${encodeURIComponent(tid)}&h=t`, {
          method: 'GET',
          headers: baseHeaders,
          credentials: 'include'
        });
        if (vResp2.ok) {
          const text = await vResp2.text();
          if (text && !text.includes('un-authorized') && (text.includes('Tender/Proposal') || text.includes('App ID') || text.includes('Document Price'))) {
            viewHtml = text;
          }
        }
      } catch (_) {}
    }

    if (!searchHtml) {
      const viewTypes = ['AllTenders', 'Live', 'Archive'];
      for (const vt of viewTypes) {
        try {
          const postBody = `funName=AllTenders&departmentId=&viewType=${vt}&office=&procNature=&procType=&procMethod=0&tenderId=${encodeURIComponent(tid)}&refNo=&pubDtFrm=&pubDtTo=&closeDtFrm=&closeDtTo=&cpvCategory=&isFrame=&pageNo=1&size=5&h=t`;
          const resp = await fetch('https://www.eprocure.gov.bd/TenderDetailsServlet', {
            method: 'POST',
            headers: {
              ...baseHeaders,
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest'
            },
            body: postBody,
            credentials: 'include'
          });
          if (resp.ok) {
            const text = await resp.text();
            if (text && !text.includes('No records found') && text.includes('<td')) {
              searchHtml = text;
              break;
            }
          }
        } catch (e) {
          console.warn('e-GP Servlet fetch error (' + vt + '):', e);
        }
      }
    }
  }

  // Parse results
  let parsed = null;
  if (searchHtml) {
    parsed = parseEgpSearchHtml(searchHtml, tid);
  }
  if (!parsed && viewHtml) {
    parsed = {
      success: true,
      tenderId: tid,
      packageNo: '',
      ift: '',
      description: '',
      amountLac: '',
      securityAmount: '',
      documentFees: '',
      recipient: '',
      ministry: '',
      organization: '',
      officialDesignation: '',
      peOffice: '',
      status: 'Live',
      closingDate: '',
      docLastDate: '',
      securitySubmissionDate: '',
      procType: '',
      appId: ''
    };
  }

  if (viewHtml && parsed) {
    enrichWithViewTenderHtml(parsed, viewHtml);
  }

  if (!parsed || (!parsed.packageNo && !parsed.description && !parsed.peOffice && !parsed.appId && !parsed.documentFees && !parsed.securityAmount)) {
    throw new Error(`Tender ID #${tid} could not be retrieved from e-GP. (Please keep your e-GP tab open with your login session)`);
  }

  // Fallbacks
  if (!parsed.packageNo && parsed.ift) parsed.packageNo = parsed.ift;
  if (!parsed.ift && parsed.packageNo) parsed.ift = parsed.packageNo;

  return {
    success: true,
    data: parsed
  };
}

// Runtime message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ status: 'PONG', version: '1.0.5', time: Date.now() });
    return true;
  }

  if (request.action === 'FETCH_EGP_TENDER') {
    fetchFromEgp(request.tenderId)
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async response
  }
});
