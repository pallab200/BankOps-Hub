document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('nav li');
    const pageTitle = document.getElementById('page-title');
    const calculatorContainer = document.getElementById('calculator-container');
    let rateData = {};

    // Global rate storage - persists across tab switches
    window.currentRates = {
        fdrDouble: 10.80,
        fdrFixed: {
            day360: 11.50,
            day180: 11.00,
            day90: 10.75
        },
        dps: {
            male: { year1: 9.50, year2: 9.50, year3: 9.75, year5: 10.00, year10: 10.00 },
            female: { year1: 9.75, year2: 9.75, year3: 10.00, year5: 10.25, year10: 10.25 }
        },
        earningPlus: {
            month1: 9.75,
            month3: 10.00,
            month6: 10.25
        }
    };

    // Bangla Number Conversion
    function toBanglaNumber(num) {
        const banglaDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        return String(num).replace(/\d/g, digit => banglaDigits[digit]);
    }

    // Convert all numbers to Bangla for print
    function convertNumbersToBanglaForPrint() {
        // Store original values and convert input values to visible text for print
        document.querySelectorAll('input[type="number"]').forEach(input => {
            if (input.value && !input.hasAttribute('data-original-value')) {
                input.setAttribute('data-original-value', input.value);
                input.setAttribute('data-is-input', 'true');

                // Create a span to hold the bangla value
                const originalDisplay = input.style.display;
                const banglaValue = toBanglaNumber(input.value);

                // Store display style and hide input
                input.setAttribute('data-original-display', originalDisplay || 'inline-block');
                input.style.display = 'none';

                // Create and insert visible span
                const span = document.createElement('span');
                span.className = 'rate-print-value';
                span.setAttribute('data-rate-span', 'true');
                span.textContent = banglaValue;
                span.style.fontWeight = 'bold';
                span.style.color = 'black';
                input.parentNode.insertBefore(span, input);
            }
        });

        // Convert profit values and other numeric displays in elements with these classes
        document.querySelectorAll('.profit-value, .profit-1, .profit-3, .profit-6').forEach(el => {
            if (el.textContent && !el.hasAttribute('data-original-text')) {
                const text = el.textContent.trim();
                // Convert any numeric format (includes decimals and commas)
                if (/[\d.,]/.test(text)) {
                    el.setAttribute('data-original-text', text);
                    // Replace ONLY with Bangla - no English
                    el.textContent = toBanglaNumber(text);
                }
            }
        });

        // Convert tenure and other numeric text in table cells and result displays
        document.querySelectorAll('.highlight-box .value, .result-value').forEach(el => {
            const text = el.textContent.trim();
            if (text && /\d/.test(text) && !el.hasAttribute('data-original-text')) {
                el.setAttribute('data-original-text', text);
                // Replace ONLY with Bangla
                el.textContent = toBanglaNumber(text);
            }
        });

        // Convert text in table cells that contain numbers (like the % symbol part)
        document.querySelectorAll('.scheme-card td').forEach(cell => {
            if (!cell.querySelector('input') && cell.textContent) {
                const text = cell.textContent.trim();
                // Only convert if it contains digits
                if (/\d/.test(text) && !cell.hasAttribute('data-original-text')) {
                    cell.setAttribute('data-original-text', text);
                    // Replace entire cell content with Bangla version
                    cell.textContent = toBanglaNumber(text);
                }
            }
        });
    }

    // Restore original numbers after print
    function restoreOriginalNumbers() {
        // Restore input elements and remove temporary spans
        document.querySelectorAll('input[type="number"][data-original-value]').forEach(input => {
            input.value = input.getAttribute('data-original-value');
            input.removeAttribute('data-original-value');

            // Remove the temporary span
            const span = input.parentNode.querySelector('span[data-rate-span]');
            if (span) {
                span.remove();
            }

            // Restore display
            const originalDisplay = input.getAttribute('data-original-display') || 'inline-block';
            input.style.display = originalDisplay;
            input.removeAttribute('data-original-display');
            input.removeAttribute('data-is-input');
        });

        document.querySelectorAll('[data-original-text]').forEach(el => {
            if (el.hasAttribute('data-original-text')) {
                el.textContent = el.getAttribute('data-original-text');
                el.removeAttribute('data-original-text');
            }
        });
    }

    // Print event listeners
    window.addEventListener('beforeprint', convertNumbersToBanglaForPrint);
    window.addEventListener('afterprint', restoreOriginalNumbers);

    // Global event listener for prospectus input changes
    document.addEventListener('input', function (e) {
        // Only trigger if input is within prospectus view
        if (e.target.closest('.prospectus-view') && e.target.type === 'number') {
            console.log('Prospectus rate changed:', e.target.id || e.target.className, '=', e.target.value);

            // Save the rate to global storage
            saveRateToGlobal(e.target);

            // Update any visible calculators
            updateAllCalculators();

            // Also update prospectus DPS maturities
            try { updateProspectusDPSMaturities(); } catch (err) { /* ignore if not present */ }
        }
    });

    document.addEventListener('change', function (e) {
        // Only trigger if input is within prospectus view
        if (e.target.closest('.prospectus-view') && e.target.type === 'number') {
            console.log('Prospectus rate finalized:', e.target.id || e.target.className, '=', e.target.value);

            // Save the rate to global storage
            saveRateToGlobal(e.target);

            // Update any visible calculators
            updateAllCalculators();

            // Also update prospectus DPS maturities
            try { updateProspectusDPSMaturities(); } catch (err) { /* ignore if not present */ }
        }
    });

    // Save rate from input to global storage
    function saveRateToGlobal(input) {
        const value = parseFloat(input.value);
        if (isNaN(value)) return;

        // Prospectus DPS installment (special case, not a rate)
        if (input.id === 'prospectus-dps-installment') {
            window.currentProspectusDPSInstallment = value;
            console.log('Saved prospectus DPS installment:', value);
            return;
        }

        // FDR Double Rate
        if (input.id === 'fdrDoubleRate') {
            window.currentRates.fdrDouble = value;
            console.log('Saved FDR Double rate:', value);
            return;
        }

        // Find which table this input belongs to
        const card = input.closest('.scheme-card');
        if (!card) return;

        const cardTitle = card.querySelector('h3')?.textContent || '';

        // FDR Fixed
        if (cardTitle.includes('ফিক্সড ডিপোজিট')) {
            const row = input.closest('tr');
            const rowIndex = Array.from(row.parentElement.children).indexOf(row);
            if (rowIndex === 0) window.currentRates.fdrFixed.day360 = value;
            else if (rowIndex === 1) window.currentRates.fdrFixed.day180 = value;
            else if (rowIndex === 2) window.currentRates.fdrFixed.day90 = value;
            console.log('Saved FDR Fixed rate:', window.currentRates.fdrFixed);
        }

        // DPS
        else if (cardTitle.includes('DPS')) {
            const row = input.closest('tr');
            if (!row) {
                // Not a row input (handled above), ignore
                return;
            }
            const rowIndex = Array.from(row.parentElement.children).indexOf(row);
            const inputs = row.querySelectorAll('.rate-input');
            const colIndex = Array.from(inputs).indexOf(input);

            const termMap = ['year1', 'year2', 'year3', 'year5', 'year10'];
            const term = termMap[rowIndex];

            if (term) {
                if (colIndex === 0) window.currentRates.dps.male[term] = value;
                else if (colIndex === 1) window.currentRates.dps.female[term] = value;
                console.log('Saved DPS rate:', window.currentRates.dps);
            }
        }

        // Earning Plus
        else if (cardTitle.includes('Earning Plus')) {
            const row = input.closest('tr');
            const inputs = row.querySelectorAll('.rate-input');
            const colIndex = Array.from(inputs).indexOf(input);

            if (colIndex === 0) window.currentRates.earningPlus.month1 = value;
            else if (colIndex === 1) window.currentRates.earningPlus.month3 = value;
            else if (colIndex === 2) window.currentRates.earningPlus.month6 = value;
            console.log('Saved Earning Plus rate:', window.currentRates.earningPlus);
        }
    }

    // Load Data
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            rateData = data;
            console.log('Data loaded:', rateData);
            // Auto-load Customer Prospectus
            handleTabChange('prospectus');
            // Set prospectus tab as active
            tabs.forEach(t => t.classList.remove('active'));
            const prospectusTab = Array.from(tabs).find(t => t.getAttribute('data-tab') === 'prospectus');
            if (prospectusTab) prospectusTab.classList.add('active');
        })
        .catch(err => {
            console.error('Error loading data:', err);
            // Load prospectus even if data.json fails
            handleTabChange('prospectus');
        });

    // Tab Switching - DISABLED (only prospectus is shown)
    // tabs.forEach(tab => {
    //     tab.addEventListener('click', () => {
    //         tabs.forEach(t => t.classList.remove('active'));
    //         tab.classList.add('active');
    //         const tabId = tab.getAttribute('data-tab');
    //         handleTabChange(tabId);
    //     });
    // });

    function handleTabChange(tabId) {
        switch (tabId) {
            case 'fdr-double':
                pageTitle.textContent = 'FDR Double Scheme';
                renderFDRDouble();
                setTimeout(() => window.calculateFDRDoubleCalc?.(), 100);
                break;
            case 'fdr':
                pageTitle.textContent = 'FDR Fixed Deposit';
                renderFDR();
                setTimeout(() => window.calculateFDR?.(), 100);
                break;
            case 'dps':
                pageTitle.textContent = 'DPS Scheme';
                renderDPS();
                setTimeout(() => window.calculateDPS?.(), 100);
                break;
            case 'earning-plus':
                pageTitle.textContent = 'UCB Earning Plus';
                renderEarningPlus();
                setTimeout(() => window.calculateEarningPlus?.(), 100);
                break;
            case 'millionaire':
                pageTitle.textContent = 'Multi-Millionaire Scheme';
                renderMillionaire();
                break;
            case 'prospectus':
                pageTitle.textContent = 'Customer Prospectus';
                renderProspectus();
                // Load rates from prospectus after rendering
                setTimeout(() => {
                    loadRatesFromProspectus();
                    attachProspectusListeners();
                }, 100);
                break;
        }
    }

    // --- Render Functions ---

    function renderProspectus() {
        calculatorContainer.innerHTML = `
            <div class="card prospectus-view" style="margin: 0 auto; max-width: 1100px;">
                 <!-- Print-only logo (shown only in print via CSS). Place the image at assets/ucb-print-logo.png -->
                <img id="print-logo" class="print-only-logo" src="assets/ucb-print-logo.png" alt="UCB Logo" />
                <div class="prospectus-header" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
                <div class="bank-logo">
                <i class="fa-solid fa-building-columns"></i>
                </div>
                <h2>ইউনাইটেড কমার্শিয়াল ব্যাংক পিএল সি</h2>
                <input type="text" id="prospectus-branch-name" class="branch-name" value="কাশিনাথপুর শাখা" style="border:none; background:transparent; font-size:18px; color:#64748b; font-weight:500; letter-spacing:1px; padding:0; margin:0; text-align:center;" />
                <div class="header-decoration"></div>
                <div class="button-group" style="display:flex; gap:8px;">
                <button class="save-btn" onclick="saveProspectusRates()">
                    <i class="fa-solid fa-floppy-disk"></i> Save Rates
                </button>
                <button class="print-btn" onclick="window.print()">
                    <i class="fa-solid fa-print"></i> Print PDF
                </button>
                </div>
            </div>

            <div class="prospectus-grid">
                <!-- FDR Double Scheme -->
                <div class="scheme-card">
                <div class="card-header">
                    <span style="font-size:1.3em;">💎</span>
                    <h3>FDR ডাবল স্কিম</h3>
                </div>
                <div class="highlight-box">
                    <span class="label">মেয়াদ ও হার</span>
                    <div class="input-group">
                    <input type="number" id="fdrDoubleRate" value="10.80" step="0.01" oninput="calculateFDRDouble()"> %
                    </div>
                    <span class="value" id="fdrDoubleResult">০৬ বছর ০৯ মাস</span>
                </div>
                <div class="input-group tenure-group" style="margin-top: 10px; justify-content: center;">
                    <input type="number" id="fdrDoubleYears" class="tenure-input" value="6" oninput="calculateFDRDoubleRate()"> বছর
                    <input type="number" id="fdrDoubleMonths" class="tenure-input" value="9" oninput="calculateFDRDoubleRate()"> মাস
                </div>
                </div>

                <!-- FDR Fixed Deposit -->
                <div class="scheme-card">
                <div class="card-header">
                    <span style="font-size:1.3em;">💎</span>
                    <h3>FDR ফিক্সড ডিপোজিট</h3>
                </div>
                <table class="rate-table">
                    <thead>
                    <tr>
                        <th>ক্রমিক</th>
                        <th>মেয়াদ</th>
                        <th>রেট</th>
                        <th>মাসিক মুনাফা (লাখে)</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>1</td>
                        <td>৩৬০ দিন</td>
                        <td><input type="number" class="rate-input" value="11.50" step="0.01" oninput="calculateFDRFixed(this)">%</td>
                        <td class="profit-value">958.33 টাকা</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>১৮০ দিন</td>
                        <td><input type="number" class="rate-input" value="11.00" step="0.01" oninput="calculateFDRFixed(this)">%</td>
                        <td class="profit-value">916.66 টাকা</td>
                    </tr>
                    <tr>
                        <td>3</td>
                        <td>৯০ দিন</td>
                        <td><input type="number" class="rate-input" value="10.75" step="0.01" oninput="calculateFDRFixed(this)">%</td>
                        <td class="profit-value">895.83 টাকা</td>
                    </tr>
                    </tbody>
                </table>
                </div>

                <!-- DPS -->
                <div class="scheme-card">
                <div class="card-header">
                    <span style="font-size:1.3em;">💎</span>
                    <h3 style="display:flex; align-items:center; gap:8px;">
                        DPS স্কিম কিস্তি
                        <input type="number" id="prospectus-dps-installment" value="3000" step="1" style="width:80px; padding:4px; font-weight:normal;" oninput="updateProspectusDPSMaturities()">
                        <label style="font-weight:normal; font-size:0.9rem; color:#666;">টাকা</label>
                    </h3>
                </div>
                <table class="rate-table">
                    <thead>
                    <tr>
                        <th>ক্রমিক</th>
                        <th>মেয়াদ</th>
                        <th>রেট (পুরুষ)</th>
                        <th>রেট (নারী)</th>
                        <th>ম্যাচুরিটি (পুরুষ)</th>
                        <th>ম্যাচুরিটি (নারী)</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>1</td>
                        <td>০১ বছর</td>
                        <td><input type="number" class="rate-input" value="9.50" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td><input type="number" class="rate-input" value="9.75" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td class="dps-maturity male">0</td>
                        <td class="dps-maturity female">0</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>০২ বছর</td>
                        <td><input type="number" class="rate-input" value="9.50" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td><input type="number" class="rate-input" value="9.75" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td class="dps-maturity male">0</td>
                        <td class="dps-maturity female">0</td>
                    </tr>
                    <tr>
                        <td>3</td>
                        <td>০৩ বছর</td>
                        <td><input type="number" class="rate-input" value="9.75" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td><input type="number" class="rate-input" value="10.00" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td class="dps-maturity male">0</td>
                        <td class="dps-maturity female">0</td>
                    </tr>
                    <tr>
                        <td>4</td>
                        <td>০৫ বছর</td>
                        <td><input type="number" class="rate-input" value="10.00" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td><input type="number" class="rate-input" value="10.25" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td class="dps-maturity male">0</td>
                        <td class="dps-maturity female">0</td>
                    </tr>
                    <tr>
                        <td>5</td>
                        <td>১০ বছর</td>
                        <td><input type="number" class="rate-input" value="10.00" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td><input type="number" class="rate-input" value="10.25" step="0.01" oninput="calculateProspectusDPSRow(this)">%</td>
                        <td class="dps-maturity male">0</td>
                        <td class="dps-maturity female">0</td>
                    </tr>
                    </tbody>
                </table>
                </div>

                <!-- UCB Earning Plus -->
                <div class="scheme-card full-width">
                <div class="card-header">
                    <span style="font-size:1.3em;">💎</span>
                    <h3>UCB Earning Plus</h3>
                    <span class="subtitle" style="display:flex; align-items:center; gap:8px;">
                    মাসিক মুনাফা ভিত্তিক 
                    <span>(</span>
                    <input type="number" id="prospectus-earning-plus-base" value="100000" step="1000" style="width:100px; padding:4px; font-size:0.9rem;" oninput="updateProspectusEarningPlusProfits()">
                    <span>টাকায়)</span>
                    </span>
                </div>
                <div class="table-responsive">
                    <table class="rate-table complex-table" id="earningPlusTable">
                    <thead>
                        <tr>
                        <th rowspan="2">মেয়াদ</th>
                        <th colspan="2">১ মাস অন্তর</th>
                        <th colspan="2">৩ মাস অন্তর</th>
                        <th colspan="2">৬ মাস অন্তর</th>
                        </tr>
                        <tr>
                        <th>রেট</th>
                        <th>মুনাফা</th>
                        <th>রেট</th>
                        <th>মুনাফা</th>
                        <th>রেট</th>
                        <th>মুনাফা</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                        <td>০১ বছর</td>
                        <td><input type="number" class="rate-input" value="9.75" step="0.01" data-term="1" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-1">813 টাকা</td>
                        <td><input type="number" class="rate-input" value="10.00" step="0.01" data-term="3" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-3">2,500 টাকা</td>
                        <td><input type="number" class="rate-input" value="10.25" step="0.01" data-term="6" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-6">5,125 টাকা</td>
                        </tr>
                        <tr>
                        <td>০২ বছর</td>
                        <td><input type="number" class="rate-input" value="9.75" step="0.01" data-term="1" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-1">813 টাকা</td>
                        <td><input type="number" class="rate-input" value="10.00" step="0.01" data-term="3" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-3">2,500 টাকা</td>
                        <td><input type="number" class="rate-input" value="10.25" step="0.01" data-term="6" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-6">5,125 টাকা</td>
                        </tr>
                        <tr>
                        <td>০৩ বছর</td>
                        <td><input type="number" class="rate-input" value="9.75" step="0.01" data-term="1" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-1">813 টাকা</td>
                        <td><input type="number" class="rate-input" value="10.00" step="0.01" data-term="3" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-3">2,500 টাকা</td>
                        <td><input type="number" class="rate-input" value="10.25" step="0.01" data-term="6" oninput="calculateEarningPlusRow(this)">%</td>
                        <td class="profit-6">5,125 টাকা</td>
                        </tr>
                    </tbody>
                    </table>
                </div>
                </div>

                <!-- Multi-Millionaire -->
                <div class="scheme-card full-width">
                <div class="card-header">
                    <span style="font-size:1.3em;">💎</span>
                    <h3>Multi-Millionaire</h3>
                    <span class="subtitle">লক্ষ্য পূরণের কিস্তি</span>
                </div>
                <div class="table-responsive">
                    <table class="rate-table">
                    <thead>
                        <tr>
                        <th>মেয়াদ</th>
                        <th>১০ লক্ষ টাকার জন্য</th>
                        <th>মেয়াদ</th>
                        <th>৫০ লক্ষ টাকার জন্য</th>
                        <th>মেয়াদ</th>
                        <th>১ কোটি টাকার জন্য</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                        <td>০৫ বছর</td>
                        <td>১২,৯৪৯ টাকা</td>
                        <td>০৭ বছর</td>
                        <td>৪১,৬৬৩ টাকা</td>
                        <td>১০ বছর</td>
                        <td>৪৮,৯৪৭ টাকা</td>
                        </tr>
                        <tr>
                        <td>০৬ বছর</td>
                        <td>১০,২৪৬ টাকা</td>
                        <td>০৮ বছর</td>
                        <td>৩৪,৫৬৩ টাকা</td>
                        <td>১১ বছর</td>
                        <td>৪২,০৩৩ টাকা</td>
                        </tr>
                        <tr>
                        <td>০৭ বছর</td>
                        <td>৮,৩৩৩ টাকা</td>
                        <td>০৯ বছর</td>
                        <td>২৯,১০৭ টাকা</td>
                        <td>১২ বছর</td>
                        <td>৩৬,৩৬৯ টাকা</td>
                        </tr>
                        <tr>
                        <td>০৮ বছর</td>
                        <td>৬,৯১৩ টাকা</td>
                        <td>১০ বছর</td>
                        <td>২৪,৮০১ টাকা</td>
                        <td>১৩ বছর</td>
                        <td>৩১,৬৬৫ টাকা</td>
                        </tr>
                        <tr>
                        <td>০৯ বছর</td>
                        <td>৫,৮২২ টাকা</td>
                        <td>১১ বছর</td>
                        <td>২১,৩৩০ টাকা</td>
                        <td>১৪ বছর</td>
                        <td>২৭,৭১৩ টাকা</td>
                        </tr>
                        <tr>
                        <td>১০ বছর</td>
                        <td>৪,৯৬১ টাকা</td>
                        <td>১২ বছর</td>
                        <td>১৮,৪৮৪ টাকা</td>
                        <td>১৫ বছর</td>
                        <td>২৪,৩৬১ টাকা</td>
                        </tr>
                    </tbody>
                    </table>
                </div>
                </div>
            </div>
            
            <div class="footer-info">
                <div class="contact-card">
                <i class="fa-solid fa-user-tie"></i>
                <div>
                    <input type="text" id="prospectus-contact-name" value="মোঃ সারোয়ার রেজা" style="border:none; background:transparent; font-weight:700; font-size:16px; color:#1e293b; padding:0; margin:0;" />
                    <input type="text" id="prospectus-contact-title" value="শাখা প্রধান" style="border:none; background:transparent; color:#64748b; padding:0; margin:0;" />
                    <input type="text" id="prospectus-contact-phone" value="০১৭১৩-১০৮৭৬২" style="border:none; background:transparent; color:#64748b; padding:0; margin:0;" />
                </div>
                </div>
            </div>

            <div class="bottom-note" style="margin-top: 15mm; padding-top: 10mm; border-top: 1px solid #cbd5e1; font-size: 8px; color: #64748b; line-height: 1.6; text-align: justify; font-family: 'Noto Sans Bengali', 'Poppins', sans-serif;">
                <strong>নোট:</strong> সরকারি বিধান অনুযায়ী প্রযোজ্য সকল Tax ও Excise Duty গ্রাহক কর্তৃক বহনযোগ্য।
            </div>
            </div>

            <!-- Page 2: DPS Super Flex Maturity Table -->
            <div class="card prospectus-view page-2" style="page-break-before: always; margin: 20px auto 0; max-width: 1100px;">
            <div class="prospectus-header" style="display:flex; flex-direction:column; align-items:center; text-align:center;">
                <h2 style="font-size:20px; margin-bottom:5px; font-weight:700;">ইউনাইটেড কমার্শিয়াল ব্যাংক পিএলসি</h2>
                <h3 style="font-size:16px; margin-bottom:3px; font-weight:600;">ডিপিএস স্কিমের ম্যাচুরিটি মূল্য</h3>
                <h3 style="font-size:16px; margin-bottom:15px; font-weight:600;">সুপার ফ্লেক্স ডিপোজিট স্কিম</h3>
            </div>

            <div class="dps-superflex-container">
                <table class="rate-table dps-superflex-table">
                <thead>
                    <tr>
                    <th rowspan="2" style="vertical-align: middle;">মাসিক কিস্তি</th>
                    <th colspan="5" style="border-bottom: 1px solid #cbd5e1;">পুরুষ (সুপার ফ্লেক্স ডিপোজিট স্কিম)</th>
                    <th colspan="5" style="border-bottom: 1px solid #cbd5e1;">নারী (সুপার ফ্লেক্স ডিপোজিট স্কিম)</th>
                    </tr>
                    <tr>
                    <th>১ বছর</th>
                    <th>২ বছর</th>
                    <th>৩ বছর</th>
                    <th>৫ বছর</th>
                    <th>১০ বছর</th>
                    <th>১ বছর</th>
                    <th>২ বছর</th>
                    <th>৩ বছর</th>
                    <th>৫ বছর</th>
                    <th>১০ বছর</th>
                    </tr>
                    <tr style="background-color: #f8fafc;">
                    <th></th>
                    <th>৯.৫০%</th>
                    <th>৯.৫০%</th>
                    <th>৯.৭৫%</th>
                    <th>१०.००%</th>
                    <th>１０.००%</th>
                    <th>９.７५%</th>
                    <th>९.७५%</th>
                    <th>１０.００%</th>
                    <th>１０.२५%</th>
                    <th>１０.२५%</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                    <td style="font-weight:600;">১,০০০ টাকা</td>
                    <td></td>
                    <td></td>
                    <td>41,961.60</td>
                    <td>78,082.38</td>
                    <td>206,552.02</td>
                    <td></td>
                    <td></td>
                    <td>42,130.00</td>
                    <td>78,616.68</td>
                    <td>209,578.70</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">২,০০০ টাকা</td>
                    <td></td>
                    <td></td>
                    <td>83,923.20</td>
                    <td>156,164.76</td>
                    <td>413,104.04</td>
                    <td></td>
                    <td></td>
                    <td>84,260.01</td>
                    <td>157,233.35</td>
                    <td>419,157.41</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">৩,০০০ টাকা</td>
                    <td></td>
                    <td></td>
                    <td>125,884.80</td>
                    <td>234,247.14</td>
                    <td>619,656.06</td>
                    <td></td>
                    <td></td>
                    <td>126,390.01</td>
                    <td>235,850.03</td>
                    <td>628,736.11</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">৪,০০০  টাকা</td>
                    <td></td>
                    <td></td>
                    <td>167,846.41</td>
                    <td>312,329.52</td>
                    <td>826,208.08</td>
                    <td></td>
                    <td></td>
                    <td>168,520.01</td>
                    <td>314,466.70</td>
                    <td>838,314.82</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">৫,০০০  টাকা</td>
                    <td>63,178.92</td>
                    <td>132,628.20</td>
                    <td>209,808.01</td>
                    <td>390,411.91</td>
                    <td>1,032,760.10</td>
                    <td>63,265.10</td>
                    <td>132,981.80</td>
                    <td>210,650.01</td>
                    <td>393,083.38</td>
                    <td>1,047,893.52</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">১০,০০০  টাকা</td>
                    <td>126,357.85</td>
                    <td>265,256.40</td>
                    <td>419,616.01</td>
                    <td>780,823.81</td>
                    <td>2,065,520.20</td>
                    <td>126,530.20</td>
                    <td>265,963.59</td>
                    <td>421,300.03</td>
                    <td>786,166.76</td>
                    <td>2,095,787.04</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">১৫,০০০  টাকা</td>
                    <td>189,536.77</td>
                    <td>397,884.60</td>
                    <td>629,424.02</td>
                    <td>1,171,235.72</td>
                    <td>3,098,280.31</td>
                    <td>189,795.29</td>
                    <td>398,945.39</td>
                    <td>631,950.04</td>
                    <td>1,179,250.14</td>
                    <td>3,143,680.57</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">২০,০০০  টাকা</td>
                    <td>252,715.69</td>
                    <td>530,512.80</td>
                    <td>839,232.03</td>
                    <td>1,561,647.62</td>
                    <td>4,131,040.41</td>
                    <td>253,060.39</td>
                    <td>531,927.18</td>
                    <td>842,600.06</td>
                    <td>1,572,333.52</td>
                    <td>4,191,574.09</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">২৫,০০০  টাকা</td>
                    <td>315,894.61</td>
                    <td>663,141.00</td>
                    <td>1,049,040.04</td>
                    <td>1,952,059.53</td>
                    <td>5,163,800.51</td>
                    <td>316,325.49</td>
                    <td>664,908.98</td>
                    <td>1,053,250.07</td>
                    <td>1,965,416.90</td>
                    <td>5,239,467.61</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">৩০,০০০  টাকা</td>
                    <td>379,073.54</td>
                    <td>795,769.20</td>
                    <td>1,258,848.04</td>
                    <td>2,342,471.43</td>
                    <td>6,196,560.61</td>
                    <td>379,590.59</td>
                    <td>797,890.77</td>
                    <td>1,263,900.09</td>
                    <td>2,358,500.28</td>
                    <td>6,287,361.13</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">৩৫,০০০  টাকা</td>
                    <td>442,252.46</td>
                    <td>928,397.40</td>
                    <td>1,468,656.05</td>
                    <td>2,732,883.34</td>
                    <td>7,229,320.71</td>
                    <td>442,855.69</td>
                    <td>930,872.57</td>
                    <td>1,474,550.10</td>
                    <td>2,751,583.66</td>
                    <td>7,335,254.65</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">৪০,০০০  টাকা</td>
                    <td>505,431.38</td>
                    <td>1,061,025.61</td>
                    <td>1,678,464.06</td>
                    <td>3,123,295.24</td>
                    <td>8,262,080.82</td>
                    <td>506,120.79</td>
                    <td>1,063,854.36</td>
                    <td>1,685,200.12</td>
                    <td>3,144,667.04</td>
                    <td>8,383,148.18</td>
                    </tr>
                    <tr>
                    <td style="font-weight:600;">৫০,০০০  টাকা</td>
                    <td>631,789.23</td>
                    <td>1,326,282.01</td>
                    <td>2,098,080.07</td>
                    <td>3,904,119.06</td>
                    <td>10,327,601.02</td>
                    <td>632,650.98</td>
                    <td>1,329,817.95</td>
                    <td>2,106,500.15</td>
                    <td>3,930,833.80</td>
                    <td>10,478,935.22</td>
                    </tr>
                </tbody>
                </table>
            </div>
            </div>
        `;

        // Initialize calculations
        calculateFDRDouble();

        // Load initial rates from inputs
        setTimeout(() => {
            loadRatesFromProspectus();
            updateSuperFlexTable();
        }, 100);
    }

    // Update Super Flex table rates from DPS স্কিম
    function updateSuperFlexTable() {
        const prospectusView = document.querySelector('.prospectus-view');
        if (!prospectusView) return;

        // Get DPS rates from prospectus
        const dpsCard = Array.from(prospectusView.querySelectorAll('.scheme-card')).find(card => 
            card.querySelector('h3') && card.querySelector('h3').textContent.includes('DPS')
        );
        if (!dpsCard) return;

        const rateInputs = dpsCard.querySelectorAll('.rate-input');
        const rates = {
            male: [],
            female: []
        };

        // Extract rates (male and female alternate in rows)
        const rows = dpsCard.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const inputs = row.querySelectorAll('.rate-input');
            if (inputs.length >= 2) {
                rates.male.push(parseFloat(inputs[0].value) || 0);
                rates.female.push(parseFloat(inputs[1].value) || 0);
            }
        });

        // Update the Super Flex table header rates
        const superFlexTable = document.querySelector('.dps-superflex-table');
        if (!superFlexTable) return;

        const rateRow = superFlexTable.querySelectorAll('thead tr')[2];
        if (rateRow) {
            const rateCells = rateRow.querySelectorAll('th');
            // Update male rates (columns 1-5)
            if (rates.male.length >= 5) {
                rateCells[1].textContent = rates.male[0].toFixed(2) + '%';
                rateCells[2].textContent = rates.male[1].toFixed(2) + '%';
                rateCells[3].textContent = rates.male[2].toFixed(2) + '%';
                rateCells[4].textContent = rates.male[3].toFixed(2) + '%';
                rateCells[5].textContent = rates.male[4].toFixed(2) + '%';
            }
            // Update female rates (columns 6-10)
            if (rates.female.length >= 5) {
                rateCells[6].textContent = rates.female[0].toFixed(2) + '%';
                rateCells[7].textContent = rates.female[1].toFixed(2) + '%';
                rateCells[8].textContent = rates.female[2].toFixed(2) + '%';
                rateCells[9].textContent = rates.female[3].toFixed(2) + '%';
                rateCells[10].textContent = rates.female[4].toFixed(2) + '%';
            }
        }

        // Update maturity values for each EMI amount
        updateSuperFlexMaturityValues(rates);
    }

    // Calculate and update all maturity values in Super Flex table
    function updateSuperFlexMaturityValues(rates) {
        const superFlexTable = document.querySelector('.dps-superflex-table');
        if (!superFlexTable) return;

        const emiAmounts = [1000, 2000, 3000, 4000, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 50000];
        const termYears = [1, 2, 3, 5, 10];

        const tbody = superFlexTable.querySelector('tbody');
        if (!tbody) return;

        const rows = tbody.querySelectorAll('tr');
        
        rows.forEach((row, rowIndex) => {
            if (rowIndex >= emiAmounts.length) return;
            
            const emi = emiAmounts[rowIndex];
            const cells = row.querySelectorAll('td');

            // Calculate for each term (5 terms for male, 5 for female)
            termYears.forEach((years, termIndex) => {
                const maleRate = rates.male[termIndex] || 0;
                const femaleRate = rates.female[termIndex] || 0;

                // Calculate male maturity
                const maleMaturity = calculateDPSMaturity(emi, maleRate, years);
                // Calculate female maturity
                const femaleMaturity = calculateDPSMaturity(emi, femaleRate, years);

                // Update cells (1-5 for male, skip empty cells; 6-10 for female, skip empty cells)
                const maleCellIndex = termIndex + 1; // columns 1-5
                const femaleCellIndex = termIndex + 6; // columns 6-10

                if (cells[maleCellIndex]) {
                    cells[maleCellIndex].textContent = maleMaturity > 0 ? toBanglaNumber(maleMaturity.toLocaleString('en-US', {maximumFractionDigits: 2})) : '';
                }
                if (cells[femaleCellIndex]) {
                    cells[femaleCellIndex].textContent = femaleMaturity > 0 ? toBanglaNumber(femaleMaturity.toLocaleString('en-US', {maximumFractionDigits: 2})) : '';
                }
            });
        });

        // Convert all numbers in the Super Flex table to Bangla
        convertTableToBangla(superFlexTable);
    }

    // Convert all numbers in the Super Flex table to Bangla
    function convertTableToBangla(table) {
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach((cell, index) => {
                // Skip the first cell (EMI amount, already in Bangla)
                if (index > 0 && cell.textContent) {
                    cell.textContent = toBanglaNumber(cell.textContent);
                }
            });
        });

        // Convert rate percentages in header
        const rateRow = table.querySelectorAll('thead tr')[2];
        if (rateRow) {
            const rateCells = rateRow.querySelectorAll('th');
            rateCells.forEach((cell, index) => {
                if (index > 0 && cell.textContent) {
                    cell.textContent = toBanglaNumber(cell.textContent);
                }
            });
        }
    }

    // Calculate DPS maturity for given parameters
    function calculateDPSMaturity(monthlyInstallment, annualRate, years) {
        const n = years * 12;
        const i = (annualRate / 100) / 12;
        let maturity = 0;
        
        if (i > 0) {
            maturity = monthlyInstallment * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        } else {
            maturity = monthlyInstallment * n;
        }
        
        return Math.round(maturity * 100) / 100;
    }

    // Load all rates from prospectus inputs into global storage
    function loadRatesFromProspectus() {
        console.log('Loading rates from prospectus...');
        const prospectusView = document.querySelector('.prospectus-view');
        if (!prospectusView) {
            console.log('Prospectus view not found');
            return;
        }

        // Load FDR Double rate
        const fdrDoubleInput = document.getElementById('fdrDoubleRate');
        if (fdrDoubleInput) {
            window.currentRates.fdrDouble = parseFloat(fdrDoubleInput.value);
            console.log('Loaded FDR Double:', window.currentRates.fdrDouble);
        }

        // Load all rates from all inputs
        const allInputs = prospectusView.querySelectorAll('input[type="number"]');
        allInputs.forEach(input => {
            saveRateToGlobal(input);
        });

        console.log('All rates loaded:', window.currentRates);
        // Update prospectus DPS maturity cells after loading rates
        try { updateProspectusDPSMaturities(); } catch (e) { console.error(e); }
    }

    // Attach event listeners to prospectus rate inputs
    function attachProspectusListeners() {
        console.log('Attaching prospectus listeners...');

        // Use MutationObserver to watch for all input changes
        const prospectusView = document.querySelector('.prospectus-view');
        if (!prospectusView) {
            console.log('Prospectus view not found');
            return;
        }

        // Get all rate inputs and attach direct listeners
        const allInputs = prospectusView.querySelectorAll('input[type="number"]');
        console.log('Found', allInputs.length, 'inputs to attach listeners to');

        allInputs.forEach((input, idx) => {
            // Remove old listeners by cloning
            const newInput = input.cloneNode(true);
            input.parentNode.replaceChild(newInput, input);

            // Attach new listeners
            newInput.addEventListener('input', function () {
                console.log('Input changed:', this.value);
                updateAllCalculators();
            });

            newInput.addEventListener('change', function () {
                console.log('Input finalized:', this.value);
                updateAllCalculators();
            });
        });

        console.log('Prospectus listeners attached successfully');
    }

    // Update all calculator tabs with current prospectus rates
    function updateAllCalculators() {
        console.log('=== Updating all calculators ===');

        // Update FDR Double
        if (document.getElementById('fdr-double-amount')) {
            console.log('Updating FDR Double');
            window.calculateFDRDoubleCalc?.();
        }

        // Update FDR Fixed
        if (document.getElementById('fdr-amount')) {
            console.log('Updating FDR Fixed');
            window.calculateFDR?.();
        }

        // Update DPS
        if (document.getElementById('dps-amount')) {
            console.log('Updating DPS');
            window.calculateDPS?.();
        }

        // Update Earning Plus
        if (document.getElementById('ep-amount')) {
            console.log('Updating Earning Plus');
            window.calculateEarningPlus?.();
        }
    }

    // Make it globally accessible
    window.updateAllCalculators = updateAllCalculators;

    // Legacy function for backward compatibility
    function attachRateUpdateListeners() {
        attachProspectusListeners();
    }

    // Save Prospectus Rates
    window.saveProspectusRates = function () {
        try {
            // Collect all rates from the prospectus
            const rates = {
                fdrDouble: document.getElementById('fdrDoubleRate')?.value || '',
                fdrFixed: {
                    day360: document.querySelector('.scheme-card .rate-table .rate-input[value="11.50"]')?.value || '',
                    day180: document.querySelector('.scheme-card .rate-table .rate-input[value="11.00"]')?.value || '',
                    day90: document.querySelector('.scheme-card .rate-table .rate-input[value="10.75"]')?.value || ''
                },
                dps: {},
                earningPlus: {}
            };

            // Get all rate inputs from the prospectus tables
            const allRateInputs = document.querySelectorAll('.prospectus-view .rate-input');
            const savedData = {};

            allRateInputs.forEach((input, index) => {
                savedData[`rate_${index}`] = input.value;
            });

            // Also save prospectus DPS installment if present
            const prospectusInstall = document.getElementById('prospectus-dps-installment');
            if (prospectusInstall) savedData['prospectus_dps_installment'] = prospectusInstall.value;

            // Save branch name if present
            const prospectusBranch = document.getElementById('prospectus-branch-name');
            if (prospectusBranch) savedData['branch_name'] = prospectusBranch.value;

            // Save primary contact fields if present
            const prospectusContactName = document.getElementById('prospectus-contact-name');
            if (prospectusContactName) savedData['contact_name'] = prospectusContactName.value;
            const prospectusContactTitle = document.getElementById('prospectus-contact-title');
            if (prospectusContactTitle) savedData['contact_title'] = prospectusContactTitle.value;
            const prospectusContactPhone = document.getElementById('prospectus-contact-phone');
            if (prospectusContactPhone) savedData['contact_phone'] = prospectusContactPhone.value;

            // Save to localStorage
            localStorage.setItem('bankRates', JSON.stringify(savedData));

            // Show success message
            alert('✓ Rates saved successfully!');
            console.log('Saved rates:', savedData);
        } catch (error) {
            console.error('Error saving rates:', error);
            alert('Error saving rates. Please try again.');
        }
    };

    // Load Saved Rates on page load
    function loadSavedRates() {
        try {
            const savedData = localStorage.getItem('bankRates');
            if (savedData) {
                const rates = JSON.parse(savedData);
                const allRateInputs = document.querySelectorAll('.prospectus-view .rate-input');

                allRateInputs.forEach((input, index) => {
                    const key = `rate_${index}`;
                    if (rates[key]) {
                        input.value = rates[key];
                    }
                });

                // Restore prospectus DPS installment if saved
                const prospectusInstall = document.getElementById('prospectus-dps-installment');
                if (prospectusInstall && rates['prospectus_dps_installment']) {
                    prospectusInstall.value = rates['prospectus_dps_installment'];
                }

                // Restore branch name if saved (keep same position)
                const prospectusBranch = document.getElementById('prospectus-branch-name');
                if (prospectusBranch && rates['branch_name']) {
                    prospectusBranch.value = rates['branch_name'];
                }
                // Restore primary contact fields if saved
                const prospectusContactName = document.getElementById('prospectus-contact-name');
                if (prospectusContactName && rates['contact_name']) {
                    prospectusContactName.value = rates['contact_name'];
                }
                const prospectusContactTitle = document.getElementById('prospectus-contact-title');
                if (prospectusContactTitle && rates['contact_title']) {
                    prospectusContactTitle.value = rates['contact_title'];
                }
                const prospectusContactPhone = document.getElementById('prospectus-contact-phone');
                if (prospectusContactPhone && rates['contact_phone']) {
                    prospectusContactPhone.value = rates['contact_phone'];
                }
                // Update DPS maturities after restoring values
                try { updateProspectusDPSMaturities(); } catch (e) { }
                console.log('Rates loaded from storage');
            }
        } catch (error) {
            console.error('Error loading saved rates:', error);
        }
    }

    // Load saved rates when prospectus is rendered
    const originalRenderProspectus = renderProspectus;
    renderProspectus = function () {
        originalRenderProspectus.call(this);
        // Load saved rates after rendering
        setTimeout(loadSavedRates, 100);
    };

    // Calculation Functions for Prospectus
    window.calculateFDRDouble = function () {
        const rate = parseFloat(document.getElementById('fdrDoubleRate').value);
        const resultEl = document.getElementById('fdrDoubleResult');
        const yearsInput = document.getElementById('fdrDoubleYears');
        const monthsInput = document.getElementById('fdrDoubleMonths');

        if (rate > 0) {
            // Formula: Years = log(2) / log(1 + rate)
            const years = Math.log(2) / Math.log(1 + rate / 100);

            const totalMonths = Math.round(years * 12);
            const y = Math.floor(totalMonths / 12);
            const m = totalMonths % 12;

            // Update display text
            const banglaY = y.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
            const banglaM = m.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
            resultEl.textContent = `${banglaY.padStart(2, '০')} বছর ${banglaM.padStart(2, '০')} মাস`;

            // Update inputs if they are not the active element (to avoid fighting user input)
            if (document.activeElement !== yearsInput && document.activeElement !== monthsInput) {
                yearsInput.value = y;
                monthsInput.value = m;
            }
        }
    };

    window.calculateFDRDoubleRate = function () {
        const years = parseInt(document.getElementById('fdrDoubleYears').value) || 0;
        const months = parseInt(document.getElementById('fdrDoubleMonths').value) || 0;
        const rateInput = document.getElementById('fdrDoubleRate');

        const totalYears = years + (months / 12);

        if (totalYears > 0) {
            // Formula: Rate = (2^(1/Years) - 1) * 100
            const rate = (Math.pow(2, 1 / totalYears) - 1) * 100;

            // Update rate input if it's not active
            if (document.activeElement !== rateInput) {
                rateInput.value = rate.toFixed(2);
            }

            // Also update the text display
            const banglaY = years.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
            const banglaM = months.toString().replace(/\d/g, d => "০১২৩৪৫৬৭৮৯"[d]);
            document.getElementById('fdrDoubleResult').textContent = `${banglaY.padStart(2, '০')} বছর ${banglaM.padStart(2, '০')} মাস`;
        }
    };

    window.calculateFDRFixed = function (input) {
        const rate = parseFloat(input.value);
        const row = input.closest('tr');
        const profitCell = row.querySelector('.profit-value');

        if (rate > 0) {
            // Monthly profit per lakh = 100,000 * Rate% / 12
            const profit = (100000 * (rate / 100)) / 12;
            profitCell.textContent = profit.toFixed(2) + ' টাকা';
        }
    };

    window.calculateEarningPlusRow = function (input) {
        const rate = parseFloat(input.value);
        const term = parseInt(input.dataset.term); // 1, 3, or 6 months
        const row = input.closest('tr');
        const profitCell = row.querySelector(`.profit-${term}`);

        if (rate > 0) {
            // Read base amount from prospectus input if present, otherwise default to 100000
            const prospectusBaseEl = document.getElementById('prospectus-earning-plus-base');
            const baseAmount = prospectusBaseEl ? (parseFloat(prospectusBaseEl.value) || 100000) : 100000;
            // Formula: Base * Rate% * (Months / 12)
            const profit = baseAmount * (rate / 100) * (term / 12);

            // Format with commas and append currency
            profitCell.textContent = Math.round(profit).toLocaleString('en-US') + ' টাকা';
        }
    };

    // Calculate and display maturity for a prospectus DPS row when rate inputs change
    window.calculateProspectusDPSRow = function (input) {
        const row = input.closest('tr');
        if (!row) return;

        // Determine the row index to map term
        const tbody = row.parentElement;
        const rowIndex = Array.from(tbody.children).indexOf(row);
        const termMap = [1, 2, 3, 5, 10];
        const termYears = termMap[rowIndex] || 1;

        // Determine whether this input is male or female based on its column position
        const inputs = row.querySelectorAll('.rate-input');
        const colIndex = Array.from(inputs).indexOf(input);
        const gender = colIndex === 0 ? 'male' : 'female';

        const rate = parseFloat(input.value) || 0;
        // Read monthly installment from prospectus input if present, otherwise default to 3000
        const prospectusInstallEl = document.getElementById('prospectus-dps-installment');
        const monthlyInstallment = prospectusInstallEl ? (parseFloat(prospectusInstallEl.value) || 3000) : 3000;

        // Use the same formula as calculateDPS
        const n = termYears * 12;
        const i = (rate / 100) / 12;
        let maturity = 0;
        if (i > 0) {
            maturity = monthlyInstallment * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
        } else {
            maturity = monthlyInstallment * n;
        }

        // Find the corresponding maturity cell in the row
        const maleCell = row.querySelector('.dps-maturity.male');
        const femaleCell = row.querySelector('.dps-maturity.female');

        if (gender === 'male' && maleCell) {
            maleCell.textContent = Math.round(maturity).toLocaleString() + ' টাকা';
        } else if (gender === 'female' && femaleCell) {
            femaleCell.textContent = Math.round(maturity).toLocaleString() + ' টাকা';
        }

        // Update Super Flex table when DPS rates change
        updateSuperFlexTable();
    };

    // Update all DPS maturities in the prospectus (call after loading rates)
    function updateProspectusDPSMaturities() {
        const prospectusView = document.querySelector('.prospectus-view');
        if (!prospectusView) return;
        const dpsCard = Array.from(prospectusView.querySelectorAll('.scheme-card')).find(card => card.querySelector('h3') && card.querySelector('h3').textContent.includes('DPS'));
        if (!dpsCard) return;
        const inputs = dpsCard.querySelectorAll('.rate-input');
        inputs.forEach(inp => {
            window.calculateProspectusDPSRow(inp);
        });
    }

    // Update all Earning Plus profit cells in prospectus when base amount changes
    window.updateProspectusEarningPlusProfits = function () {
        const prospectusView = document.querySelector('.prospectus-view');
        if (!prospectusView) return;
        const earningPlusCard = Array.from(prospectusView.querySelectorAll('.scheme-card')).find(card => card.querySelector('h3') && card.querySelector('h3').textContent.includes('Earning Plus'));
        if (!earningPlusCard) return;
        const inputs = earningPlusCard.querySelectorAll('.rate-input');
        inputs.forEach(inp => {
            window.calculateEarningPlusRow(inp);
        });
    };

    function renderFDRDouble() {
        calculatorContainer.innerHTML = `
            <div class="card">
                <div class="input-group">
                    <label>Deposit Amount (BDT)</label>
                    <input type="number" id="fdr-double-amount" value="100000" placeholder="Enter amount" oninput="calculateFDRDoubleCalc()">
                </div>
                <button class="calculate-btn" onclick="calculateFDRDoubleCalc()">Calculate Maturity</button>
                
                <div id="result-area" class="result-card" style="display:none;">
                    <div class="result-item">
                        <span class="result-label">Maturity Amount (Double)</span>
                        <span class="result-value highlight" id="fdr-double-maturity">0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Time Required</span>
                        <span class="result-value" id="fdr-double-time">6 Years 9 Months</span>
                    </div>
                     <div class="result-item">
                        <span class="result-label">Approx. Interest Rate</span>
                        <span class="result-value">10.80%</span>
                    </div>
                </div>
            </div>
        `;

        window.calculateFDRDoubleCalc = () => {
            const amount = parseFloat(document.getElementById('fdr-double-amount').value) || 0;
            // Use global rate
            const rate = window.currentRates.fdrDouble / 100;

            const yearsDecimal = Math.log(2) / Math.log(1 + rate);
            const totalMonths = Math.round(yearsDecimal * 12);
            const y = Math.floor(totalMonths / 12);
            const m = totalMonths % 12;

            const maturity = amount * 2;

            document.getElementById('fdr-double-maturity').textContent = maturity.toLocaleString() + ' BDT';

            // Update Time Required display
            const timeEl = document.getElementById('fdr-double-time');
            if (timeEl) {
                timeEl.textContent = `${y} Years ${m} Months`;
            }

            // Update rate display (elements that show %)
            const rateDisplays = document.querySelectorAll('.result-value');
            rateDisplays.forEach(el => {
                if (el.textContent.includes('%')) {
                    el.textContent = window.currentRates.fdrDouble.toFixed(2) + '%';
                }
            });

            console.log('FDR Double calc: rate=', window.currentRates.fdrDouble, 'time=', y, 'years', m, 'months');

            document.getElementById('result-area').style.display = 'block';
        };
    }

    function renderFDR() {
        calculatorContainer.innerHTML = `
            <div class="card">
                <div class="input-group">
                    <label>Deposit Amount (BDT)</label>
                    <input type="number" id="fdr-amount" value="100000">
                </div>
                <div class="input-group">
                    <label>Tenure</label>
                    <select id="fdr-tenure">
                        <option value="360">360 Days (1 Year)</option>
                        <option value="180">180 Days (6 Months)</option>
                        <option value="90">90 Days (3 Months)</option>
                    </select>
                </div>
                <button class="calculate-btn" onclick="calculateFDR()">Calculate</button>

                <div id="result-area" class="result-card" style="display:none;">
                    <div class="result-item">
                        <span class="result-label">Interest Rate</span>
                        <span class="result-value" id="fdr-rate">0%</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Maturity</span>
                        <span class="result-value highlight" id="fdr-total">0</span>
                    </div>
                </div>
            </div>
        `;

        window.calculateFDR = () => {
            const amount = parseFloat(document.getElementById('fdr-amount').value) || 0;
            const tenure = document.getElementById('fdr-tenure').value;
            let rate = 0;

            // Use global rates
            if (tenure === '360') rate = window.currentRates.fdrFixed.day360 / 100;
            else if (tenure === '180') rate = window.currentRates.fdrFixed.day180 / 100;
            else if (tenure === '90') rate = window.currentRates.fdrFixed.day90 / 100;

            console.log('FDR Fixed calculation - Tenure:', tenure, 'Rate:', (rate * 100).toFixed(2) + '%', 'from global:', window.currentRates.fdrFixed);

            const interest = amount * rate * (parseInt(tenure) / 360);
            const total = amount + interest;

            document.getElementById('fdr-rate').textContent = (rate * 100).toFixed(2) + '%';
            document.getElementById('fdr-total').textContent = total.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' BDT';
            document.getElementById('result-area').style.display = 'block';
        };
    }

    function renderDPS() {
        calculatorContainer.innerHTML = `
            <div class="card">
                <div class="input-group">
                    <label>মাসিক কিস্তি (টাকা)</label>
                    <input type="number" id="dps-amount" value="1000" oninput="updateDPSFromInstallment()">
                </div>
                <div class="input-group">
                    <label>প্রধান মূল্য (টাকা)</label>
                    <input type="number" id="dps-principal" value="12000" oninput="updateDPSFromPrincipal()">
                </div>
                <div class="input-group">
                    <label style="font-weight:600;">নোট:</label>
                    <span id="dps-note">DPS স্কিম 1000 টাকা</span>
                </div>
                <div class="input-group">
                    <label>Term (Years)</label>
                    <select id="dps-term">
                        <option value="1">1 Year</option>
                        <option value="2">2 Years</option>
                        <option value="3">3 Years</option>
                        <option value="5">5 Years</option>
                        <option value="10">10 Years</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Gender (For Rate)</label>
                    <select id="dps-gender">
                        <option value="man">Male</option>
                        <option value="woman">Female</option>
                    </select>
                </div>
                <button class="calculate-btn" onclick="calculateDPS()">Calculate Maturity</button>

                <div id="result-area" class="result-card" style="display:none;">
                     <div class="result-item">
                        <span class="result-label">Interest Rate</span>
                        <span class="result-value" id="dps-rate">0%</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Total Deposit</span>
                        <span class="result-value" id="dps-deposit">0</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Maturity Amount</span>
                        <span class="result-value highlight" id="dps-maturity">0</span>
                    </div>
                </div>
            </div>
        `;

        window.calculateDPS = () => {
            const amount = parseFloat(document.getElementById('dps-amount').value) || 0;
            const term = parseInt(document.getElementById('dps-term').value);
            const gender = document.getElementById('dps-gender').value;

            // Use global rates
            const ratesObj = gender === 'woman' ? window.currentRates.dps.female : window.currentRates.dps.male;
            const termMap = { 1: 'year1', 2: 'year2', 3: 'year3', 5: 'year5', 10: 'year10' };
            const rate = (ratesObj[termMap[term]] || 9.50) / 100;

            console.log('DPS calculation - Term:', term, 'Gender:', gender, 'Rate:', (rate * 100).toFixed(2) + '%', 'from global:', ratesObj);

            const n = term * 12;
            const i = rate / 12;

            let maturity = amount * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
            const totalDeposit = amount * n;

            document.getElementById('dps-rate').textContent = (rate * 100).toFixed(2) + '%';
            document.getElementById('dps-deposit').textContent = totalDeposit.toLocaleString() + ' টাকা';
            document.getElementById('dps-maturity').textContent = Math.round(maturity).toLocaleString() + ' টাকা';
            // Update the note to reflect current monthly installment
            const noteEl = document.getElementById('dps-note');
            if (noteEl) noteEl.textContent = `DPS স্কিম ${Math.round(amount).toLocaleString()} টাকা`;
            // Sync principal input with computed total deposit unless user is actively editing it
            const principalInput = document.getElementById('dps-principal');
            if (principalInput && document.activeElement !== principalInput) {
                principalInput.value = Math.round(totalDeposit);
            }
            document.getElementById('result-area').style.display = 'block';
        };
    }

    // When user edits principal, update monthly installment and recalc
    window.updateDPSFromPrincipal = function () {
        const principal = parseFloat(document.getElementById('dps-principal').value) || 0;
        const term = parseInt(document.getElementById('dps-term').value) || 1;
        const n = term * 12;
        if (n > 0) {
            const monthly = principal / n;
            const amountInput = document.getElementById('dps-amount');
            if (amountInput && document.activeElement !== amountInput) {
                amountInput.value = Math.round(monthly);
            }
        }
        // Update note
        const noteEl = document.getElementById('dps-note');
        const amountVal = parseFloat(document.getElementById('dps-amount').value) || 0;
        if (noteEl) noteEl.textContent = `DPS স্কিম ${Math.round(amountVal).toLocaleString()} টাকা`;
        // Recalculate
        window.calculateDPS?.();
    };

    // When user edits monthly installment, update principal and recalc
    window.updateDPSFromInstallment = function () {
        const amount = parseFloat(document.getElementById('dps-amount').value) || 0;
        const term = parseInt(document.getElementById('dps-term').value) || 1;
        const n = term * 12;
        const principal = amount * n;
        const principalInput = document.getElementById('dps-principal');
        if (principalInput && document.activeElement !== principalInput) {
            principalInput.value = Math.round(principal);
        }
        // Update note
        const noteEl = document.getElementById('dps-note');
        if (noteEl) noteEl.textContent = `DPS স্কিম কিস্তি${Math.round(amount).toLocaleString()} টাকা`;
        // Recalculate
        window.calculateDPS?.();
    };

    function renderEarningPlus() {
        calculatorContainer.innerHTML = `
            <div class="card">
                <h3>UCB Earning Plus</h3>
                <p style="color:var(--text-muted); margin-bottom:20px;">Monthly Profit Scheme</p>
                
                <div class="input-group">
                    <label>Deposit Amount (BDT)</label>
                    <input type="number" id="ep-amount" value="100000">
                </div>
                <div class="input-group">
                    <label>Term</label>
                    <select id="ep-term">
                        <option value="1">1 Year</option>
                        <option value="3">3 Years</option>
                        <option value="6">6 Years</option>
                    </select>
                </div>
                <div class="input-group">
                    <label>Gender</label>
                    <select id="ep-gender">
                        <option value="man">Male</option>
                        <option value="woman">Female</option>
                    </select>
                </div>
                <button class="calculate-btn" onclick="calculateEarningPlus()">Calculate Monthly Profit</button>

                <div id="result-area" class="result-card" style="display:none;">
                    <div class="result-item">
                        <span class="result-label">Interest Rate</span>
                        <span class="result-value" id="ep-rate">0%</span>
                    </div>
                    <div class="result-item">
                        <span class="result-label">Monthly Profit</span>
                        <span class="result-value highlight" id="ep-profit">0</span>
                    </div>
                </div>
            </div>
        `;

        window.calculateEarningPlus = () => {
            const amount = parseFloat(document.getElementById('ep-amount').value) || 0;
            const term = document.getElementById('ep-term').value;
            const gender = document.getElementById('ep-gender').value;

            // Use global rates
            let rate = 0;
            if (term === '1') rate = window.currentRates.earningPlus.month1 / 100;
            else if (term === '3') rate = window.currentRates.earningPlus.month3 / 100;
            else if (term === '6') rate = window.currentRates.earningPlus.month6 / 100;

            console.log('Earning Plus calculation - Term:', term, 'Rate:', (rate * 100).toFixed(2) + '%', 'from global:', window.currentRates.earningPlus);

            const annualProfit = amount * rate;
            const monthlyProfit = annualProfit / 12;

            document.getElementById('ep-rate').textContent = (rate * 100).toFixed(2) + '%';
            document.getElementById('ep-profit').textContent = Math.round(monthlyProfit).toLocaleString() + ' BDT';
            document.getElementById('result-area').style.display = 'block';
        };
    }

    function renderMillionaire() {
        calculatorContainer.innerHTML = `
            <div class="card">
                <h3>Multi-Millionaire Scheme</h3>
                <p style="color:var(--text-muted); margin-bottom:20px;">Target Amount Calculator</p>
                
                <div class="input-group">
                    <label>Target Amount</label>
                    <select id="mm-target">
                        <option value="1000000">10 Lac (1 Million)</option>
                        <option value="5000000">50 Lac (5 Million)</option>
                        <option value="10000000">1 Crore (10 Million)</option>
                    </select>
                </div>
                 <div class="input-group">
                    <label>Tenure</label>
                    <select id="mm-tenure">
                        <option value="5">5 Years</option>
                        <option value="6">6 Years</option>
                        <option value="7">7 Years</option>
                        <option value="8">8 Years</option>
                        <option value="9">9 Years</option>
                        <option value="10">10 Years</option>
                    </select>
                </div>
                <button class="calculate-btn" onclick="calculateMillionaire()">Calculate Monthly Installment</button>

                <div id="result-area" class="result-card" style="display:none;">
                    <div class="result-item">
                        <span class="result-label">Required Monthly Installment</span>
                        <span class="result-value highlight" id="mm-installment">0</span>
                    </div>
                </div>
            </div>
        `;

        window.calculateMillionaire = () => {
            const target = parseFloat(document.getElementById('mm-target').value);
            const tenure = parseInt(document.getElementById('mm-tenure').value);

            const installments = {
                5: 12949,
                6: 10246,
                7: 8333,
                8: 6913,
                9: 5822,
                10: 4961
            };

            let baseInstallment = installments[tenure] || 0;
            let multiplier = target / 1000000;
            let result = baseInstallment * multiplier;

            document.getElementById('mm-installment').textContent = Math.round(result).toLocaleString() + ' BDT';
            document.getElementById('result-area').style.display = 'block';
        };
    }

    // Final: Ensure prospectus renders on load
    setTimeout(() => {
        if (calculatorContainer && calculatorContainer.innerHTML === '') {
            renderProspectus();
            loadRatesFromProspectus();
            setTimeout(updateSuperFlexTable, 100);
        }
    }, 500);

});
