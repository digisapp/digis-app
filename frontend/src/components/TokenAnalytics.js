import React, { useState, useEffect } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { getAuthToken } from '../utils/auth-helpers';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const TokenAnalytics = ({ user, isCreator }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const authToken = await getAuthToken();
      const endpoint = isCreator 
        ? `/api/tokens/analytics/creator?range=${timeRange}`
        : `/api/tokens/analytics/fan?range=${timeRange}`;
        
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('❌ Analytics fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>📊</div>
        <div>Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        <div style={{ fontSize: '24px', marginBottom: '20px' }}>📈</div>
        <div>No analytics data available</div>
      </div>
    );
  }

  const lineChartData = {
    labels: analytics.daily.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: isCreator ? 'Tokens Earned' : 'Tokens Spent',
        data: analytics.daily.map(d => d.tokens),
        borderColor: isCreator ? '#28a745' : '#007bff',
        backgroundColor: isCreator ? 'rgba(40, 167, 69, 0.1)' : 'rgba(0, 123, 255, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const barChartData = {
    labels: ['Video Calls', 'Voice Calls', 'Tips', 'Streams'],
    datasets: [
      {
        label: 'Tokens',
        data: [
          analytics.byType.video || 0,
          analytics.byType.voice || 0,
          analytics.byType.tips || 0,
          analytics.byType.streams || 0,
        ],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 205, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
        ],
      },
    ],
  };

  const doughnutData = {
    labels: analytics.topCreators?.map(c => c.name) || ['No data'],
    datasets: [
      {
        data: analytics.topCreators?.map(c => c.tokens) || [1],
        backgroundColor: [
          '#FF6384',
          '#36A2EB',
          '#FFCE56',
          '#4BC0C0',
          '#9966FF',
        ],
      },
    ],
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '30px' 
      }}>
        <h2 style={{ margin: 0, color: '#333' }}>
          📊 Token Analytics
        </h2>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>💎</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#007bff' }}>
            {analytics.summary.totalTokens.toLocaleString()}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Total Tokens {isCreator ? 'Earned' : 'Spent'}
          </div>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>💰</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#28a745' }}>
            ${analytics.summary.totalUsd.toFixed(2)}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Total USD Value
          </div>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>📈</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#fd7e14' }}>
            {analytics.summary.avgPerDay.toFixed(0)}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Avg Tokens/Day
          </div>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e9ecef',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>🎯</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#dc3545' }}>
            {analytics.summary.transactions}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            Total Transactions
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: '30px'
      }}>
        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>
            Daily Token Activity
          </h3>
          <Line data={lineChartData} options={{ responsive: true }} />
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e9ecef'
        }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>
            Tokens by Activity Type
          </h3>
          <Bar data={barChartData} options={{ responsive: true }} />
        </div>

        {!isCreator && analytics.topCreators && (
          <div style={{
            padding: '20px',
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e9ecef'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>
              Top Creators (Tokens Spent)
            </h3>
            <div style={{ maxWidth: '300px', margin: '0 auto' }}>
              <Doughnut data={doughnutData} options={{ responsive: true }} />
            </div>
          </div>
        )}
      </div>

      {/* Recent Transactions */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        backgroundColor: '#fff',
        borderRadius: '12px',
        border: '1px solid #e9ecef'
      }}>
        <h3 style={{ marginBottom: '20px', color: '#333' }}>
          Recent Transactions
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Date</th>
                <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #dee2e6' }}>Type</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>Tokens</th>
                <th style={{ padding: '12px', textAlign: 'right', border: '1px solid #dee2e6' }}>USD Value</th>
                <th style={{ padding: '12px', textAlign: 'center', border: '1px solid #dee2e6' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {analytics.recentTransactions.map((transaction, index) => (
                <tr key={index}>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6' }}>
                    {transaction.type}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    border: '1px solid #dee2e6', 
                    textAlign: 'right',
                    color: transaction.type === 'purchase' ? '#28a745' : '#dc3545'
                  }}>
                    {transaction.type === 'purchase' ? '+' : '-'}{transaction.tokens.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'right' }}>
                    ${transaction.amount_usd?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '12px', border: '1px solid #dee2e6', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: transaction.status === 'completed' ? '#d4edda' : '#fff3cd',
                      color: transaction.status === 'completed' ? '#155724' : '#856404'
                    }}>
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TokenAnalytics;