const chatState = { chatHistory: [{ role: 'user', content: 'please dont show calculation only result' }] };
function formatBDT(v) {
            const n = Number(v) || 0;
            return 'BDT ' + n.toLocaleString('en-US', {maximumFractionDigits:2, minimumFractionDigits:2});
        }
function chatContainsBangla(text) {
            return /[\u0980-\u09FF]/.test(text || '');
        }
function chatNormalizeDigits(text = '') {
            const banglaToAscii = {
                '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
                '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
            };
            return String(text)
                .replace(/[০-৯]/g, digit => banglaToAscii[digit] || digit)
                .replace(/[\u00A0\u2007\u202F]/g, ' ')
                .replace(/[‐‑‒–—−]/g, '-')
                .replace(/([0-9])\{,\}([0-9])/g, '$1,$2')
                .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '$1/$2')
                .replace(/\\(?:text|mathrm|mathbf|boxed)\s*\{([^{}]*)\}/g, '$1')
                .replace(/\\times/g, ' × ')
                .replace(/\\cdot/g, ' × ')
                .replace(/\\approx/g, ' approx ')
                .replace(/\\%/g, '%')
                .replace(/\\;/g, ' ')
                .replace(/\\[\[\]()]/g, ' ')
                .replace(/[{}]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }
function chatParseLooseNumber(rawValue) {
            if (rawValue == null) return null;
            const normalized = chatNormalizeDigits(String(rawValue)).replace(/,/g, '').trim();
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }
function chatFormatCalcNumber(value, maximumFractionDigits = 6) {
            const normalized = Number(value);
            if (!Number.isFinite(normalized)) return '0';
            return normalized.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits
            });
        }
function chatExtractNumberByPatterns(text, patterns) {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (!match || match[1] == null) continue;
                const parsed = chatParseLooseNumber(match[1]);
                if (parsed !== null) {
                    return parsed;
                }
            }
            return null;
        }
function chatExtractPrincipalAmount(text) {
            const explicitAmount = chatExtractNumberByPatterns(text, [
                /(?:principal|deposit(?:\s+amount)?|investment|মূলধন|আসল|জমা(?:র)?\s+পরিমাণ)\s*(?:=|:)?\s*(?:tk|bdt|taka|টাকা)?\s*([0-9][0-9,]*(?:\.\d+)?)/i,
                /\bp\s*=\s*([0-9][0-9,]*(?:\.\d+)?)/i,
                /(?:i\s*=\s*p\s*[×x*]\s*r\s*[×x*]\s*t\s*=\s*)([0-9][0-9,]*(?:\.\d+)?)(?=\s*[×x*])/i,
                /(?:p\s*[×x*]\s*r\s*[×x*]\s*t\s*=\s*)([0-9][0-9,]*(?:\.\d+)?)(?=\s*[×x*])/i,
                /(?:a\s*=\s*p\s*\+\s*i\s*=\s*)([0-9][0-9,]*(?:\.\d+)?)(?=\s*\+)/i,
                /(?:tk|bdt|taka|টাকা)\s*([0-9][0-9,]*(?:\.\d+)?)/i,
                /([0-9][0-9,]*(?:\.\d+)?)\s*(?:tk|bdt|taka|টাকা)\b/i
            ]);

            if (explicitAmount !== null) {
                return explicitAmount;
            }

            const numberRegex = /[0-9][0-9,]*(?:\.\d+)?/g;
            let match;
            while ((match = numberRegex.exec(text))) {
                const parsed = chatParseLooseNumber(match[0]);
                if (parsed === null || parsed < 1000) continue;

                const before = text.slice(Math.max(0, match.index - 24), match.index).toLowerCase();
                const after = text.slice(numberRegex.lastIndex, numberRegex.lastIndex + 24).toLowerCase();

                if (after.trim().startsWith('%')) continue;
                if (/^\s*(?:days?|day|months?|month|years?|year|দিন|মাস|বছর)\b/.test(after)) continue;
                if (/(?:interest|rate|maturity|tax|profit|net|emi|loan|installment)/.test(before)) continue;

                return parsed;
            }

            return null;
        }
function chatExtractRatePercent(text) {
            return chatExtractNumberByPatterns(text, [
                /(?:interest\s*rate|annual\s*rate|profit\s*rate|rate|সুদের হার|মুনাফার হার|হার)\s*(?:=|:)?\s*([0-9][0-9,]*(?:\.\d+)?)/i,
                /\br\s*=\s*([0-9][0-9,]*(?:\.\d+)?)/i,
                /([0-9][0-9,]*(?:\.\d+)?)\s*%/i
            ]);
        }
