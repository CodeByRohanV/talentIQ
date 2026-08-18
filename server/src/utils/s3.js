import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// The SDK automatically uses IAM role credentials when running on EC2
export const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-2'
});

/**
 * Uploads base64 encoded data to S3 and returns the S3 URL.
 * 
 * @param {string} base64Data - Base64 string of the file (without data uri prefix)
 * @param {string} filename - Desired filename
 * @param {string} contentType - Mime type of the file
 * @returns {Promise<string>} - The S3 URL of the uploaded file
 */
export const uploadToS3 = async (base64Data, filename, contentType = 'image/png') => {
    const bucketName = process.env.S3_BUCKET_NAME || 'skillz-proctoring';
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Create the command
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: `evidence/${filename}`,
        Body: buffer,
        ContentType: contentType,
        // ACL is generally disabled in modern buckets, so we don't set it unless needed
    });

    try {
        await s3Client.send(command);
        
        // Return the constructed S3 URL
        const region = process.env.AWS_REGION || 'ap-south-2';
        return `https://${bucketName}.s3.${region}.amazonaws.com/evidence/${filename}`;
    } catch (error) {
        console.error('S3 Upload Error:', error);
        throw error;
    }
};
