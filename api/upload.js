import formidable from 'formidable';
import fs from 'fs';

// Vercel serverless functions need to use dynamic imports for pdfjs-dist
let pdfjs;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function extractWithPositions(pdfBuffer) {
  // Lazy load pdfjs-dist
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Set up worker for Vercel environment
    pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }
  
  const uint8Array = new Uint8Array(pdfBuffer);
  const pdf = await pdfjs.getDocument({
    data: uint8Array,
    disableFontFace: false
  }).promise;
  
  const page = await pdf.getPage(1);
  const textContent = await page.getTextContent();
  
  const items = textContent.items.map(item => ({
    text: item.str,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width,
    height: item.height
  }));
  
  const columns = groupByColumn(items);
  return columns;
}

function groupByColumn(items, tolerance = 40) {
  const columns = {};
  
  items.forEach(item => {
    const columnKey = Math.round(item.x / tolerance) * tolerance;
    if (item.text !== "" && item.text !== " ") {
      if (!columns[columnKey]) {
        columns[columnKey] = [];
      }
      columns[columnKey].push(item);
    }
  });
  
  return columns;
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
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
    
    // Extract data with positions using pdfjs
    const data = await extractWithPositions(dataBuffer);
    
    // Clean up temp file
    fs.unlinkSync(pdfFile.filepath);
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Error processing PDF:', error);
    return res.status(500).json({ 
      error: 'Failed to process PDF', 
      details: error.message 
    });
  }
}