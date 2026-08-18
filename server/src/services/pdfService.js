import puppeteer from 'puppeteer';
import { ZipArchive } from 'archiver';
import axios from 'axios';

const fetchImageAsBase64 = async (url) => {
    if (!url) return null;
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        const contentType = response.headers['content-type'] || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error(`Failed to fetch image for PDF: ${url}`, error.message);
        return null;
    }
};

const buildSingleCandidateHtml = (assessmentTitle, candidate, responses, photoBase64) => {
    const isPass = candidate.passed === true;
    const isFail = candidate.passed === false;
    const isPending = candidate.passed === null;
    
    let scoreClass = 'pending';
    let scoreText = 'Pending Grading';
    if (isPass) { scoreClass = 'pass'; scoreText = 'PASS'; }
    if (isFail) { scoreClass = 'fail'; scoreText = 'FAIL'; }

    const cName = candidate.candidate_name || candidate.candidateName || candidate.name || 'Unknown';
    const cEmail = candidate.candidate_email || candidate.candidateEmail || candidate.email || 'N/A';
    const cScoreRaw = candidate.overall_score ?? candidate.overallScore ?? null;
    const scoreDisplay = cScoreRaw !== null ? `${Number(cScoreRaw).toFixed(0)}%` : 'N/A';

    let htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
                margin: 0;
                padding: 0;
                color: #333;
                background: #fff;
            }
            .header {
                text-align: center;
                padding: 20px 0;
                border-bottom: 2px solid #f0f0f0;
                margin-bottom: 30px;
            }
            .header h1 {
                margin: 0;
                color: #0f172a;
                font-size: 24px;
            }
            .candidate-info {
                display: flex;
                justify-content: space-between;
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 30px;
            }
            .info-block {
                flex: 1;
            }
            .info-block strong {
                display: block;
                color: #64748b;
                font-size: 12px;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .info-block span {
                font-size: 16px;
                font-weight: 600;
                color: #0f172a;
                word-break: break-word;
            }
            .score-badge {
                font-size: 24px;
                font-weight: bold;
                color: #fff;
                padding: 10px 20px;
                border-radius: 8px;
                text-align: center;
            }
            .pass { background: #22c55e; }
            .fail { background: #ef4444; }
            .pending { background: #eab308; }
            
            .question-item {
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 15px;
                margin-bottom: 15px;
                page-break-inside: avoid;
            }
            .q-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 10px;
            }
            .q-title {
                font-weight: bold;
                font-size: 14px;
                color: #1e293b;
            }
            .q-meta {
                font-size: 12px;
                color: #64748b;
            }
            .q-text {
                font-size: 14px;
                margin-bottom: 15px;
                line-height: 1.5;
            }
            .options {
                list-style: none;
                padding: 0;
                margin: 0;
            }
            .option {
                padding: 8px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 4px;
                margin-bottom: 5px;
                font-size: 13px;
                display: flex;
                justify-content: space-between;
            }
            .option.correct {
                background: #f0fdf4;
                border-color: #86efac;
                color: #166534;
            }
            .option.incorrect-selected {
                background: #fef2f2;
                border-color: #fca5a5;
                color: #991b1b;
            }
            .subjective-answer {
                background: #f8fafc;
                padding: 12px;
                border-radius: 4px;
                font-size: 13px;
                font-style: italic;
                color: #334155;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>${assessmentTitle} — Candidate Report</h1>
        </div>
        
        <div class="candidate-info">
            <div class="info-block">
                <strong>Candidate Name</strong>
                <span>${cName}</span>
            </div>
            <div class="info-block">
                <strong>Email Address</strong>
                <span>${cEmail}</span>
            </div>
            <div class="info-block">
                <strong>Overall Score</strong>
                <span>${scoreDisplay}</span>
            </div>
            <div class="info-block">
                <div class="score-badge ${scoreClass}">
                    ${scoreText}
                </div>
            </div>
            ${photoBase64 ? `
            <div class="info-block" style="text-align: right; flex: 0.5;">
                <img src="${photoBase64}" alt="Candidate Verification" style="max-height: 80px; border-radius: 8px; border: 1px solid #e2e8f0;"/>
            </div>
            ` : ''}
        </div>

        <h3 style="color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Detailed Responses</h3>
    `;

    if (responses.length === 0) {
        htmlContent += `<p style="color: #64748b;">No detailed responses available for this candidate.</p>`;
    } else {
        responses.forEach((resp, i) => {
            htmlContent += `
            <div class="question-item">
                <div class="q-header">
                    <span class="q-title">Q${i + 1}. ${resp.domain || ''} | ${resp.difficulty || ''}</span>
                    <span class="q-meta">Score: ${resp.manualScore !== null ? resp.manualScore : (resp.selectedAnswer === resp.correctAnswer ? (resp.max_score || 1) : 0)} / ${resp.max_score || 1}</span>
                </div>
                <div class="q-text">${resp.questionText || ''}</div>
            `;

            if (resp.questionType === 'SUBJECTIVE') {
                htmlContent += `
                <div class="subjective-answer">
                    ${resp.textAnswer || '<i>No answer provided</i>'}
                </div>
                `;
            } else {
                htmlContent += `<ul class="options">`;
                let options = [];
                try {
                    options = typeof resp.options === 'string' ? JSON.parse(resp.options) : resp.options;
                } catch(e) {}
                
                if (Array.isArray(options)) {
                    options.forEach((opt, optIndex) => {
                        if(!opt) return;
                        let optClass = 'option';
                        let icon = '';
                        if (optIndex === resp.correctAnswer) {
                            optClass += ' correct';
                            icon = '✓ Correct';
                        } else if (optIndex === resp.selectedAnswer && optIndex !== resp.correctAnswer) {
                            optClass += ' incorrect-selected';
                            icon = '✗ Your Answer';
                        }
                        htmlContent += `<li class="${optClass}">${opt} <span>${icon}</span></li>`;
                    });
                }
                htmlContent += `</ul>`;
            }
            
            htmlContent += `</div>`;
        });
    }

    htmlContent += `
    </body>
    </html>
    `;

    return htmlContent;
};

export const streamZipBulkReport = async (assessmentTitle, candidates, groupedResponses, res) => {
    // Set up the archiver to stream zip directly to the response
    const archive = new ZipArchive({
        zlib: { level: 9 } // maximum compression
    });

    archive.on('error', function(err) {
        throw err;
    });

    // Pipe the archive output directly to the Express response
    archive.pipe(res);

    const browserOpts = {
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        browserOpts.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    const browser = await puppeteer.launch(browserOpts);

    const page = await browser.newPage();

    for (const candidate of candidates) {
        try {
            const cid = candidate.candidate_id || candidate.candidateId || candidate.id;
            const responses = groupedResponses[cid] || [];
            
            // Fetch photo as Base64 before building HTML to ensure it renders in PDF natively
            const photoBase64 = await fetchImageAsBase64(candidate.photo_id_url);
            
            const htmlContent = buildSingleCandidateHtml(assessmentTitle, candidate, responses, photoBase64);
            
            await page.setContent(htmlContent, { waitUntil: 'load' });
            
            const pdfBuffer = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: {
                    top: '20mm',
                    bottom: '20mm',
                    left: '15mm',
                    right: '15mm'
                }
            });

            // Fallback for names
            const cName = candidate.candidate_name || candidate.candidateName || candidate.name || 'Unknown';
            // Clean name for safe filesystem usage
            const cleanName = cName.replace(/[^a-zA-Z0-9]/g, '_');
            const shortId = String(cid).split('-')[0].substring(0, 8); // Take first 8 chars of UUID
            const fileName = `${cleanName}_${shortId}.pdf`;

            archive.append(Buffer.from(pdfBuffer), { name: fileName });
        } catch (error) {
            console.error(`Error generating PDF for candidate ID ${candidate.id}:`, error);
            // We log the error but DO NOT crash the loop. We want the rest of the candidates to succeed.
        }
    }

    await browser.close();
    
    // Finalize the archive (this tells the stream that we are done appending files)
    await archive.finalize();
};
