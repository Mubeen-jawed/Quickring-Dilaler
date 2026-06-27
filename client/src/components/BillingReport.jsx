import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';
import { parsePhone } from '../utils/phoneFormat';

const PAGE_SIZE = 10;

const formatMonthLabel = (isoOrStr) => {
  const d = new Date(isoOrStr);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

const toMonthKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatDuration = (seconds) => {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const formatTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleString();
};

const statusBadge = (status) => {
  const colors = {
    completed: 'badge-success',
    initiated: 'badge-info',
    ringing: 'badge-info',
    'no-answer': 'badge-warn',
    busy: 'badge-warn',
    failed: 'badge-error',
    canceled: 'badge-error',
    voicemail: 'badge-warn',
  };
  return colors[status] || 'badge-info';
};

export default function BillingReport() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Detail view state
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthData, setMonthData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    api.getBillingSummary()
      .then(setSummary)
      .catch((err) => console.error('Failed to fetch billing summary:', err))
      .finally(() => setLoading(false));
  }, []);

  const fetchMonth = useCallback((month, p = 1, q = '') => {
    setDetailLoading(true);
    api.getBillingMonth(month, p, PAGE_SIZE, q)
      .then(setMonthData)
      .catch((err) => console.error('Failed to fetch month detail:', err))
      .finally(() => setDetailLoading(false));
  }, []);

  const openMonth = (monthIso) => {
    const key = toMonthKey(monthIso);
    setSelectedMonth(key);
    setPage(1);
    setSearch('');
    setSearchInput('');
    fetchMonth(key, 1, '');
  };

  const goBack = () => {
    setSelectedMonth(null);
    setMonthData(null);
    setPage(1);
    setSearch('');
    setSearchInput('');
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setSearch(val);
    }, 400);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  useEffect(() => {
    if (selectedMonth) fetchMonth(selectedMonth, page, search);
  }, [page, search, selectedMonth, fetchMonth]);

  // Find the summary row for the selected month
  const selectedSummary = summary?.months?.find(
    (m) => toMonthKey(m.month) === selectedMonth
  );

  if (loading) {
    return (
      <div className="history-container">
        <div className="history-loading">Loading billing data...</div>
      </div>
    );
  }

  // ── Detail View ──
  if (selectedMonth && selectedSummary) {
    const rate = summary.rate_per_minute;
    return (
      <div className="history-container billing-report">
        <button className="billing-back-btn" onClick={goBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to Summary
        </button>

        <div className="billing-detail-header">
          <h2>{formatMonthLabel(selectedSummary.month)}</h2>
          <a
            href={api.getBillingExportUrl(selectedMonth)}
            className="btn-export"
            download
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </a>
        </div>

        {/* Stat cards */}
        <div className="billing-stats-grid">
          <div className="billing-stat-card">
            <span className="billing-stat-label">Total Minutes</span>
            <span className="billing-stat-value">{selectedSummary.total_minutes}</span>
          </div>
          <div className="billing-stat-card">
            <span className="billing-stat-label">Total Cost</span>
            <span className="billing-stat-value billing-cost">${selectedSummary.total_cost.toFixed(2)}</span>
          </div>
          <div className="billing-stat-card">
            <span className="billing-stat-label">Completed Calls</span>
            <span className="billing-stat-value">{selectedSummary.completed_calls}</span>
          </div>
        </div>

        {/* Direction breakdown */}
        <div className="billing-direction-grid">
          <div className="billing-direction-card outbound">
            <div className="billing-direction-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="7 17 17 7" />
                <polyline points="7 7 17 7 17 17" />
              </svg>
            </div>
            <div className="billing-direction-info">
              <span className="billing-direction-label">Outbound</span>
              <span className="billing-direction-value">{selectedSummary.outbound_calls} calls</span>
              <span className="billing-direction-sub">{selectedSummary.outbound_minutes} min</span>
            </div>
          </div>
          <div className="billing-direction-card inbound">
            <div className="billing-direction-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 7 7 17" />
                <polyline points="17 17 7 17 7 7" />
              </svg>
            </div>
            <div className="billing-direction-info">
              <span className="billing-direction-label">Inbound</span>
              <span className="billing-direction-value">{selectedSummary.inbound_calls} calls</span>
              <span className="billing-direction-sub">{selectedSummary.inbound_minutes} min</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="history-search">
          <svg className="history-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="history-search-input"
            placeholder="Search by phone number..."
            value={searchInput}
            onChange={handleSearchChange}
          />
          {searchInput && (
            <button className="history-search-clear" onClick={clearSearch}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Call list */}
        {detailLoading && !monthData ? (
          <div className="history-loading">Loading calls...</div>
        ) : monthData && monthData.calls.length > 0 ? (
          <>
            <div className="history-list">
              {monthData.calls.map((call) => {
                const phone = parsePhone(call.phone_number);
                const isInbound = call.direction === 'inbound';
                const durSec = call.duration || 0;
                const billableMin = durSec > 0 ? Math.ceil(durSec / 60) : 0;
                const cost = Math.round(billableMin * rate * 100) / 100;
                return (
                  <div key={call.id} className="history-item">
                    <div className="history-item-icon">
                      {isInbound ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="17 7 7 17" />
                          <polyline points="17 17 7 17 7 7" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="7 17 17 7" />
                          <polyline points="7 7 17 7 17 17" />
                        </svg>
                      )}
                    </div>
                    <div className="history-item-info">
                      <span className="history-number">{phone.formatted}</span>
                      <span className="history-time">{formatTime(call.started_at)}</span>
                    </div>
                    <div className="history-item-meta">
                      <span className={`badge ${statusBadge(call.status)}`}>{call.status}</span>
                      <span className="history-duration">{formatDuration(call.duration)}</span>
                      <span className="billing-call-cost">${cost.toFixed(2)}</span>
                      {call.recording_sid && (
                        <a
                          href={api.getRecordingUrl(call.call_sid)}
                          download={`${call.call_sid}.mp3`}
                          title="Download recording"
                          className="recording-download-btn"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {monthData.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Prev
                </button>
                <span className="pagination-info">
                  Page {page} of {monthData.totalPages}
                </span>
                <button
                  className="pagination-btn"
                  onClick={() => setPage((p) => Math.min(monthData.totalPages, p + 1))}
                  disabled={page === monthData.totalPages}
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="history-empty">
            <p>{search ? 'No calls match your search.' : 'No completed calls this month.'}</p>
          </div>
        )}
      </div>
    );
  }

  // ── Summary View ──
  return (
    <div className="history-container billing-report">
      <div className="history-header">
        <h2>Billing & Reports</h2>
        {summary && (
          <span className="history-count">${summary.rate_per_minute}/min</span>
        )}
      </div>

      {!summary || summary.months.length === 0 ? (
        <div className="history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <p>No billing data yet. Make some calls!</p>
        </div>
      ) : (
        <div className="billing-months-list">
          {summary.months.map((m) => {
            const key = toMonthKey(m.month);
            return (
              <div
                key={key}
                className="billing-month-card"
                onClick={() => openMonth(m.month)}
              >
                <div className="billing-month-left">
                  <span className="billing-month-name">{formatMonthLabel(m.month)}</span>
                  <span className="billing-month-calls">
                    {m.completed_calls} calls
                    <span className="billing-month-split">
                      ({m.outbound_calls} out / {m.inbound_calls} in)
                    </span>
                  </span>
                </div>
                <div className="billing-month-right">
                  <span className="billing-month-minutes">{m.total_minutes} min</span>
                  <span className="billing-month-cost">${m.total_cost.toFixed(2)}</span>
                </div>
                <div className="billing-month-actions">
                  <a
                    href={api.getBillingExportUrl(key)}
                    className="btn-csv"
                    title="Download CSV"
                    download
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
