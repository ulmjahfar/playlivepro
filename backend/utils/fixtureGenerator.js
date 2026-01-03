/**
 * Fixture Generator Utility
 * Generates matches based on fixture type and match count
 */

// Shuffle array using Fisher-Yates algorithm
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Generate all possible pairs from an array of teams
const generatePairs = (teams) => {
  const pairs = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      pairs.push([teams[i], teams[j]]);
    }
  }
  return pairs;
};

// Calculate Round Robin match count for n teams
const calculateRoundRobinCount = (n) => {
  return (n * (n - 1)) / 2;
};

/**
 * STRAIGHT FIXTURE
 * Uses group order exactly as stored
 */
const generateStraightFixture = (groups, matchCount) => {
  const matches = [];
  let matchNo = 1;
  const maxCycles = matchCount === 'round-robin' ? 10 : matchCount; // Round robin handled separately

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    // Process each group
    for (const group of groups) {
      const teams = group.teams || [];
      if (teams.length < 2) continue;

      // For first cycle, pair sequentially
      if (cycle === 1) {
        for (let i = 0; i < teams.length - 1; i += 2) {
          if (i + 1 < teams.length) {
            matches.push({
              teamA: teams[i],
              teamB: teams[i + 1],
              groupA: group.name,
              groupB: group.name,
              round: cycle,
              matchNo: matchNo++,
              fixtureType: 'straight'
            });
          } else {
            // Odd team gets BYE
            matches.push({
              teamA: teams[i],
              teamB: null,
              groupA: group.name,
              groupB: null,
              round: cycle,
              matchNo: matchNo++,
              fixtureType: 'straight',
              teamABye: false,
              teamBBye: true
            });
          }
        }
      } else {
        // Subsequent cycles: generate all pairs and rotate through them
        const allPairs = generatePairs(teams);
        const pairsPerCycle = Math.ceil(teams.length / 2);
        const startIndex = ((cycle - 1) * pairsPerCycle) % allPairs.length;
        const endIndex = Math.min(startIndex + pairsPerCycle, allPairs.length);
        
        // Get pairs for this cycle
        const cyclePairs = [];
        for (let i = startIndex; i < endIndex; i++) {
          cyclePairs.push(allPairs[i]);
        }
        
        // If we need more pairs and haven't covered all, wrap around
        if (cyclePairs.length < pairsPerCycle) {
          const remaining = pairsPerCycle - cyclePairs.length;
          for (let i = 0; i < remaining && i < allPairs.length; i++) {
            if (!cyclePairs.some(([a, b]) => 
              (a.toString() === allPairs[i][0].toString() && b.toString() === allPairs[i][1].toString()) ||
              (a.toString() === allPairs[i][1].toString() && b.toString() === allPairs[i][0].toString())
            )) {
              cyclePairs.push(allPairs[i]);
            }
          }
        }
        
        for (const [teamA, teamB] of cyclePairs) {
          matches.push({
            teamA,
            teamB,
            groupA: group.name,
            groupB: group.name,
            round: cycle,
            matchNo: matchNo++,
            fixtureType: 'straight'
          });
        }

        // Handle BYE if odd number of teams and we don't have enough pairs
        if (teams.length % 2 === 1 && cyclePairs.length < pairsPerCycle) {
          const usedTeams = new Set();
          cyclePairs.forEach(([a, b]) => {
            usedTeams.add(a.toString());
            usedTeams.add(b.toString());
          });
          const byeTeam = teams.find(t => !usedTeams.has(t.toString()));
          if (byeTeam) {
            matches.push({
              teamA: byeTeam,
              teamB: null,
              groupA: group.name,
              groupB: null,
              round: cycle,
              matchNo: matchNo++,
              fixtureType: 'straight',
              teamABye: false,
              teamBBye: true
            });
          }
        }
      }
    }
  }

  return matches;
};

/**
 * MIXED FIXTURE
 * Combines all teams, shuffles randomly each cycle
 */
const generateMixedFixture = (groups, matchCount) => {
  const matches = [];
  let matchNo = 1;
  
  // Combine all teams from all groups
  const allTeams = [];
  groups.forEach(group => {
    if (group.teams && group.teams.length > 0) {
      allTeams.push(...group.teams);
    }
  });

  if (allTeams.length < 2) return matches;

  const maxCycles = matchCount === 'round-robin' 
    ? calculateRoundRobinCount(allTeams.length)
    : matchCount;

  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    // Shuffle teams for each cycle
    const shuffledTeams = shuffleArray(allTeams);
    
    // Pair teams sequentially
    for (let i = 0; i < shuffledTeams.length - 1; i += 2) {
      if (i + 1 < shuffledTeams.length) {
        const teamA = shuffledTeams[i];
        const teamB = shuffledTeams[i + 1];
        
        // Find groups for teams
        const groupA = groups.find(g => g.teams && g.teams.some(t => t.toString() === teamA.toString()))?.name;
        const groupB = groups.find(g => g.teams && g.teams.some(t => t.toString() === teamB.toString()))?.name;

        matches.push({
          teamA,
          teamB,
          groupA,
          groupB,
          round: cycle,
          matchNo: matchNo++,
          fixtureType: 'mixed'
        });
      } else {
        // Odd team gets BYE
        const teamA = shuffledTeams[i];
        const groupA = groups.find(g => g.teams && g.teams.some(t => t.toString() === teamA.toString()))?.name;
        
        matches.push({
          teamA,
          teamB: null,
          groupA,
          groupB: null,
          round: cycle,
          matchNo: matchNo++,
          fixtureType: 'mixed',
          teamABye: false,
          teamBBye: true
        });
      }
    }
  }

  return matches;
};

