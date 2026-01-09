const formidable = require('formidable');
const pdfParse = require('pdf-parse');
const fs = require('fs');

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB max
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve([fields, files]);
      });
    });

    const pdfFile = files.pdf?.[0] || files.pdf;
    
    if (!pdfFile) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const dataBuffer = fs.readFileSync(pdfFile.filepath);
    const pdfData = await pdfParse(dataBuffer);
    
    // Extract text content with positioning
    const textContent = pdfData.text;
    
    // Parse the PDF structure similar to your backend
    const parsedData = parsePDFContent(pdfData);
    
    // Clean up temp file
    fs.unlinkSync(pdfFile.filepath);
    
    return res.status(200).json(parsedData);
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ error: 'Failed to process PDF', details: error.message });
  }
}

function parsePDFContent(pdfData) {
  // This function needs to be adapted based on your backend's actual parsing logic
  // Since I don't have your backend code, here's a basic structure
  
  const lines = pdfData.text.split('\n');
  const result = {};
  
  lines.forEach((line, index) => {
    if (line.trim()) {
      if (!result[`column_${Math.floor(index / 10)}`]) {
        result[`column_${Math.floor(index / 10)}`] = [];
      }
      
      result[`column_${Math.floor(index / 10)}`].push({
        text: line.trim(),
        x: 0, // You'll need actual coordinates from your backend
        y: index * 10,
        width: line.length * 7,
        regex: null
      });
    }
  });
  
  return result;
}