function chatExtractTenorDays(text) {
            const days = chatExtractNumberByPatterns(text, [
                /(?:tenor|term|duration|period|for|মেয়াদ|সময়|সময়)\s*(?:=|:)?\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:days?|day|দিন)/i,
                /\bt\s*=\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:days?|day|দিন)?/i,
                /([0-9][0-9,]*(?:\.\d+)?)\s*(?:days?|day|দিন)/i
            ]);

            if (days !== null) {
                return { days, derivedFromMonths: false };
            }

            const months = chatExtractNumberByPatterns(text, [
                /(?:tenor|term|duration|period|for|মেয়াদ|সময়|সময়)\s*(?:=|:)?\s*([0-9][0-9,]*(?:\.\d+)?)\s*(?:months?|month|মাস)/i,
                /([0-9][0-9,]*(?:\.\d+)?)\s*(?:months?|month|মাস)/i
            ]);

            if (months !== null) {
                return { days: months * 30, derivedFromMonths: true };
            }

            return null;
        }
function chatHas360Basis(text) {
            return /(?:360\s*(?:-| )?\s*day|360\s*দিন|\/\s*360|t\s*\/\s*360)/i.test(text || '');
        }
function chatHas365Basis(text) {
            return /(?:365\s*(?:-| )?\s*day|365\s*দিন|\/\s*365|t\s*\/\s*365)/i.test(text || '');
        }
function chatLooksLikeFdCalculation(text) {
            return /(?:\bfd\b|\bfdr\b|fixed\s+deposit|term\s+deposit|maturity(?:\s+amount)?|simple\s+interest|deposit\s+interest|এফডি|এফডিআর|মেয়াদি\s+আমানত|মেয়াদী\s+আমানত|সুদ|মুনাফা|মেয়াদ)/i.test(text || '');
        }
function chatBuildFdCalculationReply(details, wantsBangla) {
            const summaryAmount = (value) => {
                const amount = Number(value) || 0;
                const isWhole = Math.abs(amount - Math.round(amount)) < 1e-9;
                return `Tk. ${amount.toLocaleString('en-US', {
                    minimumFractionDigits: isWhole ? 0 : 2,
                    maximumFractionDigits: 2
                })}`;
            };
            const principalText = summaryAmount(details.principal);
            const interestText = summaryAmount(details.interest);
            const maturityText = summaryAmount(details.maturity);
            const ratePercentText = `${chatFormatCalcNumber(details.ratePercent, 4)}%`;
            const differenceText = summaryAmount(Math.abs(details.interest - details.comparisonInterest));

            if (wantsBangla) {
                const lines = [
                    'Result',
                    `- Principal: ${principalText}`,
                    `- Interest: ${interestText}`,
                    `- Maturity Amount: ${maturityText}`,
                    `- Rate used: ${ratePercentText} p.a.`,
                    `- Basis used: ${details.basis}-day year`
                ];

                if (details.includeComparison) {
                    lines.push(
                        '',
                        `${details.comparisonBasis}-day year ব্যবহার করলে:`,
                        `- Interest: ${summaryAmount(details.comparisonInterest)}`,
                        `- Maturity Amount: ${summaryAmount(details.comparisonMaturity)}`,
                        `- Difference: ${differenceText}`
                    );
                }

                return lines.join('\n');
            }

            const lines = [
                'Result',
                `- Principal: ${principalText}`,
                `- Interest: ${interestText}`,
                `- Maturity Amount: ${maturityText}`,
                `- Rate used: ${ratePercentText} p.a.`,
                `- Basis used: ${details.basis}-day year`
            ];

            if (details.includeComparison) {
                lines.push(
                    '',
                    `If you use a ${details.comparisonBasis}-day year instead:`,
                    `- Interest: ${summaryAmount(details.comparisonInterest)}`,
                    `- Maturity Amount: ${summaryAmount(details.comparisonMaturity)}`,
                    `- Difference in interest: ${differenceText}`
                );
            }

            return lines.join('\n');
        }
