import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Proctoring from '../models/Proctoring.js';
import { uploadToS3 } from '../utils/s3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, '../../public/uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const startSession = async (req, res) => {
    try {
        const { attemptId } = req.body;

        if (!attemptId) {
            return res.status(400).json({ success: false, message: 'attemptId is required' });
        }

        const session = await Proctoring.createSession(attemptId, null);
        res.status(201).json({ success: true, session });
    } catch (error) {
        console.error('Error starting proctoring session:', error);
        res.status(500).json({ success: false, message: 'Failed to start proctoring session' });
    }
};

export const logEvent = async (req, res) => {
    try {
        const { sessionId, eventType, description, screenshotBase64, riskLevel } = req.body;

        if (!sessionId || !eventType) {
            return res.status(400).json({ success: false, message: 'sessionId and eventType are required' });
        }

        let screenshotUrl = null;
        if (screenshotBase64) {
            try {
                const base64Data = screenshotBase64.replace(/^data:image\/\w+;base64,/, '');
                const filename = `proctoring_${sessionId}_${Date.now()}.png`;
                
                // Upload to S3 instead of local disk
                screenshotUrl = await uploadToS3(base64Data, filename);
            } catch (imgErr) {
                console.error('Error saving screenshot to S3:', imgErr);
                // Fallback to local storage if S3 fails or is not configured properly?
                // For this migration, we are instructed to upload *directly* to S3.
                // If it fails, we shouldn't crash the event logging, but we won't have the image.
            }
        }

        const log = await Proctoring.logEvent(sessionId, null, eventType, description, screenshotUrl, riskLevel || 'medium');
        res.status(201).json({ success: true, log });
    } catch (error) {
        console.error('Error logging proctoring event:', error);
        res.status(500).json({ success: false, message: 'Failed to log event' });
    }
};

export const endSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await Proctoring.endSession(sessionId);
        res.status(200).json({ success: true, session });
    } catch (error) {
        console.error('Error ending proctoring session:', error);
        res.status(500).json({ success: false, message: 'Failed to end session' });
    }
};

export const getReport = async (req, res) => {
    try {
        const { candidateId } = req.params;
        const report = await Proctoring.getReportByCandidateId(candidateId);
        if (!report) {
            return res.status(404).json({ success: false, message: 'No proctoring report found' });
        }
        res.status(200).json({ success: true, report });
    } catch (error) {
        console.error('Error fetching proctoring report:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch report' });
    }
};

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '../utils/s3.js';
import { pipeline } from 'stream';

export const getMedia = async (req, res) => {
    try {
        const url = req.query.url;
        if (!url || !url.includes('.amazonaws.com/')) {
            return res.status(400).json({ success: false, message: 'Invalid media URL' });
        }
        

        
        const urlObj = new URL(url);
        // Ensure it's accessing the configured bucket
        if (!urlObj.hostname.includes(process.env.S3_BUCKET_NAME)) {
            return res.status(403).json({ success: false, message: 'Unauthorized bucket access' });
        }

        const key = decodeURIComponent(urlObj.pathname.substring(1));
        
        const command = new GetObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: key
        });
        
        const response = await s3Client.send(command);
        
        res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
        // Prevent CORS issues by adding Access-Control-Allow-Origin
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        // stream it to the client safely
        pipeline(response.Body, res, (err) => {
            if (err) {
                console.error('S3 Stream Pipeline Error:', err);
            }
        });
    } catch (error) {
        console.error('Error fetching media from S3:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch media' });
    }
};
