document.addEventListener('DOMContentLoaded', () => {
  const logo = document.querySelector('.ucb-logo');
  if (logo) {
    logo.addEventListener('error', () => { logo.style.display = 'none'; });
  }

  const input = document.getElementById('testTenderId');
  const btn = document.getElementById('testFetchBtn');
  const statusMsg = document.getElementById('statusMsg');
  const resultBox = document.getElementById('resultBox');

  const resSecurityAmount = document.getElementById('resSecurityAmount');
  const resDocFees = document.getElementById('resDocFees');
  const resTenderId = document.getElementById('resTenderId');
  const resPackageNo = document.getElementById('resPackageNo');
  const resIft = document.getElementById('resIft');
  const resOrganization = document.getElementById('resOrganization');
  const resOfficialDesignation = document.getElementById('resOfficialDesignation');
  const resDesc = document.getElementById('resDesc');
  const resPe = document.getElementById('resPe');
  const resDocLastDate = document.getElementById('resDocLastDate');
  const resSecuritySubmissionDate = document.getElementById('resSecuritySubmissionDate');

  function fmtMoney(num) {
    if (!num && num !== 0) return '-';
    const n = parseFloat(String(num).replace(/,/g, ''));
    if (isNaN(n)) return String(num);
    return '৳ ' + n.toLocaleString('en-US');
  }

  function showStatus(text, isError = false) {
    statusMsg.style.display = 'block';
    statusMsg.style.color = isError ? 'var(--danger)' : 'var(--primary)';
    statusMsg.innerHTML = text;
  }

  btn.addEventListener('click', async () => {
    const tid = input.value.trim();
    if (!tid) {
      showStatus('Please enter a numeric Tender ID', true);
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Fetching...';
    showStatus('Fetching details from e-GP session...');
    resultBox.style.display = 'none';

    try {
      chrome.runtime.sendMessage({ action: 'FETCH_EGP_TENDER', tenderId: tid }, (res) => {
        btn.disabled = false;
        btn.innerHTML = 'Fetch';

        if (chrome.runtime.lastError) {
          showStatus('Error: ' + chrome.runtime.lastError.message, true);
          return;
        }

        if (!res || !res.success || !res.data) {
          showStatus('Failed: ' + ((res && res.error) || 'Tender not found on e-GP portal'), true);
          return;
        }

        const data = res.data;
        showStatus('✓ Tender details successfully fetched from e-GP!', false);
        statusMsg.style.color = 'var(--success)';

        // Financials
        resSecurityAmount.textContent = data.securityAmount ? fmtMoney(data.securityAmount) : (data.amountLac ? fmtMoney(parseFloat(data.amountLac) * 100000) : '-');
        resDocFees.textContent = data.documentFees ? fmtMoney(data.documentFees) : '-';

        // General
        resTenderId.textContent = data.tenderId || tid;
        resPackageNo.textContent = data.packageNo || '-';
        resIft.textContent = data.ift || '-';
        resOrganization.textContent = data.organization || data.ministry || '-';
        resOfficialDesignation.textContent = data.officialDesignation || (data.recipient ? data.recipient.split(',')[0].replace(/^The\s+/i, '') : '-');
        resPe.textContent = data.peOffice || data.recipient || '-';
        if (resDocLastDate) resDocLastDate.textContent = data.docLastDate || '-';
        if (resSecuritySubmissionDate) resSecuritySubmissionDate.textContent = data.securitySubmissionDate || '-';
        resDesc.textContent = data.description || '-';

        resultBox.style.display = 'block';
      });
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = 'Fetch';
      showStatus('Error: ' + err.message, true);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });
});
