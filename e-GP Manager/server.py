#!/usr/bin/env python3
"""
Credit Commitment - Local e-GP Helper & Web Server
Serves the Credit Commitment web application and provides API endpoints
to fetch tender details directly from eprocure.gov.bd without CORS issues.
"""

import sys
import os
import re
import json
import urllib.request
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import webbrowser
import socket

PORT = 8000

def get_free_port(start_port=8000):
    port = start_port
    while port < 65535:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return port
        port += 1
    return start_port

def strip_html_tags(html):
    if not html:
        return ""
    text = re.sub(r'<[^>]+>', ' ', html)
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#39;', "'")
    return ' '.join(text.split()).strip()

def clean_lines(html):
    if not html:
        return []
    text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '\n', text)
    lines = []
    for line in text.split('\n'):
        cl = strip_html_tags(line).rstrip(',')
        if cl:
            lines.append(cl)
    return lines

def extract_key_value_pairs(html):
    kv = {}
    if not html:
        return kv
    tr_matches = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', html, re.IGNORECASE)
    for tr in tr_matches:
        td_matches = re.findall(r'<(?:td|th)[^>]*>([\s\S]*?)</(?:td|th)>', tr, re.IGNORECASE)
        if len(td_matches) >= 2:
            for i in range(0, len(td_matches) - 1, 2):
                key = re.sub(r'[:\s]+$', '', strip_html_tags(td_matches[i])).strip().lower()
                val = strip_html_tags(td_matches[i + 1]).strip()
                if key and val and key not in kv:
                    kv[key] = val
    return kv

