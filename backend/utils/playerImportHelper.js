const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const sharp = require('sharp');

/**
 * Parse CSV file content (reuse from team import)
 */
const parseCSV = (fileBuffer) => {
  const content = fileBuffer.toString('utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  // Parse rows
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Simple CSV parsing (handles quoted values)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    // Skip empty rows
    if (Object.values(row).some(v => v && v.trim())) {
      rows.push(row);
    }
  }
  
  return { headers, rows };
};

/**
 * Parse Excel file (reuse from team import)
 */
const parseExcel = async (fileBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);
  
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('Excel file has no worksheets');
  }

  const headers = [];
  worksheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = (cell.value || '').toString().trim();
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header row
    
    const rowData = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        let value = cell.value;
        if (value !== null && value !== undefined) {
          if (typeof value === 'object' && value.text) {
            value = value.text;
          }
          rowData[header] = value.toString().trim();
        } else {
          rowData[header] = '';
        }
      }
    });
    
    // Skip empty rows
    if (Object.values(rowData).some(v => v && v.trim())) {
      rows.push(rowData);
    }
  });

  return { headers, rows };
};

/**
 * Auto-detect column mapping for players
 */
const autoDetectColumns = (headers) => {
  const mapping = {};
  const headerMap = {};
  
  headers.forEach(header => {
    const normalized = header.toLowerCase().trim().replace(/[_\s]/g, '');
    headerMap[normalized] = header;
  });

  // Required fields
  const requiredFields = {
    name: 'name',
    playername: 'name',
    player_name: 'name',
    fullname: 'name',
    mobile: 'mobile',
    phone: 'mobile',
    mobilenumber: 'mobile',
    phonenumber: 'mobile',
    city: 'city',
    place: 'city',
    location: 'city',
    role: 'role',
    playerrole: 'role',
    position: 'role'
  };

  // Optional fields
  const optionalFields = {
    remarks: 'remarks',
    remark: 'remarks',
    notes: 'remarks',
    note: 'remarks',
    photo: 'photo',
    photopath: 'photo',
    photo_path: 'photo',
    image: 'photo',
    receipt: 'receipt',
    receiptpath: 'receipt',
    receipt_path: 'receipt',
    baseprice: 'basePrice',
    base_price: 'basePrice',
    price: 'basePrice'
  };

  Object.keys(requiredFields).forEach(key => {
    if (headerMap[key]) {
      mapping[requiredFields[key]] = headerMap[key];
    }
  });

  Object.keys(optionalFields).forEach(key => {
    if (headerMap[key]) {
      mapping[optionalFields[key]] = headerMap[key];
    }
  });

  return mapping;
};

/**
 * Get valid roles for tournament sport
 */
const getValidRoles = (sport) => {
  if (sport === 'Cricket') return ['Batsman', 'Bowler', 'All-Rounder', 'Wicketkeeper'];
  if (sport === 'Football') return ['Goalkeeper', 'Defender', 'Midfielder', 'Forward'];
  if (sport === 'Volleyball') return ['Setter', 'Attacker', 'Blocker', 'Libero'];
  if (sport === 'Basketball') return ['Point Guard', 'Center', 'Forward', 'Shooting Guard'];
  return [];
};

/**
 * Validate player data
 */