/**
 * MIXED-GROUP FIXTURE
 * Cross-group matching, never pairs same-group teams until all cross-group options exhausted
 */
const generateMixedGroupFixture = (groups, matchCount) => {
  const matches = [];
  let matchNo = 1;

  if (groups.length < 2) {
    // If only one group, fall back to within-group
    return generateWithinGroupFixture(groups, matchCount);
  }

  const maxCycles = matchCount === 'round-robin' ? groups.length * 2 : matchCount;

  // Generate group pairings for cross-group matches
  const groupPairings = [];
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      groupPairings.push([groups[i], groups[j]]);
    }
  }

  // Rotate through group pairings
  for (let cycle = 1; cycle <= maxCycles; cycle++) {
    const pairingIndex = (cycle - 1) % groupPairings.length;
    const [groupA, groupB] = groupPairings[pairingIndex];
    
    const teamsA = groupA.teams || [];
    const teamsB = groupB.teams || [];
    
    const maxPairs = Math.max(teamsA.length, teamsB.length);
    
    for (let i = 0; i < maxPairs; i++) {
      const teamA = teamsA[i % teamsA.length];
      const teamB = teamsB[i % teamsB.length];
      
      matches.push({
        teamA,
        teamB,
        groupA: groupA.name,
        groupB: groupB.name,
        round: cycle,
        matchNo: matchNo++,
        fixtureType: 'mixed-group'
      });
    }
  }

  return matches;
};

/**
 * WITHIN-GROUP FIXTURE
 * Each group generates its own mini-league
 */
const generateWithinGroupFixture = (groups, matchCount) => {
  const matches = [];
  let matchNo = 1;

  for (const group of groups) {
    const teams = group.teams || [];
    if (teams.length < 2) continue;

    let maxCycles;
    if (matchCount === 'round-robin') {
      maxCycles = calculateRoundRobinCount(teams.length);
    } else {
      maxCycles = matchCount;
    }

    // Generate all possible pairs for round robin
    if (matchCount === 'round-robin') {
      const pairs = generatePairs(teams);
      pairs.forEach(([teamA, teamB], index) => {
        matches.push({
          teamA,
          teamB,
          groupA: group.name,
          groupB: group.name,
          round: Math.floor(index / Math.ceil(teams.length / 2)) + 1,
          matchNo: matchNo++,
          fixtureType: 'within-group'
        });
      });
    } else {
      // For fixed match count, generate cycles
      for (let cycle = 1; cycle <= maxCycles; cycle++) {
        const pairs = generatePairs(teams);
        const cyclePairs = pairs.slice((cycle - 1) * Math.ceil(teams.length / 2), cycle * Math.ceil(teams.length / 2));
        
        for (const [teamA, teamB] of cyclePairs) {
          matches.push({
            teamA,
            teamB,
            groupA: group.name,
            groupB: group.name,
            round: cycle,
            matchNo: matchNo++,
            fixtureType: 'within-group'
          });
        }

        // Handle BYE if odd number of teams
        if (teams.length % 2 === 1 && cyclePairs.length < Math.ceil(teams.length / 2)) {
          const usedTeams = new Set();
          cyclePairs.forEach(([a, b]) => {
            usedTeams.add(a.toString());
            usedTeams.add(b.toString());
          });
          const byeTeam = teams.find(t => !usedTeams.has(t.toString()));
          if (byeTeam) {
            matches.push({
              teamA: byeTeam,
              teamB: null,
              groupA: group.name,
              groupB: null,
              round: cycle,
              matchNo: matchNo++,
              fixtureType: 'within-group',
              teamABye: false,
              teamBBye: true
            });
          }
        }
      }
    }
  }

  return matches;
};

/**
 * Main fixture generator function
 */
const generateFixtures = (groups, fixtureType, matchCount) => {
  if (!groups || groups.length === 0) {
    throw new Error('No groups provided');
  }

  let matches = [];

  switch (fixtureType) {
    case 'straight':
      matches = generateStraightFixture(groups, matchCount);
      break;
    case 'mixed':
      matches = generateMixedFixture(groups, matchCount);
      break;
    case 'mixed-group':
      matches = generateMixedGroupFixture(groups, matchCount);
      break;
    case 'within-group':
      matches = generateWithinGroupFixture(groups, matchCount);
      break;
    default:
      throw new Error(`Unknown fixture type: ${fixtureType}`);
  }

  return matches;
};

module.exports = {
  generateFixtures,
  calculateRoundRobinCount
};