def parse_egp_tender(tender_id):
    tid = str(tender_id).strip()
    if not tid or not tid.isdigit():
        return {'success': False, 'error': 'Invalid Tender ID (must be numeric)'}

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.eprocure.gov.bd/partner/SearchTenPayment.jsp',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,bn;q=0.8'
    }

    result = {
        'success': True,
        'tenderId': tid,
        'packageNo': '',
        'ift': '',
        'description': '',
        'amountLac': '',
        'securityAmount': '',
        'documentFees': '',
        'recipient': '',
        'ministry': '',
        'organization': '',
        'officialDesignation': '',
        'peOffice': '',
        'status': 'Live',
        'closingDate': '',
        'docLastDate': '',
        'securitySubmissionDate': '',
        'procNature': '',
        'procType': '',
        'appId': '',
        'source': 'eprocure.gov.bd'
    }

    # Step 1: Search in AllTenders via TenderDetailsServlet
    # We test AllTenders first; if not found, also check Live and Archive
    search_html = ''
    for view_type in ['AllTenders', 'Live', 'Archive']:
        try:
            servlet_url = 'https://www.eprocure.gov.bd/TenderDetailsServlet'
            post_data = {
                'funName': 'AllTenders',
                'departmentId': '',
                'viewType': view_type,
                'office': '',
                'procNature': '',
                'procType': '',
                'procMethod': '0',
                'tenderId': tid,
                'refNo': '',
                'pubDtFrm': '',
                'pubDtTo': '',
                'closeDtFrm': '',
                'closeDtTo': '',
                'cpvCategory': '',
                'isFrame': '',
                'pageNo': '1',
                'size': '5',
                'h': 't'
            }
            req = urllib.request.Request(
                servlet_url,
                data=urllib.parse.urlencode(post_data).encode('utf-8'),
                headers={
                    **headers,
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            )
            with urllib.request.urlopen(req, timeout=12) as response:
                search_html = response.read().decode('utf-8', errors='ignore')
                if 'No records found' not in search_html and '<td' in search_html:
                    break
        except Exception as e:
            print(f"Servlet search error ({view_type}): {e}")

    # Parse search results
    if search_html and 'No records found' not in search_html:
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', search_html, re.DOTALL | re.IGNORECASE)
        for r in rows:
            tds = re.findall(r'<td[^>]*>(.*?)</td>', r, re.DOTALL | re.IGNORECASE)
            if len(tds) >= 4:
                # Column 2: Tender ID, Reference No, Status
                col1_lines = clean_lines(tds[1])
                if len(col1_lines) >= 2:
                    result['ift'] = col1_lines[1]
                    result['packageNo'] = col1_lines[1]
                if len(col1_lines) >= 3:
                    result['status'] = col1_lines[2]

                # Column 3: Procurement Nature, Description
                p_match = re.search(r'<p[^>]*>(.*?)</p>', tds[2], re.DOTALL | re.IGNORECASE)
                result['description'] = strip_html_tags(p_match.group(1)) if p_match else strip_html_tags(tds[2])

                # Column 4: Ministry, Division, Department, PE Office
                col3_lines = clean_lines(tds[3])
                if col3_lines:
                    ministry_candidate = ''
                    organization_candidate = ''
                    pe_office_candidate = ''

                    for i, line in enumerate(col3_lines):
                        l_lower = line.lower()
                        if 'ministry' in l_lower and not ministry_candidate:
                            ministry_candidate = line
                        elif any(kw in l_lower for kw in ['department', 'board', 'directorate', 'authority', 'corporation', 'commission', '(lged)', '(rhd)', '(pwd)', '(bwdb)', '(dphe)', '(breb)', '(biwta)']) and 'office of the' not in l_lower and not organization_candidate:
                            organization_candidate = line
                        elif any(kw in l_lower for kw in ['office of', 'division', 'circle', 'zone', 'pourashava', 'upazila', 'sadar', 'district']) or i == len(col3_lines) - 1:
                            pe_office_candidate = line

                    result['ministry'] = ministry_candidate or col3_lines[0]
                    if not organization_candidate:
                        if len(col3_lines) >= 4:
                            organization_candidate = col3_lines[2]
                        elif len(col3_lines) == 3:
                            organization_candidate = col3_lines[1]
                        elif len(col3_lines) == 2 and 'office' not in col3_lines[1].lower():
                            organization_candidate = col3_lines[1]
                    result['organization'] = organization_candidate or result['ministry']

                    if not pe_office_candidate or pe_office_candidate == result['organization']:
                        pe_office_candidate = col3_lines[-1]
                    result['peOffice'] = pe_office_candidate

                    if result['peOffice']:
                        if result['peOffice'].lower().startswith('office of the'):
                            result['recipient'] = 'The ' + re.sub(r'^office of the\s*', '', result['peOffice'], flags=re.IGNORECASE)
                        else:
                            result['recipient'] = "The Executive Engineer,\n" + result['peOffice']

                # Column 5: Proc Nature / Type
                if len(tds) >= 5:
                    c4 = strip_html_tags(tds[4])
                    if c4:
                        result['procType'] = c4

                # Column 6: Closing Date
                if len(tds) >= 6:
                    col5_lines = clean_lines(tds[5])
                    if len(col5_lines) >= 2:
                        result['closingDate'] = col5_lines[1]
                    elif len(col5_lines) == 1:
                        result['closingDate'] = col5_lines[0]
                break

    # Step 2: Fetch ViewTender.jsp for complete details
    try:
        view_url = 'https://www.eprocure.gov.bd/resources/common/ViewTender.jsp'
        view_data = urllib.parse.urlencode({'id': tid, 'h': 't'}).encode('utf-8')
        req_view = urllib.request.Request(
            view_url,
            data=view_data,
            headers={**headers, 'Content-Type': 'application/x-www-form-urlencoded'}
        )
        view_html = ''
        try:
            with urllib.request.urlopen(req_view, timeout=12) as response:
                view_html = response.read().decode('utf-8', errors='ignore')
        except Exception as ve1:
            print(f"ViewTender POST error: {ve1}")

        if not view_html or 'un-authorized' in view_html:
            try:
                get_url = f'https://www.eprocure.gov.bd/resources/common/ViewTender.jsp?id={tid}&h=t'
                req_get = urllib.request.Request(get_url, headers=headers)
                with urllib.request.urlopen(req_get, timeout=12) as response:
                    view_html = response.read().decode('utf-8', errors='ignore')
            except Exception as ve2:
                print(f"ViewTender GET error: {ve2}")

        if view_html and 'un-authorized' not in view_html:
            kv = extract_key_value_pairs(view_html)

            # App ID
            if 'app id' in kv:
                result['appId'] = kv['app id']
                if not result['ift'] or 'APP ID' in result['ift']:
                    prefix = f"{result['packageNo']} / " if result['packageNo'] else ""
                    result['ift'] = f"{prefix}APP ID : {kv['app id']}"
            else:
                app_match = re.search(r'App ID\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if app_match:
                    raw_app = strip_html_tags(app_match.group(1))
                    if raw_app:
                        result['appId'] = raw_app
                        if not result['ift'] or 'APP ID' in result['ift']:
                            prefix = f"{result['packageNo']} / " if result['packageNo'] else ""
                            result['ift'] = f"{prefix}APP ID : {raw_app}"

            # Package No and Description
            pkg_desc_match = re.search(r'Tender\s*/\s*Proposal\s*Package\s*No\.?(?:\s*(?:and|&)\s*Description)?\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
            if pkg_desc_match:
                raw_cell = pkg_desc_match.group(1)
                parts = re.split(r'<br\s*/?>', raw_cell, flags=re.IGNORECASE)
                if len(parts) >= 2:
                    p_no = strip_html_tags(parts[0])
                    p_desc = strip_html_tags(" ".join(parts[1:]))
                    if p_no:
                        result['packageNo'] = p_no
                    if p_desc:
                        result['description'] = p_desc
                elif len(parts) == 1:
                    full_pkg = strip_html_tags(parts[0])
                    if ' ' in full_pkg and not result['packageNo']:
                        p_no, p_desc = full_pkg.split(' ', 1)
                        result['packageNo'] = p_no.strip()
                        if not result['description']:
                            result['description'] = p_desc.strip()
            else:
                for k, v in kv.items():
                    if 'package no' in k:
                        if ' ' in v:
                            p_no, p_desc = v.split(' ', 1)
                            result['packageNo'] = p_no.strip()
                            if not result['description']:
                                result['description'] = p_desc.strip()
                        else:
                            result['packageNo'] = v
                        break

            # Document Fees (Tender/Proposal Document Price (In BDT))
            doc_fee = kv.get('tender/proposal document price (in bdt)') or kv.get('tender/proposal document price') or kv.get('document price') or kv.get('document fees')
            if not doc_fee:
                for k, v in kv.items():
                    if 'document price' in k or 'document fee' in k:
                        doc_fee = v
                        break
            if not doc_fee:
                doc_fee_match = re.search(r'Tender\s*/\s*Proposal\s*Document\s*Price(?:\s*\([^)]*\))?\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if doc_fee_match:
                    doc_fee = strip_html_tags(doc_fee_match.group(1))
            if doc_fee:
                result['documentFees'] = str(doc_fee).replace(',', '').strip()

            # Security Amount (Lot Table / Key-Value): Tender/Proposal security (Amount in BDT)
            sec_txt = ''
            tables = re.findall(r'<table[^>]*>[\s\S]*?</table>', view_html, re.IGNORECASE)
            for tbl in tables:
                if re.search(r'security', tbl, re.IGNORECASE):
                    rows = re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', tbl, re.IGNORECASE)
                    sec_col_idx = -1
                    header_found = False
                    for row in rows:
                        headers = re.findall(r'<(?:th|td)[^>]*>([\s\S]*?)</(?:th|td)>', row, re.IGNORECASE)
                        if not header_found and re.search(r'security', row, re.IGNORECASE):
                            for idx, h in enumerate(headers):
                                h_clean = strip_html_tags(h)
                                if re.search(r'security', h_clean, re.IGNORECASE):
                                    sec_col_idx = idx
                                    header_found = True
                                    break
                            continue
                        if header_found:
                            cells = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row, re.IGNORECASE)
                            if cells:
                                if 0 <= sec_col_idx < len(cells):
                                    v = strip_html_tags(cells[sec_col_idx]).replace(',', '').strip()
                                    if re.match(r'^\d+(\.\d+)?$', v) and float(v) > 0:
                                        sec_txt = v
                                        break
                                for c_idx, c in enumerate(cells):
                                    if c_idx == 0 and len(cells) > 2:
                                        continue  # Skip lot number
                                    v = strip_html_tags(c).replace(',', '').strip()
                                    if re.match(r'^\d+(\.\d+)?$', v) and float(v) >= 100:
                                        sec_txt = v
                                        break
                                if sec_txt:
                                    break
                    if sec_txt:
                        break

            if not sec_txt:
                for k, v in kv.items():
                    if 'security' in k and 'amount' in k:
                        val = v.replace(',', '').strip()
                        if re.match(r'^\d+(\.\d+)?$', val):
                            sec_txt = val
                            break

            if not sec_txt:
                sec_match2 = re.search(r'Tender\s*/\s*Proposal\s*security\s*(?:\([^)]*\))?\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if sec_match2:
                    txt = strip_html_tags(sec_match2.group(1)).replace(',', '').strip()
                    if re.match(r'^\d+(\.\d+)?$', txt):
                        sec_txt = txt

            if not sec_txt:
                loose_match = re.search(r'security\s*(?:\([^)]*\))?[\s\S]{1,500}?<td>([\d,]+(?:\.\d+)?)</td>', view_html, re.IGNORECASE)
                if loose_match:
                    val = strip_html_tags(loose_match.group(1)).replace(',', '').strip()
                    if re.match(r'^\d+(\.\d+)?$', val) and float(val) > 0:
                        sec_txt = val

            if sec_txt:
                result['securityAmount'] = sec_txt
                amt_num = float(sec_txt)
                amt_in_lac = amt_num / 100000.0
                result['amountLac'] = f"{amt_in_lac:.2f}".rstrip('0').rstrip('.') if amt_in_lac >= 0.01 else str(amt_num)

            # Organization
            org_val = kv.get('organization') or kv.get('organization name') or kv.get('agency / organization')
            if not org_val:
                for k, v in kv.items():
                    if k.startswith('organization') or ('organization' in k and 'ministry' not in k):
                        org_val = v
                        break
            if not org_val:
                org_match = re.search(r'(?:Organization|Agency)[\s\S]*?:\s*</(?:td|th|b|span|label|strong)[^>]*>\s*<(?:td|th)[^>]*>([\s\S]*?)</(?:td|th)>', view_html, re.IGNORECASE)
                if org_match:
                    org_val = strip_html_tags(org_match.group(1))
            if not org_val:
                org_match2 = re.search(r'Organization\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if org_match2:
                    org_val = strip_html_tags(org_match2.group(1))
            if org_val:
                result['organization'] = org_val

            # Ministry / Division
            min_val = kv.get('ministry / division') or kv.get('ministry') or kv.get('division')
            if not min_val:
                for k, v in kv.items():
                    if 'ministry' in k:
                        min_val = v
                        break
            if not min_val:
                min_match = re.search(r'Ministry\s*(?:/\s*Division)?\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if min_match:
                    min_val = strip_html_tags(min_match.group(1))
            if min_val and not result['ministry']:
                result['ministry'] = min_val

            # Procuring Entity Name / PE Office
            pe_val = kv.get('procuring entity name') or kv.get('procuring entity') or kv.get('procuring entity office') or kv.get('name of procuring entity') or kv.get('pe office')
            if not pe_val:
                for k, v in kv.items():
                    if 'procuring entity' in k and 'code' not in k and 'district' not in k:
                        pe_val = v
                        break
            if not pe_val:
                pe_match = re.search(r'Procuring\s*Entity\s*(?:Name|Office)?\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if pe_match:
                    pe_val = strip_html_tags(pe_match.group(1))
            if pe_val:
                result['peOffice'] = pe_val

            # Designation & Office Address of Official Inviting
            desig_val = kv.get('designation of official inviting tender/proposal') or kv.get('designation of official inviting tender') or kv.get('designation of official inviting proposal') or kv.get('designation of official inviting')
            if not desig_val:
                for k, v in kv.items():
                    if 'designation' in k and 'official inviting' in k:
                        desig_val = v
                        break
            if not desig_val:
                desig_match = re.search(r'Designation\s*of\s*Official\s*Inviting\s*Tender\s*/\s*Proposal\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if desig_match:
                    desig_val = strip_html_tags(desig_match.group(1))
            if desig_val:
                result['officialDesignation'] = desig_val

            addr_val = kv.get('address of official inviting tender/proposal') or kv.get('address of official inviting tender') or kv.get('address of official inviting')
            if not addr_val:
                for k, v in kv.items():
                    if 'address' in k and 'official inviting' in k:
                        addr_val = v
                        break
            if not addr_val:
                addr_match = re.search(r'Address\s*of\s*Official\s*Inviting\s*Tender\s*/\s*Proposal\s*:\s*</td>\s*<td[^>]*>(.*?)</td>', view_html, re.DOTALL | re.IGNORECASE)
                if addr_match:
                    addr_val = strip_html_tags(addr_match.group(1))

            office_addr = result['peOffice']
            if addr_val:
                am = re.search(r'Address\s*:\s*([^,\n<]+)', addr_val, re.IGNORECASE)
                if am and am.group(1).strip():
                    office_addr = am.group(1).strip()
                elif addr_val:
                    office_addr = addr_val

            effective_desig = result['officialDesignation'] or desig_val or ''
            if effective_desig:
                if office_addr and office_addr.lower().startswith('office of the ' + effective_desig.lower()):
                    result['recipient'] = 'The ' + re.sub(r'^office of the\s*', '', office_addr, flags=re.IGNORECASE)
                else:
                    result['recipient'] = f"The {effective_desig}" + (f",\n{office_addr}" if office_addr else "")
            elif office_addr and not result['recipient']:
                if office_addr.lower().startswith('office of the'):
                    result['recipient'] = 'The ' + re.sub(r'^office of the\s*', '', office_addr, flags=re.IGNORECASE)
                else:
                    result['recipient'] = f"The Executive Engineer,\n{office_addr}"

            # Document last selling / downloading Date and Time
            doc_date_val = ''
            for k, v in kv.items():
                if ('selling' in k or 'downloading' in k) and 'date' in k and 'office' not in k and 'address' not in k:
                    doc_date_val = v
                    break
            if not doc_date_val:
                doc_date_match = re.search(r'(?:Tender\s*/\s*Proposal\s*)?Document\s*last\s*selling\s*/\s*downloading\s*Date\s*and\s*Time\s*:\s*</(?:td|th|b|span|label|strong)[^>]*>\s*<(?:td|th)[^>]*>(.*?)</(?:td|th)>', view_html, re.DOTALL | re.IGNORECASE)
                if doc_date_match:
                    doc_date_val = strip_html_tags(doc_date_match.group(1))
            if doc_date_val:
                result['docLastDate'] = doc_date_val.strip()

            # Last Date and Time for Tender/Proposal Security Submission
            sec_sub_val = ''
            direct_sec_match = re.search(r'Last\s*Date\s*and\s*Time\s*for\s*(?:Tender\s*/\s*Proposal\s*)?Security\s*Submission[\s\S]*?:\s*</(?:td|th|b|span|label|strong)[^>]*>\s*<(?:td|th)[^>]*>(.*?)</(?:td|th)>', view_html, re.DOTALL | re.IGNORECASE)
            if direct_sec_match:
                raw_s = strip_html_tags(direct_sec_match.group(1))
                if raw_s and re.search(r'\d{1,2}-[A-Za-z]{3}-\d{4}', raw_s):
                    sec_sub_val = raw_s

            if not sec_sub_val:
                for k, v in kv.items():
                    if 'security' in k and 'submission' in k and 'office' not in k and 'address' not in k and 'name' not in k:
                        if v and re.search(r'\d{1,2}-[A-Za-z]{3}-\d{4}', v):
                            sec_sub_val = v
                            break

            if not sec_sub_val:
                fallback_match = re.search(r'Security\s*Submission[\s\S]{1,200}?(\d{1,2}-[A-Za-z]{3}-\d{4}\s+\d{1,2}:\d{2})', view_html, re.IGNORECASE)
                if fallback_match:
                    sec_sub_val = fallback_match.group(1)

            if sec_sub_val:
                result['securitySubmissionDate'] = sec_sub_val.strip()

    except Exception as e:
        print(f"ViewTender extraction error: {e}")

    # Fallback if packageNo is still empty but ift exists
    if not result['packageNo'] and result['ift']:
        result['packageNo'] = result['ift']
    if not result['ift'] and result['packageNo']:
        result['ift'] = result['packageNo']

    # Check if we got at least something
    if not result['description'] and not result['packageNo'] and not result['peOffice']:
        return {
            'success': False,
            'error': f'Tender ID {tid} not found on e-GP portal (www.eprocure.gov.bd). Please verify the ID.',
            'tenderId': tid
        }

    return result

class EGPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS for local cross-origin usage
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/api/fetch-tender':
            params = urllib.parse.parse_qs(parsed_path.query)
            tender_id = params.get('id', [''])[0]
            data = parse_egp_tender(tender_id)
            self.send_response(200 if data.get('success') else 404)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))
            return
        elif parsed_path.path == '/api/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"ok","server":"e-GP Manager Helper"}')
            return

        super().do_GET()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path)
        if parsed_path.path == '/api/fetch-batch':
            content_len = int(self.headers.get('Content-Length', 0))
            post_body = self.rfile.read(content_len)
            try:
                payload = json.loads(post_body.decode('utf-8'))
                ids = payload.get('ids', [])
                results = []
                for tid in ids:
                    results.append(parse_egp_tender(tid))
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'results': results}, ensure_ascii=False).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False, 'error': str(e)}).encode('utf-8'))
            return

        super().do_POST()

def run_server(port=PORT, open_browser=True):
    actual_port = get_free_port(port)
    server_address = ('127.0.0.1', actual_port)
    html_file = "e-GP%20Manager.html" if os.path.exists("e-GP Manager.html") else "Credit%20Commitment.html"
    app_url = f"http://localhost:{actual_port}/{html_file}"
    print(f"================================================================")
    print(f"  e-GP Manager Server Running")
    print(f"  Local URL: {app_url}")
    print(f"  API Endpoint: http://localhost:{actual_port}/api/fetch-tender?id=<TenderID>")
    print(f"================================================================")
    if open_browser:
        webbrowser.open(app_url)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

if __name__ == '__main__':
    open_b = True
    if len(sys.argv) > 1 and sys.argv[1] == '--no-browser':
        open_b = False
    run_server(open_browser=open_b)