const validatePlayerData = (playerData, tournament, existingPlayers) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!playerData.name || !playerData.name.trim()) {
    errors.push('Player name is required');
  }

  if (!playerData.mobile || !playerData.mobile.trim()) {
    errors.push('Mobile number is required');
  } else {
    const mobileRegex = /^(\+91|\+966)?[6-9]\d{9}$/;
    const mobile = playerData.mobile.trim().replace(/\s+/g, '');
    if (!mobileRegex.test(mobile)) {
      errors.push('Invalid mobile number format (must be 10-digit Indian format)');
    }
  }

  if (!playerData.city || !playerData.city.trim()) {
    errors.push('City is required');
  }

  if (!playerData.role || !playerData.role.trim()) {
    errors.push('Role is required');
  } else {
    const validRoles = getValidRoles(tournament.sport);
    const role = playerData.role.trim();
    if (validRoles.length > 0 && !validRoles.includes(role)) {
      errors.push(`Invalid role. Valid roles for ${tournament.sport} are: ${validRoles.join(', ')}`);
    }
  }

  // Check for duplicates (mobile)
  if (playerData.mobile) {
    const mobile = playerData.mobile.trim().replace(/\s+/g, '');
    const duplicate = existingPlayers.find(p => 
      p.mobile.replace(/\s+/g, '') === mobile
    );
    if (duplicate) {
      warnings.push(`Duplicate player found: ${duplicate.playerId} (${duplicate.name})`);
    }
  }

  // Validate basePrice if provided
  if (playerData.basePrice) {
    const basePrice = parseFloat(playerData.basePrice);
    if (isNaN(basePrice) || basePrice < 0) {
      warnings.push('Base price must be a valid positive number');
    }
  }

  // Validate photo path if provided
  if (playerData.photo && playerData.photo.trim()) {
    const photoPath = playerData.photo.trim();
    if (!photoPath.startsWith('uploads/') && !photoPath.startsWith('http://') && !photoPath.startsWith('https://')) {
      warnings.push('Photo path should be relative (uploads/...) or a full URL');
    }
  }

  // Validate receipt path if provided
  if (playerData.receipt && playerData.receipt.trim()) {
    const receiptPath = playerData.receipt.trim();
    if (!receiptPath.startsWith('uploads/') && !receiptPath.startsWith('http://') && !receiptPath.startsWith('https://')) {
      warnings.push('Receipt path should be relative (uploads/...) or a full URL');
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
};

/**
 * Download image from URL and save to uploads
 */
const downloadAndSaveFile = async (url, tournamentCode, playerName, fileType = 'photo') => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download file: ${response.statusCode}`));
      }

      const contentType = response.headers['content-type'];
      
      // Validate content type based on file type
      if (fileType === 'photo') {
        if (!contentType || !contentType.startsWith('image/')) {
          return reject(new Error('URL does not point to a valid image'));
        }
      } else if (fileType === 'receipt') {
        const validTypes = ['image/', 'application/pdf'];
        if (!contentType || !validTypes.some(type => contentType.startsWith(type))) {
          return reject(new Error('URL does not point to a valid receipt (image or PDF)'));
        }
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          // Validate file size
          const maxSize = fileType === 'photo' ? 5 * 1024 * 1024 : 2 * 1024 * 1024; // 5MB for photo, 2MB for receipt
          if (buffer.length > maxSize) {
            return reject(new Error(`File size exceeds ${maxSize / 1024 / 1024}MB limit`));
          }

          // Process and save file
          const sanitizedPlayerName = playerName.trim().replace(/\s+/g, '_').toUpperCase();
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substr(2, 9);
          
          let filename, uploadsDir, relativePath;
          
          if (fileType === 'photo') {
            filename = `playerPhoto_${timestamp}_${randomId}.jpg`;
            uploadsDir = path.join(__dirname, '..', 'uploads', 'players');
            relativePath = `uploads/players/${filename}`;
            
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const filepath = path.join(uploadsDir, filename);
            
            // Process image with sharp
            await sharp(buffer)
              .rotate()
              .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 75, progressive: true, mozjpeg: true })
              .toFile(filepath);
          } else {
            // Receipt - determine extension from content type
            const ext = contentType.includes('pdf') ? 'pdf' : 'jpg';
            filename = `receipt_${timestamp}_${randomId}.${ext}`;
            uploadsDir = path.join(__dirname, '..', 'uploads');
            relativePath = `uploads/${filename}`;
            
            if (!fs.existsSync(uploadsDir)) {
              fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const filepath = path.join(uploadsDir, filename);
            
            // For PDF, save directly; for images, process with sharp
            if (ext === 'pdf') {
              fs.writeFileSync(filepath, buffer);
            } else {
              await sharp(buffer)
                .rotate()
                .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85, progressive: true, mozjpeg: true })
                .toFile(filepath);
            }
          }

          resolve(relativePath);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
};

/**
 * Process photo/receipt path (relative or URL)
 */
const processFilePath = async (filePath, tournamentCode, playerName, fileType = 'photo') => {
  if (!filePath || !filePath.trim()) {
    return null;
  }

  const trimmedPath = filePath.trim();

  // If it's a URL, download it
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    try {
      return await downloadAndSaveFile(trimmedPath, tournamentCode, playerName, fileType);
    } catch (error) {
      console.error(`Error downloading ${fileType} from URL:`, error);
      return null; // Return null on error, player will be created without file
    }
  }

  // If it's a relative path, check if file exists
  if (trimmedPath.startsWith('uploads/')) {
    const absolutePath = path.join(__dirname, '..', trimmedPath);
    if (fs.existsSync(absolutePath)) {
      return trimmedPath;
    } else {
      console.warn(`${fileType} file not found: ${trimmedPath}`);
      return null; // File doesn't exist, but don't fail the import
    }
  }

  return null;
};

/**
 * Map row data to player object
 */
const mapRowToPlayer = (row, columnMapping) => {
  const playerData = {};
  
  Object.keys(columnMapping).forEach(field => {
    const sourceColumn = columnMapping[field];
    if (sourceColumn && row[sourceColumn] !== undefined) {
      playerData[field] = row[sourceColumn];
    }
  });

  return playerData;
};

module.exports = {
  parseCSV,
  parseExcel,
  autoDetectColumns,
  validatePlayerData,
  processFilePath,
  mapRowToPlayer,
  getValidRoles
};

