const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const sharp = require('sharp');

/**
 * Parse CSV file content
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
 * Parse Excel file
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
 * Auto-detect column mapping
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
    teamname: 'teamName',
    team_name: 'teamName',
    name: 'teamName',
    team: 'teamName',
    captainname: 'captainName',
    captain_name: 'captainName',
    captain: 'captainName',
    mobile: 'mobile',
    phone: 'mobile',
    mobilenumber: 'mobile',
    email: 'email',
    emailaddress: 'email',
    city: 'city',
    place: 'city',
    location: 'city',
    numberofplayers: 'numberOfPlayers',
    players: 'numberOfPlayers',
    player_count: 'numberOfPlayers',
    playercount: 'numberOfPlayers'
  };

  // Optional fields
  const optionalFields = {
    group: 'group',
    groupindex: 'groupIndex',
    group_index: 'groupIndex',
    teamicon: 'teamIcon',
    team_icon: 'teamIcon',
    icons: 'teamIcon',
    notes: 'notes',
    note: 'notes',
    logo: 'logo',
    logopath: 'logo',
    logo_path: 'logo'
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
 * Validate team data
 */
const validateTeamData = (teamData, tournament, existingTeams) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!teamData.teamName || !teamData.teamName.trim()) {
    errors.push('Team name is required');
  } else {
    const teamName = teamData.teamName.trim().toUpperCase();
    if (teamName.length < 3) {
      errors.push('Team name must be at least 3 characters');
    }
    if (teamName !== teamData.teamName.trim()) {
      warnings.push('Team name will be converted to uppercase');
    }
  }

  if (!teamData.captainName || !teamData.captainName.trim()) {
    errors.push('Captain name is required');
  }

  if (!teamData.mobile || !teamData.mobile.trim()) {
    errors.push('Mobile number is required');
  } else {
    const mobileRegex = /^(\+91|\+966)?[6-9]\d{9}$/;
    const mobile = teamData.mobile.trim().replace(/\s+/g, '');
    if (!mobileRegex.test(mobile)) {
      errors.push('Invalid mobile number format (must be 10-digit Indian format)');
    }
  }

  if (!teamData.email || !teamData.email.trim()) {
    errors.push('Email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(teamData.email.trim())) {
      errors.push('Invalid email format');
    }
  }

  if (!teamData.city || !teamData.city.trim()) {
    errors.push('City is required');
  }

  if (!teamData.numberOfPlayers) {
    errors.push('Number of players is required');
  } else {
    const numPlayers = parseInt(teamData.numberOfPlayers);
    if (isNaN(numPlayers)) {
      errors.push('Number of players must be a valid number');
    } else if (tournament.minPlayers && numPlayers < tournament.minPlayers) {
      errors.push(`Number of players must be at least ${tournament.minPlayers}`);
    } else if (tournament.maxPlayers && numPlayers > tournament.maxPlayers) {
      errors.push(`Number of players must be at most ${tournament.maxPlayers}`);
    }
  }

  // Check for duplicates (teamName + mobile)
  if (teamData.teamName && teamData.mobile) {
    const teamName = teamData.teamName.trim().toUpperCase();
    const mobile = teamData.mobile.trim().replace(/\s+/g, '');
    const duplicate = existingTeams.find(t => 
      t.name.toUpperCase() === teamName && 
      t.mobile.replace(/\s+/g, '') === mobile
    );
    if (duplicate) {
      warnings.push(`Duplicate team found: ${duplicate.teamId} (${duplicate.name})`);
    }
  }

  // Validate group if provided
  if (teamData.group && teamData.group.trim()) {
    const group = teamData.group.trim().toUpperCase();
    if (group.length > 10) {
      warnings.push('Group name is unusually long');
    }
  }

  // Validate logo path if provided
  if (teamData.logo && teamData.logo.trim()) {
    const logoPath = teamData.logo.trim();
    if (!logoPath.startsWith('uploads/') && !logoPath.startsWith('http://') && !logoPath.startsWith('https://')) {
      warnings.push('Logo path should be relative (uploads/...) or a full URL');
    }
  }

  return { errors, warnings, isValid: errors.length === 0 };
};

/**
 * Download image from URL and save to uploads
 */
const downloadAndSaveLogo = async (url, tournamentCode, teamName) => {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to download image: ${response.statusCode}`));
      }

      const contentType = response.headers['content-type'];
      if (!contentType || !contentType.startsWith('image/')) {
        return reject(new Error('URL does not point to a valid image'));
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          // Validate image size (5MB max)
          if (buffer.length > 5 * 1024 * 1024) {
            return reject(new Error('Image size exceeds 5MB limit'));
          }

          // Process and save image
          const sanitizedTeamName = teamName.trim().replace(/\s+/g, '_').toUpperCase();
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substr(2, 9);
          const filename = `teamLogo_${timestamp}_${randomId}.jpg`;
          const uploadsDir = path.join(__dirname, '..', 'uploads', 'team_logos');
          
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }

          const filepath = path.join(uploadsDir, filename);
          
          await sharp(buffer)
            .rotate()
            .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80, progressive: true, mozjpeg: true })
            .toFile(filepath);

          const relativePath = `uploads/team_logos/${filename}`;
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
 * Process logo path (relative or URL)
 */
const processLogoPath = async (logoPath, tournamentCode, teamName) => {
  if (!logoPath || !logoPath.trim()) {
    return null;
  }

  const trimmedPath = logoPath.trim();

  // If it's a URL, download it
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    try {
      return await downloadAndSaveLogo(trimmedPath, tournamentCode, teamName);
    } catch (error) {
      console.error('Error downloading logo from URL:', error);
      return null; // Return null on error, team will be created without logo
    }
  }

  // If it's a relative path, check if file exists
  if (trimmedPath.startsWith('uploads/')) {
    const absolutePath = path.join(__dirname, '..', trimmedPath);
    if (fs.existsSync(absolutePath)) {
      return trimmedPath;
    } else {
      console.warn(`Logo file not found: ${trimmedPath}`);
      return null; // File doesn't exist, but don't fail the import
    }
  }

  return null;
};

/**
 * Map row data to team object
 */
const mapRowToTeam = (row, columnMapping) => {
  const teamData = {};
  
  Object.keys(columnMapping).forEach(field => {
    const sourceColumn = columnMapping[field];
    if (sourceColumn && row[sourceColumn] !== undefined) {
      teamData[field] = row[sourceColumn];
    }
  });

  return teamData;
};

module.exports = {
  parseCSV,
  parseExcel,
  autoDetectColumns,
  validateTeamData,
  processLogoPath,
  mapRowToTeam
};

