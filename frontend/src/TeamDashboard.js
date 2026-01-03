import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import io from 'socket.io-client';
import axios from 'axios';
import { API_BASE_URL } from './utils/apiConfig';
import './styles-team-dashboard.css';

const initialSeatAuth = () => {
  try {
    const data = sessionStorage.getItem('seatAuth');
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
};

function TeamDashboard() {
  const { tournamentCode } = useParams();
  const [seatAuth, setSeatAuth] = useState(initialSeatAuth);
  const [loginForm, setLoginForm] = useState({ teamCode: '', seatCode: '', pin: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [seatView, setSeatView] = useState(null);
  const [seatViewLoading, setSeatViewLoading] = useState(false);
  const [voteState, setVoteState] = useState({ submitting: false, message: '', consensus: null });
  const [socket, setSocket] = useState(null);
  const [tournamentInfo, setTournamentInfo] = useState({ loading: true, plan: null, error: '' });

  const authHeaders = useMemo(() => {
    if (!seatAuth?.seatToken) return {};
    return { Authorization: `Bearer ${seatAuth.seatToken}` };
  }, [seatAuth]);

  const isAuctionProTournament = tournamentInfo.plan === 'AuctionPro';

  const storeSeatAuth = useCallback((payload) => {
    sessionStorage.setItem('seatAuth', JSON.stringify(payload));
    setSeatAuth(payload);
  }, []);

  const clearSeatAuth = useCallback(() => {
    sessionStorage.removeItem('seatAuth');
    setSeatAuth(null);
    setSeatView(null);
    setVoteState({ submitting: false, message: '', consensus: null });
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  }, [socket]);

  useEffect(() => {
    let isCancelled = false;
    const loadTournament = async () => {
      try {
        setTournamentInfo({ loading: true, plan: null, error: '' });
        const res = await axios.get(`${API_BASE_URL}/api/tournaments/${tournamentCode}`);
        const rawPlan = res.data?.tournament?.plan || '';
        const normalized = rawPlan.toString().replace(/\s+/g, '').toLowerCase();
        let plan = 'Standard';
        if (normalized === 'standard') plan = 'Standard';
        else if (normalized === 'auctionpro') plan = 'AuctionPro';
        else if (normalized === 'lite' || normalized === 'liteplus') plan = 'Standard'; // Map old tiers to Standard
        if (!isCancelled) {
          setTournamentInfo({ loading: false, plan, error: '' });
        }
      } catch (error) {
        if (!isCancelled) {
          setTournamentInfo({
            loading: false,
            plan: null,
            error: error.response?.data?.message || 'Unable to load tournament info.'
          });
        }
      }
    };
    loadTournament();
    return () => {
      isCancelled = true;
    };
  }, [tournamentCode]);

  useEffect(() => {
    if (seatAuth?.team?.tournamentCode && seatAuth.team.tournamentCode !== tournamentCode) {
      clearSeatAuth();
    }
  }, [seatAuth, tournamentCode, clearSeatAuth]);

  useEffect(() => {
    if (seatAuth && tournamentInfo.plan && tournamentInfo.plan !== 'AuctionPro') {
      clearSeatAuth();
    }
  }, [seatAuth, tournamentInfo.plan, clearSeatAuth]);

  const fetchSeatView = useCallback(async () => {
    if (!seatAuth?.seatToken) return;
    try {
      setSeatViewLoading(true);
      const res = await axios.get(`${API_BASE_URL}/api/auctions/${tournamentCode}/seat-view`, {
        headers: authHeaders
      });
      if (res.data.success) {
        setSeatView(res.data);
        setVoteState((prev) => ({
          ...prev,
          consensus: res.data.consensus || prev.consensus
        }));
      }
    } catch (error) {
      console.error('Failed to load seat view', error);
      if (error.response?.status === 401) {
        clearSeatAuth();
      }
    } finally {
      setSeatViewLoading(false);
    }
  }, [authHeaders, seatAuth?.seatToken, tournamentCode, clearSeatAuth]);

  useEffect(() => {
    if (!seatAuth?.seatToken) return undefined;

    fetchSeatView();
    const intervalId = setInterval(fetchSeatView, 8000);
    return () => clearInterval(intervalId);
  }, [seatAuth?.seatToken, fetchSeatView]);

  useEffect(() => {
    if (!seatAuth?.seatToken) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return undefined;
    }

    const newSocket = io(`${API_BASE_URL}`, {
      auth: { token: seatAuth.seatToken }
    });
    setSocket(newSocket);

    newSocket.emit('join-auction', { tournamentCode });

    const refreshEvents = ['player:next', 'bid:update', 'player:sold', 'auction:start', 'auction:resume', 'auction:pause', 'auction:end'];
    refreshEvents.forEach((event) => {
      newSocket.on(event, (payload) => {
        if (!payload || payload.tournamentCode === tournamentCode) {
          fetchSeatView();
        }
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, [seatAuth?.seatToken, tournamentCode, fetchSeatView, socket]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (!loginForm.teamCode || !loginForm.seatCode || !loginForm.pin) {
      setLoginError('Enter your Team ID, Seat Code, and PIN to continue.');
      return;
    }
    if (tournamentInfo.loading) {
      setLoginError('Please wait while we verify tournament access.');
      return;
    }
    if (tournamentInfo.plan !== 'AuctionPro') {
      setLoginError('Auction Pro seats are only available for tournaments on the Auction Pro tier.');
      return;
    }
    try {
      setLoginLoading(true);
      setLoginError('');
      const res = await axios.post(`${API_BASE_URL}/api/teams/seat/login`, {
        teamCode: loginForm.teamCode.trim(),
        seatCode: loginForm.seatCode.trim(),
        pin: loginForm.pin.trim(),
        tournamentCode
      });

      if (res.data.success) {
        const payload = {
          seatToken: res.data.seatToken,
          seat: res.data.seat,
          team: res.data.team
        };
        storeSeatAuth(payload);
        setLoginForm({ teamCode: '', seatCode: '', pin: '' });
      }
    } catch (error) {
      console.error('Seat login failed', error);
      const message = error.response?.data?.message || 'Unable to login with the provided credentials.';
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVote = async (action) => {
    if (!seatAuth?.seatToken) return;
    try {
      setVoteState((prev) => ({ ...prev, submitting: true, message: '' }));
      const res = await axios.post(
        `${API_BASE_URL}/api/auctions/${tournamentCode}/seats/vote`,
        { action },
        { headers: authHeaders }
      );
      if (res.data.success) {
        const message = res.data.bidTriggered
          ? '✅ Bid placed. Stay ready for next increment.'
          : action === 'pass'
            ? 'You marked this player as pass.'
            : 'Vote recorded. Waiting for teammates…';
        setVoteState({
          submitting: false,
          message,
          consensus: res.data.consensus || null
        });
        if (res.data.bidTriggered) {
          fetchSeatView();
        }
      }
    } catch (error) {
      console.error('Vote failed', error);
      const message = error.response?.data?.message || 'Unable to record vote.';
      setVoteState({ submitting: false, message, consensus: voteState.consensus });
      if (error.response?.status === 401) {
        clearSeatAuth();
      }
    }
  };

  const isLoggedIn = Boolean(seatAuth?.seatToken);
  const currentPlayer = seatView?.currentPlayer;
  const teamSnapshot = seatView?.team;
  const tournamentState = seatView?.tournament;
  const seatMeta = seatAuth?.seat;
  // Determine status - prioritize Running if there's a current player, otherwise use the status from API
  const rawStatus = tournamentState?.status || 'NotStarted';
  const statusLabel = (rawStatus === 'NotStarted' && currentPlayer) ? 'Running' : 
                      (rawStatus === 'Idle' && currentPlayer) ? 'Running' :
                      rawStatus;
  const statusKey = statusLabel.toLowerCase().replace(/\s+/g, '-');
  const seatTags = [
    seatMeta?.role || 'Seat',
    seatMeta?.isLead ? 'Lead' : 'Member'
  ].filter(Boolean);
  const budgetStats = [
    { label: 'Budget', value: teamSnapshot?.budget },
    { label: 'Spent', value: teamSnapshot?.budgetUsed },
    { label: 'Balance', value: teamSnapshot?.budgetBalance },
    { label: 'Max Bid (Now)', value: teamSnapshot?.maxBid }
  ];
  const bidHistoryList = currentPlayer?.bidHistory?.length
    ? [...currentPlayer.bidHistory].reverse().slice(0, 6)
    : [];

  const consensusProgress = useMemo(() => {
    if (!voteState.consensus) return null;
    const { callVotes = 0, required = 1 } = voteState.consensus;
    const pct = Math.min(100, Math.round((callVotes / required) * 100));
    return {
      callVotes,
      required,
      progress: Number.isNaN(pct) ? 0 : pct
    };
  }, [voteState.consensus]);

  if (!isLoggedIn) {
    return (
      <div className="team-dashboard login-state">
        <div className="team-dashboard-card login-card">
          <div className="login-shell">
            <section className="login-hero">
              <span className="hero-pill">Auction Pro Seat</span>
              <h1>Remote control for your team booth</h1>
              <p>
                Plug into the live auction flow, sync every bid instantly, and keep your squad aligned without shouting
                across the hall.
              </p>

              <ul className="login-highlights">
                <li>
                  <div>
                    <strong>Live seat sync</strong>
                    <p>Realtime player + budget feed with socket failover.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Smart guardrails</strong>
                    <p>Auto-calculates eligibility before you vote call or pass.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <strong>Secure access</strong>
                    <p>Seat codes + rotating PIN-backed tokens.</p>
                  </div>
                </li>
              </ul>

              <div className="login-meta">
                <div>
                  <p className="eyebrow">Version</p>
                  <strong>Auction Pro v3.1</strong>
                </div>
                <div>
                  <p className="eyebrow">Support</p>
                  <strong>support@playlive.in</strong>
                </div>
                <div>
                  <p className="eyebrow">Latency</p>
                  <strong>&lt; 400ms global</strong>
                </div>
              </div>
            </section>

            <section className="login-panel">
              <p className="eyebrow">Seat Login</p>
              <h2>Authenticate your seat</h2>
              {tournamentInfo.loading ? (
                <p className="muted">Loading tournament access…</p>
              ) : tournamentInfo.error ? (
                <p className="form-error">{tournamentInfo.error}</p>
              ) : isAuctionProTournament ? (
                <p className="muted">
                  Use the Team ID, Seat Code, and PIN provided by your tournament admin to unlock the remote seat.
                </p>
              ) : (
                <p className="muted">
                  Remote seats are available only for tournaments on the Auction Pro plan. Ask your admin to enable it for{' '}
                  {tournamentCode}.
                </p>
              )}

              {isAuctionProTournament && !tournamentInfo.loading && !tournamentInfo.error ? (
                <form className="login-form" onSubmit={handleLogin}>
                  <label>
                    Team ID
                    <input
                      type="text"
                      value={loginForm.teamCode}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, teamCode: e.target.value }))}
                      placeholder="e.g., PRE2025-T003"
                    />
                  </label>
                  <label>
                    Seat Code
                    <input
                      type="text"
                      value={loginForm.seatCode}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, seatCode: e.target.value }))}
                      placeholder="Seat code"
                    />
                  </label>
                  <label>
                    PIN
                    <input
                      type="password"
                      value={loginForm.pin}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, pin: e.target.value }))}
                      placeholder="6-digit pin"
                    />
                  </label>
                  {loginError && <div className="form-error">{loginError}</div>}
                  <button type="submit" disabled={loginLoading}>
                    {loginLoading ? 'Joining…' : 'Join Auction'}
                  </button>
                  <p className="login-footnote">Need help? Ping support with your Tournament Code.</p>
                </form>
              ) : null}
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-dashboard mobile-first">
      <header className="td-header">
        <span className="td-chip">Auction Pro Seat</span>
        <h1>{seatMeta?.label || 'Seat Console'}</h1>
        <p className="muted td-team-info">
          {seatAuth?.team?.teamId} • {seatAuth?.team?.name}
        </p>
        <div className="td-header-meta">
          {seatTags.map((tag, index) => (
            <span key={`${tag}-${index}`} className="td-tag">
              {tag}
            </span>
          ))}
          <span className={`status-pill status-${statusKey}`}>{statusLabel}</span>
        </div>
        <div className="td-actions">
          <button type="button" onClick={fetchSeatView} disabled={seatViewLoading}>
            {seatViewLoading ? 'Syncing…' : 'Refresh'}
          </button>
          <button type="button" className="ghost" onClick={clearSeatAuth}>
            Logout
          </button>
        </div>
      </header>

      <section className="td-card td-card-hero">
        <div className="td-card-head">
          <div>
            <p className="eyebrow">Current Player</p>
            <h2>{currentPlayer?.name || 'Awaiting Player'}</h2>
          </div>
          <div className="td-card-meta">
            <p className="muted">Leading team</p>
            <strong>{tournamentState?.highestBidderName || '—'}</strong>
          </div>
        </div>

        {currentPlayer ? (
          <div className="td-grid">
            <div className="td-stat">
              <p>Role</p>
              <strong>{currentPlayer.role || '—'}</strong>
            </div>
            <div className="td-stat">
              <p>Base Price</p>
              <strong>₹{(currentPlayer.basePrice || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="td-stat">
              <p>Current Bid</p>
              <strong>₹{(tournamentState?.currentBid || 0).toLocaleString('en-IN')}</strong>
            </div>
            <div className="td-stat">
              <p>Timer</p>
              <strong>{tournamentState?.timerSeconds ?? '—'}s</strong>
            </div>
          </div>
        ) : (
          <p className="empty-state">Waiting for the controller to bring a player into the auction.</p>
        )}
      </section>

      <section className="td-card td-card-actions">
        <div className="td-card-head">
          <div>
            <p className="eyebrow">Seat Actions</p>
            <h3>Cast your vote</h3>
          </div>
        </div>

        <div className="td-action-buttons">
          <button
            type="button"
            disabled={voteState.submitting || !currentPlayer}
            onClick={() => handleVote(seatMeta?.isLead ? 'override_call' : 'call')}
          >
            {seatMeta?.isLead ? 'Call (Lead Override)' : 'Call'}
          </button>
          <button
            type="button"
            className="ghost"
            disabled={voteState.submitting || !currentPlayer}
            onClick={() => handleVote('pass')}
          >
            Pass
          </button>
        </div>

        {consensusProgress ? (
          <div className="consensus-progress">
            <div className="consensus-bar">
              <span style={{ width: `${consensusProgress.progress}%` }} />
            </div>
            <p className="muted">
              Votes {consensusProgress.callVotes}/{consensusProgress.required}
            </p>
          </div>
        ) : (
          <p className="muted">Waiting for votes from your teammates.</p>
        )}

        {voteState.message && <div className="vote-message">{voteState.message}</div>}
      </section>

      <section className="td-card">
        <div className="td-card-head">
          <div>
            <p className="eyebrow">Budget Snapshot</p>
            <h3>{seatAuth?.team?.name}</h3>
          </div>
          <p className="muted">{teamSnapshot?.playersBought || 0} players bought</p>
        </div>

        <div className="td-grid compact">
          {budgetStats.map((stat) => (
            <div key={stat.label} className="td-stat">
              <p>{stat.label}</p>
              <strong>₹{(stat.value || 0).toLocaleString('en-IN')}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="td-card">
        <div className="td-card-head">
          <div>
            <p className="eyebrow">Recent Bids</p>
            <h3>Bid History</h3>
          </div>
        </div>
        {bidHistoryList.length ? (
          <ul className="bid-history">
            {bidHistoryList.map((bid) => (
              <li key={bid.bidTime}>
                <span>{bid.teamName}</span>
                <strong>₹{(bid.bidAmount || 0).toLocaleString('en-IN')}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">No bids placed yet for this player.</p>
        )}
      </section>
    </div>
  );
}

export default TeamDashboard;
