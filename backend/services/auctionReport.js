const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

const currency = (value = 0) =>
  `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const ensureReportsDirectory = () => {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
};

const drawSectionHeader = (doc, title) => {
  doc.moveDown(1.2);
  doc
    .fontSize(14)
    .fillColor('#1E293B')
    .text(title.toUpperCase(), { continued: false, underline: false });
  doc.moveDown(0.4);
  doc
    .moveTo(doc.x, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .lineWidth(1)
    .stroke('#CBD5F5');
  doc.moveDown(0.6);
};

const drawKeyValue = (doc, label, value) => {
  doc
    .fontSize(11)
    .fillColor('#1E293B')
    .text(`${label}: `, { continued: true })
    .font('Helvetica-Bold')
    .text(value)
    .font('Helvetica');
};

const drawTable = (doc, headers, rows) => {
  if (rows.length === 0) {
    doc.fontSize(11).fillColor('#475569').text('No data available.');
    doc.moveDown();
    return;
  }

  const columnCount = headers.length;
  const columnWidth =
    (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columnCount;

  doc.fontSize(11).fillColor('#ffffff');
  headers.forEach((header, index) => {
    doc
      .rect(
        doc.page.margins.left + index * columnWidth,
        doc.y,
        columnWidth,
        18
      )
      .fill('#0F172A');
    doc
      .fillColor('#F8FAFC')
      .text(header, doc.page.margins.left + index * columnWidth + 6, doc.y + 4, {
        width: columnWidth - 12,
        align: 'left'
      });
  });
  doc.moveDown();
  doc.moveDown(0.1);
  doc.fillColor('#1F2937');

  rows.forEach((row) => {
    headers.forEach((header, index) => {
      const text = row[index] ?? '';
      doc
        .text(
          text,
          doc.page.margins.left + index * columnWidth + 6,
          doc.y,
          {
            width: columnWidth - 12,
            align: 'left'
          }
        );
    });
    doc.moveDown();
  });

  doc.moveDown();
};

async function generateAuctionReport(tournamentCode) {
  ensureReportsDirectory();

  const tournament = await Tournament.findOne({ code: tournamentCode });
  if (!tournament) {
    throw new Error('Tournament not found for report generation');
  }

  const [players, teams] = await Promise.all([
    Player.find({ tournamentCode }).sort({ name: 1 }).lean(),
    Team.find({ tournamentCode }).sort({ name: 1 }).lean()
  ]);

  const soldPlayers = players.filter((p) => p.auctionStatus === 'Sold');
  const pendingPlayers = players.filter((p) => p.auctionStatus === 'Pending');
  const unsoldPlayers = players.filter((p) => p.auctionStatus === 'Unsold');
  const availablePlayers = players.filter((p) => p.auctionStatus === 'Available');
  const totalSoldValue = soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0);

  const teamSummaries = teams.map((team) => {
    const purchases = soldPlayers.filter((p) => String(p.soldTo) === String(team._id));
    const spent = purchases.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
    const remainingBudget =
      (team.currentBalance ??
        team.budget ??
        tournament.auctionRules?.maxFundForTeam ??
        0) - spent;
    return {
      name: team.name,
      players: purchases.length,
      spent,
      remaining: remainingBudget,
      purchases
    };
  });

  const fileName = `${tournamentCode}_Auction_Report.pdf`;
  const filePath = path.join(REPORTS_DIR, fileName);
  const relativePath = path.join('reports', fileName);

  const doc = new PDFDocument({ margin: 50 });
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);

  const currentRound = tournament.auctionState?.currentRound || 1;
  
  doc
    .font('Helvetica-Bold')
    .fontSize(22)
    .fillColor('#0F172A')
    .text(`${tournament.name} – Auction Summary`, { align: 'center' });
  doc.moveDown(0.5);
  doc
    .fontSize(12)
    .font('Helvetica')
    .fillColor('#475569')
    .text(`Tournament Code: ${tournament.code}`, { align: 'center' });
  if (tournament.location) {
    doc.text(`Venue: ${tournament.location}`, { align: 'center' });
  }
  if (currentRound > 1) {
    doc.text(`Round: ${currentRound}`, { align: 'center' });
  }
  doc.text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

  drawSectionHeader(doc, 'Overview');
  drawKeyValue(doc, 'Total Players Registered', players.length);
  drawKeyValue(doc, 'Players Sold', soldPlayers.length);
  drawKeyValue(doc, 'Players Pending', pendingPlayers.length);
  drawKeyValue(doc, 'Players Unsold', unsoldPlayers.length);
  drawKeyValue(doc, 'Players Remaining Available', availablePlayers.length);
  drawKeyValue(doc, 'Total Auction Spend', currency(totalSoldValue));

  drawSectionHeader(doc, 'Team Spending Summary');
  drawTable(
    doc,
    ['Team', 'Players Bought', 'Total Spent', 'Balance'],
    teamSummaries
      .sort((a, b) => b.spent - a.spent)
      .map((team) => [
        team.name,
        team.players,
        currency(team.spent),
        currency(team.remaining)
      ])
  );

  drawSectionHeader(doc, 'Top Player Sales');
  drawTable(
    doc,
    ['Player', 'Role', 'Team', 'Price'],
    soldPlayers
      .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))
      .slice(0, 10)
      .map((player) => [
        `${player.name} (${player.playerId})`,
        player.role || '—',
        player.soldToName || '—',
        currency(player.soldPrice || 0)
      ])
  );

  if (unsoldPlayers.length > 0) {
    drawSectionHeader(doc, 'Unsold Players');
    drawTable(
      doc,
      ['Player', 'Role', 'Base Price'],
      unsoldPlayers.map((player) => [
        `${player.name} (${player.playerId})`,
        player.role || '—',
        currency(player.basePrice || 0)
      ])
    );
  }

  // Add withdrawn players section
  const withdrawnPlayers = players.filter((p) => p.auctionStatus === 'Withdrawn');
  if (withdrawnPlayers.length > 0) {
    drawSectionHeader(doc, 'Withdrawn Players');
    drawTable(
      doc,
      ['Player', 'Role', 'Base Price', 'Reason'],
      withdrawnPlayers.map((player) => [
        `${player.name} (${player.playerId})`,
        player.role || '—',
        currency(player.basePrice || 0),
        player.withdrawalReason || '—'
      ])
    );
  }

  // Add financial summary
  drawSectionHeader(doc, 'Financial Summary');
  const totalBudget = teams.reduce((sum, team) => {
    const budget = team.budget || tournament.auctionRules?.maxFundForTeam || 0;
    return sum + budget;
  }, 0);
  const totalRemaining = teamSummaries.reduce((sum, team) => sum + team.remaining, 0);
  drawKeyValue(doc, 'Total Team Budget', currency(totalBudget));
  drawKeyValue(doc, 'Total Spent', currency(totalSoldValue));
  drawKeyValue(doc, 'Total Remaining', currency(totalRemaining));
  drawKeyValue(doc, 'Average Player Price', currency(soldPlayers.length > 0 ? totalSoldValue / soldPlayers.length : 0));

  doc.moveDown(1.5);
  doc
    .fontSize(10)
    .fillColor('#94A3B8')
    .text('Report generated by PlayLive Auction Controller', { align: 'center' });
  doc
    .fontSize(8)
    .fillColor('#CBD5E1')
    .text('Powered by PlayLive.com', { align: 'center' });

  doc.end();

  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return relativePath.replace(/\\/g, '/');
}

module.exports = {
  generateAuctionReport
};

