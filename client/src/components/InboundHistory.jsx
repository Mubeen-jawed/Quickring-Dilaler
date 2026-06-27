import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { parsePhone } from '../utils/phoneFormat';

const PAGE_SIZE = 10;
const RATE = 0.05;

export default function InboundHistory() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceRef = useRef(null);
  const { socket } = useSocket();

  const fetchHistory = useCallback((p = page, q = search) => {
    api.getInboundHistory(p, PAGE_SIZE, q)
      .then((data) => {
        setCalls(data.calls);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      })
      .catch((err) => console.error('Failed to fetch inbound history:', err))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    setLoading(true);
    fetchHistory(page, search);
  }, [page, search, fetchHistory]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchHistory(page, search);
    socket.on('call:logged', refresh);
    socket.on('call:updated', refresh);
    return () => {
      socket.off('call:logged', refresh);
      socket.off('call:updated', refresh);
    };
  }, [socket, fetchHistory, page, search]);

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

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
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

  if (loading && calls.length === 0) {
    return (
      <div className="history-container">
        <div className="history-loading">Loading inbound call history...</div>
      </div>
    );
  }

  return (
    <div className="history-container">
      <div className="history-header">
        <h2>Inbound Calls</h2>
        <span className="history-count">{total} calls</span>
      </div>

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

      {calls.length === 0 ? (
        <div className="history-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 7 7 17" />
            <polyline points="17 17 7 17 7 7" />
          </svg>
          <p>{search ? 'No calls match your search.' : 'No inbound calls yet.'}</p>
        </div>
      ) : (
        <>
          <div className="history-list">
            {calls.map((call) => {
              const phone = parsePhone(call.phone_number);
              const durSec = call.duration || 0;
              const billableMin = durSec > 0 ? Math.ceil(durSec / 60) : 0;
              const cost = (billableMin * RATE).toFixed(2);
              return (
                <div key={call.id} className="history-item">
                  <div className="history-item-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="17 7 7 17" />
                      <polyline points="17 17 7 17 7 7" />
                    </svg>
                  </div>
                  <div className="history-item-info">
                    <span className="history-number">{phone.formatted}</span>
                    <span className="history-time">{formatTime(call.started_at)}</span>
                  </div>
                  <div className="history-item-meta">
                    <span className={`badge ${statusBadge(call.status)}`}>
                      {call.status}
                      <span
                        className="dev-delete-call"
                        onDoubleClick={() => {
                          api.deleteCall(call.call_sid).catch((err) => console.error('Failed to delete call:', err));
                        }}
                      />
                    </span>
                    <span className="history-duration">{formatDuration(call.duration)}</span>
                    <span className="billing-call-cost">${cost}</span>
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

          {totalPages > 1 && (
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
                Page {page} of {totalPages}
              </span>
              <button
                className="pagination-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