function chatTryBuildFinancialCalculationReply(questionText, contextText = '') {
            const normalizedQuestion = chatNormalizeDigits(questionText);
            const normalizedContext = chatNormalizeDigits(contextText);
            const combinedText = `${normalizedQuestion}\n${normalizedContext}`;

            if (/(?:loan|emi|installment|credit card|mortgage)/i.test(combinedText)) {
                return null;
            }

            const looksLikeCalculation = chatLooksLikeFdCalculation(combinedText) || /(?:\bp\s*=|\br\s*=|\bt\s*=)/i.test(combinedText);
            if (!looksLikeCalculation) {
                return null;
            }

            const principal = chatExtractPrincipalAmount(normalizedQuestion) ?? chatExtractPrincipalAmount(normalizedContext);
            let ratePercent = chatExtractRatePercent(normalizedQuestion);
            if (ratePercent === null) {
                ratePercent = chatExtractRatePercent(normalizedContext);
            }
            if (ratePercent !== null && ratePercent > 0 && ratePercent <= 1 && !/%/.test(normalizedQuestion)) {
                ratePercent *= 100;
            }

            const tenor = chatExtractTenorDays(normalizedQuestion) ?? chatExtractTenorDays(normalizedContext);
            if (principal === null || ratePercent === null || !tenor) {
                return null;
            }

            const questionHas360 = chatHas360Basis(normalizedQuestion);
            const questionHas365 = chatHas365Basis(normalizedQuestion);
            const contextHas360 = chatHas360Basis(normalizedContext);
            const contextHas365 = chatHas365Basis(normalizedContext);

            let basis = 360;
            if (questionHas365 && !questionHas360) {
                basis = 365;
            } else if (questionHas360) {
                basis = 360;
            } else if (contextHas365 && !contextHas360) {
                basis = 365;
            } else if (contextHas360) {
                basis = 360;
            }

            const comparisonRequested = (questionHas360 && questionHas365)
                || /(?:compare|difference|instead|rather than|vs\.?|versus|if\s+a?\s*365|if\s+a?\s*360)/i.test(normalizedQuestion);
            const comparisonBasis = basis === 360 ? 365 : 360;
            const interest = detailsRound(principal * (ratePercent / 100) * (tenor.days / basis));
            const maturity = detailsRound(principal + interest);
            const comparisonInterest = detailsRound(principal * (ratePercent / 100) * (tenor.days / comparisonBasis));
            const comparisonMaturity = detailsRound(principal + comparisonInterest);
            const assumedBangladeshBasis = basis === 360
                && !questionHas360
                && !questionHas365
                && !contextHas360
                && !contextHas365
                && /(?:bangladesh|bangladeshi|bank|বাংলাদেশ|ব্যাংক|fd|fdr|fixed deposit)/i.test(combinedText);

            return chatBuildFdCalculationReply({
                principal,
                ratePercent,
                days: tenor.days,
                basis,
                interest,
                maturity,
                includeComparison: comparisonRequested,
                comparisonBasis,
                comparisonInterest,
                comparisonMaturity,
                assumedBangladeshBasis,
                derivedFromMonths: tenor.derivedFromMonths
            }, chatContainsBangla(questionText));
        }
function chatPostProcessAiReply(questionText, rawReply, contextText = '') {
            if (!rawReply) {
                return rawReply;
            }

            const normalizedQuestion = chatNormalizeDigits(questionText);
            const normalizedReply = chatNormalizeDigits(rawReply);
            const isFinanceMath = chatLooksLikeFdCalculation(`${normalizedQuestion}\n${normalizedReply}`)
                || /(?:\bp\s*=|\br\s*=|\bt\s*=|principal|interest|maturity amount|rate used|basis used|fixed deposit|fd|fdr)/i.test(`${normalizedQuestion}\n${normalizedReply}`);

            if (!isFinanceMath) {
                return rawReply;
            }

            const forceSummary = /(?:only\s+result|result\s+only|don't\s+show\s+calculation|do\s+not\s+show\s+calculation|without\s+calculation|no\s+calculation|just\s+result|only\s+final\s+result)/i.test(normalizedQuestion)
                || chatLooksLikeCalculationHeavyAnswer(rawReply);

            if (!forceSummary) {
                return rawReply;
            }

            const summarizedReply = chatTryBuildFinancialCalculationReply(questionText, `${contextText}\n${rawReply}`);
            return summarizedReply || rawReply;
        }
function chatGetLatestUserQuestion() {
            for (let index = chatState.chatHistory.length - 1; index >= 0; index--) {
                const entry = chatState.chatHistory[index];
                if (entry?.role === 'user' && typeof entry.content === 'string') {
                    return entry.content;
                }
            }
            return '';
        }
function detailsRound(value) {
            return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
        }

const rawReply = "### Calculation steps\n\\[\n\\\\text{Interest} = P \\\\times r \\\\times \\\\frac{\\\\text{days}}{360}\n= 200{,}000 \\\\times 0.1025 \\\\times \\\\frac{90}{360}\n= 200{,}000 \\\\times 0.1025 \\\\times 0.25\n= 200{,}000 \\\\times 0.025625\n= \\\\textbf{BDT 5,125}\n\\]\n\\[\n\\\\text{Maturity Amount} = P + \\\\text{Interest}\n= 200{,}000 + 5{,}125\n= \\\\textbf{BDT 205,125}\n\\]";

const processed = chatPostProcessAiReply(rawReply);
console.log('---RESULT_START---');
console.log(processed);
console.log('---RESULT_END---');
console.log('Contains Calculation steps:', processed.includes('Calculation steps'));
console.log('Contains \\\\text{Interest}:', processed.includes('\\\\text{Interest}'));
console.log('Contains 0.025625:', processed.includes('0.025625'));
